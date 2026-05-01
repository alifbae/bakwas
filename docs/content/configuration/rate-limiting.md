# Rate limiting

Only `/summarize` and `/summarize/stream` are rate limited. Every other endpoint — homepage, `/models`, `/health`, `/stats`, `/search`, detail view, delete — runs unthrottled.

This is intentional: the summarize endpoints are the only ones that do expensive outbound work (caption fetch plus an LLM call), so that's where abuse protection matters.

## Default

```
30 per hour
```

## Overriding the limit

Set `RATE_LIMIT_SUMMARIZE` in `.env`:

```ini
RATE_LIMIT_SUMMARIZE=60 per hour
```

Any [Flask-Limiter](https://flask-limiter.readthedocs.io/) expression works, including compound rules joined with `;`:

```ini
RATE_LIMIT_SUMMARIZE=5 per minute;100 per day
```

## Disabling limits in development

Rate limiting is skipped automatically whenever any of these are set:

- `DEBUG=True`
- `FLASK_ENV=development`
- `LOCAL=true`

The Docker image leaves these unset, so production traffic is throttled by `RATE_LIMIT_SUMMARIZE`. Local `python run.py` sessions pick up `.env` and are typically unthrottled.

## Storage backend

Flask-Limiter uses in-memory storage (`memory://`) by default. The shipped Docker image runs a single Gunicorn worker, so counters are process-local and accurate. If you ever scale to multiple workers or multiple containers, switch the storage URI to Redis to share counters across processes — otherwise each worker maintains its own independent quota.
