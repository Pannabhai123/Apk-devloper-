"""Deterministic bilingual MCQ parser used with or without an AI provider.

It only creates questions where a numbered question exists in extracted page text;
it never pads a document with guessed or missing questions.
"""
import re
from typing import Any

QUESTION_START = re.compile(
    r"^[ \t]*(?:(?:q|ques|question|प्र|प्रश्न)\s*[.:\-]?\s*)?"
    r"(\d{1,4})\s*[.)\]/:ः\-]\s*",
    re.IGNORECASE | re.MULTILINE,
)
OPTION_START = re.compile(
    r"(?:^|\s)[\(\[]?([A-Da-dकखगघ])[\)\].:]\s*",
    re.MULTILINE,
)
ANSWER_LINE = re.compile(
    r"^[ \t]*(?:correct\s+answer|answer|ans|उत्तर|सही\s+उत्तर|उत्तरम्)\s*[:.\-–]?\s*(.*)$",
    re.IGNORECASE | re.MULTILINE,
)
EXPLANATION_LINE = re.compile(
    r"^[ \t]*(?:explanation|solution|reason|व्याख्या|विवरण|हल)\s*[:.\-–]?\s*(.*)$",
    re.IGNORECASE | re.MULTILINE,
)
LABEL_MAP = {"क": "A", "ख": "B", "ग": "C", "घ": "D"}


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u200b", "")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    value = " ".join(line for line in lines if line)
    return re.sub(r"\s+([,.;:?%!।])", r"\1", value).strip()


def option_label(value: str) -> str | None:
    value = value.strip().upper()
    if value in LABEL_MAP:
        return LABEL_MAP[value]
    match = re.search(r"(?:^|[\s(\[])([A-Dकखगघ])(?:$|[\s)\].,:])", value, re.IGNORECASE)
    if match:
        label = match.group(1).upper()
        return LABEL_MAP.get(label, label)
    return None


def _parse_answer(raw: str, options: list[dict[str, str]]) -> tuple[str | None, bool]:
    raw = clean_text(raw)
    if not raw:
        return None, False
    uncertain = bool(re.search(r"\?|uncertain|not\s+sure|probably|अनिश्चित|संदिग्ध", raw, re.I))
    label = option_label(raw.splitlines()[0][:80])
    if not label:
        lowered = raw.casefold()
        for option in options:
            if option["text"] and option["text"].casefold() in lowered:
                label = option["label"]
                break
    return label or (raw if raw else None), uncertain


def parse_page_text(text: str, page_number: int) -> list[dict[str, Any]]:
    """Parse all numbered MCQs on one page, retaining their source order."""
    if not text or not text.strip():
        return []
    matches = list(QUESTION_START.finditer(text))
    questions: list[dict[str, Any]] = []
    for index, match in enumerate(matches):
        block_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():block_end].strip()
        if not block:
            continue

        answer_match = ANSWER_LINE.search(block)
        explanation_match = EXPLANATION_LINE.search(block)
        content_end = min(
            [m.start() for m in (answer_match, explanation_match) if m] or [len(block)]
        )
        content = block[:content_end].rstrip()
        option_matches = list(OPTION_START.finditer(content))
        options: list[dict[str, str]] = []
        if option_matches:
            question_text = clean_text(content[:option_matches[0].start()])
            for option_index, option_match in enumerate(option_matches):
                end = (
                    option_matches[option_index + 1].start()
                    if option_index + 1 < len(option_matches)
                    else len(content)
                )
                option_text = clean_text(content[option_match.end():end])
                label = LABEL_MAP.get(option_match.group(1), option_match.group(1).upper())
                # Repeated labels are almost always a parser false positive; do not overwrite real options.
                if option_text and not any(item["label"] == label for item in options):
                    options.append({"label": label, "text": option_text})
        else:
            question_text = clean_text(content)

        if not question_text:
            continue
        answer, uncertain = _parse_answer(answer_match.group(1), options) if answer_match else (None, False)
        explanation = None
        if explanation_match:
            # Preserve wrapped explanation lines up to the next question (block end),
            # or up to an unusually placed answer line.
            explanation_end = (
                answer_match.start()
                if answer_match and answer_match.start() > explanation_match.start()
                else len(block)
            )
            explanation = clean_text(block[explanation_match.start(1):explanation_end])
        flags = []
        if len(options) < 4:
            flags.append("missing_options")
        if not answer:
            flags.append("missing_answer")
        if uncertain:
            flags.append("uncertain_answer")
        questions.append(
            {
                "number": match.group(1),
                "text": question_text,
                "options": options,
                "correct_answer": answer,
                "explanation": explanation,
                "answer_source": "pdf" if answer else "none",
                "answer_confidence": "uncertain" if uncertain else ("certain" if answer else "none"),
                "flags": flags,
                "page_number": page_number,
                "extraction_method": "local",
            }
        )
    return questions


def recompute_flags(question: dict[str, Any]) -> list[str]:
    flags = []
    if len(question.get("options", [])) < 4 or any(
        not option.get("text", "").strip() for option in question.get("options", [])
    ):
        flags.append("missing_options")
    if not question.get("correct_answer"):
        flags.append("missing_answer")
    if question.get("answer_confidence") == "uncertain":
        flags.append("uncertain_answer")
    return flags
