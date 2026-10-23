"""Page-by-page PDF extraction with optional OCR and AI enhancement."""
from functools import lru_cache
import io
import logging
from pathlib import Path
from typing import Any

import fitz
from PIL import Image
import pytesseract

from ..config import ai_config
from ..database import get_settings, replace_questions, update_project
from .ai_service import AIError, extract_questions_with_ai
from .question_parser import parse_page_text

logger = logging.getLogger(__name__)
MIN_TEXT_CHARACTERS = 12


@lru_cache(maxsize=1)
def ocr_capabilities() -> dict[str, Any]:
    try:
        version = str(pytesseract.get_tesseract_version())
        languages = pytesseract.get_languages(config="")
        return {
            "available": True,
            "version": version,
            "languages": languages,
            "hindi": "hin" in languages,
            "english": "eng" in languages,
        }
    except Exception:
        return {
            "available": False,
            "version": None,
            "languages": [],
            "hindi": False,
            "english": False,
        }


def _ocr_page(page: fitz.Page) -> str:
    capabilities = ocr_capabilities()
    languages = [code for code in ("eng", "hin") if code in capabilities["languages"]]
    if not languages:
        raise RuntimeError("Tesseract has no English or Hindi language data installed.")
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), alpha=False)
    image = Image.open(io.BytesIO(pixmap.tobytes("png")))
    return pytesseract.image_to_string(image, lang="+".join(languages), config="--psm 6")


def process_project(project_id: str, pdf_path: str) -> None:
    """Synchronous worker suitable for FastAPI BackgroundTasks or a task queue."""
    from ..database import get_project

    project = get_project(project_id)
    if not project:
        return
    settings = get_settings()
    update_project(
        project_id, status="processing", progress=0, processed_pages=0,
        readable_pages=0, unreadable_pages=[], warnings=[], error=None,
    )
    questions: list[dict[str, Any]] = []
    unreadable: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    readable_pages = 0
    methods: set[str] = set()
    config = ai_config()

    try:
        document = fitz.open(pdf_path)
        total_pages = len(document)
        if total_pages == 0:
            raise ValueError("This PDF has no pages.")
        update_project(project_id, total_pages=total_pages)

        for index, page in enumerate(document):
            page_number = index + 1
            try:
                text = page.get_text("text", sort=True).strip()
                extraction_source = "text"
                if len(text.strip()) < MIN_TEXT_CHARACTERS and settings.get("auto_ocr", True):
                    if ocr_capabilities()["available"]:
                        try:
                            ocr_text = _ocr_page(page).strip()
                            if len(ocr_text) > len(text):
                                text = ocr_text
                                extraction_source = "ocr"
                        except Exception as exc:
                            warnings.append({"page": page_number, "message": f"OCR failed: {exc}"})
                    else:
                        warnings.append({
                            "page": page_number,
                            "message": "Scanned page needs OCR, but Tesseract is not configured on the server.",
                        })

                if len(text.strip()) < MIN_TEXT_CHARACTERS:
                    unreadable.append({
                        "page": page_number,
                        "reason": "No readable embedded text" + (
                            "; OCR unavailable or disabled" if extraction_source == "text" else "; OCR returned no usable text"
                        ),
                    })
                else:
                    readable_pages += 1
                    page_questions: list[dict[str, Any]] = []
                    if config["extraction_enabled"] and config["api_key"]:
                        try:
                            page_questions = extract_questions_with_ai(text, page_number)
                            if page_questions:
                                methods.add("ai")
                        except AIError as exc:
                            warnings.append({"page": page_number, "message": str(exc) + " Local parser used."})
                    if not page_questions:
                        page_questions = parse_page_text(text, page_number)
                        if page_questions:
                            methods.add("ocr+local" if extraction_source == "ocr" else "local")
                    for question in page_questions:
                        question["extraction_source"] = extraction_source
                    questions.extend(page_questions)
                    if not page_questions:
                        warnings.append({
                            "page": page_number,
                            "message": "Readable text found, but no numbered MCQ pattern was detected. No question was invented.",
                        })
            except Exception as exc:
                logger.exception("Failed to process project %s page %s", project_id, page_number)
                unreadable.append({"page": page_number, "reason": f"Page processing error: {exc}"})

            processed = page_number
            update_project(
                project_id,
                processed_pages=processed,
                readable_pages=readable_pages,
                unreadable_pages=unreadable,
                warnings=warnings[-100:],
                progress=max(1, round(processed / total_pages * 95)),
            )

        document.close()
        replace_questions(project_id, questions)
        if readable_pages == 0:
            update_project(
                project_id, status="failed", progress=100,
                error="No readable pages were found. Install/configure Hindi + English OCR, then retry this project.",
                extraction_method="none",
            )
        else:
            update_project(
                project_id, status="ready", progress=100,
                extraction_method="+".join(sorted(methods)) or "text-read",
                error=None if questions else "Pages were read, but no supported numbered MCQs were found. Check the PDF format or enable AI extraction.",
            )
    except Exception as exc:
        logger.exception("PDF processing failed for project %s", project_id)
        update_project(project_id, status="failed", error=f"Could not process PDF: {exc}", progress=100)
