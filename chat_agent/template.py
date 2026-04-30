#!/usr/bin/env python3
"""
Zuu Crew AI Project Template Generator

Generates a production-ready project structure following the
Zuu Crew AI Standard.

Usage:
    python template.py --name my_project --level dev
    python template.py --name my_project --level full

Options:
    --name: Project name (default: "context_engineering")
    --level: Structure level - "dev" (core only) or "full" (with Docker/CI)
    --output: Output directory (default: current directory)
"""

import argparse
from pathlib import Path
from typing import Dict, List


# ============================================================================
# TEMPLATE CONTENT
# ============================================================================

def get_main_init(package_name: str) -> str:
    """Generate main __init__.py content."""
    return f'''"""
{package_name.replace('_', ' ').title()} - Production RAG System

A production-ready Retrieval-Augmented Generation system following
the Zuu Crew AI Standard.

Features:
- Standard RAG with modern LangChain LCEL
- Cache-Augmented Generation (CAG) for instant responses
- Corrective RAG (CRAG) for self-correcting retrieval
- Multiple chunking strategies
"""

__version__ = "0.1.0"
__author__ = "{package_name.replace('_', ' ').title()} Team"

# Main exports
from .config import (
    # Paths
    DATA_DIR,
    VECTOR_DIR,
    MARKDOWN_DIR,
    CACHE_DIR,
    # LLM Config
    OPENAI_CHAT_MODEL,
    EMBEDDING_MODEL,
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
    "__version__",
    "__author__",
    "DATA_DIR",
    "VECTOR_DIR",
    "MARKDOWN_DIR",
    "CACHE_DIR",
    "OPENAI_CHAT_MODEL",
    "EMBEDDING_MODEL",
    "validate",
    "dump",
    "Document",
    "Chunk",
    "Evidence",
    "RAGQuery",
    "RAGResponse",
    "format_docs",
    "calculate_confidence",
    "extract_citations",
    "truncate_text",
    "get_chat_llm",
    "get_default_embeddings",
    "ChunkingService",
]
'''


def get_config_py() -> str:
    """Generate config.py content."""
    return '''"""
Application configuration - single source of truth for non-secrets.

CONFIGURATION POLICY:
====================
This module is the SINGLE SOURCE OF TRUTH for all NON-SECRET configuration values.

Secrets (API keys, credentials) live ONLY in .env and are loaded via os.getenv() or
python-dotenv. Non-secrets are defined here as constants and MUST NOT be read from
environment variables outside this module.
"""

from pathlib import Path
import os

# ========================================
# Project Paths
# ========================================

# Get project root (parent of src/package/)
_PROJECT_ROOT = Path(__file__).parent.parent.parent

# Data directories
DATA_DIR = _PROJECT_ROOT / "data"
VECTOR_DIR = DATA_DIR / "vectorstore"
MARKDOWN_DIR = DATA_DIR / "markdown"
CACHE_DIR = DATA_DIR / "cache"

# ========================================
# LLM Configuration
# ========================================

OPENAI_CHAT_MODEL = "gpt-4o-mini"
EMBEDDING_MODEL = "text-embedding-3-large"

# ========================================
# Chunking Configuration
# ========================================

FIXED_CHUNK_SIZE = 800
FIXED_CHUNK_OVERLAP = 100
SEMANTIC_MAX_CHUNK_SIZE = 1000
SEMANTIC_MIN_CHUNK_SIZE = 200
SLIDING_WINDOW_SIZE = 512
SLIDING_STRIDE_SIZE = 256
PARENT_CHUNK_SIZE = 1200
CHILD_CHUNK_SIZE = 250
CHILD_OVERLAP = 50
LATE_CHUNK_BASE_SIZE = 1000
LATE_CHUNK_SPLIT_SIZE = 300
LATE_CHUNK_CONTEXT_WINDOW = 150

# ========================================
# Retrieval Configuration
# ========================================

TOP_K_RESULTS = 4
SIMILARITY_THRESHOLD = 0.7

# ========================================
# CAG Configuration
# ========================================

CAG_CACHE_TTL = 86400
CAG_CACHE_MAX_SIZE = 1000

# ========================================
# CRAG Configuration
# ========================================

CRAG_CONFIDENCE_THRESHOLD = 0.6
CRAG_EXPANDED_K = 8

# ========================================
# Helper Functions
# ========================================

def validate() -> None:
    """
    Validate configuration and create required directories.
    
    Raises:
        ValueError: If required secrets are missing
        OSError: If directories cannot be created
    """
    # Check required secrets
    required_secrets = ["OPENAI_API_KEY"]
    missing = [key for key in required_secrets if not os.getenv(key)]
    
    if missing:
        raise ValueError(
            f"❌ Missing required secrets in .env: {', '.join(missing)}\\n"
            f"Please create a .env file with these keys."
        )
    
    # Create required directories
    required_dirs = [DATA_DIR, VECTOR_DIR, MARKDOWN_DIR, CACHE_DIR]
    
    for dir_path in required_dirs:
        try:
            dir_path.mkdir(parents=True, exist_ok=True)
        except (PermissionError, OSError) as e:
            raise OSError(f"❌ Cannot create directory {dir_path}: {e}")


def dump() -> None:
    """Print all active non-secret configuration values for debugging."""
    print("\\n" + "=" * 60)
    print("CONFIGURATION (NON-SECRETS ONLY)")
    print("=" * 60)
    
    print("\\n📦 LLM & Embeddings:")
    print(f"   Chat Model: {OPENAI_CHAT_MODEL}")
    print(f"   Embedding Model: {EMBEDDING_MODEL}")
    
    print("\\n📁 Directories:")
    print(f"   Data Root: {DATA_DIR}")
    print(f"   Vector Store: {VECTOR_DIR}")
    print(f"   Markdown: {MARKDOWN_DIR}")
    print(f"   Cache: {CACHE_DIR}")
    
    print("\\n🔧 Chunking:")
    print(f"   Fixed Size: {FIXED_CHUNK_SIZE} tokens")
    print(f"   Fixed Overlap: {FIXED_CHUNK_OVERLAP} tokens")
    print(f"   Sliding Window: {SLIDING_WINDOW_SIZE} tokens")
    
    print("\\n🔍 Retrieval:")
    print(f"   Top-K Results: {TOP_K_RESULTS}")
    print(f"   Similarity Threshold: {SIMILARITY_THRESHOLD}")
    
    print("\\n" + "=" * 60 + "\\n")
'''


