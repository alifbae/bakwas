# Bakwas - YouTube Video Summarizer

A Flask web app that extracts YouTube video captions and summarizes them using Claude Sonnet 4 (via LiteLLM).

## Features

- Extract captions from YouTube videos (automatic or manual)
- Summarize transcripts in 3-5 bullet points using Claude Sonnet 4
- Clean, minimal dark UI
- Docker support for easy deployment

## Setup

### Prerequisites

- Python 3.11+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Anthropic API key

### Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   PORT=5000
   ```

## Running Locally

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the app:
   ```bash
   python app.py
   ```

3. Open your browser to `http://localhost:5000`

## Running with Docker

### Build and run:
```bash
docker compose up -d
```

### View logs:
```bash
docker compose logs -f
```

### Stop the container:
```bash
docker compose down
```

### Rebuild after changes:
```bash
docker compose up -d --build
```

## Development

The `docker-compose.yml` includes volume mounts for `app.py` and `templates/`, so you can edit these files locally and see changes immediately (after restarting the container). This allows you to develop while running in Docker.

For pure local development without Docker, just run `python app.py` directly.

## Project Structure

```
Bakwas/
├── app.py              # Main Flask application
├── templates/
│   └── index.html      # Frontend UI
├── requirements.txt    # Python dependencies
├── Dockerfile          # Docker image configuration
├── docker-compose.yml  # Docker Compose setup
├── .env                # Environment variables (gitignored)
├── .env.example        # Example environment variables
├── .gitignore          # Git ignore patterns
└── README.md           # This file
```

## How It Works

1. User pastes a YouTube URL into the web interface
2. `yt-dlp` extracts the video captions (auto-generated or manual)
3. The transcript is cleaned (VTT formatting removed)
4. Claude Sonnet 4 summarizes the transcript via LiteLLM
5. Summary is displayed to the user

## Model Configuration

The app uses Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`) by default. You can change the model in the `summarize_text()` function in `app.py` if needed.

## Notes

- Videos without captions will return an error
- Very long transcripts are truncated to 8000 characters before summarization
- Port can be customized via the `PORT` environment variable
