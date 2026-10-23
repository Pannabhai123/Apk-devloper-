"""Dream Classes PPT Maker AI — FastAPI application."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from .config import EXPORT_DIR, FRONTEND_DIST, MAX_UPLOAD_MB, UPLOAD_DIR, ai_config
from .database import (
    create_project, delete_project, get_export, get_project, get_question,
    get_settings, init_db, latest_export, list_exports, list_projects,
    list_questions, record_export, replace_questions, update_project,
    update_question, update_settings,
)
from .schemas import GenerateRequest, QuestionUpdate, SettingsUpdate
from .services.ai_service import AIError, AINotConfigured, generate_missing_answers, is_ai_configured
from .services.pdf_export import generate_pdf
from .services.pdf_processor import ocr_capabilities, process_project
from .services.pptx_service import generate_pptx
from .services.question_parser import recompute_flags


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Dream Classes PPT Maker AI",
    description="Bilingual PDF-to-editable-PowerPoint workflow for Dream Sir",
    version="1.1.0",
    lifespan=lifespan,
)
origins = {
    "http://localhost:5173", "http://127.0.0.1:5173",
    "capacitor://localhost", "https://localhost", "http://localhost",
    "https://appassets.androidplatform.net",
}
origins.update(origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip())
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origins), allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def require_project(project_id: str) -> dict[str, Any]:
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def safe_name(value: str) -> str:
    value = re.sub(r"[^\w\- ]+", "", value, flags=re.UNICODE).strip().replace(" ", "_")
    return value[:80] or "Dream_Classes"


def public_project(project: dict[str, Any]) -> dict[str, Any]:
    """Do not leak the server's upload path to browsers or the APK."""
    return {key: value for key, value in project.items() if key != "pdf_path"}


@app.get("/api/health")
def health() -> dict[str, Any]:
    config = ai_config()
    return {
        "status": "ok",
        "service": "Dream Classes PPT Maker AI",
        "capabilities": {
            "pdf_text": True,
            "pptx": True,
            "pdf_export": True,
            "ocr": ocr_capabilities(),
            "ai_configured": is_ai_configured(),
            "ai_extraction_enabled": config["extraction_enabled"] and is_ai_configured(),
            "ai_model": config["model"] if is_ai_configured() else None,
        },
    }


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    projects = list_projects()
    exports = list_exports()
    return {
        "stats": {
            "projects": len(projects),
            "questions": sum(project["question_count"] for project in projects),
            "presentations": sum(1 for export in exports if export["kind"] == "pptx"),
            "pages_processed": sum(project["processed_pages"] for project in projects),
        },
        "recent_projects": [public_project(project) for project in projects[:4]],
        "recent_exports": [{k: v for k, v in export.items() if k != "path"} for export in exports[:4]],
    }


