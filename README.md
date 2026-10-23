# Dream Classes PPT Maker AI

A complete bilingual PDF-to-PowerPoint workspace for **Dream Sir**, Dream Classes, Kothwara, Dobhi, Gaya, Bihar.

Upload a question-paper PDF and let the app automatically extract questions, generate a **genuine editable PPTX**, and start the download. Advanced review, editing, and custom blackboard design remain available when needed.

## What is implemented

- PDF upload with real upload progress, 50 MB validation, page counts, per-page processing progress, unreadable-page reporting, and retry.
- **One-click upload → automatic PPT → automatic download.** No review or Generate click is required; advanced editing remains optional.
- Hindi and English text extraction with PyMuPDF. Numbered MCQs, A–D and क/ख/ग/घ options, answers, and explanations are parsed in source order.
- Optional scanned-page OCR using Tesseract `eng+hin`. OCR availability and language packs are checked on the server.
- Optional server-side AI extraction and AI answers through an OpenAI-compatible chat-completions endpoint.
  - No AI key is needed for normal extraction/editing/export.
  - AI answers are visibly labelled, uncertain answers are flagged, and missing-key/provider errors are returned honestly.
  - AI extraction candidates whose question wording is not present in the source page are rejected.
- Editable question review: number, text, four options, answer, explanation, answer confidence, and deletion.
- Modes A/B/C/D, live blackboard preview, 16:9 layout, Hindi-compatible font choices, colour controls, text fitting, and continuation slides for long questions.
- Editable PPTX generated with `python-pptx`; no screenshots or image-based slide substitutes.
- Presentation PDF with embedded Devanagari font and HarfBuzz shaping.
- Download PPTX, PDF, extracted questions (JSON), and answer key (TXT).
- SQLite projects, settings, dashboard statistics, and presentation/export history.
- Responsive web UI and a native Android APK with system PDF picker, device-specific backend connection settings, and downloads through Android DownloadManager.

## Verified workflow

The checked-in test suite currently passes **13 tests**, including this real API workflow:

1. Upload `samples/Dream_Classes_Bilingual_Sample.pdf`.
2. Process both readable pages and extract six questions in order.
3. Preserve Hindi question text, options, source answer, and explanation.
4. Reject AI answer generation with HTTP 503 when no key is configured, without modifying data.
5. Edit the one deliberately missing answer.
6. Generate Mode C and verify 12 slides.
7. Re-open the downloaded PPTX with `python-pptx` and verify its text is editable.
8. Download and open the 12-page PDF, six-question JSON, and UTF-8 answer key.
9. Detect invalid and unreadable PDFs without inventing questions.

A separate browser test selected the sample PDF and performed **no further clicks**. The app automatically produced 12 slides and downloaded `Dream_Classes_Bilingual_Sample_Mode_C.pptx` with no JavaScript errors.

Repeat the real deployed-cloud check (including Android CORS and PPTX download) with:

```bash
python backend/scripts/verify_remote.py https://dream-classes-ppt-api.onrender.com
```

Sample files are included:

- `samples/Dream_Classes_Bilingual_Sample.pdf` — two-page Hindi + English input.
- `samples/Dream_Classes_Sample_Output.pptx` — 12 editable Mode C slides.
- `samples/Dream_Classes_Sample_Output.pdf` — 12-page presentation PDF.

## Technology

| Layer | Implementation |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, Lucide icons |
| Backend | FastAPI, Python 3.11+, SQLite |
| PDF extraction | PyMuPDF |
| OCR | Optional Tesseract + `pytesseract` |
| PPTX | `python-pptx`, editable text and vector shapes |
| PDF export | ReportLab, Noto Sans Devanagari, HarfBuzz |
| AI | Server-only OpenAI-compatible HTTP API |
| Android | Native WebView activity, Capacitor asset sync, AAPT2/D8 |

## Quick start: local development

### Prerequisites

- Node.js 22+ and npm
- Python 3.11+
- Optional: Tesseract OCR for scanned PDFs

### 1. Install and configure

```bash
git clone <your-repository-url>
cd Apk-devloper-

npm install
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
```

On Windows, use `backend\.venv\Scripts\python.exe` and `backend\.venv\Scripts\pip.exe` instead of the Unix paths.

### 2. Start the backend

```bash
npm run backend
```

The API listens on `http://localhost:8000`. Interactive API documentation is at `/docs`.

### 3. Start the web app

In another terminal:

```bash
npm run dev
```

Open the Vite URL shown in the terminal. Vite proxies `/api` to the backend, so the browser never needs to call a second localhost port directly.

### 4. Test with the sample

Choose **Upload & Make PPT** and select:

```text
samples/Dream_Classes_Bilingual_Sample.pdf
```

