"""
Prompt templates for the routing-engine agent.

Prompt source priority:
1. Local JSON file: ``config/prompts.json``
2. In-code fallback templates

No LangFuse prompt fetch is used in this stage.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


_PROMPTS_PATH = Path(__file__).resolve().parents[4] / "config" / "prompts.json"
_PROMPTS_CACHE: Dict[str, str] | None = None


def _load_local_prompts() -> Dict[str, str]:
    global _PROMPTS_CACHE
    if _PROMPTS_CACHE is not None:
        return _PROMPTS_CACHE

    if not _PROMPTS_PATH.exists():
        _PROMPTS_CACHE = {}
        return _PROMPTS_CACHE

    try:
        data = json.loads(_PROMPTS_PATH.read_text(encoding="utf-8-sig"))
        if isinstance(data, dict):
            _PROMPTS_CACHE = {
                str(k): str(v) for k, v in data.items() if isinstance(v, str)
            }
        else:
            _PROMPTS_CACHE = {}
    except Exception:
        _PROMPTS_CACHE = {}

    return _PROMPTS_CACHE


def _render(template: str, **kwargs: Any) -> str:
    try:
        return template.format(**kwargs)
    except Exception:
        return template


def _get_prompt(key: str, fallback: str, **kwargs: Any) -> str:
    prompts = _load_local_prompts()
    template = prompts.get(key, fallback)
    return _render(template, **kwargs)


_AGENT_SYSTEM_FALLBACK = """\
You are SafeguardIoT Assistant, an operations AI for industrial worker monitoring.

Capabilities:
- Answer product and platform questions from internal knowledge base.
- Retrieve live and historical telemetry from the monitoring backend database.
- Check worker status, alerts, zones, thresholds, and incident state.
- Use web search only for external, time-sensitive information.

Rules:
1. Be concise, accurate, and operationally useful.
2. Never fabricate real-time values or IDs.
3. If data is missing, ask a targeted follow-up question.
4. Do not expose internal implementation details unless asked explicitly.
5. Any write operation must require explicit user confirmation.
"""

_ROUTER_SYSTEM_FALLBACK = """\
You are the query router for SafeguardIoT.

Classify the user message into one or more routes:
- crm: operational database actions via backend APIs
- rag: internal KB/documentation retrieval
- web_search: public web information
- direct: greeting/chitchat/simple conversation

For route=crm, extract one action:
- get_live_snapshot
- get_worker_latest
- get_worker_history
- get_worker_alerts
- list_zones
- get_thresholds
- set_alert_status
- update_thresholds
- update_notifications
- update_device

Output strict JSON:
{
  "routes": [
    {
      "route": "<crm|rag|web_search|direct>",
      "confidence": <0.0-1.0>,
      "reasoning": "<one sentence>",
      "action": "<action or null>",
      "params": { }
    }
  ]
}

Parameter rules:
- Use IDs/entities from USER MESSAGE first. Use MEMORY CONTEXT only for
  follow-ups like "yes", "continue", or missing references.
- For worker actions, use employee_id if available (e.g. EMP001).
- Queries asking worker/device/status/alerts for EMP IDs are operational and
  should route to crm (not rag).
- For history, include limit when requested.
- For live/current/now wording, include realtime=true.
- For set_alert_status: alert_id + status(active|acknowledged|resolved).
- For update_device: employee_id + device_id.
- For write actions (set_alert_status, update_thresholds, update_notifications, update_device),
  include confirmed=true only when user clearly confirms with words like
  "confirm", "proceed", "go ahead", or "yes, do it".
- If a write intent exists without confirmation, set confirmed=false.
- For rag/web_search routes, include params.query.
- For direct, params must be {}.

If action is uncertain for crm, use get_live_snapshot with best-effort params.

