"""
Provider registry for LLM backends.

Loads provider definitions from config/providers.yaml so users can add any
OpenAI-compatible endpoint (Anthropic, OpenAI, Gemini, DeepSeek, OpenRouter,
Ollama, a local proxy, etc.) without touching code.

Shape of a provider entry (YAML):

    providers:
      - id: openai               # unique identifier (also used as fallback label)
        label: OpenAI            # optional display name
        type: openai             # litellm provider prefix (openai, anthropic,
                                 # gemini, openrouter, deepseek, ollama, etc.)
        api_key_env: OPENAI_API_KEY   # env var holding the API key (optional)
        api_base: https://...    # optional override for OpenAI-compatible endpoints
        default: true            # optional: provider flagged as default source
        models:                  # optional explicit model list
          - id: gpt-4o-mini
            name: GPT-4o mini
            default: true
        models_endpoint: auto    # optional: 'auto' enables runtime discovery

The `id` a user picks in the UI is the fully-qualified LiteLLM model string,
e.g. "openai/gpt-4o-mini", "anthropic/claude-sonnet-4-6", "ollama/llama3.1",
so summarize_text can forward it straight to litellm.completion().
"""

from __future__ import annotations

import os
import pathlib
from dataclasses import dataclass, field
from typing import Any, Iterable

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover - dependency check at import time
    yaml = None


PROJECT_ROOT = pathlib.Path(__file__).parent.parent
# Load order: user override first, then the shipped default.
# `providers.local.yaml` is git-ignored so users can customize without
# conflicting with upstream updates to `providers.yaml`.
CONFIG_PATHS = [
    PROJECT_ROOT / "config" / "providers.local.yaml",
    PROJECT_ROOT / "config" / "providers.local.yml",
    PROJECT_ROOT / "config" / "providers.yaml",
    PROJECT_ROOT / "config" / "providers.yml",
]


@dataclass
class Provider:
    id: str
    label: str
    type: str
    api_key_env: str | None = None
    api_base: str | None = None
    default: bool = False
    models: list[dict[str, Any]] = field(default_factory=list)
    models_endpoint: str | None = None

    @property
    def api_key(self) -> str | None:
        if not self.api_key_env:
            return None
        return os.getenv(self.api_key_env) or None

    @property
    def enabled(self) -> bool:
        """A provider is enabled if it has either an API key or no key is required
        (e.g. a local Ollama). Local/no-key providers are only considered enabled
        when they also have an api_base configured, to avoid accidentally
        exposing empty providers in the UI."""
        if self.api_key_env:
            return bool(self.api_key)
        return bool(self.api_base)


def _coerce_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _normalize_model(entry: Any, provider_id: str) -> dict[str, Any] | None:
    """Accept either a plain string or a dict; return a normalized model dict
    with id, name, default fields."""
    if entry is None:
        return None
    if isinstance(entry, str):
        return {"id": entry, "name": entry, "default": False}
    if isinstance(entry, dict):
        model_id = entry.get("id")
        if not model_id:
            return None
        return {
            "id": str(model_id),
            "name": str(entry.get("name") or model_id),
            "default": bool(entry.get("default", False)),
        }
    return None


def _load_raw_config() -> dict[str, Any]:
    if yaml is None:
        return {}
    for path in CONFIG_PATHS:
        if path.exists():
            try:
                with path.open("r", encoding="utf-8") as fh:
                    data = yaml.safe_load(fh) or {}
                if isinstance(data, dict):
                    return data
            except Exception as exc:  # pragma: no cover - surfaced via logs
                print(f"[providers] Failed to read {path}: {exc}")
    return {}


def load_providers() -> list[Provider]:
    """Parse providers from the YAML config. Silently returns [] if none exist."""
    raw = _load_raw_config()
    entries = _coerce_list(raw.get("providers"))

    providers: list[Provider] = []
    seen_ids: set[str] = set()

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        pid = str(entry.get("id") or "").strip()
        if not pid or pid in seen_ids:
            continue
        seen_ids.add(pid)

        models_raw = _coerce_list(entry.get("models"))
        models = [m for m in (_normalize_model(m, pid) for m in models_raw) if m]

        provider = Provider(
            id=pid,
            label=str(entry.get("label") or pid),
            type=str(entry.get("type") or pid),
            api_key_env=(str(entry["api_key_env"]).strip() or None)
            if entry.get("api_key_env")
            else None,
            api_base=(str(entry["api_base"]).strip() or None)
            if entry.get("api_base")
            else None,
            default=bool(entry.get("default", False)),
            models=models,
            models_endpoint=(str(entry["models_endpoint"]).strip().lower() or None)
            if entry.get("models_endpoint")
            else None,
        )
        providers.append(provider)

    return providers


# ---------------------------------------------------------------------------
# Model discovery
# ---------------------------------------------------------------------------


def _qualify(provider_type: str, model_id: str) -> str:
    """Return the fully-qualified LiteLLM model string."""
    if "/" in model_id:
        return model_id
    return f"{provider_type}/{model_id}"


