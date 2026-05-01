# Rate limiting

Only `/summarize` is rate limited. Everything else — homepage, `/models`, `/health`, detail view, delete — runs unthrottled.

This is intentional: the summarize endpoint is the only one that does expensive outbound work (caption fetch plus an LLM call), so that's where abuse protection matters.

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

## Gunicorn worker note

When running under Gunicorn (the Docker default), Flask-Limiter uses in-memory storage per worker. With 2 workers, each worker maintains its own counter, so in practice the effective cap across the process group is `2 × RATE_LIMIT_SUMMARIZE`. For a self-hosted app this is almost always fine. If you need strict shared-counter limits, point `storage_uri` at Redis.
