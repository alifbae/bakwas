# Bakwas

Skip the bakwas ("nonsense") — extract and summarize YouTube video transcripts with the LLM of your choice.

<p align="center">
  <img src="docs/images/homepage.png" alt="Bakwas homepage" width="720" />
</p>

Bakwas is a small, self-hosted Flask app that pulls captions from a YouTube video, sends them through the LLM provider you configure (Anthropic, OpenAI, Google, DeepSeek, Groq, OpenRouter, a local Ollama, or any OpenAI-compatible endpoint), and stores the summary in a local database so you can revisit it later.

## Features

- Works with any LLM via a pluggable provider registry — OpenAI-compatible endpoints are fully supported
- Concise (bulleted) or comprehensive (paragraph) summary styles
- Server-side sorting, pagination, and URL-based caching so you don't pay to regenerate the same summary twice
- Settings for default model, default summary style, and cost usage
- Ships as a single Docker container with a SQLite volume

## Quick start

```bash
git clone https://github.com/alifbae/bakwas.git
cd bakwas

cp .env.example .env
# Set at least ANTHROPIC_API_KEY (or another provider key)

docker-compose up -d
```

Bakwas is now available at [http://localhost:5000](http://localhost:5000).

## Full documentation

Comprehensive docs are at **[docs.bakwas.alifbae.dev](https://docs.bakwas.alifbae.dev)**, including:

- [Getting started with Docker](https://docs.bakwas.alifbae.dev/getting-started/docker/)
- [Local development setup](https://docs.bakwas.alifbae.dev/getting-started/local/)
- [Environment variables](https://docs.bakwas.alifbae.dev/configuration/env/)
- [Provider configuration](https://docs.bakwas.alifbae.dev/configuration/providers/)
- [Rate limiting](https://docs.bakwas.alifbae.dev/configuration/rate-limiting/)
- [Reverse proxy setup](https://docs.bakwas.alifbae.dev/operations/reverse-proxy/)
- [Troubleshooting](https://docs.bakwas.alifbae.dev/operations/troubleshooting/)

## License

MIT — see [LICENSE](LICENSE).
