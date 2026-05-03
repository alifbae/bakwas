"""
Shared pytest fixtures.

Every test gets a fresh, file-backed temp database (via BAKWAS_DB_PATH) so
parallel or subsequent tests don't leak state — and so the real
`summaries.db` in the workspace is never touched.
"""

import importlib
import os

import pytest


@pytest.fixture
def temp_db_path(tmp_path, monkeypatch):
    """Point the app at a temp SQLite file for the duration of the test."""
    db_path = tmp_path / "summaries.db"
    monkeypatch.setenv("BAKWAS_DB_PATH", str(db_path))
    # The env var is read at import time; reload `src.database` so it picks
    # up the new value. Reloading `src.app` wires it up for the test client.
    from src import database

    importlib.reload(database)
    database.init_db()
    yield str(db_path)


@pytest.fixture
def client(temp_db_path):
    """Flask test client talking to a temp DB."""
    from src import app as app_module

    importlib.reload(app_module)
    app_module.app.config.update(TESTING=True)
    with app_module.app.test_client() as client:
        yield client
