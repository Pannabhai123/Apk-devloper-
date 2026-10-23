# Railway ALP Mathematics Mock Test Platform
### रेलवे ALP गणित मॉक टेस्ट प्लेटफ़ॉर्म

A complete, fully-functional mock test platform for **Railway ALP (Assistant Loco Pilot) Mathematics** preparation — bilingual (Hindi + English), offline-capable PWA, with a **real question bank of 1,200 original questions** (20 full-length mock tests × 60 questions), live timed exam simulation, auto-scoring, step-by-step solutions, progress tracking, practice mode, formula sheet, bookmarks and wrong-question revision.

> ⚠️ **Honest disclaimer:** These are **original practice tests created for this platform** — they are *not* official RRB question papers and are not affiliated with Indian Railways. Difficulty tiers are designed to mirror exam-level progression only.

---

## ✨ Features

### Exam mode (full simulation)
- **20 mock tests × 60 unique questions** — every question has a unique ID (`ALP-MATH-T01-Q001` … `ALP-MATH-T20-Q060`), 4 options, exactly one correct answer, and a detailed step-by-step Hindi solution (plus English question text).
- **90-minute timer** shown as `HH:MM:SS` — starts **only** after you press BEGIN TEST, **survives page refresh** (computed from the stored start time), shows warnings at 15/5/1 minutes, and **auto-submits without confirmation at 00:00:00**.
- One question at a time with **Previous / Save & Next / Next / Clear Response / Mark for Review**.
- **Question palette (1–60)**: Grey = not visited, Red = visited unanswered, Green = answered, Purple = marked for review (with a dot when marked *and* answered). Accessible `aria-label` per item; collapsible on mobile.
- **Submit confirmation dialog** with answered/unanswered/marked counts — duplicate submissions are impossible (attempt is cleared on submit).
- **Marking**: default `+1` correct, `0` wrong/skipped. Optionally enable negative marking (`−1/3` per wrong) *before* the test — clearly labelled as an optional practice setting, not an official scheme. No answers or solutions are visible during the live test.
- **Result dashboard**: attempt ID, correct/incorrect/unanswered/attempted counts, final score, accuracy (`correct ÷ attempted × 100`, 0 % guard), time taken, topic-wise performance bars, strong (≥75 %) and weak (<50 %) topics, recommended next test, and buttons: View All Solutions / Retake / Next Mock Test / Back / **Download PDF** (via the browser print dialog → "Save as PDF") / Print.
- **Solution review**: all 60 questions with your answer vs. the correct answer, full solution steps, shortcut (where applicable), topic and difficulty — filterable by All / Correct / Incorrect / Unanswered / Marked.

### Beyond the exam
- **Progress tracking** — completed tests, best/latest/average scores, total questions attempted, overall accuracy, total time, topic-wise aggregation, and full attempt history. Retakes create **new records** (history is never overwritten).
- **Practice mode** (`/practice`) — untimed, topic-wise (28 topics), instant feedback with solutions. Completely separate from exam mode.
- **Formula sheet** (`/formulas`) — 19 topic groups of essential formulas with search.
- **Bookmarks** (`/bookmarks`) — save any question from review/practice, replay them anytime.
- **Wrong-question revision** (`/revision`) — every question you got wrong across all attempts, collected for retake.
- **Dark mode** toggle, search/filter on tests and formulas, keyboard-accessible controls, high-contrast palettes, mobile-first responsive layout (no horizontal scroll), Noto Sans Devanagari font stack.
- **PWA** — installable manifest + service worker: app shell pre-cached, assets cached on first use, navigations fall back to the cached shell offline. Registered only in production builds.
- **Reset data** — a confirmation dialog wipes all local data.

### Question bank integrity
- Bank is stored as structured JSON (`src/data/tests/test-01..20.json`, 28 topic files, an index) — **not** hardcoded in a component.
- Every question: unique ID, 4 options, exactly one correct, ≥2-step Hindi solution, `topic` + `topicHi` + `difficulty` tags, deterministic generation (seeded, reproducible).
- Balanced 28-topic syllabus (Number System → Coordinate Geometry). Difficulty tiers: Tests 01–05 Easy–Moderate, 06–10 Moderate, 11–15 Moderate–Difficult, 16–20 Difficult/Advanced.
- **Independent validator** (`tools/validate.mjs`) checks counts (20×60), ID uniqueness, duplicate question text, option count/duplicates, answer validity, solution presence, and math consistency (correct option == final answer).

