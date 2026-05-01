# Monitoring

## Health check

```bash
curl http://localhost:5000/health
```

Returns `{"status":"healthy"}` with HTTP 200 when the app is serving. Exempt from rate limiting.

## Docker health status

The container ships with a health check configured:

```bash
docker inspect bakwas-app | grep -A 10 Health
```

Docker marks the container healthy after three successful checks (~90 seconds from start).

## Logs

The container logs to stdout/stderr:

```bash
docker logs -f bakwas-app
# or
docker-compose logs -f bakwas
```

Both Gunicorn access logs and Flask application logs appear in the same stream.

## Verbose LLM debugging

Set `DEBUG=True` in `.env` to enable verbose LiteLLM logging. Useful when diagnosing provider-specific issues — the logs will show the exact request/response shapes.
