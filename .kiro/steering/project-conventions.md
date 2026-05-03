---
inclusion: always
---

# Bakwas — Project Conventions

Conventions for this repo. Follow them before making changes. These exist to
keep the codebase consistent and predictable for anyone (human or AI) working
on it.

## Stack summary

- **Backend:** Flask 3.x + SQLite 3 + LiteLLM (for LLM calls) + yt-dlp (for YouTube captions).
- **Frontend:** Server-rendered Jinja templates + vanilla ES modules. No framework, no build step, no jQuery.
- **Markup:** Pico.css as the base stylesheet, plus `static/css/styles.css` for overrides.
- **Dev deps:** pre-commit, black, flake8, isort. Test deps when added: pytest (Python), vitest (JS).

## File layout (what goes where)

```
src/                Python application code
  app.py            Flask routes + lifecycle
  database.py       SQLite access layer
  providers.py      LLM provider registry (driven by config/providers.yaml)
  subtitles.py      yt-dlp + URL canonicalization
  summarizer.py     LiteLLM prompt + call logic
  utils.py          Tiny helpers (env readers)

static/
  css/              Stylesheets
  js/
    main.js         Base entry module (every page)
    modules/        Shared modules (toast, modal, api, …)
    pages/          One file per page controller (pages/index.js, pages/detail.js)

templates/          Jinja templates
  base.html         Base layout, loads main.js
  partials/         Reusable includes (navbar, footer, icons, modal macro)

config/
  providers.yaml    LLM providers (git-tracked defaults)
  providers.local.yaml  User overrides (git-ignored)

.kiro/steering/     Project-wide agent rules (this file)
```

**Rule:** don't move `static/` or `templates/` under `src/`. Flask's default
layout expects them at the project root and `src/app.py` is wired for that.

## JavaScript conventions

- **Modules, not globals.** Every JS file is an ES module. No `var`, no IIFEs,
  no attaching things to `window` unless explicitly needed.
- **One source of truth for endpoints.** All backend API calls go through
  `static/js/modules/api.js`. Do not `fetch("/…")` from other modules.
- **Pure before impure.** URL parsing, SSE parsing, formatting — these live
  in dedicated modules (`youtube.js`, `sse.js`, `dom.js`) with no DOM access.
- **HTML stays in HTML.** Dynamic fragments live in `<template>` elements
  inside Jinja templates. JS clones via `cloneTemplate(id)` and fills
  `[data-field="…"]` nodes with `textContent`. Avoid `innerHTML = "<div>…"` strings.
- **No inline `onclick`/`onsubmit`.** Use `data-action="name"` on buttons and
  register a handler in `main.js` via `registerAction`. For forms, use
  `data-form-action` + `registerFormAction`.
- **Page wiring goes in `pages/*.js`.** Shared behavior goes in `modules/*.js`.
- **Module header:** every JS module starts with a `@module` JSDoc block that
  names the module, summarizes its purpose, and lists its consumers.

## Python conventions

- **Black** for formatting, line length 100 (default).
- **isort** (black profile) for imports.
- **flake8** for lint.
- Use `with get_db() as conn:` (context manager) for every SQLite access.
- Prefer keyword args on multi-arg calls. It's easier to read and grep.
- For new routes: follow the shape in `src/app.py` — use `limiter.limit` on
  anything that costs money, validate inputs up front, return JSON for API
  routes, render templates for page routes.

## Templates / Jinja conventions

- Use the `modal` macro in `templates/partials/modal.html` for dialogs. Don't
  hand-roll `<dialog>` markup.
- Extend `base.html` with `{% extends "base.html" %}`; don't duplicate head/body scaffolding.
- Add per-page JS via the `extra_scripts` block, as a single `<script type="module">`.
- Don't put JS inside Jinja `{# … #}` comments — some linters mis-parse them.
- Prefer `textContent` (via `data-field` pattern) over re-rendering strings.

## Adding a new X (quick index)

- **A route:** add to `src/app.py`. If it calls an LLM, add `@limiter.limit`.
- **A JS module:** create in `static/js/modules/`. Add `@module` header listing consumers.
- **A page controller:** create in `static/js/pages/`. Reference from that page's template via `extra_scripts`.
- **An API endpoint in JS:** add a wrapper function in `modules/api.js`, then import.
- **A preference:** add the key in `modules/preferences.js` `PREFS_KEYS`, expose getter/setter, update settings dialog.
- **A modal:** `{% call modal(id="...") %}...{% endcall %}` in a template. Close buttons use `data-action="close-modal"`.
- **An LLM provider:** add to `config/providers.yaml`. No code change needed for most.
- **An env var:** document in `.env.example` first, read via `src/utils.py` helpers.

## Verification commands

Before handing a change back, run the appropriate check:

```bash
# Import sanity (fast)
source .venv/bin/activate && python -c "from src import app"

# Pre-commit (formatters + linters)
pre-commit run --all-files

# Python tests (when added)
pytest

# JS tests (when added)
npm test

# Boot the server locally (don't leave running unattended)
python run.py
```

## Things to NOT do

- Don't introduce jQuery, React, Vue, Svelte, Alpine, or a frontend framework.
  The app is vanilla ES modules by design.
- Don't add a bundler or TypeScript compilation step. We use JSDoc for docs,
  no `@ts-check`, no `tsc`.
- Don't add a state management library. Per-request state stays closure-local.
- Don't add new dependencies without asking. If you must, pin to an exact version.
- Don't bypass `api.js` with ad-hoc `fetch(…)` in pages or modules.
- Don't regress `data-action` back into inline `onclick=`.
- Don't delete files without explicit request.
- Don't rewrite files wholesale when a small edit will do.
- Don't run `git push`, `git commit --amend`, or destructive git commands
  without explicit request.

## Security + safety notes

- All user-facing routes that call the LLM are rate-limited via `flask-limiter`.
- `flask-talisman` sets the CSP. If a new external domain is needed
  (script/style/img/connect), update the `csp` dict in `src/app.py`.
- Never log API keys. Never commit `.env` or `providers.local.yaml`.
- Validate YouTube URLs via `src/subtitles.py:validate_youtube_url`. Don't
  shell out to yt-dlp with user input.

## Testing philosophy (if tests are being added)

- Favor testing pure functions and happy-path routes over aiming for high coverage.
- Mock external services (LiteLLM, yt-dlp, noembed) at the seam, not over the wire.
- Use an in-memory or temp SQLite for any test touching the database.
- Every new bug gets a test. Every new feature gets at least one happy path test.

## Architecture

See the [Architecture reference](https://docs.bakwas.alifbae.dev/reference/architecture/)
for a one-page overview of request flow, data model, JS module index, and
where to add each kind of change.
