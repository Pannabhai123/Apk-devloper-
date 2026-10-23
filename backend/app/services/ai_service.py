"""Server-only OpenAI-compatible AI integration.

No provider is contacted unless AI_API_KEY is configured. Errors are surfaced to
the caller; the application never fabricates an AI success response.
"""
import json
import re
from typing import Any
import httpx

from ..config import ai_config


class AIError(RuntimeError):
    pass


class AINotConfigured(AIError):
    pass


def is_ai_configured() -> bool:
    return bool(ai_config()["api_key"])


def _chat_json(system: str, user: str) -> Any:
    config = ai_config()
    if not config["api_key"]:
        raise AINotConfigured(
            "AI is not configured. Set AI_API_KEY and AI_MODEL in backend/.env on the server."
        )
    payload = {
        "model": config["model"],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    try:
        response = httpx.post(
            f"{config['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {config['api_key']}"},
            json=payload,
            timeout=90,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        content = re.sub(r"^```(?:json)?|```$", "", content.strip()).strip()
        return json.loads(content)
    except httpx.HTTPStatusError as exc:
        # Do not expose response bodies, which can contain provider/account details.
        raise AIError(f"AI provider returned HTTP {exc.response.status_code}. Check the server configuration.") from exc
    except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise AIError("AI provider could not return a valid response. The original project is unchanged.") from exc


def extract_questions_with_ai(text: str, page_number: int) -> list[dict[str, Any]]:
    system = """You extract multiple-choice questions from OCR/PDF text. Return JSON only:
{"questions":[{"number":"1","text":"...","options":[{"label":"A","text":"..."}],"correct_answer":"A or null","explanation":"... or null","uncertain":false}]}
Rules: preserve source order and Hindi/English text exactly; extract only questions actually present;
never infer a missing question; use only A-D labels; do not answer questions yourself;
use null when the source does not state an answer. Mark ambiguous source answers uncertain."""
    result = _chat_json(system, f"PDF page {page_number}:\n\n{text[:28000]}")
    source = result.get("questions", []) if isinstance(result, dict) else []
    questions = []
    # Reject any candidate whose question wording is not actually in the source page.
    # This is a hard guard against an AI provider padding or inventing questions.
    source_normalized = re.sub(r"\s+", "", text).casefold()
    for item in source:
        if not isinstance(item, dict) or not str(item.get("text", "")).strip():
            continue
        candidate_normalized = re.sub(r"\s+", "", str(item["text"])).casefold()
        if len(candidate_normalized) < 4 or candidate_normalized not in source_normalized:
            continue
        options = []
        for option in item.get("options", [])[:4]:
            if isinstance(option, dict) and str(option.get("label", "")).upper() in "ABCD":
                options.append({
                    "label": str(option["label"]).upper(),
                    "text": str(option.get("text", "")).strip(),
                })
        answer = item.get("correct_answer")
        answer = str(answer).upper() if answer and str(answer).upper() in {"A", "B", "C", "D"} else None
        uncertain = bool(item.get("uncertain"))
        flags = []
        if len(options) < 4:
            flags.append("missing_options")
        if not answer:
            flags.append("missing_answer")
        if uncertain:
            flags.append("uncertain_answer")
        questions.append({
            "number": str(item.get("number", "")),
            "text": str(item["text"]).strip(),
            "options": options,
            "correct_answer": answer,
            "explanation": str(item["explanation"]).strip() if item.get("explanation") else None,
            "answer_source": "pdf" if answer else "none",
            "answer_confidence": "uncertain" if uncertain else ("certain" if answer else "none"),
            "flags": flags,
            "page_number": page_number,
            "extraction_method": "ai",
        })
    return questions


def generate_missing_answers(questions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Return validated answer patches keyed by existing question id."""
    if not questions:
        return {}
    compact = [{
        "id": q["id"], "question": q["text"],
        "options": {o["label"]: o["text"] for o in q["options"]},
    } for q in questions]
    system = """You are a careful teaching assistant for Dream Classes. Solve only the supplied MCQs.
Return JSON: {"answers":[{"id":"exact supplied id","correct_answer":"A","explanation":"concise explanation","confidence":"high or low"}]}.
Use only an available option label. If unsure, still choose the best option but set confidence low.
Never change question text or invent options. Explanations should be concise and in the question's language."""
    updates: dict[str, dict[str, Any]] = {}
    # Small batches keep responses reliable and make failures easier to retry.
    for start in range(0, len(compact), 8):
        batch = compact[start:start + 8]
        result = _chat_json(system, json.dumps({"questions": batch}, ensure_ascii=False))
        by_id = {q["id"]: q for q in batch}
        for item in result.get("answers", []) if isinstance(result, dict) else []:
            if not isinstance(item, dict) or item.get("id") not in by_id:
                continue
            question = by_id[item["id"]]
            answer = str(item.get("correct_answer", "")).upper()
            labels = {option["label"] for option in question["options"]}
            if answer not in labels:
                continue
            confidence = "certain" if str(item.get("confidence", "")).lower() == "high" else "uncertain"
            updates[item["id"]] = {
                "correct_answer": answer,
                "explanation": str(item.get("explanation", "")).strip() or None,
                "answer_source": "ai",
                "answer_confidence": confidence,
            }
    if not updates:
        raise AIError("The AI response contained no valid answers. No questions were changed.")
    return updates
