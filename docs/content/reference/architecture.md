# Architecture

One-page overview of how the app fits together. Use this as the fast
onboarding doc; longer guides live in the rest of this reference section.

## 30-second model

Bakwas is a small Flask app that summarizes YouTube transcripts with any
LiteLLM-compatible model. Storage is SQLite. Rendering is server-side Jinja
plus vanilla ES modules in the browser. No bundler, no framework.

## Request flow

```
Browser                             Flask (src/app.py)           Storage/LLM
  │                                   │                               │
  │  GET /                            │                               │
  │──────────────────────────────────▶│                               │
  │                                   │  get_all_summaries()          │
  │                                   │──────────────────────────────▶│ SQLite
  │     index.html (server-rendered)  │                               │
  │◀──────────────────────────────────│                               │
  │                                   │                               │
  │  main.js + pages/index.js load    │                               │
  │  (ES modules, browser-imported)   │                               │
  │                                   │                               │
  │  POST /summarize/stream           │                               │
  │──────────────────────────────────▶│                               │
  │                                   │  subtitles.get_video_info     │
  │                                   │──────────────────────────────▶│ yt-dlp
  │     SSE: event=meta               │                               │
  │◀──────────────────────────────────│                               │
  │                                   │  summarizer.summarize_stream  │
  │                                   │──────────────────────────────▶│ LiteLLM
  │     SSE: event=chunk (×N)         │                               │
  │◀──────────────────────────────────│                               │
  │                                   │  database.save_summary        │
  │                                   │──────────────────────────────▶│ SQLite
  │     SSE: event=done               │                               │
  │◀──────────────────────────────────│                               │
```

## Project layout

```
bakwas/
├── src/                   # Flask app, DB, summarizer, providers, subtitles
│   ├── app.py             # Flask routes, startup, rate-limit config
│   ├── database.py        # SQLite access layer
│   ├── providers.py       # Provider registry: YAML loader + model discovery
│   ├── summarizer.py      # Prompt templates + lazy LiteLLM dispatch
│   ├── subtitles.py       # yt-dlp caption extraction + URL canonicalization
│   └── utils.py           # Tiny helpers (env readers)
├── templates/             # Jinja templates
│   ├── base.html          # Page shell (nav, footer, scripts)
│   ├── index.html         # Homepage (form + summaries table + URL preview)
│   ├── detail.html        # Individual summary view
│   ├── 404.html           # Themed 404 page
│   └── partials/          # navbar, footer, modal macro, icons
├── static/
│   ├── css/styles.css
│   └── js/                # ES modules (no jQuery, no bundler)
│       ├── main.js        # Base entry, loaded on every page
│       ├── modules/       # Shared helpers (see JS module index below)
│       └── pages/         # One file per page controller
├── config/
│   ├── providers.yaml     # Shipped provider registry (git-tracked)
│   └── providers.local.yaml  # User override (git-ignored)
├── tests/                 # pytest (Python) + vitest (JS) suites
├── data/                  # SQLite database (bind-mounted in Docker)
├── docs/                  # This documentation site (MkDocs Material)
├── run.py                 # Entry point (Werkzeug dev server)
├── Dockerfile             # Production image (runs Gunicorn)
├── docker-compose.yml
├── pyproject.toml         # pytest config
├── package.json           # vitest config
└── requirements.txt
```

## Data model

One table, `summaries`, in SQLite:

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `url` | TEXT UNIQUE | canonicalized YouTube URL; cache key with `model_used` + `summary_length` |
| `title`, `creator`, `video_date` | TEXT | metadata from yt-dlp |
| `subtitles` | TEXT | raw transcript (cleaned VTT) |
| `summary` | TEXT | LLM-generated markdown |
| `model_used` | TEXT | e.g. `openai/gpt-4o-mini` |
| `summary_length` | TEXT | `concise` or `comprehensive` |
| `prompt_tokens`, `completion_tokens` | INTEGER | usage from LiteLLM |
| `cost_usd` | REAL | cost from LiteLLM pricing map |
| `duration_seconds` | INTEGER | video length |
| `created_at` | TIMESTAMP | set by SQLite |

Migrations live inline in `database.py::init_db` as best-effort
`ALTER TABLE ADD COLUMN` wrapped in try/except (SQLite doesn't support
`IF NOT EXISTS` on column additions).

## JavaScript module index

Every module starts with a `@module` JSDoc block listing its dependencies
and consumers. Grep `@module` in `static/js/` for the full index.

```
static/js/
├── main.js              # Base entry; registers actions, boots all modules
└── modules/
    ├── actions.js       # data-action / data-form-action delegation registry
    ├── api.js           # Every backend endpoint wrapped here
    ├── command-palette.js  # Cmd/Ctrl+K overlay
    ├── datetime.js      # UTC → local timestamp rewrite
    ├── delete-confirm.js # Shared "are you sure" dialog wiring
    ├── dom.js           # escapeHtml, readJsonScript, cloneTemplate, isMacPlatform
    ├── modal.js         # openModal / closeModal
    ├── preferences.js   # localStorage prefs + settings dialog
    ├── sse.js           # parseSseEvent, consumeEventStream (pure protocol)
    ├── theme.js         # data-theme toggle
    ├── toast.js         # Toast notifications + flash drain
    └── youtube.js       # URL parsing + oEmbed fetch

pages/
├── index.js             # Homepage: URL preview, streaming submit
└── detail.js            # Detail page: render + regenerate flow
```

