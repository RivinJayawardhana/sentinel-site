"""
Agent Orchestrator — LangGraph Multi-Agent State Machine.

Week 10 refactor: the Week 7 linear orchestrator is now a LangGraph StateGraph
with multi-route fan-out support.

Architecture (Supervisor-Worker pattern with fan-out):
    recall → supervisor → [admin_agent, clinical_agent, direct_agent]  (1 or more in parallel)
                                  ↘         ↓         ↙
                              merge_responses  (fan-in + synthesize)
                                      ↓
                              save_memory → END

Multi-route support:
    When a user asks a compound question (e.g. "Check my appointments AND
    what's the infection control policy?"), the router returns multiple
    RouteDecisions. The supervisor fans out to the relevant agent nodes
    in parallel via LangGraph's native fan-out. The merge_responses node
    combines all agent outputs into one coherent answer.

    For single-route queries (the common case), only one agent runs and
    merge_responses passes through without an extra LLM call.

Prompt management:
    Sub-agent prompts (admin, clinical, direct, merge) are defined in
    agents/prompts/agent_prompts.py with local JSON prompts + in-code fallbacks.
"""

import time
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

from loguru import logger
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END

from agents.state import AgentState
from agents.router import QueryRouter, RouteDecision, MultiRouteDecision
from agents.prompts.agent_prompts import (
    build_admin_agent_prompt,
    build_clinical_agent_prompt,
    build_direct_agent_prompt,
    build_merge_prompt,
)
from memory.schemas import ConversationTurn
from infrastructure.observability import (
    observe,
    update_current_trace,
    update_current_observation,
)


@dataclass
class AgentResponse:
    """
    Complete agent response with metadata for the UI/Notebooks.
    """
    answer: str
    route: str = "direct"
    routes: List[str] = field(default_factory=list)   # all routes taken (multi-route)
    action: Optional[str] = None
    tool_output: str = ""
    memory_context: str = ""
    latency_ms: int = 0


