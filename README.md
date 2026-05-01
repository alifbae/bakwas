# Bakwas

Skip the bakwas ("nonsense") — extract and summarize YouTube video transcripts with the LLM of your choice.

<p align="center">
  <img src="docs/images/homepage.png" alt="Bakwas homepage" width="720" />
</p>

Bakwas is a small, self-hosted Flask app that pulls captions from a YouTube video, sends them through the LLM provider you configure (Anthropic, OpenAI, Google, DeepSeek, Groq, OpenRouter, a local Ollama, or any OpenAI-compatible endpoint), and stores the summary in a local SQLite database so you can revisit it later.

## Features

- Works with any LLM via a pluggable provider registry — OpenAI-compatible endpoints are fully supported
- Concise (bulleted) or comprehensive (paragraph) summary styles
- Server-side sorting, pagination, and URL-based caching so you don't pay to regenerate the same summary twice
- Settings modal for default model, default summary style, and items-per-page preferences
- Dark and light themes
- Rate limiting on the expensive endpoint only, disabled automatically in local dev
- Ships as a single Docker container with a SQLite volume

## Getting Started

Bakwas runs as a Docker container. Pull or build the image, provide at least one provider API key, and start it up.

### Running with Docker

```bash
# Clone the repo
git clone https://github.com/yourusername/bakwas.git
cd bakwas

# Configure your provider keys
cp .env.example .env
# Edit .env and set at least ANTHROPIC_API_KEY (or another provider key)

# Start the container
docker-compose up -d
```

Bakwas is now available at [http://localhost:5000](http://localhost:5000).

### Docker Compose example

The repo ships with a working `docker-compose.yml`. Here's what the minimal version looks like:

```yaml
services:
  bakwas:
    build: .
    container_name: bakwas-app
    ports:
      - "5000:5000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
      - GROQ_API_KEY=${GROQ_API_KEY:-}
      - DEBUG=${DEBUG:-False}
      - SECRET_KEY=${SECRET_KEY}
      - RATE_LIMIT_SUMMARIZE=${RATE_LIMIT_SUMMARIZE:-30 per hour}
    volumes:
      - ./data:/app/data
      # Optional: override the shipped provider config without rebuilding
      # - ./config/providers.local.yaml:/app/config/providers.local.yaml:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Compose auto-loads `.env` from the project directory, so values flow into the container through the `${VAR}` interpolations above. Only the variables listed in `environment:` are visible to the app — add new ones when you register custom providers.

### Running locally without Docker

Requires Python 3.12 or newer.

```bash
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Set at least one provider key

python run.py
```

Visit [http://localhost:5000](http://localhost:5000).

## Configuration

Bakwas is configured in two places:

- `.env` — API keys, server settings, rate limits.
- `config/providers.yaml` — the LLM provider registry (ships with sensible defaults).

### Environment variables

All variables are set in `.env` and loaded at startup. At least one provider API key must be set, otherwise the model dropdown is empty.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API key. Required unless you enable a different provider in `providers.yaml`. |
| `OPENAI_API_KEY` | No | — | Enables the OpenAI provider. |
| `GEMINI_API_KEY` | No | — | Enables the Google Gemini provider. |
| `OPENROUTER_API_KEY` | No | — | Enables OpenRouter (gateway to many models). |
| `DEEPSEEK_API_KEY` | No | — | Enables DeepSeek. |
| `GROQ_API_KEY` | No | — | Enables Groq. |
| `PORT` | No | `5000` | Flask server port (ignored by the default Docker setup, which binds 5000:5000). |
| `DEBUG` | No | `False` | `true` enables debug mode, verbose LLM logs, and disables rate limits. |
| `FLASK_ENV` | No | — | Set to `development` to flag as local (rate-limit exempt). |
| `LOCAL` | No | `False` | Alternative flag that marks the app as local. |
| `SECRET_KEY` | No | random per start | Flask session secret. Set a stable value in production. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `RATE_LIMIT_SUMMARIZE` | No | `30 per hour` | Rate limit for `/summarize` only. Accepts any [Flask-Limiter](https://flask-limiter.readthedocs.io/) rule, e.g. `"60 per hour"` or `"5 per minute;100 per day"`. |

<small>\* "Required" means at least one enabled provider must have its API key set. The default config ships with Anthropic flagged as the default provider, so `ANTHROPIC_API_KEY` is the simplest path. Swap to any other provider in `providers.yaml` and a different key becomes the required one.</small>

### Providers

Providers are registered in `config/providers.yaml`, which ships with sensible defaults for Anthropic, OpenAI, OpenRouter, Google Gemini, DeepSeek, and Groq. Commented examples for Ollama (local) and a custom OpenAI-compatible proxy are included for reference.

A provider is hidden from the UI automatically when its API key is missing, so it's safe to leave entries in place for providers you aren't using.

To add or customize providers without editing the tracked file, create `config/providers.local.yaml`. It takes precedence over the shipped default and is git-ignored.

If you register a new provider in `providers.local.yaml` that references a new env var (e.g. `MY_PROXY_API_KEY`), add a matching line to the `environment:` block in `docker-compose.yml`:

```yaml
environment:
  - MY_PROXY_API_KEY=${MY_PROXY_API_KEY:-}
```

### Rate limiting

Only `/summarize` is rate limited because it's the expensive endpoint (LLM call + caption fetch). Everything else — homepage, `/models`, `/health`, detail view, delete — runs unthrottled. Override the default via `RATE_LIMIT_SUMMARIZE`. When `DEBUG=true`, `FLASK_ENV=development`, or `LOCAL=true`, all rate limiting is skipped.

### Reverse proxy

Example Nginx configuration if you're putting Bakwas behind HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

```bash
# HTTP health check
curl http://localhost:5000/health

# Docker health status
docker inspect bakwas-app | grep -A 10 Health
```

## Development

Set `DEBUG=True` in `.env` and Flask will auto-reload on changes to Python files, templates, and static assets:

```bash
# .env
DEBUG=True
FLASK_ENV=development

python run.py
```

## Project layout

```
bakwas/
├── src/                   # Flask app, DB, summarizer, providers, subtitles
├── templates/             # Jinja2 templates + partials
├── static/                # CSS, JavaScript, images
├── config/
│   └── providers.yaml     # Shipped provider registry (edit providers.local.yaml to override)
├── data/                  # SQLite database (bind-mounted in Docker)
├── run.py                 # Entry point
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Troubleshooting

**Rate limit errors.** Increase `RATE_LIMIT_SUMMARIZE` in `.env` or set `DEBUG=True` for a single run.

**No models in the dropdown.** You haven't set a provider API key that matches any enabled entry in `config/providers.yaml`. Set at least `ANTHROPIC_API_KEY`, or edit the provider registry.

**Permission errors on the database.** `chmod 755 ./data` from the project root.

**Template not found.** Templates must live at `templates/` in the project root, not inside `src/templates/`.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

AI-generated summaries may contain inaccuracies. Always verify important information against the original video.