### Honest data & privacy policy
- **No login, no OTP, no account, no server.** All your attempts, bookmarks and settings live in your browser's `localStorage` — nothing is sent anywhere, and there is no cloud sync across devices.
- No fake percentiles, ranks or leaderboards — no such comparison data exists here.
- `/privacy` documents this in full.

---

## 🚀 Getting started

```bash
npm install
npm run dev        # development server
npm run build      # typecheck (tsc --noEmit) + production build → dist/
npm run preview    # serve the production build (0.0.0.0:4173)
```

Deploy `dist/` to any static host (GitHub Pages, Netlify, Vercel, etc.). It's a fully static SPA — no backend required. Configure the host to serve `index.html` for unknown paths (SPA fallback).

## 🔧 Question bank tooling

```bash
# full deterministic regeneration (reproducible — same seeds, same output)
rm -rf src/data/tests src/data/topics src/data/index.json
for b in 1 2 3 4; do node tools/generate.mjs --batch $b; done

node tools/validate.mjs    # independent validation (exit 1 on any failure)
node tools/icons.mjs       # regenerate PWA PNG icons (pure Node, no image deps)
node tools/smoke.mjs       # functional smoke tests of scoring/timer/storage logic
```

Generation templates live in `tools/gen/` (core + 6 topic modules, 186 templates across 28 topics). Deterministic seeds ensure the same bank can always be rebuilt.

## 🗂 Project structure

```
index.html                 SPA entry (lang=hi, PWA meta, Devanagari fonts)
public/                    favicon.svg, manifest.webmanifest, sw.js, icons/
src/
  main.tsx                 React root + theme init + SW registration (prod only)
  App.tsx                  14 routes
  data/
    app.ts                 site meta, constants, the 12 exam instructions
    formulas.ts            formula-sheet content (19 groups)
    tests/test-01..20.json  20 × 60 validated questions
    topics/<28 slugs>.json  per-topic question pools
    index.json              bank index
  lib/
    types.ts               shared TypeScript types
    storage.ts             localStorage layer (attempts, active, bookmarks…)
    questions.ts           lazy JSON loaders + admin-override merge
    scoring.ts             pure scoring/timer/format helpers
  components/              Header, Footer, Modal, QuestionCard
  pages/                   Home, Tests, Instructions, Attempt, Result,
                           Solutions, Progress, Practice, Formulas,
                           Bookmarks, Revision, Admin, Privacy, NotFound
  styles/global.css        design system (light/dark, exam UI, print styles)
tools/                     generation, validation, icons, smoke tests
```

## 🧪 Testing status

- `tools/validate.mjs`: **ALL CHECKS PASSED** (20 files, 1,200 questions, unique IDs and texts, 28 topics).
- `tools/smoke.mjs`: **36/36 passed** — scoring (default and −1/3 negative marking, accuracy zero-guard), timer maths and formatting, attempt record building, storage round-trips (dedupe, retake = new record, newest-first history), bookmarks, topic classification, reset.
- Production build (`tsc --noEmit && vite build`) and preview server verified; question JSON chunks lazy-load per test/topic.

## ⚠️ Known limitations (stated honestly)

- **No backend** — this is a static site. The "admin" area (`/admin`) is a *local* question-management workflow (browsing, editing via localStorage overrides, unpublishing tests locally, running validation). Edits apply only to your browser; permanent changes require editing `src/data/` JSON and rebuilding. There is deliberately no login/credential system.
- Progress does **not** sync across devices/browsers.
- **Contact placeholder:** the site currently uses `support@example.com` — replace it in `src/data/app.ts` (and rebuild) before real publication.
- Icons are programmatically generated (`tools/icons.mjs`) — intentionally simple geometric design.

## 📄 License & attribution

Question bank and platform code created as original practice material for this repository. Not affiliated with Indian Railways / RRB.
