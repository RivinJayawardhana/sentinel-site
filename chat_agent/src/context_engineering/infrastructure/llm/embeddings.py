"""
Embedding model provider.

Routes through OpenRouter when configured and credentials are available.
Falls back to OpenAI direct API when OPENROUTER_API_KEY is missing but
OPENAI_API_KEY is present.
"""

from typing import Any

from loguru import logger
from langchain_openai import OpenAIEmbeddings

from infrastructure.config import EMBEDDING_MODEL, OPENROUTER_BASE_URL, PROVIDER, get_api_key


def _normalize_openai_embedding_model(model: str) -> str:
    """Convert OpenRouter-style embedding model IDs to OpenAI model IDs."""
    if model.startswith("openai/"):
        return model.split("/", 1)[1]

    # Non-OpenAI embedding vendor IDs are not valid on OpenAI direct API.
    if "/" in model:
        return "text-embedding-3-small"

    return model


def get_default_embeddings(
    batch_size: int = 100,
    show_progress: bool = False,
    **kwargs: Any,
) -> OpenAIEmbeddings:
    """Get an OpenAIEmbeddings instance configured for the active provider."""
    llm_kwargs: dict[str, Any] = dict(
        model=EMBEDDING_MODEL,
        show_progress_bar=show_progress,
        **kwargs,
    )

    if PROVIDER == "openrouter":
        openrouter_key = get_api_key("openrouter")
        if openrouter_key:
            llm_kwargs["openai_api_base"] = OPENROUTER_BASE_URL
            llm_kwargs["openai_api_key"] = openrouter_key
        else:
            openai_key = get_api_key("openai")
            if not openai_key:
                raise ValueError(
                    "Missing OPENROUTER_API_KEY (or OPENAI_API_KEY fallback) for embeddings."
                )
            fallback_model = _normalize_openai_embedding_model(EMBEDDING_MODEL)
            llm_kwargs["model"] = fallback_model
            llm_kwargs["openai_api_key"] = openai_key
            logger.warning(
                "OPENROUTER_API_KEY is missing; falling back to OpenAI embeddings (model={}).",
                fallback_model,
            )
    else:
        # Ensure we pass a concrete key to avoid lazy async key providers.
        openai_key = get_api_key("openai")
        if openai_key:
            llm_kwargs["openai_api_key"] = openai_key

    return OpenAIEmbeddings(**llm_kwargs)
