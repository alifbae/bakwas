# Environment variables

All configuration lives in a `.env` file at the project root. Variables are loaded at startup.

!!! info "One provider key is required"
    The model dropdown is empty unless at least one configured provider has its API key set. See [Providers](providers.md) to pick which one.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API key. Required unless you enable a different provider in `providers.yaml`. |
| `OPENAI_API_KEY` | No | — | Enables the OpenAI provider. |
| `GEMINI_API_KEY` | No | — | Enables the Google Gemini provider. |
| `OPENROUTER_API_KEY` | No | — | Enables OpenRouter (gateway to many models). |
| `DEEPSEEK_API_KEY` | No | — | Enables DeepSeek. |
| `GROQ_API_KEY` | No | — | Enables Groq. |
| `PORT` | No | `5000` | Flask server port. Ignored by the default Docker setup, which binds `5000:5000`. |
| `DEBUG` | No | `False` | `true` enables debug mode, verbose LLM logs, and disables rate limits. |
| `FLASK_ENV` | No | — | Set to `development` to flag as local (rate-limit exempt). |
| `LOCAL` | No | `False` | Alternative flag that marks the app as local. |
| `SECRET_KEY` | No | random per start | Flask session secret. Set a stable value in production. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `RATE_LIMIT_SUMMARIZE` | No | `30 per hour` | Rate limit for `/summarize` only. Accepts any [Flask-Limiter](https://flask-limiter.readthedocs.io/) rule, e.g. `"60 per hour"` or `"5 per minute;100 per day"`. See [Rate limiting](rate-limiting.md). |

<small>\* "Required" means at least one enabled provider must have its API key set. The default `providers.yaml` ships with Anthropic flagged as the default provider, so `ANTHROPIC_API_KEY` is the simplest path. Swap to any other provider in `providers.yaml` and a different key becomes the required one.</small>

## Generating a SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Set the resulting value in `.env` so sessions survive container restarts.

## Adding custom provider keys

If you register a provider in `config/providers.local.yaml` that references a new env var (e.g. `MY_PROXY_API_KEY`), you need to do two things:

1. Add the value to `.env`.
2. Add a matching line to the `environment:` block in `docker-compose.yml` so it reaches the container:

   ```yaml
   environment:
     - MY_PROXY_API_KEY=${MY_PROXY_API_KEY:-}
   ```

The compose file uses an explicit allowlist (rather than `env_file:`) so that only the variables you list flow into the container.
