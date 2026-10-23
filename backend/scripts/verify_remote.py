"""Verify a deployed Dream Classes API with a real PDF→PPTX round trip.

Uses only the Python standard library. The test project is deleted afterwards.
Example: python backend/scripts/verify_remote.py https://your-service.onrender.com
"""
from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4
import zipfile

ANDROID_ORIGIN = "https://appassets.androidplatform.net"
SAMPLE = Path(__file__).resolve().parents[2] / "samples" / "Dream_Classes_Bilingual_Sample.pdf"


def request(root: str, path: str, *, method: str = "GET", data: bytes | None = None,
            content_type: str | None = None, preflight: bool = False):
    headers = {"Origin": ANDROID_ORIGIN}
    if preflight:
        headers.update({"Access-Control-Request-Method": method, "Access-Control-Request-Headers": "content-type"})
        method = "OPTIONS"
    if content_type:
        headers["Content-Type"] = content_type
    call = Request(root + path, data=data, headers=headers, method=method)
    try:
        with urlopen(call, timeout=120) as response:
            return response.status, response.read(), response.headers
    except HTTPError as error:
        return error.code, error.read(), error.headers


def expect(result, status: int):
    actual, body, headers = result
    if actual != status:
        raise RuntimeError(f"Expected HTTP {status}, got {actual}: {body[:1000].decode('utf-8', 'replace')}")
    return body, headers


def json_request(root: str, path: str, *, method: str = "GET", payload=None, status: int = 200):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    body, _ = expect(request(root, path, method=method, data=data,
                             content_type="application/json" if data else None), status)
    return json.loads(body) if body else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url", help="Public backend base URL, with or without /api")
    args = parser.parse_args()
    root = args.base_url.strip().rstrip("/")
    if not root.endswith("/api"):
        root += "/api"

    health_body, health_headers = expect(request(root, "/health"), 200)
    health = json.loads(health_body)
    assert health["status"] == "ok", health
    capabilities = health["capabilities"]
    assert capabilities["pdf_text"] and capabilities["pptx"] and capabilities["pdf_export"]
    assert capabilities["ocr"]["available"] and capabilities["ocr"]["hindi"] and capabilities["ocr"]["english"]
    assert health_headers.get("Access-Control-Allow-Origin") == ANDROID_ORIGIN, dict(health_headers)

    project_id = None
    try:
        # A JSON generation request from the Android origin requires this CORS preflight.
        _, preflight_headers = expect(request(root, "/projects/not-a-real-id/generate", method="POST", preflight=True), 200)
        assert preflight_headers.get("Access-Control-Allow-Origin") == ANDROID_ORIGIN

        boundary = uuid4().hex
        pdf = SAMPLE.read_bytes()
        upload = (
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{SAMPLE.name}\"\r\n"
            "Content-Type: application/pdf\r\n\r\n"
        ).encode() + pdf + f"\r\n--{boundary}--\r\n".encode()
        body, _ = expect(request(root, "/projects", method="POST", data=upload,
                                 content_type=f"multipart/form-data; boundary={boundary}"), 202)
        project = json.loads(body)
        project_id = project["id"]

        deadline = time.monotonic() + 180
        while project["status"] in {"uploaded", "processing"}:
            if time.monotonic() > deadline:
                raise TimeoutError(f"Remote processing did not finish: {project}")
            time.sleep(2)
            project = json_request(root, f"/projects/{project_id}")
        assert project["status"] == "ready", project
        assert project["total_pages"] == 2 and project["processed_pages"] == 2, project
        assert project["question_count"] == 6, project

        questions = json_request(root, f"/projects/{project_id}/questions")
        assert len(questions) == 6
        assert questions[3]["text"] == "भारत की राजधानी क्या है?"
        assert questions[3]["correct_answer"] == "B"

        generated = json_request(root, f"/projects/{project_id}/generate", method="POST", payload={"mode": "C"})
        assert generated["slide_count"] == 12, generated
        pptx, download_headers = expect(request(root, f"/projects/{project_id}/download/pptx"), 200)
        assert pptx.startswith(b"PK") and len(pptx) > 30_000
        assert "Dream_Classes_Bilingual_Sample_Mode_C.pptx" in download_headers.get("Content-Disposition", "")
        archive = zipfile.ZipFile(io.BytesIO(pptx))
        slides = [name for name in archive.namelist()
                  if name.startswith("ppt/slides/slide") and name.endswith(".xml")]
        assert len(slides) == 12, slides
        slide_text = "".join(archive.read(name).decode("utf-8") for name in slides)
        assert "भारत की राजधानी क्या है?" in slide_text
        assert not any(name.startswith("ppt/media/") for name in archive.namelist()), "Slides must not be screenshots"
        print(f"REMOTE WORKFLOW OK: 2 pages, 6 ordered questions, 12 editable slides, {len(pptx)} PPTX bytes")
        print(f"ANDROID CORS OK: {ANDROID_ORIGIN}")
    finally:
        if project_id:
            expect(request(root, f"/projects/{project_id}", method="DELETE"), 204)
            print("Remote test project cleaned up")


if __name__ == "__main__":
    main()
