"""Generate sample editable PPTX/PDF directly from the checked-in bilingual PDF."""
from pathlib import Path
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import fitz
from app.schemas import GenerateRequest
from app.services.pdf_export import generate_pdf
from app.services.pptx_service import generate_pptx
from app.services.question_parser import parse_page_text

source = ROOT / "samples" / "Dream_Classes_Bilingual_Sample.pdf"
questions = []
with fitz.open(source) as document:
    for index, page in enumerate(document):
        for question in parse_page_text(page.get_text("text", sort=True), index + 1):
            question["id"] = str(uuid4())
            questions.append(question)

settings = GenerateRequest(mode="C").model_dump()
pptx_path = ROOT / "samples" / "Dream_Classes_Sample_Output.pptx"
pdf_path = ROOT / "samples" / "Dream_Classes_Sample_Output.pdf"
slide_count, _ = generate_pptx(questions, settings, pptx_path, "Dream Classes Bilingual Sample")
pdf_count = generate_pdf(questions, settings, pdf_path)
print(f"Extracted {len(questions)} questions from 2 pages")
print(f"PPTX: {pptx_path} ({slide_count} editable slides)")
print(f"PDF: {pdf_path} ({pdf_count} pages)")
