"""Small SQLite persistence layer; every worker/request gets its own connection."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import sqlite3
from typing import Any, Iterator
from uuid import uuid4

from .config import DATABASE_PATH


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid4())


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    db = sqlite3.connect(DATABASE_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    finally:
        db.close()


def init_db() -> None:
    with connection() as db:
        db.executescript(
            """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                pdf_path TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'uploaded',
                progress INTEGER NOT NULL DEFAULT 0,
                total_pages INTEGER NOT NULL DEFAULT 0,
                processed_pages INTEGER NOT NULL DEFAULT 0,
                readable_pages INTEGER NOT NULL DEFAULT 0,
                unreadable_pages TEXT NOT NULL DEFAULT '[]',
                warnings TEXT NOT NULL DEFAULT '[]',
                error TEXT,
                extraction_method TEXT NOT NULL DEFAULT 'local',
                generation_settings TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                number TEXT NOT NULL DEFAULT '',
                text TEXT NOT NULL,
                options TEXT NOT NULL DEFAULT '[]',
                correct_answer TEXT,
                explanation TEXT,
                answer_source TEXT NOT NULL DEFAULT 'none',
                answer_confidence TEXT NOT NULL DEFAULT 'none',
                flags TEXT NOT NULL DEFAULT '[]',
                page_number INTEGER NOT NULL,
                extraction_method TEXT NOT NULL DEFAULT 'local'
            );
            CREATE INDEX IF NOT EXISTS idx_questions_project
                ON questions(project_id, position);
            CREATE TABLE IF NOT EXISTS exports (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                path TEXT NOT NULL,
                mode TEXT NOT NULL,
                slide_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        defaults = {
            "teacher_name": "Dream Sir",
            "institute_name": "Dream Classes",
            "address": "Kothwara, Dobhi, Gaya, Bihar",
            "default_mode": "C",
            "auto_ocr": True,
            "default_font": "Nirmala UI",
        }
        for key, value in defaults.items():
            db.execute(
                "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
                (key, json.dumps(value)),
            )


def _decode(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    item = dict(row)
    for key in ("unreadable_pages", "warnings", "options", "flags", "generation_settings"):
        if key in item and isinstance(item[key], str):
            try:
                item[key] = json.loads(item[key])
            except json.JSONDecodeError:
                item[key] = []
    return item


def get_project(project_id: str) -> dict[str, Any] | None:
    with connection() as db:
        row = db.execute(
            """SELECT p.*,
               (SELECT COUNT(*) FROM questions q WHERE q.project_id=p.id) AS question_count,
               (SELECT COUNT(*) FROM exports e WHERE e.project_id=p.id AND e.kind='pptx') AS pptx_count
               FROM projects p WHERE p.id=?""",
            (project_id,),
        ).fetchone()
    return _decode(row)


def list_projects() -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute(
            """SELECT p.*,
               (SELECT COUNT(*) FROM questions q WHERE q.project_id=p.id) AS question_count,
               (SELECT COUNT(*) FROM exports e WHERE e.project_id=p.id AND e.kind='pptx') AS pptx_count
               FROM projects p ORDER BY p.created_at DESC"""
        ).fetchall()
    return [_decode(row) for row in rows]


def update_project(project_id: str, **fields: Any) -> None:
    if not fields:
        return
    fields["updated_at"] = utc_now()
    encoded = {
        key: json.dumps(value, ensure_ascii=False) if key in {"unreadable_pages", "warnings", "generation_settings"} else value
        for key, value in fields.items()
    }
    assignments = ", ".join(f"{key}=?" for key in encoded)
    with connection() as db:
        db.execute(
            f"UPDATE projects SET {assignments} WHERE id=?",
            (*encoded.values(), project_id),
        )


def create_project(title: str, filename: str, path: str) -> str:
    project_id = new_id()
    now = utc_now()
    with connection() as db:
        db.execute(
            """INSERT INTO projects(id,title,original_filename,pdf_path,status,created_at,updated_at)
               VALUES(?,?,?,?, 'uploaded',?,?)""",
            (project_id, title, filename, path, now, now),
        )
    return project_id


def replace_questions(project_id: str, questions: list[dict[str, Any]]) -> None:
    with connection() as db:
        db.execute("DELETE FROM questions WHERE project_id=?", (project_id,))
        for position, question in enumerate(questions):
            db.execute(
                """INSERT INTO questions(
                    id,project_id,position,number,text,options,correct_answer,explanation,
                    answer_source,answer_confidence,flags,page_number,extraction_method
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    question.get("id", new_id()), project_id, position,
                    str(question.get("number", "")), question["text"],
                    json.dumps(question.get("options", []), ensure_ascii=False),
                    question.get("correct_answer") or None,
                    question.get("explanation") or None,
                    question.get("answer_source", "pdf" if question.get("correct_answer") else "none"),
                    question.get("answer_confidence", "certain" if question.get("correct_answer") else "none"),
                    json.dumps(question.get("flags", []), ensure_ascii=False),
                    question.get("page_number", 1), question.get("extraction_method", "local"),
                ),
            )


def list_questions(project_id: str) -> list[dict[str, Any]]:
    with connection() as db:
        rows = db.execute(
            "SELECT * FROM questions WHERE project_id=? ORDER BY position", (project_id,)
        ).fetchall()
    return [_decode(row) for row in rows]


def get_question(question_id: str) -> dict[str, Any] | None:
    with connection() as db:
        row = db.execute("SELECT * FROM questions WHERE id=?", (question_id,)).fetchone()
    return _decode(row)


def update_question(question_id: str, values: dict[str, Any]) -> None:
    encoded = dict(values)
    for key in ("options", "flags"):
        if key in encoded:
            encoded[key] = json.dumps(encoded[key], ensure_ascii=False)
    assignments = ", ".join(f"{key}=?" for key in encoded)
    with connection() as db:
        db.execute(f"UPDATE questions SET {assignments} WHERE id=?", (*encoded.values(), question_id))


def delete_question(question_id: str) -> None:
    with connection() as db:
        db.execute("DELETE FROM questions WHERE id=?", (question_id,))


def record_export(project_id: str, kind: str, path: str, mode: str, slide_count: int) -> dict[str, Any]:
    export = {
        "id": new_id(), "project_id": project_id, "kind": kind, "path": path,
        "mode": mode, "slide_count": slide_count, "created_at": utc_now(),
    }
    with connection() as db:
        db.execute(
            """INSERT INTO exports(id,project_id,kind,path,mode,slide_count,created_at)
               VALUES(:id,:project_id,:kind,:path,:mode,:slide_count,:created_at)""",
            export,
        )
    return export


def list_exports(project_id: str | None = None) -> list[dict[str, Any]]:
    query = """SELECT e.*,p.title AS project_title,p.original_filename
               FROM exports e JOIN projects p ON p.id=e.project_id"""
    params: tuple[Any, ...] = ()
    if project_id:
        query += " WHERE e.project_id=?"
        params = (project_id,)
    query += " ORDER BY e.created_at DESC"
    with connection() as db:
        return [dict(row) for row in db.execute(query, params).fetchall()]


def latest_export(project_id: str, kind: str = "pptx") -> dict[str, Any] | None:
    with connection() as db:
        row = db.execute(
            "SELECT * FROM exports WHERE project_id=? AND kind=? ORDER BY created_at DESC LIMIT 1",
            (project_id, kind),
        ).fetchone()
    return dict(row) if row else None


def get_export(export_id: str) -> dict[str, Any] | None:
    with connection() as db:
        row = db.execute("SELECT * FROM exports WHERE id=?", (export_id,)).fetchone()
    return dict(row) if row else None


def delete_project(project_id: str) -> None:
    with connection() as db:
        db.execute("DELETE FROM projects WHERE id=?", (project_id,))


def get_settings() -> dict[str, Any]:
    with connection() as db:
        rows = db.execute("SELECT key,value FROM settings").fetchall()
    return {row["key"]: json.loads(row["value"]) for row in rows}


def update_settings(values: dict[str, Any]) -> None:
    with connection() as db:
        for key, value in values.items():
            db.execute(
                "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, json.dumps(value, ensure_ascii=False)),
            )
