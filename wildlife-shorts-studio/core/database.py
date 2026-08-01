"""SQLite persistence for projects.

Each project's full generated package (script, scenes, prompts, SEO,
captions, voiceover path) is stored as a single JSON blob alongside a few
indexed columns used for the dashboard's project list. This keeps the schema
stable even as generators evolve — new fields just appear in the JSON
without a migration.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from core.config import DB_PATH
from core.models import Project

_SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
);
"""


@contextmanager
def _connect(db_path: Path = DB_PATH):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(db_path: Path = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute(_SCHEMA)


def save_project(project: Project, db_path: Path = DB_PATH) -> int:
    """Insert a new project, or update it in place if project.id is set."""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    title = project.script.title if project.script else project.topic
    data = project.to_json()

    with _connect(db_path) as conn:
        if project.id is None:
            cur = conn.execute(
                "INSERT INTO projects (topic, title, created_at, updated_at, data) "
                "VALUES (?, ?, ?, ?, ?)",
                (project.topic, title, now, now, data),
            )
            return int(cur.lastrowid)

        conn.execute(
            "UPDATE projects SET topic = ?, title = ?, updated_at = ?, data = ? "
            "WHERE id = ?",
            (project.topic, title, now, data, project.id),
        )
        return project.id


def get_project(project_id: int, db_path: Path = DB_PATH) -> Project | None:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, created_at, data FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
    if row is None:
        return None
    return Project.from_json(row["data"], project_id=row["id"], created_at=row["created_at"])


def list_projects(db_path: Path = DB_PATH, limit: int = 50) -> list[dict]:
    """Lightweight rows for the dashboard list — no JSON parsing needed."""
    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, topic, title, created_at, updated_at FROM projects "
            "ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def delete_project(project_id: int, db_path: Path = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))


def count_projects(db_path: Path = DB_PATH) -> int:
    with _connect(db_path) as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM projects").fetchone()
    return int(row["n"])


def get_analytics(db_path: Path = DB_PATH) -> dict:
    """Lightweight aggregate stats for the dashboard. Loads every row's JSON
    blob, which is fine at desktop-app scale (dozens to low hundreds of
    projects); revisit with an indexed column if this ever needs to scale
    further."""
    rows = list_projects(db_path=db_path, limit=10_000)
    total = len(rows)
    scores = []
    with _connect(db_path) as conn:
        for r in conn.execute("SELECT data FROM projects").fetchall():
            try:
                project = Project.from_json(r["data"], project_id=0, created_at="")
                if project.script is not None:
                    scores.append(project.script.viral_score)
            except (KeyError, ValueError):
                continue
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    return {
        "total_projects": total,
        "average_viral_score": avg_score,
        "most_recent_topic": rows[0]["topic"] if rows else "—",
    }