class AgentOrchestrator:
    """
    Orchestrates the multi-agent system using a LangGraph StateGraph.

    Supports both single-route and multi-route (fan-out) queries.
    """
    WRITE_ACTIONS = {
        "set_alert_status",
        "update_thresholds",
        "update_notifications",
        "update_device",
    }

    CONFIRM_PHRASES = (
        "confirm",
        "confirmed",
        "proceed",
        "go ahead",
        "apply it",
        "do it",
        "yes",
    )

    def __init__(
        self,
        llm_chat: Any,
        llm_router: Any,
        st_store: Any,
        lt_store: Any,
        recaller: Any,
        distiller: Any,
        crm_tool: Optional[Any] = None,
        rag_tool: Optional[Any] = None,
        web_tool: Optional[Any] = None,
    ) -> None:
        self.llm_chat = llm_chat
        self.st_store = st_store
        self.lt_store = lt_store
        self.recaller = recaller
        self.distiller = distiller

        self.crm_tool = crm_tool
        self.rag_tool = rag_tool
        self.web_tool = web_tool

        self.router = QueryRouter(llm_router)

        # Build the graph
        self.graph = self._build_graph()

    # ── Graph Construction ──────────────────────────────────────────

    def _build_graph(self) -> StateGraph:
        """
        Construct the LangGraph state machine.

        Topology:
            recall → supervisor → [admin | clinical | direct]  (fan-out)
                                        ↘     ↓     ↙
                                     merge_responses  (fan-in)
                                           ↓
                                      save_memory → END
        """
        workflow = StateGraph(AgentState)

        # 1. Define Nodes
        workflow.add_node("recall", self.recall_node)
        workflow.add_node("supervisor", self.supervisor_node)
        workflow.add_node("admin_agent", self.admin_agent_node)
        workflow.add_node("clinical_agent", self.clinical_agent_node)
        workflow.add_node("direct_agent", self.direct_agent_node)
        workflow.add_node("merge_responses", self.merge_responses_node)
        workflow.add_node("save_memory", self.store_and_distill_node)

        # 2. Define Edges (The Pipeline)
        workflow.set_entry_point("recall")
        workflow.add_edge("recall", "supervisor")

        # Conditional routing from Supervisor (supports fan-out)
        # supervisor_routing() returns str for single-route, list[str] for multi-route
        workflow.add_conditional_edges(
            "supervisor",
            self.supervisor_routing,
            {
                "admin": "admin_agent",
                "clinical": "clinical_agent",
                "direct": "direct_agent"
            }
        )

        # All agents converge to merge_responses (fan-in point)
        workflow.add_edge("admin_agent", "merge_responses")
        workflow.add_edge("clinical_agent", "merge_responses")
        workflow.add_edge("direct_agent", "merge_responses")

        # Merge → save → end
        workflow.add_edge("merge_responses", "save_memory")
        workflow.add_edge("save_memory", END)

        return workflow.compile()

    # ── Node Implementations ────────────────────────────────────────

    @observe(name="node_recall")
    def recall_node(self, state: AgentState) -> Dict:
        """Reads conversation history and long-term facts into the state."""
        user_message = state["messages"][-1].content
        user_id = state["user_id"]
        session_id = state["session_id"]

        try:
            st_turns, lt_facts = self.recaller.recall(
                user_id=user_id,
                session_id=session_id,
                query=user_message
            )
            memory_context = self.recaller.format_context(st_turns)
            semantic_facts = [f.to_dict() if hasattr(f, 'to_dict') else vars(f) for f in lt_facts]

            return {
                "memory_context": memory_context,
                "semantic_facts": semantic_facts
            }
        except Exception as e:
            logger.warning(f"Recall node failed: {e}")
            return {"memory_context": "(memory offline)"}

    @observe(name="node_supervisor")
    def supervisor_node(self, state: AgentState) -> Dict:
        """
        Classifies intent and chooses which specialized agent(s) to call.

        For multi-intent queries, returns multiple route decisions so the
        graph can fan out to parallel agent nodes.
        """
        user_message = state["messages"][-1].content
        memory_context = state.get("memory_context", "")

        # Augment context with LT facts for the Router
        facts = state.get("semantic_facts", [])
        if facts:
            memory_context += "\n=== LONG-TERM FACTS ===\n"
            for f in facts:
                memory_context += f"- {f.get('text', '')}\n"

        # Router now returns MultiRouteDecision
        multi_decision = self.router.route(user_message, memory_context)

        # Serialise all decisions for the state
        route_decisions = [
            {
                "route": d.route,
                "action": d.action,
                "params": d.params or {},
                "reasoning": d.reasoning,
            }
            for d in multi_decision.decisions
        ]

        return {
            # Full list of decisions (multi-route)
            "route_decisions": route_decisions,
            # Primary decision (backward compat)
            "route_decision": route_decisions[0],
        }

    def supervisor_routing(self, state: AgentState) -> Union[str, List[str]]:
        """
        Map RouteDecision route strings to graph node names.

        Router outputs:  crm | rag | web_search | direct
        Graph nodes:     admin_agent | clinical_agent | direct_agent

        Returns a single string for single-route (standard conditional edge)
        or a list of strings for multi-route (LangGraph fan-out).

        Note: web_search is handled by direct_agent, which checks
        route_decision internally to decide whether to call Tavily.
        """
        route_map = {
            "crm": "admin",
            "rag": "clinical",
            "web_search": "direct",
            "direct": "direct",
        }

        decisions = self._normalize_route_decisions(
            state.get("route_decisions"),
            fallback=state.get("route_decision"),
        )
        if not decisions:
            return "direct"

        # Map routes to node names, deduplicate, preserve order
        node_names = []
        seen = set()
        for d in decisions:
            node = route_map.get(d.get("route", "direct"), "direct")
            if node not in seen:
                node_names.append(node)
                seen.add(node)

        # Single route → return string (no fan-out)
        # Multiple routes → return list (LangGraph fan-out)
        if len(node_names) == 1:
            return node_names[0]
        return node_names

    @observe(name="node_admin_agent")
    def admin_agent_node(self, state: AgentState) -> Dict:
        """Specialized Agent for operational DB actions."""
        # Find the CRM-specific decision from route_decisions
        decisions = self._normalize_route_decisions(
            state.get("route_decisions"),
            fallback=state.get("route_decision"),
        )
        crm_decision = next(
            (d for d in decisions if d.get("route") == "crm"),
            self._normalize_route_decisions(state.get("route_decision"))[0],
        )
        action = crm_decision.get("action", "get_live_snapshot")
        params = crm_decision.get("params", {})
        user_message = state["messages"][-1].content

        system_prompt = build_admin_agent_prompt()

        if self._is_remove_worker_intent(user_message):
            unsupported = (
                "Removing/deleting workers is not supported by the current backend API. "
                "Supported write actions are alert status, thresholds, notifications, and device updates."
            )
            return {
                "messages": [AIMessage(content=unsupported)],
                "tool_output": unsupported,
                "final_answer": unsupported,
                "agent_outputs": [{"route": "crm", "tool_output": unsupported, "answer": unsupported}],
            }

        if self._is_write_action(action) and not self._has_explicit_confirmation(user_message, params):
            confirmation_msg = self._build_write_confirmation_message(action, params)
            return {
                "messages": [AIMessage(content=confirmation_msg)],
                "tool_output": confirmation_msg,
                "final_answer": confirmation_msg,
                "agent_outputs": [{"route": "crm", "tool_output": confirmation_msg, "answer": confirmation_msg}],
            }

        if self._is_write_action(action):
            params = dict(params or {})
            params.setdefault("confirm", True)

        if not self.crm_tool:
            tool_output = "Operations DB tool unavailable."
        else:
            try:
                tool_output = self.crm_tool.dispatch(action, params)
            except Exception as e:
                logger.warning(f"Operations DB tool failed: {e}")
                tool_output = f"Operations DB tool error: {e}"

        answer = self._generate_agent_response(state, system_prompt, tool_output)

        return {
            "messages": [AIMessage(content=answer)],
            "tool_output": tool_output,
            "final_answer": answer,
            "agent_outputs": [{"route": "crm", "tool_output": tool_output, "answer": answer}],
        }

    @observe(name="node_clinical_agent")
    def clinical_agent_node(self, state: AgentState) -> Dict:
        """Specialized Agent for Medical Info and Patient History."""
        # Find the RAG-specific decision from route_decisions
        decisions = self._normalize_route_decisions(
            state.get("route_decisions"),
            fallback=state.get("route_decision"),
        )
        rag_decision = next(
            (d for d in decisions if d.get("route") == "rag"),
            self._normalize_route_decisions(state.get("route_decision"))[0],
        )
        params = rag_decision.get("params", {})
        query = params.get("query", state["messages"][-1].content)

        system_prompt = build_clinical_agent_prompt()

        # Inject semantic facts for clinical context
        facts = state.get("semantic_facts", [])
        kb_context = ""
        if facts:
            kb_context += "\n=== PATIENT CLINICAL HISTORY ===\n"
            for f in facts:
                kb_context += f"- {f.get('text', '')}\n"

        if not self.rag_tool:
            tool_output = "RAG Tool unavailable."
            answer = (
                "I cannot access the internal knowledge base right now. "
                "For live worker/device/alert data, please ask an operational query "
                "(for example: 'show EMP001 latest status')."
            )
            return {
                "messages": [AIMessage(content=answer)],
                "tool_output": tool_output,
                "final_answer": answer,
                "agent_outputs": [{"route": "rag", "tool_output": tool_output, "answer": answer}],
            }
        else:
            try:
                tool_output = self.rag_tool.dispatch("search", {"query": query})
            except Exception as e:
                logger.warning(f"RAG tool failed: {e}")
                tool_output = f"RAG tool error: {e}"
                answer = (
                    "I could not query the internal knowledge base due to a tool error. "
                    "Please retry, or ask for operational data via CRM actions."
                )
                return {
                    "messages": [AIMessage(content=answer)],
                    "tool_output": tool_output,
                    "final_answer": answer,
                    "agent_outputs": [{"route": "rag", "tool_output": tool_output, "answer": answer}],
                }

        answer = self._generate_agent_response(state, system_prompt, tool_output, extra_context=kb_context)

        return {
            "messages": [AIMessage(content=answer)],
            "tool_output": tool_output,
            "final_answer": answer,
            "agent_outputs": [{"route": "rag", "tool_output": tool_output, "answer": answer}],
        }

    @observe(name="node_direct_agent")
    def direct_agent_node(self, state: AgentState) -> Dict:
        """Specialized Agent for greetings and general inquiries."""
        system_prompt = build_direct_agent_prompt()

        # Check if any decision routes to web_search
        decisions = self._normalize_route_decisions(
            state.get("route_decisions"),
            fallback=state.get("route_decision"),
        )
        web_decision = next(
            (d for d in decisions if d.get("route") == "web_search"),
            None
        )

        tool_output = ""
        route_label = "direct"
        if web_decision and self.web_tool:
            params = web_decision.get("params", {})
            query = params.get("query", state["messages"][-1].content)
            try:
                tool_output = self.web_tool.dispatch("search", {"query": query})
                route_label = "web_search"
            except Exception as e:
                logger.warning(f"Web search tool failed: {e}")
                tool_output = f"Web search tool error: {e}"

        answer = self._generate_agent_response(state, system_prompt, tool_output)

        return {
            "messages": [AIMessage(content=answer)],
            "tool_output": tool_output,
            "final_answer": answer,
            "agent_outputs": [{"route": route_label, "tool_output": tool_output, "answer": answer}],
        }

    @observe(name="node_merge_responses")
    def merge_responses_node(self, state: AgentState) -> Dict:
        """
        Fan-in node: merges outputs from parallel agent nodes.

        Single-route:  passes through (no extra LLM call, zero latency overhead).
        Multi-route:   calls the merge synthesiser to produce one coherent response.
        """
        agent_outputs = state.get("agent_outputs", [])

        # Single agent → pass through (backward compatible, no overhead)
        if len(agent_outputs) <= 1:
            return {}

        # Multi-agent → synthesize into one response
        logger.info(f"Merging {len(agent_outputs)} agent outputs into unified response")

        user_message = state["messages"][0].content
        memory_context = state.get("memory_context", "")

        # Build labelled tool output sections for the synthesiser
        combined_tool_output = ""
        for out in agent_outputs:
            route = out.get("route", "unknown").upper()
            answer = out.get("answer", "")
            combined_tool_output += f"=== {route} AGENT RESULT ===\n{answer}\n\n"

        system_prompt = build_merge_prompt()

        system_content = (
            f"{system_prompt}\n\n"
            f"=== MEMORY CONTEXT ===\n{memory_context}\n\n"
            f"=== AGENT RESULTS TO MERGE ===\n{combined_tool_output}"
        )

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_message),
        ]

        response = self.llm_chat.invoke(messages)
        merged_answer = response.content if hasattr(response, "content") else str(response)

        # Combine all tool outputs
        all_tool_output = "\n---\n".join(
            out.get("tool_output", "") for out in agent_outputs if out.get("tool_output")
        )

        return {
            "final_answer": merged_answer,
            "tool_output": all_tool_output,
            "messages": [AIMessage(content=merged_answer)],
        }

    @observe(name="node_save_memory")
    def store_and_distill_node(self, state: AgentState) -> Dict:
        """Saves messages to short-term and extracts long-term facts."""
        user_message = state["messages"][0].content
        answer = state["final_answer"]
        user_id = state["user_id"]
        session_id = state["session_id"]

        # Store ST turns (best-effort: memory can be offline in local/dev mode)
        now = time.time()
        try:
            self.st_store.add(
                user_id,
                session_id,
                ConversationTurn(
                    user_id=user_id,
                    session_id=session_id,
                    role="user",
                    content=user_message,
                    ts=now,
                ),
            )
            self.st_store.add(
                user_id,
                session_id,
                ConversationTurn(
                    user_id=user_id,
                    session_id=session_id,
                    role="assistant",
                    content=answer,
                    ts=now,
                ),
            )
        except Exception as e:
            logger.warning(f"Short-term memory store unavailable: {e}")
            return {"should_distill": False}

        # Distill if needed
        try:
            recent = self.st_store.recent(user_id, session_id, k=5)
            if self.distiller.should_distill(recent):
                logger.info(f"Distilling new facts for {user_id}...")
                self.distiller.distill(user_id, recent)
                return {"should_distill": True}
        except Exception as e:
            logger.warning(f"Distillation failed: {e}")

        return {"should_distill": False}

    # ── Core Helpers ──────────────────────────────────────────────

    def _generate_agent_response(self, state: AgentState, system_prompt: str, tool_output: str, extra_context: str = "") -> str:
        """
        Standard LLM call for all sub-agents.

        Each sub-agent calls its prompt builder (e.g. build_admin_agent_prompt())
        which loads from local prompt templates.
        The system_prompt passed here is already fully composed.
        """
        user_message = state["messages"][-1].content
        memory_context = state.get("memory_context", "") + extra_context

        system_content = (
            f"{system_prompt}\n\n"
            f"=== MEMORY CONTEXT ===\n{memory_context}\n\n"
            f"=== TOOL OUTPUT ===\n{tool_output}"
        )

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_message),
        ]

        response = self.llm_chat.invoke(messages)
        return response.content if hasattr(response, "content") else str(response)

    @staticmethod
    def _normalize_route_decisions(raw: Any, fallback: Any = None) -> List[Dict[str, Any]]:
        """
        Normalise route decisions to a list[dict] across old/new state shapes.

        Handles:
        - list[dict] (expected)
        - dict (single decision)
        - str route labels from legacy/partial state (e.g. "direct")
        """
        normalized: List[Dict[str, Any]] = []

        def _append(item: Any) -> None:
            if isinstance(item, dict):
                params = item.get("params")
                normalized.append(
                    {
                        "route": item.get("route", "direct"),
                        "action": item.get("action"),
                        "params": params if isinstance(params, dict) else {},
                        "reasoning": item.get("reasoning", ""),
                    }
                )
                return

            if isinstance(item, str):
                route = item.strip().lower()
                if route in {"crm", "rag", "web_search", "direct"}:
                    normalized.append(
                        {
                            "route": route,
                            "action": None,
                            "params": {},
                            "reasoning": "legacy route string",
                        }
                    )

        if isinstance(raw, list):
            for entry in raw:
                _append(entry)
        else:
            _append(raw)

        if not normalized and fallback is not None:
            if isinstance(fallback, list):
                for entry in fallback:
                    _append(entry)
            else:
                _append(fallback)

        if not normalized:
            normalized.append(
                {
                    "route": "direct",
                    "action": None,
                    "params": {},
                    "reasoning": "route fallback",
                }
            )

        return normalized

    @classmethod
    def _is_write_action(cls, action: Optional[str]) -> bool:
        return isinstance(action, str) and action in cls.WRITE_ACTIONS

    @classmethod
    def _has_explicit_confirmation(cls, user_message: str, params: Dict[str, Any]) -> bool:
        if isinstance(params, dict):
            for key in ("confirm", "confirmed", "approval"):
                value = params.get(key)
                if isinstance(value, bool) and value:
                    return True
                if isinstance(value, str) and value.strip().lower() in {"true", "yes", "1"}:
                    return True

        text = (user_message or "").strip().lower()
        if not text:
            return False

        return any(phrase in text for phrase in cls.CONFIRM_PHRASES)

    @staticmethod
    def _build_write_confirmation_message(action: str, params: Dict[str, Any]) -> str:
        details = ", ".join(f"{k}={v}" for k, v in (params or {}).items())
        if not details:
            details = "no parameters parsed"
        return (
            f"Confirmation required before executing '{action}'. "
            f"Parsed details: {details}. "
            "Reply with an explicit confirmation (for example: 'confirm and proceed')."
        )

    @staticmethod
    def _is_remove_worker_intent(user_message: str) -> bool:
        text = (user_message or "").lower()
        if not text:
            return False
        has_remove = any(token in text for token in ("remove", "delete"))
        has_worker = any(token in text for token in ("worker", "employee", "emp"))
        return has_remove and has_worker

    # ── Entry Point ───────────────────────────────────────────────

    @observe(name="agent_chat")
    def chat(self, user_message: str, user_id: str, session_id: str) -> AgentResponse:
        """Run the graph for one interaction."""
        t0 = time.time()

        initial_state = {
            "messages": [HumanMessage(content=user_message)],
            "user_id": user_id,
            "session_id": session_id,
            "agent_outputs": [],  # initialise the fan-out collector
        }

        # Run the LangGraph state machine
        final_state = self.graph.invoke(initial_state)

        latency = int((time.time() - t0) * 1000)

        # Extract all routes taken
        route_decisions = self._normalize_route_decisions(
            final_state.get("route_decisions"),
            fallback=final_state.get("route_decision"),
        )
        all_routes = [d.get("route", "direct") for d in route_decisions]
        primary = route_decisions[0] if route_decisions else {"route": "direct"}

        return AgentResponse(
            answer=final_state["final_answer"],
            route=primary.get("route", "direct"),
            routes=all_routes,
            action=primary.get("action"),
            tool_output=final_state.get("tool_output", ""),
            memory_context=final_state.get("memory_context", ""),
            latency_ms=latency
        )

    # ── Async Entry Point (for FastAPI) ──────────────────────────

    async def achat(self, user_message: str, user_id: str, session_id: str) -> AgentResponse:
        """
        Async version of chat() — uses graph.ainvoke() for non-blocking execution.

        Identical logic to chat(), but awaits ainvoke() so the FastAPI event
        loop isn't blocked during LLM calls.  Notebooks can keep using chat().
        """
        t0 = time.time()

        initial_state = {
            "messages": [HumanMessage(content=user_message)],
            "user_id": user_id,
            "session_id": session_id,
            "agent_outputs": [],
        }

        # Non-blocking graph execution
        final_state = await self.graph.ainvoke(initial_state)

        latency = int((time.time() - t0) * 1000)

        route_decisions = self._normalize_route_decisions(
            final_state.get("route_decisions"),
            fallback=final_state.get("route_decision"),
        )
        all_routes = [d.get("route", "direct") for d in route_decisions]
        primary = route_decisions[0] if route_decisions else {"route": "direct"}

        return AgentResponse(
            answer=final_state["final_answer"],
            route=primary.get("route", "direct"),
            routes=all_routes,
            action=primary.get("action"),
            tool_output=final_state.get("tool_output", ""),
            memory_context=final_state.get("memory_context", ""),
            latency_ms=latency
        )


