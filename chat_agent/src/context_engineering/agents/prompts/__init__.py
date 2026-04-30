"""
Agent prompt builders for router and synthesizer paths.

Prompts are loaded from ``config/prompts.json`` when available, with local
in-code fallbacks defined in ``agent_prompts.py``.
"""

from .agent_prompts import (
    build_router_prompt,
    build_synthesiser_prompt,
)

__all__ = [
    "build_router_prompt",
    "build_synthesiser_prompt",
]
