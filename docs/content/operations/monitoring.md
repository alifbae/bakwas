# Monitoring

## Health check

```bash
curl http://localhost:5000/health
```

Returns `{"status":"healthy"}` with HTTP 200 when the app is serving.

## Docker health status

The container ships with a health check configured:

```bash
docker inspect bakwas-app | grep -A 10 Health
```

Docker marks the container healthy after three successful checks (about 90 seconds after start).

## Logs

The container logs to stdout/stderr:

```bash
docker logs -f bakwas-app
# or
docker-compose logs -f bakwas
```

Both Gunicorn access logs and Flask application logs appear in the same stream.

## Memory footprint

Out of the box:

- **Idle**: ~60 MB resident. LiteLLM and its provider SDKs are deferred until a summarize request arrives.
- **After first summary**: ~200 MB. Once loaded, those modules stay resident for the life of the worker.
- **Growth**: flat afterwards. Python caches modules but your summaries themselves don't leak memory.

If you see continuous growth over time, open an issue with `docker stats` output.

## Verbose LLM debugging

Set `DEBUG=True` in `.env` to enable verbose LiteLLM logging. Useful when diagnosing provider-specific issues — the logs will show the exact request/response shapes. Debug mode also disables rate limiting.
