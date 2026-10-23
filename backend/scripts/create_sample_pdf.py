"""Create the bilingual sample used by the end-to-end test (no AI required)."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

from backend.app.config import ASSET_DIR

OUTPUT = ROOT / "samples" / "Dream_Classes_Bilingual_Sample.pdf"
pdfmetrics.registerFont(TTFont("DreamSampleFont", str(ASSET_DIR / "NotoSansDevanagari.ttf")))

pages = [
    [
        ("1. What is the capital of Bihar?", ["A. Gaya", "B. Patna", "C. Muzaffarpur", "D. Bhagalpur"], "Answer: B", "Explanation: Patna is the capital city of Bihar."),
        ("2. Which planet is known as the Red Planet?", ["A. Earth", "B. Venus", "C. Mars", "D. Jupiter"], "Answer: C", "Explanation: Iron minerals in Martian soil give it a red appearance."),
        ("3. Which gas is essential for human respiration?", ["A. Oxygen", "B. Nitrogen", "C. Helium", "D. Hydrogen"], None, None),
    ],
    [
        ("1. भारत की राजधानी क्या है?", ["A. मुंबई", "B. नई दिल्ली", "C. कोलकाता", "D. चेन्नई"], "उत्तर: B", "व्याख्या: नई दिल्ली भारत की राजधानी है।"),
        ("2. सबसे छोटी अभाज्य संख्या कौन-सी है?", ["A. 0", "B. 1", "C. 2", "D. 3"], "उत्तर: C", "व्याख्या: 2 सबसे छोटी और एकमात्र सम अभाज्य संख्या है।"),
        ("3. गया जिला किस राज्य में स्थित है?", ["A. झारखंड", "B. बिहार", "C. उत्तर प्रदेश", "D. मध्य प्रदेश"], "उत्तर: B", "व्याख्या: गया बिहार राज्य का एक जिला है।"),
    ],
]

styles = {
    "title": ParagraphStyle("title", fontName="DreamSampleFont", fontSize=22, leading=28, textColor=HexColor("#173E2A"), shaping=0, spaceAfter=5),
    "subtitle": ParagraphStyle("subtitle", fontName="DreamSampleFont", fontSize=10, leading=15, textColor=HexColor("#66756C"), shaping=0, spaceAfter=18),
    "question": ParagraphStyle("question", fontName="DreamSampleFont", fontSize=12, leading=18, textColor=HexColor("#17251C"), shaping=0, spaceAfter=5, spaceBefore=8),
    "option": ParagraphStyle("option", fontName="DreamSampleFont", fontSize=11, leading=16, leftIndent=8 * mm, textColor=HexColor("#28392E"), shaping=0),
    "answer": ParagraphStyle("answer", fontName="DreamSampleFont", fontSize=10, leading=15, leftIndent=4 * mm, textColor=HexColor("#9A572E"), shaping=0, spaceBefore=4),
    "explanation": ParagraphStyle("explanation", fontName="DreamSampleFont", fontSize=9, leading=14, leftIndent=4 * mm, textColor=HexColor("#58695E"), shaping=0),
}


def create_sample(output: Path = OUTPUT) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title="Dream Classes Bilingual Sample")
    story = []
    for page_index, questions in enumerate(pages):
        story.extend([
            Paragraph("DREAM CLASSES — QUESTION BANK", styles["title"]),
            Paragraph("Teacher: Dream Sir · Kothwara, Dobhi, Gaya, Bihar", styles["subtitle"]),
        ])
        for question, options, answer, explanation in questions:
            story.append(Paragraph(question, styles["question"]))
            story.extend(Paragraph(option, styles["option"]) for option in options)
            if answer:
                story.append(Paragraph(answer, styles["answer"]))
            if explanation:
                story.append(Paragraph(explanation, styles["explanation"]))
            story.append(Spacer(1, 3 * mm))
        if page_index < len(pages) - 1:
            story.append(PageBreak())
    doc.build(story)
    return output


if __name__ == "__main__":
    print(create_sample())