After upload, processing and PPT generation start automatically. The PPTX download begins when it is ready. To make changes, open the project and use **Review or edit questions** or **Change design**.

## One-command Docker deployment

The Docker image installs Tesseract with both Hindi and English language data and serves the built frontend and API from port 8000.

```bash
cp backend/.env.example backend/.env
# Edit backend/.env only if you want AI features.
docker compose up --build
```

Open `http://localhost:8000`. Project data, uploads, and exports persist in the `dream_classes_data` Docker volume.

For a public deployment, put the container behind an HTTPS reverse proxy and back up the `/data` volume. The included Compose file is single-application/single-worker by design. For high-volume multi-user processing, move `process_project` from FastAPI background tasks to a durable worker queue.

> Docker was not available in the development sandbox, so the Docker image itself was not built here. The same application and dependencies were tested directly.

## Scanned PDF OCR setup

OCR is **not required** for ordinary text-based PDFs. For scanned PDFs on a local Ubuntu/Debian server:

```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-hin tesseract-ocr-eng
tesseract --list-langs
```

Confirm that `hin` and `eng` appear, then restart the backend. The Settings page performs a live OCR capability check.

If OCR is unavailable, scanned pages are reported as unreadable with a configuration message; the app does not pretend they were processed. OCR accuracy still depends on scan quality, cropping, and page layout.

## AI setup (optional)

Edit **`backend/.env` on the server only**:

```dotenv
AI_API_KEY=your_real_server_side_key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_EXTRACTION_ENABLED=false
```

- `AI_API_KEY`: provider key. Never prefix this with `VITE_` and never bundle it in Android.
- `AI_BASE_URL`: any OpenAI-compatible `/chat/completions` base URL.
- `AI_MODEL`: a model that supports JSON responses.
- `AI_EXTRACTION_ENABLED=true`: try AI extraction before the deterministic parser. If AI fails, the warning is recorded and the local parser is used. Leave `false` to use only the local parser.
- **AI answers for missing answers** can be requested from the Review screen whenever `AI_API_KEY` is configured.

Provider calls can incur costs and require network access. No provider call was made during the included tests. Without a working key/provider, AI endpoints return a clear 503/502 error; all non-AI features continue to work.

## Expected question format

The deterministic parser supports common numbered MCQ layouts, for example:

```text
1. What is the capital of Bihar?
A. Gaya
B. Patna
C. Muzaffarpur
D. Bhagalpur
Answer: B
Explanation: Patna is the capital of Bihar.
```

Hindi numbering and `(क) (ख) (ग) (घ)` options are also supported. Every readable page is processed. Readable pages with no supported numbered MCQ pattern receive a warning and **no placeholder question is invented**. Missing options/answers remain editable and are flagged. Complex multi-column or inconsistent layouts may need OCR adjustments or optional AI extraction followed by teacher review.

## Self-host the cloud backend with Render (optional)

**Ready APK users do not need to deploy anything.** The current APK already uses `https://dream-classes-ppt-api.onrender.com/api`. The following button is only for creating a separate self-hosted backend.

### [Deploy Dream Classes backend to Render](https://render.com/deploy?repo=https://github.com/Pannabhai123/Apk-devloper-/tree/arena/35966a87-apk-devloper)

1. Sign in to Render with GitHub and authorize repository access when Render asks.
2. The button selects `arena/35966a87-apk-devloper` and its root `render.yaml`. Review the Blueprint and choose **Apply**.
3. The Blueprint automatically supplies these real Docker values—no manual environment setup is needed:

```dotenv
DATA_DIR=/data
FRONTEND_DIST=/app/dist
CORS_ORIGINS=https://appassets.androidplatform.net
MAX_UPLOAD_MB=50
```

4. Wait for the deployment health check to pass. Render will show the service's actual public URL, normally `https://dream-classes-ppt-api.onrender.com` (the suffix can differ if that name is unavailable).
5. Open `ACTUAL_RENDER_URL/api/health`. It must return `"status":"ok"`. In Android, enter the **actual Render base URL** under **Settings → Backend connection** and choose **Test & save**; `/api` is added automatically.

The service includes FastAPI, the frontend, English/Hindi Tesseract OCR, and PPT generation. The Blueprint uses Render's free plan for initial setup. Free services can sleep when idle and their local filesystem is not permanent project storage. For long-term history and uploaded/exported files, use a paid persistent disk mounted at `/data` (or another permanent host). No AI key is included; add `AI_API_KEY` only in the hosting provider's server environment if AI answers are required.

## Production without Docker (advanced manual setup)

```bash
npm run build
# Restart after building so FastAPI can serve dist/.
npm run backend
```

For this combined local deployment, **no path environment variables are required**. The server automatically uses `backend/data` for projects/exports and `dist` for the frontend. Android CORS is already enabled. Only override paths when you manage a custom server directory layout; do not copy example placeholders into Render.