def get_domain_models() -> str:
    """Generate domain/models.py content."""
    return '''"""
Core domain models.

Defines Document, Chunk, Evidence, and related data structures.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any


@dataclass
class Document:
    """Represents a crawled web document."""
    url: str
    title: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Chunk:
    """Represents a text chunk from a document."""
    text: str
    strategy: str
    chunk_index: int
    url: str
    title: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Evidence:
    """Represents retrieved evidence for RAG."""
    url: str
    title: str
    quote: str
    strategy: str
    score: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RAGQuery:
    """Represents a RAG query with context."""
    query: str
    k: int = 4
    confidence_threshold: float = 0.6
    use_cache: bool = True


@dataclass
class RAGResponse:
    """Represents a RAG response with metadata."""
    answer: str
    evidence: list[Evidence]
    confidence: Optional[float] = None
    cache_hit: bool = False
    generation_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
'''


def get_domain_utils() -> str:
    """Generate domain/utils.py content."""
    return '''"""
Helper functions for RAG pipeline.

Includes document formatting, confidence scoring, and citation utilities.
"""

import re
from typing import List


def format_docs(docs: list) -> str:
    """Format list of Documents into a single context string."""
    formatted = []
    for i, doc in enumerate(docs, 1):
        url = doc.metadata.get('url', 'N/A')
        title = doc.metadata.get('title', 'N/A')
        content = doc.page_content[:500]
        formatted.append(
            f"[Source {i}: {url}]\\n"
            f"Title: {title}\\n"
            f"Content: {content}\\n"
        )
    return "\\n---\\n".join(formatted)


def calculate_confidence(docs: list, query: str) -> float:
    """Calculate confidence score for retrieved documents."""
    if not docs:
        return 0.0
    
    query_words = set(query.lower().split())
    
    overlaps = []
    for doc in docs:
        doc_words = set(doc.page_content.lower().split())
        overlap = len(query_words & doc_words) / len(query_words) if query_words else 0
        overlaps.append(overlap)
    
    keyword_score = sum(overlaps) / len(overlaps)
    avg_length = sum(len(doc.page_content) for doc in docs) / len(docs)
    length_score = min(avg_length / 500, 1.0)
    
    strategies = set([doc.metadata.get('strategy', 'unknown') for doc in docs])
    diversity_score = len(strategies) / 3.0
    
    confidence = (
        0.5 * keyword_score +
        0.3 * length_score +
        0.2 * diversity_score
    )
    
    return confidence


def extract_citations(text: str) -> List[str]:
    """Extract [url] citations from generated text."""
    citations = re.findall(r'\\[([^\\]]+)\\]', text)
    urls = [c for c in citations if 'http' in c or '.com' in c]
    return urls


def truncate_text(text: str, max_length: int = 400) -> str:
    """Truncate text to maximum length for quotes/previews."""
    if len(text) <= max_length:
        return text
    return text[:max_length].rsplit(' ', 1)[0] + "..."
'''


