"""
Query Router — LLM-based intent classification.

Takes a user message + memory context and returns a ``MultiRouteDecision``
containing one or more ``RouteDecision`` objects.  When the user query
contains multiple independent intents (e.g. "Check my appointments AND
what is the infection control policy?") the router returns multiple
routes so the orchestrator can fan out to parallel agent nodes.
"""

import json
import re
from loguru import logger
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from agents.prompts.agent_prompts import build_router_prompt
from infrastructure.observability import observe, update_current_observation

# Valid routes
VALID_ROUTES = {"crm", "rag", "web_search", "direct"}

# Valid CRM sub-actions
VALID_CRM_ACTIONS = {
    "get_live_snapshot",
    "get_worker_latest",
    "get_worker_history",
    "get_worker_alerts",
    "list_zones",
    "get_thresholds",
    "set_alert_status",
    "update_thresholds",
    "update_notifications",
    "update_device",
}

# Maximum routes per query (safety cap)
MAX_ROUTES = 3


@dataclass
class RouteDecision:
    """
    A single routing decision for one intent.

    Attributes:
        route: Primary route (crm | rag | web_search | direct).
        confidence: Router's self-assessed confidence [0-1].
        reasoning: One-line explanation of the routing decision.
        action: CRM sub-action (only when route == crm).
        params: Extracted parameters for the tool.
    """

    route: str = "direct"
    confidence: float = 0.0
    reasoning: str = ""
    action: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MultiRouteDecision:
    """
    Container for one or more RouteDecision objects.

    Single-intent queries produce ``decisions`` with one element.
    Multi-intent queries (e.g. "book me an appointment AND tell me
    about infection control") produce multiple elements, enabling
    LangGraph fan-out to parallel agent nodes.
    """

    decisions: List[RouteDecision] = field(default_factory=list)

    @property
    def is_multi_route(self) -> bool:
        return len(self.decisions) > 1

    @property
    def primary(self) -> RouteDecision:
        """First (or only) decision — backward compatibility."""
        return self.decisions[0] if self.decisions else RouteDecision()