## Android APK

### Ready-to-install package

**APK:** `releases/Dream_Classes_PPT_Maker.apk`

**Direct GitHub download:** https://github.com/Pannabhai123/Apk-devloper-/releases/download/v1.1.2/Dream_Classes_PPT_Maker.apk

- Version: **1.1.2** (`versionCode 4`)
- PDF picker stability: content-URI read access, Android-standard result parsing, persistable permissions, and single-callback cleanup prevent upload-time WebView crashes on supported devices.
- Preconfigured cloud API: `https://dream-classes-ppt-api.onrender.com/api`—no manual backend entry is required.
- Older saved `/api` settings migrate automatically to the cloud default after upgrading.
- Package: `in.dreamclasses.pptmaker`
- Android: **6.0 / API 23 and newer**; target/compile API 35
- Signed with a development/test certificate; APK Signature Scheme **v1 and v2 verified**
- APK SHA-256: `6e351c266f606870dff1e2ac301b9ad61d6723de9767e73f527adc08364fa552`

### Install and use

1. Copy the APK to the Android phone and choose **Install unknown apps** if Android asks for permission. Version 1.1.2 can be installed directly over 1.1.x using the included development signature.
2. Open the app with internet access. The Dream Classes Render backend is already configured; **Settings → Test & save is not required**. A sleeping free cloud service may take a short time to wake on the first request.
3. Choose **Upload & Make PPT** and select a PDF. Question extraction, PPT generation, and download happen automatically. Downloads are saved through Android's DownloadManager to **Downloads**.
4. **Settings → Backend connection** remains available for diagnostics or for switching to a self-hosted server. Do not replace the cloud URL with `/api` or `localhost` on a physical phone.

The configured backend is `https://dream-classes-ppt-api.onrender.com/api`. Its live health response confirms PDF text extraction, editable PPTX/PDF export, and Hindi + English OCR. No AI key is configured or bundled. The temporary Arena preview URL is not used.

### Rebuild from source

Requirements for a normal Gradle build: JDK 17 and Android Studio/SDK.

```bash
npm install
# Bake in the deployed cloud default; users can still change it on their device.
VITE_API_URL=https://dream-classes-ppt-api.onrender.com/api npm run android:sync
npm run android:open
```

Then use **Build → Generate Signed App Bundle / APK** in Android Studio. For a public release and future updates, sign with your own securely stored private key rather than the included test certificate.

The supplied APK was actually compiled with AAPT2/D8, zipaligned, signed, and checked for ZIP integrity, manifest/launcher data, DEX, web assets, and valid v1/v2 signatures. A physical Android device or emulator was not available, so installation and on-device UI behavior have not been device-tested.

## Tests and regeneration

```bash
npm run build
cd backend
.venv/bin/python -m pytest -q
```

Recreate the sample input and outputs:

```bash
backend/.venv/bin/python backend/scripts/create_sample_pdf.py
backend/.venv/bin/python backend/scripts/generate_sample_output.py
```

The PPTX integrity check re-opens each generated file and verifies its slide count before download. Tests also confirm widescreen dimensions, editable text, Hindi content, AI warning labels, and the absence of picture-substitute slides. Microsoft PowerPoint itself was not available in the sandbox.

## API overview

| Endpoint | Purpose |
|---|---|
| `POST /api/projects` | Upload PDF and start background processing |
| `GET /api/projects/{id}` | Actual processing status/page counters/errors |
| `POST /api/projects/{id}/retry` | Retry extraction/OCR |
| `GET /api/projects/{id}/questions` | Source-ordered editable questions |
| `PATCH /api/questions/{id}` | Save question edits |
| `POST /api/projects/{id}/generate-answers` | Configured AI answers for missing answers only |
| `POST /api/projects/{id}/generate` | Generate and verify editable PPTX |
| `GET /api/projects/{id}/download/{kind}` | `pptx`, `pdf`, `questions`, or `answer-key` |
| `GET /api/exports` | Presentation history |
| `GET /api/health` | Live OCR/AI/export capabilities |

## Data, fonts, and limitations

- Runtime data is stored under `backend/data/` locally or `/data` in Docker. Back up this directory/volume.
- The bundled Noto Sans Devanagari font and its OFL license are in `backend/app/assets/`.
- PowerPoint uses the selected Hindi-compatible font name. Install that font on the presentation computer for the closest match; PowerPoint may substitute another installed font.
- Hindi PDF slides are shaped for visual display. For reliable copying, editing, or re-extraction of Hindi text, use the PPTX or JSON export rather than treating presentation PDF as a text-exchange format.
- AI answers are assistance, not authority. Dream Sir should verify every AI-generated or uncertain answer before teaching.
