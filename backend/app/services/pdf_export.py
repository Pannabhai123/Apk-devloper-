"""Presentation PDF export with embedded, HarfBuzz-shaped Hindi font support."""
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

import fitz
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from ..config import ASSET_DIR
from .slide_service import build_slide_plan, enrich_answer_options

PAGE_W = 13.333333 * inch
PAGE_H = 7.5 * inch
FONT_NAME = "DreamNotoDevanagari"
pdfmetrics.registerFont(TTFont(FONT_NAME, str(ASSET_DIR / "NotoSansDevanagari.ttf")))


def _paragraph(c: canvas.Canvas, text: str, x: float, top: float, width: float, height: float,
               size: float, color: str, align=TA_LEFT, bold: bool = False,
               valign: str = "top", min_size: float = 7) -> None:
    """Draw fitted Unicode text; dimensions are top-origin inches."""
    safe = escape(text).replace("\n", "<br/>")
    chosen = None
    actual_w = actual_h = 0
    current = size
    while current >= min_size:
        style = ParagraphStyle(
            "slide", fontName=FONT_NAME, fontSize=current, leading=current * 1.22,
            textColor=HexColor(color), alignment=align, shaping=1,
            spaceAfter=0, spaceBefore=0,
        )
        para = Paragraph(safe, style)
        actual_w, actual_h = para.wrap(width * inch, height * inch)
        chosen = para
        if actual_h <= height * inch:
            break
        current -= 0.5
    if chosen is None:
        return
    # At the minimum size Paragraph.wrap still reports the required height. Reduce further for extreme input.
    while actual_h > height * inch and current > 4:
        current -= 0.5
        style = ParagraphStyle(
            "slide-fit", fontName=FONT_NAME, fontSize=current, leading=current * 1.18,
            textColor=HexColor(color), alignment=align, shaping=1,
        )
        chosen = Paragraph(safe, style)
        actual_w, actual_h = chosen.wrap(width * inch, height * inch)
    y = PAGE_H - (top * inch) - actual_h
    if valign == "middle":
        y = PAGE_H - (top * inch) - (height * inch + actual_h) / 2
    chosen.drawOn(c, x * inch, y)


def _rect(c, x, top, width, height, fill, stroke=None, radius=0.08):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    c.roundRect(x * inch, PAGE_H - (top + height) * inch, width * inch, height * inch,
                radius * inch, stroke=1 if stroke else 0, fill=1)


def _base(c, settings, plan, index, total):
    c.setFillColor(HexColor(settings["background_color"]))
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    _paragraph(c, "DREAM CLASSES", 0.65, 0.28, 4, 0.3, 12, settings["highlight_color"], bold=True)
    _paragraph(c, "PPT MAKER AI", 10.2, 0.28, 2.45, 0.3, 9, "#92A59A", TA_RIGHT)
    _rect(c, 0.65, 0.73, 12.03, 0.012, "#2A3A31", radius=0)
    _paragraph(c, "DREAM SIR  •  KOTHWARA, DOBHI, GAYA", 0.65, 7.12, 7, 0.18, 7, "#71877A")
    _paragraph(c, f"{index:02d} / {total:02d}", 11.2, 7.1, 1.45, 0.2, 8, "#71877A", TA_RIGHT)


def _render_question(c, settings, plan, index, total):
    _base(c, settings, plan, index, total)
    highlight = settings["highlight_color"]
    label = f"Q{plan['number']}" if settings.get("show_question_numbers", True) else "QUESTION"
    if plan.get("continuation"):
        label += " · CONTINUED"
    _paragraph(c, label.upper(), 0.67, 0.94, 5, 0.36, 13, highlight)
    _paragraph(c, f"SOURCE PAGE {plan['page_number']}", 9.8, 0.96, 2.85, 0.3, 9, "#92A59A", TA_RIGHT)
    has_options = bool(plan["options"])
    include_answer = plan.get("include_answer")
    question_height = 1.72 if has_options else (3.6 if include_answer else 5.25)
    _paragraph(c, plan["text"], 0.67, 1.39, 11.95, question_height,
               settings["question_font_size"], settings["question_color"], valign="middle", min_size=10)
    if has_options:
        options = plan["options"]
        compact = len(options) > 2 and max(len(o["text"]) for o in options) < 95 and len(plan["text"]) < 520
        bottom = 5.92 if include_answer else 6.82
        start_y = 3.34
        available = bottom - start_y
        if compact:
            rows = (len(options) + 1) // 2
            box_h = min(1.18, (available - (rows - 1) * 0.16) / rows)
            for i, option in enumerate(options):
                row, col = divmod(i, 2)
                x, y, w = 0.67 + col * 6.08, start_y + row * (box_h + 0.16), 5.87
                _rect(c, x, y, w, box_h, "#101D16", "#263C30")
                _paragraph(c, f"{option['label']}.  {option['text']}", x + 0.15, y + 0.05,
                           w - 0.3, box_h - 0.1, settings["option_font_size"],
                           settings["option_color"], valign="middle", min_size=8)
        else:
            count = max(1, len(options))
            box_h = min(0.82, (available - (count - 1) * 0.12) / count)
            for i, option in enumerate(options):
                y = start_y + i * (box_h + 0.12)
                _rect(c, 0.67, y, 11.95, box_h, "#101D16", "#263C30")
                _paragraph(c, f"{option['label']}.  {option['text']}", 0.83, y + 0.04,
                           11.62, box_h - 0.08, settings["option_font_size"],
                           settings["option_color"], valign="middle", min_size=8)
    if include_answer:
        answer = plan.get("correct_answer") or "Answer not provided"
        content = f"ANSWER: {answer}"
        if plan.get("answer_text"):
            content += f" — {plan['answer_text']}"
        if plan.get("explanation"):
            content += f"\nExplanation: {plan['explanation']}"
        _paragraph(c, content, 0.75, 5.98, 11.75, 0.82, 17, highlight, valign="middle")
    if plan.get("continues"):
        _paragraph(c, "CONTINUED ON NEXT SLIDE →", 8.7, 6.8, 3.9, 0.2, 8, highlight, TA_RIGHT)


