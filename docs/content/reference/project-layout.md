# Project layout

```
bakwas/
├── src/                   # Flask app, DB, summarizer, providers, subtitles
│   ├── app.py             # Flask routes, startup, rate limit config
│   ├── database.py        # SQLite access (get_all_summaries, save_summary, ...)
│   ├── providers.py       # Provider registry: YAML loader + model discovery
│   ├── summarizer.py      # Prompt templates + LiteLLM dispatch
│   ├── subtitles.py       # yt-dlp caption extraction + URL canonicalization
│   └── utils.py           # Small helpers (env parsing, is_local, rate-limit config)
├── templates/             # Jinja2 templates + partials
│   ├── base.html          # Page shell (nav, settings modal, scripts)
│   ├── index.html         # Homepage (form + summaries table)
│   ├── detail.html        # Individual summary view
│   └── partials/          # navbar, footer, modal, icons
├── static/                # CSS, JavaScript, images
│   ├── css/styles.css
│   └── js/                # theme, modal, preferences, index, detail, ...
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

**Single Docker container.** The whole app runs in one image. Database is SQLite in a bind-mounted volume.

**Provider registry, not hardcoded SDKs.** `src/providers.py` loads `config/providers.yaml` at startup. Any OpenAI-compatible endpoint can be added without code changes.

**LiteLLM as the dispatch layer.** One code path (`litellm.completion`) handles every provider type. Authentication is resolved per-call from the provider config.

**Gunicorn in Docker, Werkzeug locally.** The Dockerfile runs `gunicorn --workers 2 --threads 4` for production. `python run.py` uses Flask's built-in dev server with hot reload.

**URL-based caching.** Summaries are keyed by canonical YouTube URL + model + summary length. Resubmitting the same combination returns the cached summary without calling the LLM.