def get_application_init() -> str:
    """Generate application/__init__.py content."""
    return '''"""
Application layer - services and use cases.

Contains:
- chat_service: RAG, CAG, CRAG services
- ingest_documents_service: Crawling, chunking, indexing
- evaluation_service: Metrics and evaluation
"""

from .ingest_documents_service import ChunkingService

__all__ = ["ChunkingService"]
'''


def get_domain_init() -> str:
    """Generate domain/__init__.py content."""
    return '''"""
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
    "Document",
    "Chunk",
    "Evidence",
    "RAGQuery",
    "RAGResponse",
    "format_docs",
    "calculate_confidence",
    "extract_citations",
    "truncate_text",
]
'''


def get_infrastructure_init() -> str:
    """Generate infrastructure/__init__.py content."""
    return '''"""
Infrastructure layer - external integrations.

Contains:
- llm_providers: LLM and embedding services
- db: Database and storage
- api: API endpoints
- monitoring: Logging and metrics
"""

from .llm_providers import get_chat_llm, get_default_embeddings

__all__ = [
    "get_chat_llm",
    "get_default_embeddings",
]
'''


def get_llm_provider() -> str:
    """Generate infrastructure/llm_providers/openai_provider.py content."""
    return '''"""
OpenAI LLM provider using LangChain.

Factory functions for chat models with production configuration.
"""

from typing import Optional, Any
from langchain_openai import ChatOpenAI

from ..config import OPENAI_CHAT_MODEL


def get_chat_llm(
    temperature: float = 0,
    streaming: bool = False,
    max_tokens: Optional[int] = None,
    **kwargs: Any
) -> ChatOpenAI:
    """
    Factory function to create a chat completion LLM instance.
    
    Args:
        temperature: Sampling temperature (0.0 = deterministic)
        streaming: Whether to enable streaming responses
        max_tokens: Maximum tokens to generate
        **kwargs: Additional provider-specific parameters
    
    Returns:
        ChatOpenAI: An LLM instance ready for chat completions
    """
    return ChatOpenAI(
        model=OPENAI_CHAT_MODEL,
        temperature=temperature,
        streaming=streaming,
        max_tokens=max_tokens,
        **kwargs
    )
'''


def get_embeddings_provider() -> str:
    """Generate infrastructure/llm_providers/embeddings.py content."""
    return '''"""
Embedding model provider using LangChain.

Factory functions for text embedding models.
"""

from typing import Any
from langchain_openai import OpenAIEmbeddings

from ..config import EMBEDDING_MODEL


def get_default_embeddings(
    batch_size: int = 100,
    show_progress: bool = False,
    **kwargs: Any
) -> OpenAIEmbeddings:
    """
    Factory function to create the default embedding model instance.
    
    Args:
        batch_size: Number of texts to embed in parallel
        show_progress: Display progress bar for large batch operations
        **kwargs: Additional provider-specific parameters
    
    Returns:
        OpenAIEmbeddings: An embedding model instance
    """
    return OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        show_progress_bar=show_progress,
        **kwargs
    )
'''


def get_chunking_service_stub() -> str:
    """Generate application/ingest_documents_service/__init__.py content."""
    return '''"""
Document ingestion service.

Provides chunking strategies for document processing.
"""

# ChunkingService implementation would go in chunkers.py
# For now, this is a placeholder

class ChunkingService:
    """Unified service for all chunking strategies."""
    
    def __init__(self):
        self.strategies = {}
    
    def chunk(self, documents: list, strategy: str = "semantic"):
        """Chunk documents using specified strategy."""
        raise NotImplementedError("ChunkingService to be implemented")
    
    def available_strategies(self) -> list:
        """Return list of available chunking strategies."""
        return []

__all__ = ["ChunkingService"]
'''