Examples:
- "Show EMP001 latest status now" -> crm/get_worker_latest with {employee_id:"EMP001", realtime:true}
- "Update EMP001 device to DEV-77" -> crm/update_device with {employee_id:"EMP001", device_id:"DEV-77", confirmed:false}
- "Confirm and update EMP001 device to DEV-77" -> crm/update_device with {employee_id:"EMP001", device_id:"DEV-77", confirmed:true}
"""

_ROUTER_USER_FALLBACK = """\
MEMORY CONTEXT:
{memory_context}

USER MESSAGE:
{user_message}

Classify and extract JSON:
"""

_SYNTHESISER_SYSTEM_FALLBACK = """\
You are the final response synthesiser for SafeguardIoT Assistant.
Use memory context and tool output to produce a natural, accurate reply.
Do not mention route names or tool internals.
"""

_SYNTHESISER_USER_FALLBACK = """\
MEMORY CONTEXT:
{memory_context}

ROUTE TAKEN: {route}
TOOL OUTPUT:
{tool_output}

USER MESSAGE:
{user_message}

Compose your response:
"""

_ADMIN_AGENT_FALLBACK = """\
You are the SafeguardIoT Operations Agent.
Focus on telemetry, alerts, zones, thresholds, and worker status.
If user asks for live data, prefer real-time sync first.
Keep output clear and actionable.
Never execute write operations unless explicit confirmation is present.
"""

_CLINICAL_AGENT_FALLBACK = """\
You are the SafeguardIoT Knowledge Agent.
Answer using internal docs and policies from the RAG tool.
If source confidence is weak, say so briefly and avoid over-claiming.
"""

_DIRECT_AGENT_FALLBACK = """\
You are the SafeguardIoT Assistant for direct conversation.
Handle greetings, simple follow-ups, and non-tool responses succinctly.
"""

_MERGE_SYNTHESISER_FALLBACK = """\
You merge outputs from multiple specialist agents into one coherent answer.
Cover all user asks in a compact response.
Do not label sections by internal route/tool names.
"""


def build_router_prompt(user_message: str, memory_context: str) -> tuple[str, str]:
    system_prompt = _get_prompt("router_system", _ROUTER_SYSTEM_FALLBACK)
    user_prompt = _get_prompt(
        "router_user",
        _ROUTER_USER_FALLBACK,
        memory_context=memory_context or "(no memory context)",
        user_message=user_message,
    )
    return system_prompt, user_prompt


def build_synthesiser_prompt(
    user_message: str,
    memory_context: str,
    route: str,
    tool_output: str,
) -> tuple[str, str]:
    agent_system = _get_prompt("agent_system", _AGENT_SYSTEM_FALLBACK)
    synth_system = _get_prompt("synthesiser_system", _SYNTHESISER_SYSTEM_FALLBACK)
    user_prompt = _get_prompt(
        "synthesiser_user",
        _SYNTHESISER_USER_FALLBACK,
        memory_context=memory_context or "(no memory context)",
        route=route,
        tool_output=tool_output or "(no tool output)",
        user_message=user_message,
    )
    return agent_system + "\n\n" + synth_system, user_prompt


def build_admin_agent_prompt() -> str:
    base = _get_prompt("agent_system", _AGENT_SYSTEM_FALLBACK)
    persona = _get_prompt("admin_agent", _ADMIN_AGENT_FALLBACK)
    return base + "\n\n" + persona


def build_clinical_agent_prompt() -> str:
    base = _get_prompt("agent_system", _AGENT_SYSTEM_FALLBACK)
    persona = _get_prompt("clinical_agent", _CLINICAL_AGENT_FALLBACK)
    return base + "\n\n" + persona


def build_direct_agent_prompt() -> str:
    base = _get_prompt("agent_system", _AGENT_SYSTEM_FALLBACK)
    persona = _get_prompt("direct_agent", _DIRECT_AGENT_FALLBACK)
    return base + "\n\n" + persona


def build_merge_prompt() -> str:
    base = _get_prompt("agent_system", _AGENT_SYSTEM_FALLBACK)
    merge = _get_prompt("merge_synthesiser", _MERGE_SYNTHESISER_FALLBACK)
    return base + "\n\n" + merge
