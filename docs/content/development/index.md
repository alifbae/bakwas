# Development

Everything you need to contribute to Bakwas: environment setup, code style
tooling, and running the test suites.

For local setup (running the app against a real provider), see
[Local development](../getting-started/local.md). This page covers
contributor workflow.

## Setup

Install development dependencies:

```bash
pip install -r requirements-dev.txt
```

This installs:

- **pre-commit** — Git hook framework
- **black** — Python code formatter
- **flake8** — Python linter
- **isort** — Python import sorter
- **pytest** — Python test runner

Install the Git hooks:

```bash
pre-commit install
```

For the JavaScript test suite:

```bash
npm install
```

That installs vitest + jsdom into `node_modules/`.

## Code style

### Python

- **Black** for formatting (line length 100, the default).
- **isort** with the black-compatible profile for import ordering.
- **flake8** for lint. Follow PEP 8.
- **JavaScript:** 2-space indent, semicolons required, double quotes,
  line length 100.
- **CSS / HTML:** 2-space indent, Prettier defaults.

### Pre-commit hooks

The hooks run automatically on each commit. They:

1. Format Python code with Black.
2. Sort Python imports with isort.
3. Lint Python code with flake8.
4. Format JS/CSS/HTML with Prettier.
5. Check for trailing whitespace, missing final newlines, and similar.

Run them manually if you want to check everything up front:

```bash
# All files
pre-commit run --all-files

# Staged files only
pre-commit run

# A specific hook
pre-commit run black --all-files
pre-commit run prettier --all-files
```

### Running individual tools

```bash
# Format in place
black .
isort .

# Check without modifying
black --check .
isort --check .

# Lint
flake8 src/ run.py

# Prettier (JS / CSS / HTML / JSON / Markdown)
npx prettier --write "**/*.{js,css,html,json,md}"
npx prettier --check "**/*.{js,css,html,json,md}"
```

## Tests

Two suites, one per language.

### Python — pytest

Exercises the Flask routes, the database layer, and `src/subtitles.py`
parsing. External services (LiteLLM, yt-dlp, noembed) are never hit in
tests; we only test the cache-hit path of `/summarize` so nothing outbound
fires.

```bash
pytest
```

Tests use a temp SQLite database via the `BAKWAS_DB_PATH` env var (set by
the `temp_db_path` fixture in `tests/conftest.py`). Your real
`summaries.db` is never touched.

### JavaScript — vitest

Runs under jsdom. Targets the pure modules (`dom`, `youtube`, `sse`,
`preferences`).

```bash
npm test
```

### Testing philosophy

- Favor testing pure functions and happy-path routes over aiming for high
  coverage.
- Mock external services (LiteLLM, yt-dlp, noembed) at the seam, not over
  the wire.
- Use an in-memory or temp SQLite for any test touching the database.
- Every new bug gets a test. Every new feature gets at least one happy-path
  test.

## Configuration files

| File | Purpose |
|---|---|
| `.pre-commit-config.yaml` | Pre-commit hook configuration |
| `.prettierrc` | Prettier formatting rules |
| `.prettierignore` | Files excluded from Prettier |
| `requirements-dev.txt` | Development dependencies |
| `pyproject.toml` | pytest config |
| `package.json` | vitest + test deps |
| `vitest.config.js` | jsdom environment, test glob |

## Skipping hooks (not recommended)

```bash
git commit --no-verify
```

## Maintenance

Update pre-commit hooks to their latest pinned versions:

```bash
pre-commit autoupdate
```

Clear the pre-commit cache if hooks misbehave:

```bash
pre-commit clean
```

Reinstall the Git hooks:

```bash
pre-commit uninstall
pre-commit install
```

## Troubleshooting

### Pre-commit modified files during a commit

The hooks ran, auto-fixed formatting, and aborted the commit. Review the
changes, stage them, and commit again:

```bash
git add .
git commit
```

### Tests fail only in one environment

- Python tests rely on the `BAKWAS_DB_PATH` env var — make sure nothing
  else in your shell has it set to an existing DB.
- JS tests run under jsdom; anything using browser-only APIs outside
  `window` / `document` / `localStorage` / `fetch` may fail. Mock it or
  move the logic into a pure helper.

## Project conventions

Higher-level conventions (file layout rules, what goes where, the
`data-action` pattern, "things not to do") live in the [Architecture](../reference/architecture.md)
page and in `.kiro/steering/project-conventions.md`.
