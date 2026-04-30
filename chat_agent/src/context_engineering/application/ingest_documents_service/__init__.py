"""
Document ingestion service.

Provides:
- Chunking strategies for document processing
- Web crawling for content extraction
"""

from .chunkers import (
    ChunkingService,
    semantic_chunk,
    fixed_chunk,
    sliding_chunk,
    parent_child_chunk,
    late_chunk_index,
    late_chunk_split,
    count_tokens
)
from .web_crawler import (
    NawalokaWebCrawler
)

__all__ = [
    # Chunking
    "ChunkingService",
    "semantic_chunk",
    "fixed_chunk",
    "sliding_chunk",
    "parent_child_chunk",
    "late_chunk_index",
    "late_chunk_split",
    "count_tokens",
    # Crawling
    "NawalokaWebCrawler"
]