def _discover_anthropic(provider: Provider) -> list[dict[str, Any]]:
    """Use Anthropic's /v1/models to populate models for an 'anthropic' provider."""
    import requests

    api_key = provider.api_key
    if not api_key:
        return []
    try:
        resp = requests.get(
            (provider.api_base or "https://api.anthropic.com") + "/v1/models",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        latest_sonnet: str | None = None
        models = []
        for m in data.get("data", []):
            mid = m.get("id", "")
            if not mid:
                continue
            if latest_sonnet is None and "sonnet" in mid.lower():
                latest_sonnet = mid
            models.append(
                {
                    "id": mid,
                    "name": m.get("display_name") or mid,
                    "default": False,
                }
            )
        for m in models:
            if m["id"] == latest_sonnet:
                m["default"] = True
                break
        return models
    except Exception as exc:  # pragma: no cover
        print(f"[providers] Anthropic discovery failed for {provider.id}: {exc}")
        return []


def _discover_openai_compatible(provider: Provider) -> list[dict[str, Any]]:
    """Hit the /v1/models endpoint of any OpenAI-compatible provider."""
    import requests

    base = provider.api_base
    if not base:
        # Named OpenAI-compat providers that LiteLLM knows about also expose
        # this endpoint at a well-known URL. Map a few common ones.
        defaults = {
            "openai": "https://api.openai.com/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "groq": "https://api.groq.com/openai/v1",
            "together_ai": "https://api.together.xyz/v1",
        }
        base = defaults.get(provider.type)
    if not base:
        return []

    headers = {}
    api_key = provider.api_key
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        resp = requests.get(base.rstrip("/") + "/models", headers=headers, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        items = data.get("data") or data.get("models") or []
        models = []
        for m in items:
            if isinstance(m, str):
                mid = m
                name = m
            elif isinstance(m, dict):
                mid = m.get("id") or m.get("name")
                name = m.get("name") or mid
            else:
                continue
            if not mid:
                continue
            models.append({"id": str(mid), "name": str(name), "default": False})
        return models
    except Exception as exc:  # pragma: no cover
        print(f"[providers] OpenAI-compat discovery failed for {provider.id}: {exc}")
        return []


def _discover_ollama(provider: Provider) -> list[dict[str, Any]]:
    """Ollama uses /api/tags instead of /v1/models."""
    import requests

    base = provider.api_base or "http://localhost:11434"
    try:
        resp = requests.get(base.rstrip("/") + "/api/tags", timeout=5)
        if resp.status_code != 200:
            return []
        data = resp.json()
        return [
            {"id": m.get("name"), "name": m.get("name"), "default": False}
            for m in data.get("models", [])
            if m.get("name")
        ]
    except Exception as exc:  # pragma: no cover
        print(f"[providers] Ollama discovery failed for {provider.id}: {exc}")
        return []


def _discover_models(provider: Provider) -> list[dict[str, Any]]:
    if provider.type == "anthropic":
        return _discover_anthropic(provider)
    if provider.type == "ollama":
        return _discover_ollama(provider)
    # Treat everything else as OpenAI-compatible
    return _discover_openai_compatible(provider)


def _provider_models(provider: Provider) -> list[dict[str, Any]]:
    """Return the model list for a provider, honoring explicit vs auto-discovery."""
    explicit = list(provider.models)
    if explicit:
        return explicit
    if (provider.models_endpoint or "auto") == "auto":
        return _discover_models(provider)
    return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


_providers_cache: list[Provider] | None = None


def get_providers(refresh: bool = False) -> list[Provider]:
    global _providers_cache
    if _providers_cache is None or refresh:
        _providers_cache = load_providers()
    return _providers_cache


def list_models() -> list[dict[str, Any]]:
    """
    Return the flat model list the UI consumes. Each entry has:
      - id: fully-qualified LiteLLM model string, e.g. "openai/gpt-4o-mini"
      - name: display name (prefixed with provider label for disambiguation)
      - default: bool - exactly one item is True when possible
      - provider: provider label (used by the UI for optgroup labels)
    Only enabled providers are included.
    """
    providers = [p for p in get_providers() if p.enabled]
    flat: list[dict[str, Any]] = []
    default_provider: Provider | None = next(
        (p for p in providers if p.default), providers[0] if providers else None
    )

    for provider in providers:
        models = _provider_models(provider)
        for model in models:
            qualified = _qualify(provider.type, model["id"])
            flat.append(
                {
                    "id": qualified,
                    "name": f"{provider.label}: {model['name']}",
                    "default": bool(
                        model.get("default")
                        and default_provider
                        and provider.id == default_provider.id
                    ),
                    "provider": provider.label,
                }
            )

    # If no model was explicitly marked default, promote the first model of
    # the default provider (or the first model overall) so the UI has a
    # well-defined default.
    if flat and not any(m["default"] for m in flat):
        if default_provider:
            for m in flat:
                if m["provider"] == default_provider.label:
                    m["default"] = True
                    break
            else:
                flat[0]["default"] = True
        else:
            flat[0]["default"] = True

    return flat


def resolve(model_id: str) -> Provider | None:
    """Given a fully-qualified model id, return the provider it belongs to."""
    if not model_id:
        return None
    # Split on first slash: "openai/gpt-4o-mini" -> type "openai"
    if "/" not in model_id:
        return None
    prefix = model_id.split("/", 1)[0]
    for provider in get_providers():
        if provider.type == prefix:
            return provider
    return None