## Where to add …

| Change | Where |
|---|---|
| A new Flask route | `src/app.py`. Add `@limiter.limit` if it calls an LLM. |
| A new LLM provider | `config/providers.yaml`. No code change. |
| A new JS API endpoint | `static/js/modules/api.js`. |
| A new preference | `PREFS_KEYS` in `modules/preferences.js`, plus dialog + `tests/js`. |
| A new modal | `{% call modal(id=…) %}` in a template. Close via `data-action="close-modal"`. |
| A new page | Template extending `base.html`, plus `static/js/pages/<name>.js`. |
| A new env var | `.env.example` + a reader in `src/utils.py`. |
| A new external domain | CSP dict in `src/app.py`. |

## Key architectural choices

**Single Docker container.** The whole app runs in one image. The database
is SQLite in a bind-mounted volume.

**Provider registry, not hardcoded SDKs.** `src/providers.py` loads
`config/providers.yaml` at startup. Any OpenAI-compatible endpoint can be
added without code changes, plus native Anthropic and Ollama support.

**LiteLLM lazy-loaded.** The LiteLLM module and its vendor SDKs are
imported on first call to `/summarize` (and `/summarize/stream`). The idle
process stays around 60 MB. After the first summary, LiteLLM adds about
140 MB and stays resident for subsequent requests.

**Streaming-first UI.** The homepage submits summarize requests to the SSE
endpoint and renders Markdown progressively as tokens arrive. A
non-streaming endpoint still exists as a fallback for other callers.

**Gunicorn in Docker, Werkzeug locally.** The Dockerfile runs
`gunicorn --workers 1 --threads 8 --worker-class gthread` for production.
`python run.py` uses Flask's built-in dev server with hot reload.

**URL-based caching.** Summaries are keyed by canonical YouTube URL + model
+ summary length. Resubmitting the same combination returns the cached
summary without calling the LLM. "Regenerate" explicitly bypasses the cache.

**Asset fingerprinting.** CSS and JS URLs include a version query string
derived from the newest file mtime in `static/`. Browsers cache assets
indefinitely between deploys and revalidate automatically when source
files change.

**Favicon set.** The container serves properly-sized PNGs (16, 32, 180 for
iOS) plus a multi-resolution `.ico` instead of a single large logo. Saves
around 180 KB on initial page load.

**Vanilla ES modules, no framework.** The browser loads plain ES modules.
No React/Vue/Svelte/Alpine, no bundler, no TypeScript compile step. HTML
fragments live in `<template>` elements; UI triggers use `data-action`
delegation instead of inline `onclick`.

## Config surfaces

| Surface | File | Purpose |
|---|---|---|
| Provider registry | `config/providers.yaml` | Shipped LLM providers |
| Local provider override | `config/providers.local.yaml` | User-only (git-ignored) |
| Runtime env | `.env` | API keys + config (see `.env.example`) |
| SQLite path override | `BAKWAS_DB_PATH` env var | Used by tests (temp DB) |
| CSP allowlist | `src/app.py` (`csp` dict) | External script/style/img/connect domains |
| Rate limits | `RATE_LIMIT_SUMMARIZE` env var | Per-IP limit on `/summarize` |

## Tests

- **Python:** `pytest` — routes (happy paths + cache-hit path of `/summarize`),
  database layer, subtitles parsing. External services (LiteLLM, yt-dlp,
  noembed) are never hit in tests.
- **JS:** `vitest` with jsdom — pure modules (`dom`, `youtube`, `sse`,
  `preferences`).

Run with `pytest` or `npm test`. See [Development](../development/index.md).

## Dependencies

| Layer | File | Update cadence |
|---|---|---|
| Python runtime | `requirements.txt` | Dependabot weekly; **yt-dlp daily**. |
| Python dev | `requirements-dev.txt` | Dependabot weekly. |
| JS test tooling | `package.json` | Dependabot weekly. |
| CDN scripts | `templates/base.html` (marked) | Manually, pinned to a major. |
| GitHub Actions | `.github/workflows/` | Dependabot weekly. |

yt-dlp is on a daily Dependabot schedule because YouTube changes often and
stale builds break caption extraction; we want fast PRs so we can verify
and merge.

## Security

- `flask-talisman` sets CSP in `src/app.py`. Allowlist is explicit.
- `flask-limiter` rate-limits `/summarize` and `/summarize/stream`; anything
  not on those limits is unthrottled.
- `SECRET_KEY` from env; a random one is generated if missing.
- URL validation via `src/subtitles.py::validate_youtube_url` before yt-dlp.
