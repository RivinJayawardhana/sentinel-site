"""
Application layer - services and use cases.

Contains:
- chat_service: RAG, CAG, CRAG services
- ingest_documents_service: Crawling, chunking, indexing
- evaluation_service: Metrics and evaluation
"""

from .ingest_documents_service import (
    ChunkingService,
    NawalokaWebCrawler
)
from .chat_service import (
    RAGService,
    CAGService,
    CRAGService,
    CAGCache,
    build_rag_chain
)

__all__ = [
    # Ingest services
    "ChunkingService",
    "NawalokaWebCrawler",
    # Chat services
    "RAGService",
    "CAGService",
    "CRAGService",
    "CAGCache",
    "build_rag_chain"
]
