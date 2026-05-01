# Reverse proxy

Bakwas listens on HTTP port 5000 and expects a reverse proxy to terminate TLS in production.

## Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Nginx Proxy Manager (NPM)

If you're running NPM, add a Proxy Host with:

- **Scheme**: `http`
- **Forward hostname / IP**: `bakwas` (the compose service name, if NPM is on the same network) or the host IP
- **Forward port**: `5000`
- **Websockets support**: off (Bakwas doesn't use websockets)
- **SSL**: enabled, with Let's Encrypt or your own cert

## Cloudflare

Works out of the box. Bakwas doesn't require any special headers or WAF rules. If you use Cloudflare's proxy (orange cloud), be aware that requests have a [100 second response limit](https://developers.cloudflare.com/support/troubleshooting/cloudflare-errors/troubleshooting-cloudflare-5xx-errors/) — long LLM calls can occasionally exceed this. If that happens, switch to a DNS-only record (grey cloud) for the subdomain running Bakwas.
