# Project layout

```
bakwas/
├── src/                   # Flask app, DB, summarizer, providers, subtitles
│   ├── app.py             # Flask routes, startup, rate limit config
│   ├── database.py        # SQLite access (get_all_summaries, save_summary, …)
│   ├── providers.py       # Provider registry: YAML loader + model discovery
│   ├── summarizer.py      # Prompt templates + lazy LiteLLM dispatch (stream + non-stream)
│   ├── subtitles.py       # yt-dlp caption extraction + URL canonicalization
│   └── utils.py           # Small helpers (env parsing, is_local, rate-limit config)
├── templates/             # Jinja2 templates
│   ├── base.html          # Page shell (nav, footer, scripts)
│   ├── index.html         # Homepage (form + summaries table + URL preview)
│   ├── detail.html        # Individual summary view with thumbnail + metadata
│   ├── 404.html           # Themed 404 page
│   └── partials/          # navbar, footer, modal (reusable macro), icons
├── static/                # CSS, JavaScript, images, favicons
│   ├── css/styles.css
│   └── js/                # theme, modal, preferences, toast, command-palette,
│                          # delete-confirm, datetime, index, detail
├── config/
│   └── providers.yaml     # Shipped provider registry (git-tracked)
│                          # Override via providers.local.yaml (git-ignored)
├── data/                  # SQLite database (bind-mounted in Docker)
├── docs/                  # This documentation site (MkDocs Material)
├── run.py                 # Entry point (Werkzeug dev server)
├── Dockerfile             # Production image (runs Gunicorn)
├── docker-compose.yml
└── requirements.txt
```

## Key architectural choices

**Single Docker container.** The whole app runs in one image. The database is SQLite in a bind-mounted volume.

**Provider registry, not hardcoded SDKs.** `src/providers.py` loads `config/providers.yaml` at startup. Any OpenAI-compatible endpoint can be added without code changes, plus native Anthropic and Ollama support.

**LiteLLM lazy-loaded.** The LiteLLM module and its vendor SDKs are imported on first call to `/summarize` (and `/summarize/stream`). The idle process stays around 60 MB. After the first summary, LiteLLM adds about 140 MB and stays resident for subsequent requests.

**Streaming-first UI.** The homepage submits summarize requests to the SSE endpoint and renders Markdown progressively as tokens arrive. A non-streaming endpoint still exists as a fallback for other callers.

**Gunicorn in Docker, Werkzeug locally.** The Dockerfile runs `gunicorn --workers 1 --threads 8 --worker-class gthread` for production. `python run.py` uses Flask's built-in dev server with hot reload.

**URL-based caching.** Summaries are keyed by canonical YouTube URL + model + summary length. Resubmitting the same combination returns the cached summary without calling the LLM. "Regenerate" explicitly bypasses the cache.

**Asset fingerprinting.** CSS and JS URLs include a version query string derived from the newest file mtime in `static/`. Browsers cache assets indefinitely between deploys and revalidate automatically when source files change.

**Favicon set.** The container serves properly-sized PNGs (16, 32, 180 for iOS) plus a multi-resolution `.ico` instead of a single large logo. Saves around 180 KB on initial page load.

**No client-side framework.** Vanilla JS + jQuery for DOM helpers and Pico CSS for base styling. Everything else is hand-written and commented.
