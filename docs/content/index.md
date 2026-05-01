# Bakwas

Skip the bakwas ("nonsense") — extract and summarize YouTube video transcripts with the LLM of your choice.

Bakwas is a small, self-hosted Flask app that pulls captions from a YouTube video, sends them through the LLM provider you configure (Anthropic, OpenAI, Google, DeepSeek, Groq, OpenRouter, a local Ollama, or any OpenAI-compatible endpoint), and stores the summary in a local SQLite database so you can revisit it later.

## Features

- Works with any LLM via a pluggable provider registry — OpenAI-compatible endpoints are fully supported
- Concise (bulleted) or comprehensive (paragraph) summary styles
- Server-side sorting, pagination, and URL-based caching so you don't pay to regenerate the same summary twice
- Settings modal for default model, default summary style, and items-per-page preferences
- Dark and light themes
- Rate limiting on the expensive endpoint only, disabled automatically in local dev
- Ships as a single Docker container with a SQLite volume

## Next steps

- [Get started with Docker](getting-started/docker.md) — the recommended way to run Bakwas.
- [Run it locally for development](getting-started/local.md) — Python 3.12, hot reload, no container needed.
- [Configure providers](configuration/providers.md) — plug in the LLM backends you want to use.