# ── Factory function ──────────────────────────────────────────

def build_agent(enable_crm: bool = True, enable_rag: bool = True, enable_web: bool = True) -> AgentOrchestrator:
    """Builds the Multi-Agent Orchestrator."""
    from infrastructure.llm import get_chat_llm, get_router_llm, get_extractor_llm, get_default_embeddings
    from memory.st_store import ShortTermMemoryStore
    from memory.lt_store import LongTermMemoryStore
    from memory.memory_ops import MemoryRecaller, MemoryDistiller

    llm_chat = get_chat_llm(temperature=0)
    llm_router = get_router_llm(temperature=0)
    llm_extractor = get_extractor_llm(temperature=0)
    embedder = get_default_embeddings()

    st_store = ShortTermMemoryStore()
    lt_store = LongTermMemoryStore(embedder)
    recaller = MemoryRecaller(st_store, lt_store)
    distiller = MemoryDistiller(llm_extractor, lt_store)

    crm_tool = None
    if enable_crm:
        try:
            from agents.tools import CRMTool
            crm_tool = CRMTool()
            logger.info("Operations DB tool initialised")
        except Exception as e:
            logger.warning(f"Operations DB tool unavailable: {e}")

    rag_tool = None
    if enable_rag:
        try:
            from agents.tools import RAGTool
            rag_tool = RAGTool(embedder=embedder, llm=llm_chat)
            logger.info("RAG tool initialised")
        except Exception as e:
            logger.warning(f"RAG tool unavailable: {e}")

    web_tool = None
    if enable_web:
        try:
            from agents.tools import WebSearchTool
            web_tool = WebSearchTool()
            logger.info("Web search tool initialised")
        except Exception as e:
            logger.warning(f"Web search tool unavailable: {e}")

    return AgentOrchestrator(
        llm_chat=llm_chat,
        llm_router=llm_router,
        st_store=st_store,
        lt_store=lt_store,
        recaller=recaller,
        distiller=distiller,
        crm_tool=crm_tool,
        rag_tool=rag_tool,
        web_tool=web_tool
    )