def get_requirements() -> str:
    """Generate requirements.txt content."""
    return '''# Core dependencies
langchain>=0.1.0
langchain-core>=0.1.0
langchain-openai>=0.0.5
langchain-community>=0.0.20
langchain-text-splitters>=0.2.0

# Vector store
chromadb>=0.4.0

# Utilities
tiktoken>=0.5.0
python-dotenv>=1.0.0

# Web scraping (if needed)
playwright>=1.40.0
nest-asyncio>=1.5.0

# Development
jupyter>=1.0.0
ipykernel>=6.29.0
'''


def get_env_example() -> str:
    """Generate .env.example content."""
    return '''# OpenAI API Key
OPENAI_API_KEY=sk-...

# Add other secrets here (NO non-secrets!)
'''


def get_readme(package_name: str) -> str:
    """Generate README.md content."""
    return f'''# {package_name.replace('_', ' ').title()}

Production-ready RAG system following Zuu Crew AI Standard.

## Features

- ✅ Zuu Crew AI structure (Application/Domain/Infrastructure)
- ✅ Centralized configuration (single source of truth)
- ✅ Type hints throughout
- ✅ Comprehensive documentation
- ✅ Production-ready architecture

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

3. Validate configuration:
```python
from {package_name}.config import validate, dump
validate()  # Check secrets and create directories
dump()      # Show configuration
```

## Usage

```python
from {package_name} import (
    ChunkingService,
    get_chat_llm,
    get_default_embeddings,
)

# Initialize services
llm = get_chat_llm()
embeddings = get_default_embeddings()
chunker = ChunkingService()

# Your code here...
```

## Structure

```
src/{package_name}/
├── config.py                    # Configuration
├── application/                 # Services
├── domain/                      # Core logic
└── infrastructure/              # External systems
```

## Documentation

- All configuration in `config.py`
- Type hints throughout
- Comprehensive docstrings
- Clean imports from top level

## License

MIT
'''


def get_gitignore() -> str:
    """Generate .gitignore content."""
    return '''# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
.venv/
venv/
ENV/
env/

# IDEs
.vscode/
.idea/
*.swp
*.swo

# Jupyter
.ipynb_checkpoints/
*.ipynb

# Environment
.env
.env.local

# Data
data/
*.db
*.sqlite

# OS
.DS_Store
Thumbs.db
'''


# ============================================================================
# DIRECTORY STRUCTURE
# ============================================================================

def get_directory_structure(package_name: str, level: str = "dev") -> Dict[str, List[str]]:
    """
    Get the directory structure to create.
    
    Args:
        package_name: Name of the package
        level: "dev" for core structure, "full" for complete structure
    
    Returns:
        Dict mapping directory paths to list of files to create
    """
    structure = {
        f"src/{package_name}": [
            "__init__.py",
            "config.py",
        ],
        f"src/{package_name}/application": [
            "__init__.py",
        ],
        f"src/{package_name}/application/chat_service": [
            "__init__.py",
        ],
        f"src/{package_name}/application/ingest_documents_service": [
            "__init__.py",
        ],
        f"src/{package_name}/application/evaluation_service": [
            "__init__.py",
        ],
        f"src/{package_name}/domain": [
            "__init__.py",
            "models.py",
            "utils.py",
        ],
        f"src/{package_name}/domain/prompts": [
            "__init__.py",
        ],
        f"src/{package_name}/domain/tools": [
            "__init__.py",
        ],
        f"src/{package_name}/infrastructure": [
            "__init__.py",
        ],
        f"src/{package_name}/infrastructure/llm_providers": [
            "__init__.py",
            "openai_provider.py",
            "embeddings.py",
        ],
        f"src/{package_name}/infrastructure/db": [
            "__init__.py",
        ],
        f"src/{package_name}/infrastructure/api": [
            "__init__.py",
        ],
        f"src/{package_name}/infrastructure/monitoring": [
            "__init__.py",
        ],
        "data": [],
        "notebooks": [],
        ".": [
            "requirements.txt",
            ".env.example",
            ".gitignore",
            "README.md",
        ],
    }
    
    if level == "full":
        structure.update({
            "tests": ["__init__.py"],
            ".github/workflows": [],
            "docker": ["Dockerfile"],
        })
    
    return structure


# ============================================================================
# FILE CONTENT MAPPING
# ============================================================================

