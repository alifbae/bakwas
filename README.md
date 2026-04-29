# Bakwas

YouTube video transcript summarizer powered by Claude AI. Extract and summarize video transcripts to cut through the "bakwas" (nonsense) and get to the point.

## Features

- **YouTube Integration** - Automatically extracts English subtitles from any YouTube video
- **AI-Powered Summaries** - Uses Claude AI models for intelligent summarization
- **Multiple Summary Styles** - Choose between concise bullet points or comprehensive paragraphs
- **History Tracking** - Stores all summaries in a local SQLite database
- **Dark/Light Theme** - Beautiful UI with Pico CSS and theme switching
- **Rate Limited** - Built-in protection against API abuse
- **Docker Ready** - Production-ready containerization with health checks

## Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/bakwas.git
cd bakwas

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run the application
python run.py
```

Visit http://localhost:5000

### Docker Deployment

```bash
# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:5000/health
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional
PORT=5000
DEBUG=False
SECRET_KEY=generate_with_command_below
```

Generate a secure SECRET_KEY:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Rate Limits

Default rate limits per IP address:

- Global: 200 requests/day, 50 requests/hour
- /summarize endpoint: 10 requests/hour

Adjust in `src/app.py` if needed.

## Architecture

```
Bakwas/
├── src/                    # Application source code
│   ├── __init__.py        # Package initialization
│   ├── app.py             # Flask application and routes
│   ├── database.py        # SQLite database operations
│   ├── subtitles.py       # YouTube subtitle extraction
│   ├── summarizer.py      # AI summarization logic
│   └── utils.py           # Helper functions
├── templates/             # Jinja2 HTML templates
├── static/                # CSS, JavaScript, images
├── data/                  # SQLite database (created at runtime)
├── run.py                 # Application entry point
├── Dockerfile             # Docker container definition
├── docker-compose.yml     # Docker Compose configuration
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

## Security

### Implemented Security Features

- **Rate Limiting** - Prevents API abuse with per-IP limits
- **URL Validation** - Only accepts YouTube URLs
- **SQL Injection Protection** - Parameterized queries throughout
- **Security Headers** - CSP, X-Frame-Options via Flask-Talisman
- **Non-Root Docker User** - Container runs as unprivileged user
- **Error Sanitization** - Generic errors to clients, detailed logs server-side
- **Health Check Endpoint** - `/health` for monitoring

### Pre-Deployment Checklist

- [ ] Set `DEBUG=False` in production
- [ ] Generate and set unique `SECRET_KEY`
- [ ] Secure your `ANTHROPIC_API_KEY`
- [ ] Set up HTTPS/TLS (use reverse proxy like Nginx)
- [ ] Configure firewall rules
- [ ] Enable container security scanning
- [ ] Set up monitoring and logging
- [ ] Configure automated backups

### Reverse Proxy Setup

Example Nginx configuration for HTTPS:

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

## API Endpoints

### GET /

Homepage with summary form and history table

### GET /models

Returns available Claude models

```json
{
  "models": [
    {
      "id": "anthropic/claude-sonnet-4-6",
      "name": "Claude Sonnet 4",
      "default": true
    }
  ]
}
```

### POST /summarize

Create a new summary

**Parameters:**

- `url` (required) - YouTube video URL
- `model` (optional) - Claude model ID
- `length` (optional) - `concise` or `comprehensive`

**Response:**

```json
{
  "summary": "Markdown formatted summary...",
  "title": "Video Title",
  "creator": "Channel Name",
  "video_date": "2026-04-29",
  "caption_length": 15000,
  "model_used": "anthropic/claude-sonnet-4-6",
  "summary_length": "comprehensive"
}
```

### GET /summary/:id

View a specific summary

### POST /summary/:id/delete

Delete a summary

### GET /health

Health check endpoint

```json
{
  "status": "healthy"
}
```

## Development

### Project Structure

The application follows a modular structure with separation of concerns:

- **app.py** - Flask routes and application setup
- **database.py** - All database operations
- **subtitles.py** - YouTube integration and caption extraction
- **summarizer.py** - AI model interaction
- **utils.py** - Configuration and helper functions

### Hot Reload

Set `DEBUG=True` in your `.env` file for auto-reload during development:

```bash
# In .env
DEBUG=True

# Run locally
python run.py
```

Flask will automatically reload when you modify Python files, templates, or static files.

### Database

SQLite database is created automatically at `data/summaries.db` with the following schema:

```sql
CREATE TABLE summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    creator TEXT,
    video_date TEXT,
    subtitles TEXT,
    summary TEXT NOT NULL,
    model_used TEXT,
    summary_length TEXT DEFAULT 'shortest',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Monitoring

### Health Checks

```bash
# HTTP endpoint
curl http://localhost:5000/health

# Docker health check (automatic)
docker inspect bakwas-app | grep Health -A 10
```

### Logs

```bash
# Docker logs
docker-compose logs -f

# Specific container
docker-compose logs -f bakwas
```

### Database Backup

```bash
# Backup
cp ./data/summaries.db ./data/summaries.db.backup

# Restore
cp ./data/summaries.db.backup ./data/summaries.db
docker-compose restart
```

## Troubleshooting

### Container won't start

```bash
docker-compose logs bakwas
```

### Rate limit errors

Increase limits in `src/app.py`:

```python
@limiter.limit("20 per hour")  # Increase from default 10
```

### Template not found

Ensure templates are in the `templates/` directory at project root, not in `src/templates/`.

### Permission errors

```bash
chmod 755 ./data
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

AI-generated summaries may contain inaccuracies. Always verify important information from the original source.

## Acknowledgments

- Built with [Flask](https://flask.palletsprojects.com/)
- UI powered by [Pico CSS](https://picocss.com/)
- Summaries by [Anthropic Claude](https://www.anthropic.com/)
- YouTube extraction via [yt-dlp](https://github.com/yt-dlp/yt-dlp)
