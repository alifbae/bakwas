# Troubleshooting

## Rate limit errors

Increase the per-hour cap:

```ini
# .env
RATE_LIMIT_SUMMARIZE=60 per hour
```

Or disable limits entirely for a single run:

```ini
DEBUG=True
```

See [Rate limiting](../configuration/rate-limiting.md) for the full syntax.

## No models in the dropdown

You haven't set a provider API key that matches any enabled entry in `config/providers.yaml`. Set at least `ANTHROPIC_API_KEY` in `.env`, or edit the provider registry.

The container logs this on startup when no providers are enabled:

```
[bakwas] No enabled providers. Set at least one provider API key in .env ...
```

## Permission errors on the database

```bash
chmod 755 ./data
```

The container runs as a non-root user (`appuser`, UID 1000). The host `./data` directory must be writable by that UID.

## Template not found

Templates must live at `templates/` in the project root, not inside `src/templates/`. This applies if you're building your own image or running locally without Docker.

## Container uses a lot of memory

~300MB resident is normal for the Bakwas container. The Python runtime, LiteLLM, and yt-dlp together account for most of it. If you need a smaller footprint, drop Gunicorn to a single worker by editing `Dockerfile`:

```dockerfile
CMD ["gunicorn", "--workers", "1", "--threads", "8", ...]
```

That saves roughly 100MB with a small tradeoff in request parallelism.

## Long LLM calls time out behind Cloudflare

Cloudflare's proxy enforces a 100-second response limit. Regenerating a long video through a slow model can sometimes exceed it. Either switch to a faster model for that request, or set the DNS record for the Bakwas subdomain to DNS-only (grey cloud) to bypass the proxy.