def get_file_content(filepath: str, package_name: str) -> str:
    """Get content for a specific file."""
    filename = Path(filepath).name
    parent = Path(filepath).parent.name
    
    # Main init
    if filepath.endswith(f"src/{package_name}/__init__.py"):
        return get_main_init(package_name)
    
    # Config
    if filename == "config.py":
        return get_config_py()
    
    # Domain
    if filepath.endswith("domain/models.py"):
        return get_domain_models()
    if filepath.endswith("domain/utils.py"):
        return get_domain_utils()
    if filepath.endswith("domain/__init__.py"):
        return get_domain_init()
    
    # Application
    if filepath.endswith("application/__init__.py"):
        return get_application_init()
    if filepath.endswith("ingest_documents_service/__init__.py"):
        return get_chunking_service_stub()
    
    # Infrastructure
    if filepath.endswith("infrastructure/__init__.py"):
        return get_infrastructure_init()
    if filename == "openai_provider.py":
        return get_llm_provider()
    if filepath.endswith("llm_providers/embeddings.py"):
        return get_embeddings_provider()
    if filepath.endswith("llm_providers/__init__.py"):
        return '''"""LLM providers."""

from .openai_provider import get_chat_llm
from .embeddings import get_default_embeddings

__all__ = ["get_chat_llm", "get_default_embeddings"]
'''
    
    # Root files
    if filename == "requirements.txt":
        return get_requirements()
    if filename == ".env.example":
        return get_env_example()
    if filename == "README.md":
        return get_readme(package_name)
    if filename == ".gitignore":
        return get_gitignore()
    
    # Default: minimal init
    if filename == "__init__.py":
        return '"""Package initialization."""\n'
    
    return ""


# ============================================================================
# MAIN GENERATOR
# ============================================================================

def generate_project(
    package_name: str = "context_engineering",
    level: str = "dev",
    output_dir: Path = Path(".")
) -> None:
    """
    Generate the project structure.
    
    Args:
        package_name: Name of the package
        level: "dev" or "full"
        output_dir: Where to create the project
    """
    print("=" * 80)
    print(f"🏗️  GENERATING ZUU CREW AI PROJECT STRUCTURE")
    print("=" * 80)
    print(f"\n📦 Package: {package_name}")
    print(f"📂 Level: {level}")
    print(f"📁 Output: {output_dir.absolute()}\n")
    
    structure = get_directory_structure(package_name, level)
    
    # Create directories and files
    total_dirs = 0
    total_files = 0
    
    for dir_path, files in structure.items():
        full_dir = output_dir / dir_path
        
        # Create directory
        full_dir.mkdir(parents=True, exist_ok=True)
        total_dirs += 1
        print(f"✅ Created directory: {dir_path}")
        
        # Create files
        for filename in files:
            filepath = full_dir / filename
            relative_path = str((Path(dir_path) / filename).as_posix() if dir_path != "." else filename)
            
            content = get_file_content(relative_path, package_name)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            total_files += 1
            print(f"   ✅ {filename} ({len(content)} chars)")
    
    print("\n" + "=" * 80)
    print("✅ PROJECT GENERATION COMPLETE!")
    print("=" * 80)
    print(f"\n📊 Created:")
    print(f"   • {total_dirs} directories")
    print(f"   • {total_files} files")
    print(f"\n📂 Project location: {output_dir.absolute()}")
    print(f"\n🚀 Next steps:")
    print(f"   1. cd {package_name if output_dir == Path('.') else output_dir}")
    print(f"   2. python -m venv .venv")
    print(f"   3. source .venv/bin/activate")
    print(f"   4. pip install -r requirements.txt")
    print(f"   5. cp .env.example .env  # Add your API keys")
    print(f"   6. python -c 'from {package_name}.config import validate, dump; validate(); dump()'")
    print("\n" + "=" * 80 + "\n")


# ============================================================================
# CLI
# ============================================================================

def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate Zuu Crew AI project structure",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python template.py --name my_rag_project
  python template.py --name healthcare_bot --level full
  python template.py --name my_project --output ~/projects/new_project
"""
    )
    
    parser.add_argument(
        "--name",
        type=str,
        default="context_engineering",
        help="Package name (default: context_engineering)"
    )
    
    parser.add_argument(
        "--level",
        type=str,
        choices=["dev", "full"],
        default="dev",
        help="Structure level: dev (core only) or full (with Docker/CI)"
    )
    
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("."),
        help="Output directory (default: current directory)"
    )
    
    args = parser.parse_args()
    
    generate_project(
        package_name=args.name,
        level=args.level,
        output_dir=args.output
    )


if __name__ == "__main__":
    main()