class QueryRouter:
    """
    Routes user queries to the appropriate tool path.

    Uses an LLM call with structured JSON output to classify intent.
    Falls back to ``direct`` on parse errors.
    """

    def __init__(self, llm: Any) -> None:
        """
        Args:
            llm: A LangChain ``ChatOpenAI`` (or compatible) instance.
        """
        self.llm = llm

    @observe(name="router", as_type="generation")
    def route(
        self,
        user_message: str,
        memory_context: str = "",
    ) -> MultiRouteDecision:
        """
        Classify user intent and extract parameters.

        Returns a ``MultiRouteDecision`` containing one or more
        ``RouteDecision`` objects.  For most queries only one route
        is returned; multi-route is triggered only when the user
        asks clearly separate questions in one message.

        Traced as a LangFuse **generation** so cost/tokens are captured.
        """
        heuristic = self._heuristic_route(user_message)
        if heuristic is not None:
            return MultiRouteDecision(decisions=[heuristic])

        system_prompt, user_prompt = build_router_prompt(
            user_message=user_message,
            memory_context=memory_context,
        )

        update_current_observation(
            input=user_prompt[:1000],
            model=self._model_name(),
        )

        try:
            response = self.llm.invoke(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
            )
            content = (
                response.content
                if hasattr(response, "content")
                else str(response)
            )

            # Extract token usage if available
            usage = {}
            if hasattr(response, "response_metadata"):
                meta = response.response_metadata or {}
                token_usage = meta.get("token_usage") or meta.get("usage", {})
                if token_usage:
                    usage = {
                        "input": token_usage.get("prompt_tokens", 0),
                        "output": token_usage.get("completion_tokens", 0),
                        "total": token_usage.get("total_tokens", 0),
                    }

            update_current_observation(
                output=content[:500],
                usage=usage if usage else None,
            )

        except Exception as exc:
            logger.error("Router LLM call failed: {}", exc)
            return MultiRouteDecision(decisions=[
                RouteDecision(
                    route="direct",
                    confidence=0.0,
                    reasoning=f"Router LLM error: {exc}",
                )
            ])

        return self._parse_response(content)

    @staticmethod
    def _extract_employee_id(text: str) -> Optional[str]:
        m = re.search(r"\bEMP\d+\b", text, flags=re.IGNORECASE)
        return m.group(0).upper() if m else None

    @staticmethod
    def _extract_device_id(text: str) -> Optional[str]:
        m = re.search(r"\bDEV[-_A-Z0-9]+\b", text, flags=re.IGNORECASE)
        return m.group(0).upper() if m else None

    @staticmethod
    def _has_confirmation(text: str) -> bool:
        lowered = text.lower()
        return any(
            phrase in lowered
            for phrase in ("confirm", "confirmed", "proceed", "go ahead", "yes, do it", "yes do it")
        )

    def _heuristic_route(self, user_message: str) -> Optional[RouteDecision]:
        """
        Deterministic routing for high-signal operational queries.

        This prevents stale memory context from overriding explicit IDs/actions
        in the user's current message.
        """
        text = (user_message or "").strip()
        if not text:
            return None

        lowered = text.lower()
        employee_id = self._extract_employee_id(text)
        device_id = self._extract_device_id(text)

        doc_intent_markers = (
            "policy",
            "documentation",
            "document",
            "manual",
            "guideline",
            "kb",
            "knowledge base",
        )
        if any(marker in lowered for marker in doc_intent_markers):
            return RouteDecision(
                route="rag",
                confidence=0.92,
                reasoning="Heuristic: documentation/policy query.",
                action=None,
                params={"query": text},
            )

        realtime = any(
            marker in lowered
            for marker in ("now", "today", "current", "live", "latest", "new")
        )

        # Device update / assignment intent
        if ("update" in lowered or "change" in lowered or "set" in lowered) and "device" in lowered and (employee_id or device_id):
            params: Dict[str, Any] = {}
            if employee_id:
                params["employee_id"] = employee_id
            if device_id:
                params["device_id"] = device_id
            params["confirmed"] = self._has_confirmation(text)
            return RouteDecision(
                route="crm",
                confidence=0.98,
                reasoning="Heuristic: device update action.",
                action="update_device",
                params=params,
            )

        # Alerts intent
        if "alert" in lowered:
            params = {}
            if employee_id:
                params["employee_id"] = employee_id
            if realtime:
                params["realtime"] = True
            return RouteDecision(
                route="crm",
                confidence=0.97,
                reasoning="Heuristic: alert lookup query.",
                action="get_worker_alerts",
                params=params,
            )

        # Worker/device/status telemetry intent
        worker_markers = (
            "device id",
            "device",
            "worker",
            "employee",
            "status",
            "heart rate",
            "temperature",
            "temp",
            "aqi",
            "shift",
            "zone",
            "telemetry",
        )
        if employee_id or any(marker in lowered for marker in worker_markers):
            params = {}
            if employee_id:
                params["employee_id"] = employee_id
            if realtime:
                params["realtime"] = True

            action = "get_worker_latest"
            if "history" in lowered or "trend" in lowered:
                action = "get_worker_history"
            elif "threshold" in lowered:
                action = "get_thresholds"
            elif ("zone" in lowered or "zones" in lowered) and not employee_id:
                action = "list_zones"

            return RouteDecision(
                route="crm",
                confidence=0.96,
                reasoning="Heuristic: operational worker telemetry query.",
                action=action,
                params=params,
            )

        return None

    def _model_name(self) -> str:
        """Extract model name from the LLM for LangFuse metadata."""
        if hasattr(self.llm, "model_name"):
            return self.llm.model_name
        if hasattr(self.llm, "model"):
            return self.llm.model
        return "unknown"

    # ── parsing ───────────────────────────────────────────────

    def _parse_response(self, raw: str) -> MultiRouteDecision:
        """
        Parse the JSON response from the router LLM.

        Supports two formats:
          - Multi-route (new):  ``{"routes": [{...}, {...}]}``
          - Single-route (old): ``{"route": "crm", ...}``

        The old format is auto-wrapped into a single-element list
        for full backward compatibility.
        """
        # Strip markdown fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        # Locate JSON object boundaries
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            logger.warning("Router output is not JSON; falling back to direct.")
            return MultiRouteDecision(decisions=[
                RouteDecision(route="direct", confidence=0.0,
                              reasoning="Failed to parse router output as JSON.")
            ])

        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            logger.warning("Router JSON parse error: {}", exc)
            return MultiRouteDecision(decisions=[
                RouteDecision(route="direct", confidence=0.0,
                              reasoning=f"JSON parse error: {exc}")
            ])

        # ── Normalise to a list of route dicts ──────────────────
        if "routes" in data and isinstance(data["routes"], list):
            # New multi-route format
            route_dicts = data["routes"][:MAX_ROUTES]
        else:
            # Old single-route format — wrap in list
            route_dicts = [data]

        # ── Build RouteDecision objects ──────────────────────────
        decisions: List[RouteDecision] = []
        seen_routes: set = set()

        for rd in route_dicts:
            if isinstance(rd, str):
                rd = {"route": rd}
            if not isinstance(rd, dict):
                logger.warning("Invalid route decision payload type '{}'; skipping.", type(rd).__name__)
                continue

            raw_route = rd.get("route", "direct")
            action = rd.get("action")

            # Accept compact legacy shape: "crm/get_worker_alerts"
            if isinstance(raw_route, str) and "/" in raw_route:
                head, tail = raw_route.split("/", 1)
                raw_route = head.strip()
                if not action and tail:
                    action = tail.strip()

            route = raw_route
            if route not in VALID_ROUTES:
                logger.warning("Invalid route '{}'; skipping.", route)
                continue
            # Deduplicate (same route appearing twice)
            if route in seen_routes:
                continue
            seen_routes.add(route)

            if route == "crm" and action not in VALID_CRM_ACTIONS:
                logger.warning(
                    "Invalid CRM action '{}'; defaulting to get_live_snapshot.", action
                )
                action = "get_live_snapshot"

            params = rd.get("params", {})
            if not isinstance(params, dict):
                params = {}

            decisions.append(RouteDecision(
                route=route,
                confidence=float(rd.get("confidence", 0.5)),
                reasoning=rd.get("reasoning", ""),
                action=action if route == "crm" else None,
                params=params,
            ))

        # Fallback if nothing valid was parsed
        if not decisions:
            decisions = [RouteDecision(route="direct", confidence=0.0,
                                       reasoning="No valid routes parsed.")]

        return MultiRouteDecision(decisions=decisions)
