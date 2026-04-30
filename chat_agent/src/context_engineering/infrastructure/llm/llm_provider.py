"""
Chat LLM providers - 3-model architecture.

Three specialised LLMs for different tasks:
  - Router:    gpt-4o-mini via OpenRouter (reliable JSON output)
  - Extractor: llama-3.1-8b-instant via Groq (ultra-fast structured extraction)
  - Chat:      gemini-2.0-flash via OpenRouter (high quality synthesis)
"""

from typing import Any, Optional, Tuple

from loguru import logger
from langchain_openai import ChatOpenAI

from infrastructure.config import (
    CHAT_MODEL,
    CHAT_PROVIDER,
    EXTRACTOR_MODEL,
    EXTRACTOR_PROVIDER,
    GROQ_BASE_URL,
    OPENROUTER_BASE_URL,
    ROUTER_MODEL,
    ROUTER_PROVIDER,
    get_api_key,
)


def _normalize_openai_model(model: str) -> str:
    """Convert OpenRouter-style model IDs to OpenAI model IDs when possible."""
    if model.startswith("openai/"):
        return model.split("/", 1)[1]

    # Non-OpenAI vendor IDs (for example google/*) are invalid on OpenAI direct API.
    if "/" in model:
        return "gpt-4o-mini"

    return model


def _resolve_provider_and_credentials(
    model: str,
    provider: str,
) -> Tuple[str, str, str, Optional[str]]:
    """
    Resolve provider/model/api-key/base-url with safe fallbacks.

    Returns:
        (resolved_provider, resolved_model, api_key, api_base)
    """
    if provider == "openrouter":
        openrouter_key = get_api_key("openrouter")
        if openrouter_key:
            return "openrouter", model, openrouter_key, OPENROUTER_BASE_URL

        openai_key = get_api_key("openai")
        if openai_key:
            fallback_model = _normalize_openai_model(model)
            logger.warning(
                "OPENROUTER_API_KEY is missing; falling back to OpenAI direct API (model={}).",
                fallback_model,
            )
            return "openai", fallback_model, openai_key, None

        raise ValueError(
            "Missing OPENROUTER_API_KEY (or OPENAI_API_KEY fallback) for router/chat LLM."
        )

    if provider == "groq":
        groq_key = get_api_key("groq")
        if groq_key:
            return "groq", model, groq_key, GROQ_BASE_URL

        openai_key = get_api_key("openai")
        if openai_key:
            logger.warning(
                "GROQ_API_KEY is missing; falling back to OpenAI direct API (model=gpt-4o-mini)."
            )
            return "openai", "gpt-4o-mini", openai_key, None

        raise ValueError(
            "Missing GROQ_API_KEY (or OPENAI_API_KEY fallback) for extractor LLM."
        )

    if provider == "openai":
        openai_key = get_api_key("openai")
        if not openai_key:
            raise ValueError("Missing OPENAI_API_KEY for OpenAI provider.")
        return "openai", _normalize_openai_model(model), openai_key, None

    # Unknown provider: fail fast with a clear message.
    raise ValueError(f"Unsupported LLM provider: {provider}")


def _build_llm(
    model: str,
    provider: str,
    temperature: float = 0,
    streaming: bool = False,
    max_tokens: Optional[int] = None,
    **kwargs: Any,
) -> ChatOpenAI:
    """Internal factory - builds a ChatOpenAI for any provider."""
    resolved_provider, resolved_model, api_key, api_base = _resolve_provider_and_credentials(
        model=model,
        provider=provider,
    )

    llm_kwargs: dict[str, Any] = dict(
        model=resolved_model,
        temperature=temperature,
        streaming=streaming,
        max_tokens=max_tokens,
        openai_api_key=api_key,
        **kwargs,
    )

    if resolved_provider in {"openrouter", "groq"} and api_base:
        llm_kwargs["openai_api_base"] = api_base

    return ChatOpenAI(**llm_kwargs)


def get_router_llm(temperature: float = 0, **kwargs: Any) -> ChatOpenAI:
    """LLM for intent classification (routing)."""
    return _build_llm(ROUTER_MODEL, ROUTER_PROVIDER, temperature=temperature, **kwargs)


def get_extractor_llm(temperature: float = 0, **kwargs: Any) -> ChatOpenAI:
    """LLM for extraction tasks (distillation, topic tagging, trigger checks)."""
    return _build_llm(EXTRACTOR_MODEL, EXTRACTOR_PROVIDER, temperature=temperature, **kwargs)


def get_chat_llm(temperature: float = 0, **kwargs: Any) -> ChatOpenAI:
    """LLM for user-facing responses (synthesis, RAG generation)."""
    return _build_llm(CHAT_MODEL, CHAT_PROVIDER, temperature=temperature, **kwargs)
