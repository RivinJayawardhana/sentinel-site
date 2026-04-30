"""
Context Engineering - Production RAG System

A production-ready Retrieval-Augmented Generation system following
the Zuu Crew AI Standard.

Features:
- Standard RAG with modern LangChain LCEL
- Cache-Augmented Generation (CAG) for instant responses
- Corrective RAG (CRAG) for self-correcting retrieval
- 5 chunking strategies (semantic, fixed, sliding, parent-child, late-chunk)
"""

__version__ = "0.1.0"
__author__ = "Context Engineering Team"

# Main exports
from .config import (
    # Paths
    DATA_DIR,
    CRAWL_OUT_DIR,
    VECTOR_DIR,
    MARKDOWN_DIR,
    CACHE_DIR,
    # LLM Config
    OPENAI_CHAT_MODEL,
    EMBEDDING_MODEL,
    # Chunking Config
    FIXED_CHUNK_SIZE,
    FIXED_CHUNK_OVERLAP,
    SEMANTIC_MAX_CHUNK_SIZE,
    SEMANTIC_MIN_CHUNK_SIZE,
    SLIDING_WINDOW_SIZE,
    SLIDING_STRIDE_SIZE,
    PARENT_CHUNK_SIZE,
    CHILD_CHUNK_SIZE,
    CHILD_OVERLAP,
    LATE_CHUNK_BASE_SIZE,
    LATE_CHUNK_SPLIT_SIZE,
    # Retrieval Config
    TOP_K_RESULTS,
    SIMILARITY_THRESHOLD,
    # CAG Config
    CAG_CACHE_TTL,
    CAG_CACHE_MAX_SIZE,
    # CRAG Config
    CRAG_CONFIDENCE_THRESHOLD,
    CRAG_EXPANDED_K,
    # Helper functions
    validate,
    dump,
)

from .domain import (
    # Models
    Document,
    Chunk,
    Evidence,
    RAGQuery,
    RAGResponse,
    # Utils
    format_docs,
    calculate_confidence,
    extract_citations,
    truncate_text,
)

from .infrastructure import (
    get_chat_llm,
    get_default_embeddings,
)

from .application import (
    ChunkingService,
)

__all__ = [
    # Version
    "__version__",
    "__author__",
    # Config
    "DATA_DIR",
    "CRAWL_OUT_DIR",
    "VECTOR_DIR",
    "MARKDOWN_DIR",
    "CACHE_DIR",
    "OPENAI_CHAT_MODEL",
    "EMBEDDING_MODEL",
    "FIXED_CHUNK_SIZE",
    "FIXED_CHUNK_OVERLAP",
    "SEMANTIC_MAX_CHUNK_SIZE",
    "SEMANTIC_MIN_CHUNK_SIZE",
    "SLIDING_WINDOW_SIZE",
    "SLIDING_STRIDE_SIZE",
    "PARENT_CHUNK_SIZE",
    "CHILD_CHUNK_SIZE",
    "CHILD_OVERLAP",
    "LATE_CHUNK_BASE_SIZE",
    "LATE_CHUNK_SPLIT_SIZE",
    "TOP_K_RESULTS",
    "SIMILARITY_THRESHOLD",
    "CAG_CACHE_TTL",
    "CAG_CACHE_MAX_SIZE",
    "CRAG_CONFIDENCE_THRESHOLD",
    "CRAG_EXPANDED_K",
    "validate",
    "dump",
    # Domain
    "Document",
    "Chunk",
    "Evidence",
    "RAGQuery",
    "RAGResponse",
    "format_docs",
    "calculate_confidence",
    "extract_citations",
    "truncate_text",
    # Infrastructure
    "get_chat_llm",
    "get_default_embeddings",
    # Application
    "ChunkingService",
]
