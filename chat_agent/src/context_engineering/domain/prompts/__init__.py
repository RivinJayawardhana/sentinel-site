"""
Prompt templates for RAG.

Contains:
- rag_templates: RAG prompt templates and system headers
"""

from .rag_templates import (
    RAG_TEMPLATE,
    SYSTEM_HEADER,
    EVIDENCE_SLOT,
    USER_SLOT,
    ASSISTANT_GUIDANCE,
    build_rag_prompt,
    build_system_message,
)

__all__ = [
    "RAG_TEMPLATE",
    "SYSTEM_HEADER",
    "EVIDENCE_SLOT",
    "USER_SLOT",
    "ASSISTANT_GUIDANCE",
    "build_rag_prompt",
    "build_system_message",
]
