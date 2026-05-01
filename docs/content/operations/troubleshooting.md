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

You haven't set a provider API key that matches any enabled entry in `config/providers.yaml`. Set at least `ANTHROPIC_API_KEY` in `.env`, or edit the provider registry to enable a different provider.

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

Templates must live at `templates/` in the project root, not inside `src/templates/`. This only matters if you're building your own image or running locally without Docker.

## Container uses more memory than expected

Idle memory is ~60 MB. After the first summary, it jumps to ~200 MB because LiteLLM and its provider SDKs are loaded lazily on demand and kept resident for subsequent requests. This is expected and steady-state.

If you see memory growing continuously over time (past ~250 MB with no activity), that's abnormal — check `docker stats`, container logs, and open an issue.

## Long LLM calls time out behind Cloudflare

Cloudflare's proxy enforces a 100-second response limit. A long transcript through a slow model can exceed it. Two fixes:

- Use a faster model for that request (the streaming endpoint keeps the connection alive via incremental data, which typically stays within Cloudflare's buffer budget).
- Set the DNS record for the Bakwas subdomain to DNS-only (grey cloud) to bypass the proxy.

## Streaming doesn't work

Streaming requires the reverse proxy to disable response buffering. The Bakwas container sends `X-Accel-Buffering: no` on stream responses, which Nginx and NPM respect. If your proxy still buffers, check its `proxy_buffering` setting (Nginx) or equivalent.

## Cost shows as $0.0000 or "unknown"

The LiteLLM pricing database ships with most major models but occasionally lags brand-new releases. If your cost is missing:

1. Confirm the model name matches an entry in LiteLLM's `model_prices_and_context_window.json`.
2. Update LiteLLM to the latest version in `requirements.txt` and rebuild.
3. For custom proxies where LiteLLM doesn't know the underlying model, cost is reported as "unknown" — that's expected.
