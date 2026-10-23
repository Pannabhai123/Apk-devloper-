"""Create a renderer-neutral slide plan shared by PPTX and PDF exports."""
from copy import deepcopy
from typing import Any


def _split_text(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    remaining = text.strip()
    while remaining:
        if len(remaining) <= limit:
            chunks.append(remaining)
            break
        split_at = remaining.rfind(" ", 0, limit)
        if split_at < limit // 2:
            split_at = remaining.rfind("।", 0, limit)
        if split_at < limit // 2:
            split_at = limit
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    return chunks


def _option_groups(options: list[dict[str, str]], limit: int = 700, piece_limit: int = 450) -> list[list[dict[str, str]]]:
    """Keep option text within a predictable area, retaining labels on continuations."""
    groups: list[list[dict[str, str]]] = []
    current: list[dict[str, str]] = []
    current_length = 0
    for option in options:
        chunks = _split_text(option.get("text", ""), piece_limit)
        for index, chunk in enumerate(chunks):
            item = {
                "label": option["label"] if index == 0 else f"{option['label']} (cont.)",
                "text": chunk,
            }
            cost = len(chunk) + 8
            if current and current_length + cost > limit:
                groups.append(current)
                current = []
                current_length = 0
            current.append(item)
            current_length += cost
    if current:
        groups.append(current)
    return groups or [[]]


def build_slide_plan(questions: list[dict[str, Any]], settings: dict[str, Any]) -> list[dict[str, Any]]:
    mode = settings.get("mode", "C")
    slides: list[dict[str, Any]] = []
    total = len(questions)
    for position, question in enumerate(questions, start=1):
        base = {
            "question_id": question["id"],
            "number": question.get("number") or str(position),
            "position": position,
            "total_questions": total,
            "page_number": question["page_number"],
            "answer_source": question.get("answer_source", "none"),
            "answer_confidence": question.get("answer_confidence", "none"),
        }
        # Long questions/options continue on another slide rather than being clipped.
        text_chunks = _split_text(question["text"], 950)
        source_option_groups = _option_groups(question["options"])
        for chunk_index, chunk in enumerate(text_chunks):
            is_last_text = chunk_index == len(text_chunks) - 1
            option_groups = source_option_groups if is_last_text else [[]]
            for group_index, options in enumerate(option_groups):
                is_final = is_last_text and group_index == len(option_groups) - 1
                include_answer = mode == "D" and not settings.get("custom_answer_slide", True) and is_final
                slides.append({
                    **base,
                    "kind": "question",
                    "text": chunk if group_index == 0 else "Options continued",
                    "options": options,
                    "continuation": chunk_index > 0 or group_index > 0,
                    "continues": not is_final,
                    "include_answer": include_answer,
                    "correct_answer": question.get("correct_answer") if is_final else None,
                    "explanation": question.get("explanation") if is_final and settings.get("custom_include_explanation", True) else None,
                })

        answer_slide = mode in {"B", "C"} or (mode == "D" and settings.get("custom_answer_slide", True))
        if answer_slide:
            explanation = question.get("explanation") if mode == "C" or (
                mode == "D" and settings.get("custom_include_explanation", True)
            ) else None
            explanation_chunks = _split_text(explanation, 1250) if explanation else [None]
            for chunk_index, explanation_chunk in enumerate(explanation_chunks):
                slides.append({
                    **base,
                    "kind": "answer",
                    "text": question["text"],
                    "options": question["options"] if mode == "D" and settings.get("custom_show_options_on_answer", False) else [],
                    "correct_answer": question.get("correct_answer"),
                    "explanation": explanation_chunk,
                    "continuation": chunk_index > 0,
                    "continues": chunk_index < len(explanation_chunks) - 1,
                })
    return slides


def enrich_answer_options(slides: list[dict[str, Any]], questions: list[dict[str, Any]]) -> None:
    """Add source answer text and paginate unusually long answer content in place."""
    by_id = {q["id"]: q for q in questions}
    expanded: list[dict[str, Any]] = []
    for slide in slides:
        source = by_id[slide["question_id"]]
        slide["all_options"] = source["options"]
        slide["answer_text"] = next(
            (o["text"] for o in source["options"] if o["label"] == slide.get("correct_answer")),
            "",
        )
        if slide["kind"] != "answer":
            expanded.append(slide)
            continue
        answer_chunks = _split_text(slide["answer_text"], 600) if slide["answer_text"] else []
        option_groups = _option_groups(slide["options"], limit=500, piece_limit=400) if slide["options"] else []
        count = max(1, len(answer_chunks), len(option_groups))
        for index in range(count):
            part = deepcopy(slide)
            part["answer_text"] = answer_chunks[index] if index < len(answer_chunks) else ""
            part["options"] = option_groups[index] if index < len(option_groups) else []
            part["continuation"] = slide.get("continuation", False) or index > 0
            part["continues"] = slide.get("continues", False) or index < count - 1
            if index > 0:
                part["explanation"] = None
            expanded.append(part)
    slides[:] = expanded