@app.post("/api/projects", status_code=202)
async def upload_project(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    filename = Path(file.filename or "questions.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please choose a PDF file.")
    project_id = create_project(Path(filename).stem, filename, "")
    destination = UPLOAD_DIR / f"{project_id}.pdf"
    size = 0
    first_chunk = b""
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                if not first_chunk:
                    first_chunk = chunk
                size += len(chunk)
                if size > MAX_UPLOAD_MB * 1024 * 1024:
                    raise HTTPException(413, f"PDF exceeds the {MAX_UPLOAD_MB} MB upload limit.")
                output.write(chunk)
        if size == 0 or b"%PDF" not in first_chunk[:1024]:
            raise HTTPException(400, "The selected file is not a valid PDF.")
        update_project(project_id, pdf_path=str(destination), status="uploaded")
    except Exception:
        destination.unlink(missing_ok=True)
        delete_project(project_id)
        raise
    finally:
        await file.close()
    background_tasks.add_task(process_project, project_id, str(destination))
    return public_project(require_project(project_id))


@app.get("/api/projects")
def projects() -> list[dict[str, Any]]:
    return [public_project(project) for project in list_projects()]


@app.get("/api/projects/{project_id}")
def project(project_id: str) -> dict[str, Any]:
    return public_project(require_project(project_id))


@app.get("/api/projects/{project_id}/questions")
def questions(project_id: str) -> list[dict[str, Any]]:
    require_project(project_id)
    return list_questions(project_id)


@app.post("/api/projects/{project_id}/retry", status_code=202)
def retry_project(project_id: str, background_tasks: BackgroundTasks):
    item = require_project(project_id)
    if item["status"] == "processing":
        raise HTTPException(409, "This project is already processing.")
    background_tasks.add_task(process_project, project_id, item["pdf_path"])
    return public_project(require_project(project_id))


@app.delete("/api/projects/{project_id}", status_code=204)
def remove_project(project_id: str):
    item = require_project(project_id)
    Path(item["pdf_path"]).unlink(missing_ok=True)
    for export in list_exports(project_id):
        Path(export["path"]).unlink(missing_ok=True)
    delete_project(project_id)
    return Response(status_code=204)


@app.patch("/api/questions/{question_id}")
def edit_question(question_id: str, update: QuestionUpdate):
    existing = get_question(question_id)
    if not existing:
        raise HTTPException(404, "Question not found")
    values = update.model_dump(exclude_unset=True)
    if "correct_answer" in values and "answer_source" not in values:
        values["answer_source"] = "manual" if values["correct_answer"] else "none"
        values["answer_confidence"] = "certain" if values["correct_answer"] else "none"
    merged = {**existing, **values}
    values["flags"] = recompute_flags(merged)
    update_question(question_id, values)
    return get_question(question_id)


@app.delete("/api/questions/{question_id}", status_code=204)
def remove_question(question_id: str):
    existing = get_question(question_id)
    if not existing:
        raise HTTPException(404, "Question not found")
    project_id = existing["project_id"]
    remaining = [q for q in list_questions(project_id) if q["id"] != question_id]
    replace_questions(project_id, remaining)
    return Response(status_code=204)


@app.post("/api/projects/{project_id}/generate-answers")
def generate_answers(project_id: str):
    require_project(project_id)
    questions = list_questions(project_id)
    missing = [q for q in questions if not q.get("correct_answer")]
    if not missing:
        return {"updated": 0, "questions": questions, "message": "All questions already have answers."}
    try:
        updates = generate_missing_answers(missing)
    except AINotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except AIError as exc:
        raise HTTPException(502, str(exc)) from exc
    for question in missing:
        if question["id"] not in updates:
            continue
        merged = {**question, **updates[question["id"]]}
        update_question(question["id"], {**updates[question["id"]], "flags": recompute_flags(merged)})
    return {
        "updated": len(updates),
        "not_answered": len(missing) - len(updates),
        "questions": list_questions(project_id),
        "message": "AI answers are labelled and must be verified before teaching.",
    }


@app.post("/api/projects/{project_id}/generate")
def generate_presentation(project_id: str, request: GenerateRequest):
    item = require_project(project_id)
    questions = list_questions(project_id)
    if not questions:
        raise HTTPException(409, "No extracted questions are available. Review the PDF processing errors first.")
    settings = request.model_dump()
    filename = f"{project_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}.pptx"
    destination = EXPORT_DIR / filename
    try:
        slide_count, _ = generate_pptx(questions, settings, destination, item["title"])
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    export = record_export(project_id, "pptx", str(destination), request.mode, slide_count)
    update_project(project_id, generation_settings=settings)
    return {
        "export": {k: v for k, v in export.items() if k != "path"},
        "slide_count": slide_count,
        "download_url": f"/api/projects/{project_id}/download/pptx",
    }


def _export_settings(project: dict[str, Any]) -> dict[str, Any]:
    defaults = GenerateRequest(
        mode=get_settings().get("default_mode", "C"),
        font_family=get_settings().get("default_font", "Nirmala UI"),
    ).model_dump()
    return {**defaults, **(project.get("generation_settings") or {})}


@app.get("/api/projects/{project_id}/download/pptx")
def download_pptx(project_id: str):
    item = require_project(project_id)
    export = latest_export(project_id, "pptx")
    if not export:
        raise HTTPException(409, "Generate the PowerPoint before downloading it.")
    if not Path(export["path"]).is_file():
        raise HTTPException(404, "The exported file is missing. Generate it again.")
    return FileResponse(
        export["path"], media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"{safe_name(item['title'])}_Mode_{export['mode']}.pptx",
    )


@app.get("/api/projects/{project_id}/download/pdf")
def download_pdf(project_id: str):
    item = require_project(project_id)
    questions = list_questions(project_id)
    if not questions:
        raise HTTPException(409, "No questions are available to export.")
    settings = _export_settings(item)
    destination = EXPORT_DIR / f"{project_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}.pdf"
    slide_count = generate_pdf(questions, settings, destination)
    record_export(project_id, "pdf", str(destination), settings["mode"], slide_count)
    return FileResponse(destination, media_type="application/pdf", filename=f"{safe_name(item['title'])}_Slides.pdf")


@app.get("/api/projects/{project_id}/download/questions")
def download_questions(project_id: str):
    item = require_project(project_id)
    payload = {
        "project": item["title"], "source_file": item["original_filename"],
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "questions": list_questions(project_id),
    }
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    return Response(
        content, media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={safe_name(item['title'])}_Questions.json"},
    )


@app.get("/api/projects/{project_id}/download/answer-key")
def download_answer_key(project_id: str):
    item = require_project(project_id)
    questions = list_questions(project_id)
    if not questions:
        raise HTTPException(409, "No questions are available to export.")
    lines = [
        "DREAM CLASSES — ANSWER KEY", f"Teacher: Dream Sir | {item['title']}",
        "Kothwara, Dobhi, Gaya, Bihar", "=" * 60, "",
    ]
    for index, question in enumerate(questions, start=1):
        answer = question.get("correct_answer") or "Not provided"
        answer_text = next((o["text"] for o in question["options"] if o["label"] == answer), "")
        source = question.get("answer_source", "none")
        suffix = " [AI-GENERATED — VERIFY]" if source == "ai" else ""
        if question.get("answer_confidence") == "uncertain":
            suffix += " [UNCERTAIN]"
        lines.append(f"Q{question.get('number') or index}. {answer}{' — ' + answer_text if answer_text else ''}{suffix}")
        if question.get("explanation"):
            lines.append(f"   Explanation: {question['explanation']}")
    content = ("\n".join(lines) + "\n").encode("utf-8")
    return Response(
        content, media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={safe_name(item['title'])}_Answer_Key.txt"},
    )


@app.get("/api/exports")
def export_history(project_id: str | None = None):
    return [{k: v for k, v in export.items() if k != "path"} for export in list_exports(project_id)]


@app.get("/api/exports/{export_id}/download")
def download_export(export_id: str):
    export = get_export(export_id)
    if not export or not Path(export["path"]).is_file():
        raise HTTPException(404, "Export not found. Please generate it again from the project.")
    item = require_project(export["project_id"])
    media_type = "application/pdf" if export["kind"] == "pdf" else "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    return FileResponse(export["path"], media_type=media_type, filename=f"{safe_name(item['title'])}.{export['kind']}")


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    return get_settings()


@app.put("/api/settings")
def save_settings(update: SettingsUpdate):
    values = update.model_dump(exclude_unset=True)
    update_settings(values)
    return get_settings()


# A production build can be served by the same backend. API routes above always win.
if FRONTEND_DIST.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "API route not found")
        requested = (FRONTEND_DIST / full_path).resolve()
        if requested.is_file() and FRONTEND_DIST in requested.parents:
            return FileResponse(requested)
        index = FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(index)
        return JSONResponse({"message": "Frontend build not found. Run npm run build."}, status_code=404)