def _render_answer(c, settings, plan, index, total):
    _base(c, settings, plan, index, total)
    highlight = settings["highlight_color"]
    answer = plan.get("correct_answer")
    _paragraph(c, f"Q{plan['number']}  /  ANSWER REVEAL", 0.67, 0.97, 5.5, 0.36, 13, highlight)
    if plan["answer_source"] == "ai":
        badge = "AI-GENERATED  •  UNCERTAIN  •  VERIFY" if plan["answer_confidence"] == "uncertain" else "AI-GENERATED  •  VERIFY BEFORE TEACHING"
        _rect(c, 8.52, 0.92, 4.1, 0.43, "#302015", "#694323")
        _paragraph(c, badge, 8.64, 1.02, 3.86, 0.2, 7, highlight, TA_CENTER)
    if not answer:
        _paragraph(c, "Answer not provided", 0.75, 2.15, 11.75, 0.9, 34, highlight, TA_CENTER)
        _paragraph(c, "Review this question or use configured AI answer generation.", 1.2, 3.25, 10.9, 0.55, 17, "#B5C2BA", TA_CENTER)
    else:
        _paragraph(c, "CORRECT OPTION", 0.75, 1.72, 3, 0.3, 11, "#9BACA1")
        _paragraph(c, str(answer), 0.72, 2.04, 2.1, 1.4, 66, highlight, valign="middle")
        if plan.get("answer_text"):
            _paragraph(c, plan["answer_text"], 2.75, 2.05, 9.55, 1.35, 29,
                       settings["question_color"], valign="middle", min_size=10)
    has_options = bool(plan.get("options"))
    if plan.get("explanation"):
        box_height = 1.72 if has_options else 2.65
        text_height = 0.82 if has_options else 1.65
        _rect(c, 0.7, 3.85, 11.92, box_height, "#101D16", "#2A3D31")
        _paragraph(c, "EXPLANATION", 0.98, 4.08, 3.2, 0.3, 11, highlight)
        _paragraph(c, plan["explanation"], 0.98, 4.53, 11.35, text_height, 20, "#F2F5F2", min_size=8)
    elif answer:
        text_height = 1.3 if has_options else 1.75
        _paragraph(c, plan["text"], 1, 4.15, 11.3, text_height, 17, "#A9B8AE", TA_CENTER, valign="middle")
    if has_options:
        text = "    ".join(f"{o['label']}. {o['text']}" for o in plan["options"])
        _paragraph(c, text, 0.9, 5.82, 11.5, 0.68, 14, settings["option_color"], TA_CENTER)


def generate_pdf(questions: list[dict[str, Any]], settings: dict[str, Any], output_path: str | Path) -> int:
    plans = build_slide_plan(questions, settings)
    enrich_answer_options(plans, questions)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_path), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("Dream Classes Questions")
    c.setAuthor("Dream Sir · Dream Classes")
    for index, plan in enumerate(plans, start=1):
        if plan["kind"] == "question":
            _render_question(c, settings, plan, index, len(plans))
        else:
            _render_answer(c, settings, plan, index, len(plans))
        c.showPage()
    c.save()
    with fitz.open(output_path) as verified:
        if len(verified) != len(plans):
            raise RuntimeError("PDF validation failed after export.")
    return len(plans)
