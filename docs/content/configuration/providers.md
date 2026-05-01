# Providers

Bakwas talks to LLMs through a pluggable provider registry in `config/providers.yaml`. It ships with sensible defaults for Anthropic, OpenAI, OpenRouter, Google Gemini, DeepSeek, and Groq. Any OpenAI-compatible endpoint is supported.

## How providers are enabled

A provider is **hidden from the UI automatically** when its API key is missing (or, for local providers like Ollama, when its `api_base` is missing). You can leave unused entries in the file without them cluttering the dropdown.

To enable a provider, set its corresponding environment variable in `.env`. See [Environment variables](env.md) for the full list of keys.

## Customizing without touching the shipped file

To add or modify providers without editing the tracked `config/providers.yaml`, create `config/providers.local.yaml`. Bakwas loads the local override first when present, and the file is git-ignored.

This is the recommended approach for:

- Adding a custom OpenAI-compatible proxy.
- Pinning specific models.
- Disabling providers you don't use.

## Provider schema

Each provider entry supports these fields:

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique identifier (also used in logs). |
| `label` | No | Display name shown in the model dropdown. |
| `type` | Yes | LiteLLM provider prefix. Use `openai` for any OpenAI-compatible endpoint that isn't a named provider. |
| `api_key_env` | Sometimes | Env var holding the API key. Leave unset for keyless (local) providers. |
| `api_base` | No | Override the default API base URL. Required for custom endpoints. |
| `default` | No | If `true`, this provider's default model becomes the app default. |
| `models` | No | Explicit list: `[id, ...]` or `[{id, name, default}, ...]`. |
| `models_endpoint` | No | `auto` (default) enables runtime discovery where supported. |

## Example: custom OpenAI-compatible proxy

```yaml
# config/providers.local.yaml
providers:
  - id: my-proxy
    label: My Proxy
    type: openai
    api_key_env: MY_PROXY_API_KEY
    api_base: https://my-proxy.example.com/v1
    models:
      - id: gpt-4o-mini
        name: GPT-4o mini (via proxy)
```

Then add `MY_PROXY_API_KEY=...` to `.env` and the matching line to `docker-compose.yml`:

```yaml
environment:
  - MY_PROXY_API_KEY=${MY_PROXY_API_KEY:-}
```

## Example: local Ollama

```yaml
providers:
  - id: ollama-local
    label: Ollama (local)
    type: ollama
    api_base: http://localhost:11434
    models_endpoint: auto
```

No API key needed. Make sure Ollama is running on the host and reachable from wherever Bakwas runs (e.g., use `host.docker.internal:11434` inside a Docker container).
