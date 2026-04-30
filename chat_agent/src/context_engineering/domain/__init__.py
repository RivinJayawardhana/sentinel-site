"""
Domain layer - core business logic.

Contains:
- models: Domain data models
- utils: Helper functions
- prompts: Prompt templates
- tools: Custom tools
"""

from .models import Document, Chunk, Evidence, RAGQuery, RAGResponse
from .utils import format_docs, calculate_confidence, extract_citations, truncate_text

__all__ = [
    # Models
    "Document",
    "Chunk",
    "Evidence",
    "RAGQuery",
    "RAGResponse",
    # Utils
    "format_docs",
    "calculate_confidence",
    "extract_citations",
    "truncate_text",
]
