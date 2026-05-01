# Bakwas

Skip the bakwas ("nonsense") — extract and summarize YouTube video transcripts with the LLM of your choice.

Bakwas is a small, self-hosted Flask app that pulls captions from a YouTube video, sends them through the LLM provider you configure (Anthropic, OpenAI, Google, DeepSeek, Groq, OpenRouter, a local Ollama, or any OpenAI-compatible endpoint), and stores the summary in a local SQLite database so you can revisit it later.

## Features

- Pluggable provider registry — any OpenAI-compatible endpoint works, plus native Anthropic support
- Real-time streaming of summaries as tokens arrive (no blank-screen wait)
- Concise (bulleted) or comprehensive (paragraph) summary styles
- URL-based caching so resubmitting the same video + model + length is free
- Per-summary cost and token tracking, with a usage total in the settings modal
- Server-side sorting and pagination of past summaries
- Fuzzy command palette (Cmd/Ctrl+K) for searching summaries and running actions
- Preferences: default model, default summary style, items-per-page
- Paste-to-preview: thumbnail and title appear as soon as you paste a YouTube URL
- Dark and light themes with popover definition of the word "bakwas"
- Rate limiting only on the expensive endpoint, disabled automatically in local dev
- Ships as a single Docker container with a SQLite volume
- Lightweight: lazy-loaded LLM libraries keep idle memory around 60 MB

## Next steps

- [Get started with Docker](getting-started/docker.md) — the recommended way to run Bakwas.
- [Run it locally for development](getting-started/local.md) — Python 3.12, hot reload, no container needed.
- [Configure providers](configuration/providers.md) — plug in the LLM backends you want to use.
