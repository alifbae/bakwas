# Docker

The recommended way to run Bakwas. Production-grade out of the box with Gunicorn, health checks, and a SQLite volume.

## Quick start

```bash
# Clone the repo
git clone https://github.com/alifbae/bakwas.git
cd bakwas

# Configure your provider keys
cp .env.example .env
# Edit .env and set at least ANTHROPIC_API_KEY (or another provider key)

# Start the container
docker-compose up -d
```

Bakwas is now available at [http://localhost:5000](http://localhost:5000).

!!! tip "No key? No models."
    Bakwas hides any provider whose API key isn't set, so if the model dropdown is empty you need at least one provider key in `.env`. See [Providers](../configuration/providers.md) for the full list.

## Compose reference

The repo ships with a working `docker-compose.yml`. Here is the minimal version:

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

## Volumes

| Host path | Container path | Purpose |
| --- | --- | --- |
| `./data` | `/app/data` | SQLite database. Required if you want summaries to survive restarts. |
| `./config/providers.local.yaml` | `/app/config/providers.local.yaml` | Optional. Override the shipped provider registry without rebuilding. |

## Production notes

- The image runs **Gunicorn** with 2 worker processes × 4 threads. The Flask dev server is not used in the container.
- The health check hits `/health` every 30 seconds and accepts 3 failures before marking the container unhealthy.
- Logs go to stdout/stderr and are visible via `docker logs bakwas-app` or `docker-compose logs -f bakwas`.
