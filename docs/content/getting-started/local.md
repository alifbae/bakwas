# Local development

Requires Python 3.12 or newer. Local dev runs Flask's built-in Werkzeug server with hot reload. The Docker image runs Gunicorn for production — see [Docker](docker.md) for that path.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Set at least one provider key

python run.py
```

Visit [http://localhost:5000](http://localhost:5000).

## Hot reload

Set `DEBUG=True` in `.env` and Flask auto-reloads on changes to Python files, templates, and static assets:

```ini
# .env
DEBUG=True
FLASK_ENV=development
```

```bash
python run.py
```

Rate limiting is also disabled automatically whenever `DEBUG=True`, `FLASK_ENV=development`, or `LOCAL=true`.
