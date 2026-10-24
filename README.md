# VidyaPariksha — Online Mock Test & CBT Platform

A mobile-first, full-stack computer-based testing platform with a real question bank,
a server-authoritative exam engine, backend-calculated results, student dashboards and
an admin console. **VidyaPariksha is original branding and design.** The workflow was
informed by the public flow of shardatest.in, but no logos, illustrations, copy or
proprietary assets were copied.

> **Status legend used below:** **Implemented** = code exists · **Tested** = covered by
> an automated check that ran green in this workspace · **Configured** = available via
> settings/env, needs your values/credentials · **Deployed** = running on infrastructure
> you control. Nothing in this repository has been deployed to production by the author.

---

## 1. Quick start (development)

Requirements: Node.js **20.19+** (verified on Node 22.22.3), npm 10+, and build tools
for the native SQLite driver.

```bash
git clone <your-fork-url>
cd Apk-devloper-
cp .env.example .env

# If npm cannot fetch Node headers for better-sqlite3, point it at local headers:
npm_config_nodedir=/usr/local npm install --no-audit --no-fund
# …or simply:
npm install --no-audit --no-fund

npm run migrate          # creates data/vidyapariksha.db (schema v2)
npm run seed             # loads 433 original demo practice questions
npm run dev              # API on :4000, Vite web on :5173
```

Open <http://localhost:5173>. In development a completely empty database is
auto-seeded on first API start, so `npm run seed` is optional for a first look.

Create your first administrator (see §3) and sign in at `/login`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API (`tsx watch`) + Vite dev server, with `/api` proxied to `:4000` |
| `npm run dev:api` / `npm run dev:web` | Run either half separately |
| `npm run migrate` | Idempotent schema creation + additive migrations |
| `npm run seed` | Idempotent demo content seed (433 questions); optional first admin |
| `npm run typecheck` | TypeScript checks for server **and** web |
| `npm test` | Vitest unit + API integration suite (51 tests) |
| `npm run e2e` | Live HTTP workflow check against a running dev stack (35 checks) |
| `npm run build` | Production web bundle into `dist/` **and** compiled server into `dist-server/` |
| `npm start` | Production single-process server: serves API + built SPA |

### What was actually run in this workspace

| Check | Result |
| --- | --- |
| `npm run typecheck` | ✅ passed |
| `npm test` (Vitest) | ✅ 51/51 passed (2 files) |
| `npm run build` | ✅ passed, no circular-chunk warning |
| `npm run migrate` | ✅ `schema v2` |
| `npm run e2e` against Vite proxy | ✅ 35/35 checks passed |
| Compiled `NODE_ENV=production node dist-server/index.js` | ✅ health 433 questions, SPA deep links, static assets, manifest/icons, admin guard |
| Real browser (Chromium/Playwright) E2E | ❌ **not run** — no browser binary or Playwright download host is available in this sandbox (see §10) |
| Lighthouse / load-test scores | ❌ **not measured** — no performance claims are made |
| Deployment | ❌ **not performed** — instructions only (see §9) |

---

## 2. Architecture

```
web/src/                 React 19 + TypeScript + Vite SPA (mobile-first)
  api/client.ts          fetch wrapper: credentials, CSRF header, typed errors
  context/               auth/settings + toast providers
  components/            UI primitives, layout, brand, search, question palette
  pages/                 catalog → instructions → attempt → result, student, admin
  public/                manifest, original SVG/PNG icons, service worker
server/src/              Node + Express 4 + TypeScript
  db.ts / schema.sql     better-sqlite3 schema, migrations, deadline helpers
  config.ts              env + production secret assertions
  lib/                   auth/session/RBAC, CSRF, validation, rate limit,
                         scoring, question selection, audit
  routes/                auth, settings, catalog, tests, attempts, results,
                         analytics, practice, admin
  seedData.ts / seed.ts  original demo bank (433 questions) + settings/roles
  index.ts / migrate.ts  entry point + migration CLI
server/tests/            unit tests, API integration tests, live workflow script
dist/ dist-server/       generated build output (gitignored)
data/                    SQLite database + uploads (gitignored)
```

**Design decisions**

- **Single origin.** In production the compiled server serves both `/api` and the SPA,
  so session cookies stay first-party and no CORS allowlist is needed.
- **SQLite via `better-sqlite3`.** Zero-service setup, transactional integrity, WAL.
  Suitable for a single node; see §10 for scaling limits.
- **Snapshots, not references.** Starting an attempt copies each question's text,
  options, marks and key into `attempt_questions`. Later edits to the bank cannot
  change a candidate's paper mid-flight or retroactively alter a score.
- **Server is the clock.** `attempts.deadline_at` is stored at start; the client
  renders a countdown from `serverNow` + `deadlineAt`, but GET/submit/expiry all
  re-check the server time. A 20-second sweeper finalises abandoned expired attempts.

---

## 3. First administrator (production-safe process)

Never put a real password in `.env` or commit it. Create the account from the CLI
after migrating, then remove the credentials from your shell history.

```bash
# Development
npx tsx server/src/index.ts --setup-admin admin@vidyapariksha.local 'DevAdminPass2026!'

# Production (from the project root, with the same DATABASE_PATH as the service)
NODE_ENV=production SESSION_SECRET="$(openssl rand -hex 32)" \
  npx tsx server/src/index.ts --setup-admin you@example.com 'a-strong-password'
```

`--setup-admin` creates the account only if no administrator exists, prints
`Administrator ready: …` (or the reason it was skipped), and exits — it does **not**
start a server. Passwords are hashed with scrypt (N=2^15, `maxmem` 96 MB). The
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars are a **development-only**
convenience for `npm run seed`; leave them blank in production.

Roles and permissions are stored in `roles` / `permissions` and enforced on the
server by `requireAdmin` / `requirePermission`. Changing a role in browser state
does not grant access; every admin route re-reads the session and its role.

---

## 4. Environment

See [`.env.example`](./.env.example). Important values:

| Variable | Notes |
| --- | --- |
| `SESSION_SECRET` | **Required in production.** `assertProductionSecrets()` refuses to boot with the dev default. |
| `COOKIE_SECURE=true` | Set when serving HTTPS; a production warning is printed otherwise. |
| `TRUST_PROXY=1` | Set behind a TLS-terminating reverse proxy. |
| `PUBLIC_ORIGIN` / `SITE_URL` | Used for canonical URLs, `robots.txt`, `sitemap.xml` and the production CSP. |
| `DATABASE_PATH` | Defaults to `./data/vidyapariksha.db`. |
| `WEB_DIST` | Defaults to `./dist`; the compiled server resolves `schema.sql` next to itself or from the project root. |
| `ALLOW_REGISTRATION`, `GUEST_TESTS_ENABLED`, `MAINTENANCE_MODE` | Feature switches, also editable by an admin in **Admin → Settings**. |
| `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Only used by `npm run e2e`. |

---

## 5. The candidate journey (all implemented, all backed by real data)

1. **Home / Exams / Books / Tests** — categories, books, subjects and tests are read
   from the database. Counts, badges, countdowns and "recent tests" are real records,
   not placeholder statistics. Demo content is labelled as original practice.
2. **Selection wizard** — category → book → subject → topic → mode (subject-wise /
   topic-wise / full mock / custom practice) → question count → duration → language.
   Each dependent field is fetched from the API. Availability counts are computed from
   published, correctly-keyed questions; Hindi is only offered where translated
   questions actually exist.
3. **Instructions modal** — marks, negative marking, duration, language, resume
   policy and an explicit acknowledgement before a server attempt is created.
4. **Exam engine** — clickable MCQs, Save & Next, Previous, Clear Response,
   Mark for Review / Save & Mark, a responsive question palette with live status
   counts, bookmark and report actions. Answers are queued and retried on flaky
   networks; the timer is derived from the authoritative deadline and auto-submits
   on expiry. Reloading the page resumes the **same** attempt without resetting time.
5. **Submit confirmation** — explicit confirmation, idempotent via
   `client_submission_id`; a double submit cannot create a second result.
6. **Result** — the server recomputes totals from the stored snapshot. Review shows
   your answer, the correct answer, explanation and per-question time **only after
   submit** (or during practice only when `practice_feedback` is enabled). A real
   PDF report is generated by PDFKit. `result_visibility: hidden` suppresses keys.
7. **Student area** — dashboard, results history, progress analytics, bookmarks and
   revision list, all derived from that student's stored attempts. Retry builds a
   new 15-minute practice attempt from incorrect / unanswered / all / bookmarked
   questions. Guest attempts, bookmarks and reports are adopted when a guest
   registers or logs in.

### Security guarantees (tested)

- Correct option IDs and `is_correct` are **never** sent in an in-progress attempt.
- Marks are computed server-side; the client cannot submit a score.
- Answer writes are rejected after submission/expiry (409).
- One session cannot read another session's attempt or result (404).
- CSRF requires an explicit `x-csrf-token` header matching the session token —
  the readable cookie alone is **not** accepted.
- Guest sessions cannot reach any `/api/admin` route (401/403).
- Rate limiters: login (12/15 min per email+IP), password reset (5/hour),
  registration (10/hour), contact (5/hour), plus a general 180 writes/min/IP net.

---

## 6. Admin console

Sign in at `/login`, then `/admin`. Server-side permission keys include
`catalog.manage`, `questions.manage`, `tests.manage`, `users.manage`,
`analytics.view`, `attempts.view`, `reports.manage`, `settings.manage`,
`roles.manage`.

| Section | What it does |
| --- | --- |
| Overview | Real totals: questions, published tests, attempts, students, last 14 days |
| Categories / Books / Subjects / Topics | Full CRUD, active flags, slug handling, duplicate-slug rejection |
| Questions | Paginated filter/search, create/edit with 2–8 options and validated keys, duplicate, archive/publish, bulk status, preview, CSV export |
| Import | Paste/upload CSV → **preview with row-numbered errors** → commit only valid rows (max 2,000/file) |
| Tests | Create/edit test configs: mode, selection mode, count, duration, languages, marks/negative, feedback, result visibility, resume policy, auto-submit, publish/list flags, plus topic/difficulty **pattern rules** |
| Test preview | Runs the real selector and reports the exact number of eligible questions |
| Attempts / Students / Analytics / Reports | Paginated real records, status changes, analytics |
| Settings / Roles / Audit logs / Contact messages / Countdowns | Live configuration, permission editing, audit trail |

### CSV import format

Header (the exporter produces exactly this):

```csv
code,book_slug,subject_slug,topic_slug,difficulty,qtype,text_en,text_hi,explanation_en,marks,negative_marks,language,status,tags,source,options,correct_labels
,lucent-subject-wise,physics,mechanics,easy,single,"What is the SI unit of force?",,,1,0.25,en,published,"physics,import",original,"A:Newton||B:Joule||C:Watt||D:Pascal",A
```

- `options` is `Label:Text` joined by `||`; `correct_labels` is `A` or `A,C`.
- `single` questions must have exactly one correct label; `multiple` may have several.
- `book_slug` and `subject_slug` must exist; `topic_slug` must belong to that subject.
- Invalid rows are listed with their spreadsheet row number and are **not** inserted.
- New imports default to `draft` unless the row explicitly sets `status=published`.

### Test patterns

`selectionMode: fixed` uses the explicit `test_questions` order. `random` samples the
eligible published/keyed pool. `topic` uses `test_rules` rows
(`subject_id`, `topic_id`, `difficulty`, `question_count`) whose counts must add up
to the test's `question_count` — otherwise creation is rejected. If any rule or the
overall pool lacks enough eligible questions, the API returns **409
"Not enough eligible questions…"** rather than silently shrinking the paper.

---

## 7. API surface

All responses are JSON shaped `{ ok, data?, meta?, error?, details? }`. State-changing
requests need the CSRF header. Paginated endpoints accept `?page=&limit=` and return
`meta: { page, limit, total, pages }`.

| Family | Endpoints |
| --- | --- |
| Public | `GET /settings`, `/health`, `/countdowns`, `/robots.txt`, `/sitemap.xml`; `POST /contact` |
| Auth | `POST /register`, `/login`, `/logout`, `/password/forgot`, `/password/reset`; `GET /me`; `PATCH /profile`; `DELETE /account` |
| Catalog | `GET /categories`, `/books`, `/books/:slug`, `/subjects`, `/subjects/:slug`, `/topics/:subjectSlug/:topicSlug`, `/exams/:slug`, `/search?q=` |
| Tests | `GET /tests`, `/tests/recent`, `/tests/:slug` |
| Attempts | `POST /attempts`, `/attempts/retry`; `GET /attempts/:id`; `PUT /attempts/:id/answers`; `POST /attempts/:id/submit` |
| Results | `GET /results`, `/results/:attemptId`, `/results/:attemptId/pdf`; `GET /analytics/overview` |
| Practice | `GET/POST /bookmarks`, `DELETE /bookmarks/:id`, `GET /revision`, `POST /question-reports` |
| Admin | `/api/admin/*` — overview, CRUD resources, import/export, preview, roles, settings, audit logs, uploads |

`POST /api/attempts` accepts `testId`, `language`, optional `subjectId`, `topicId`,
`questionCount`, `durationMinutes`, `mode` and an idempotent `clientRequestId`.

---

## 8. Accessibility, SEO, PWA, resilience

- **Accessibility:** semantic landmarks and a skip link, labelled form controls, visible focus
  states, keyboard-operable palette/options/modals, a labelled `role="timer"` and live-region toasts,
  status conveyed by text/icon as well as colour, `viewport-fit=cover` + safe-area
  aware sticky exam controls, no horizontal scroll at ~360 px, 44 px touch targets.
  WCAG 2.2 AA is targeted where practical; a formal audit has **not** been performed.
- **SEO:** per-page `<title>`/meta description/canonical via `PageMeta`, dynamic
  `robots.txt` and a database-generated `sitemap.xml`, clean deep links served by
  the SPA fallback. Search engines cannot see attempt/admin routes (disallowed).
- **PWA:** original manifest + SVG/192/512 icons, service worker registered in
  production. The worker caches **static assets only**; it deliberately never caches
  `/api/`, `/uploads/` or `/health`, so private results are never served from a
  cache. Offline catalog browsing of already-visited pages works; **offline exams
  are not supported** because the attempt state lives on the server.
- **Resilience:** queued answer sync with retry, resume-safe attempts, server-side
  expiry sweeper, idempotent start/submit, WAL database, graceful SIGTERM shutdown.
- **Validation:** Zod schemas on request bodies, bounded pagination, CSV row
  validation, 2 MB JSON/upload limits, image magic-byte checks.

---

## 9. Deployment (single node, instructions only — not performed)

```bash
# On the server, after uploading the code and setting .env for production:
npm ci                                   # or: npm_config_nodedir=/usr/local npm ci
npm run migrate
npx tsx server/src/index.ts --setup-admin you@example.com 'a-strong-password'
npm run seed                             # optional demo bank; skip for a clean install
npm run build
NODE_ENV=production npm start            # listens on 0.0.0.0:$PORT, serves dist/ + /api
```

Then put a TLS-terminating reverse proxy in front and set
`COOKIE_SECURE=true`, `TRUST_PROXY=1`, `PUBLIC_ORIGIN=https://your.domain`,
`SITE_URL=https://your.domain`.

Minimal nginx site:

```nginx
server {
  listen 443 ssl http2;
  server_name your.domain;
  ssl_certificate     /etc/letsencrypt/live/your.domain/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your.domain/privkey.pem;

  client_max_body_size 4m;             # CSV import / image upload
  location / { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host;
               proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
               proxy_set_header X-Forwarded-Proto $scheme; }
}
server { listen 80; server_name your.domain; return 301 https://$host$request_uri; }
```

systemd unit sketch:

```ini
[Unit]
Description=VidyaPariksha CBT platform
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/vidyapariksha
EnvironmentFile=/srv/vidyapariksha/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist-server/index.js
Restart=on-failure
User=vidyapariksha
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

**Backups:** stop the service (or use `sqlite3 … ".backup"`) and copy
`data/vidyapariksha.db` **plus** `data/uploads/`. WAL files are part of the live
database — do not copy only the `.db` file while the process is writing. Restore by
copying back before starting the service, then run `npm run migrate` to apply any
additive schema changes.

**Post-deploy verification:** `curl https://your.domain/api/health` →
`{"ok":true,"status":"healthy",...}`; load `/`, `/exams`, `/books`,
`/test/mechanics-topic-wise/instructions`; confirm `/manifest.webmanifest` and
`/icons/icon-192.png`; sign in as admin and open `/admin`; run `npm run e2e` with
`E2E_BASE_URL=https://your.domain` and a real admin account.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `npm install` fails fetching Node headers for `better-sqlite3` (`ECONNRESET`) | Use local headers: `npm_config_nodedir=/usr/local npm install`. Ensure `python3`, `make`, `g++` are installed. |
| `EADDRINUSE: address already in use 0.0.0.0:4000` | Another API instance is running. `ss -ltnp \| grep 4000`, stop it, or set `PORT=4001` and update Vite's `API_URL`. |
| Frontend shows `Frontend build not found. Run npm run build:web.` | `dist/` is missing and `NODE_ENV=production` (or an existing `dist/` check) triggered static serving. Run `npm run build`. |
| `403 Forbidden` on POST/PUT/PATCH | CSRF. The client must read the `vp_csrf` cookie and send it as `x-csrf-token`. The cookie alone is intentionally not enough. Call `GET /api/auth/me` first if the token is missing. |
| `429 Too many attempts` | A rate limiter tripped. Wait for the window, or (dev only) restart the process — buckets are in memory. Limits are documented in §5. |
| `RangeError: Invalid scrypt params … memory limit exceeded` | Old Node default `maxmem` is too small for N=2^15. `server/src/lib/auth.ts` passes `maxmem: 96 * 1024 * 1024`. |
| `schema.sql not found` | Run commands from the project root, or rebuild: `npm run build:api` now copies `schema.sql` into `dist-server/`. |
| Login works locally but the cookie never sticks in production | Set `COOKIE_SECURE=true` only with real HTTPS, and `TRUST_PROXY=1` behind the proxy. Mismatched settings drop the cookie. |
| Password reset email never arrives | **No mail transport is bundled.** The endpoint creates a hashed, single-use, 1-hour token; in development it returns `devResetToken` so the flow is testable. In production you must wire an SMTP/provider call at the marked boundary in `server/src/routes/auth.ts` (`// No mail transport is bundled`). The API deliberately does not leak the token in production. |
| Custom practice says "Not enough eligible questions" | The selector is honest: publish/import more questions for that book/subject/topic/difficulty/language, or lower the requested count. |
| Timer seems to jump after reload | Expected: the countdown re-syncs to the stored server deadline; it is not a local counter. |
| `503 Maintenance mode is enabled` | Disable `MAINTENANCE_MODE` or turn the switch off in **Admin → Settings**. GET/admin/auth routes remain reachable. |
| Contact form returns 422 | `/api/contact` requires name ≥ 2, a valid email, subject ≥ 3 and message ≥ 10 characters. |
| Question cannot be deleted | It appears in a stored attempt snapshot. Archive it instead — deleting would corrupt historical results. |

---

## 11. Known limitations (deliberate, not oversold)

- **Not deployed.** No hosting, domain, TLS certificate or CI/CD pipeline is part of
  this repository. §9 is a runbook, not a completed deployment.
- **No browser-driven E2E ran.** This sandbox has no Chromium/Playwright browser and
  outbound access is limited to GitHub/npm/PyPI, so Playwright's browser CDN is
  unreachable. `npm run e2e` is a real HTTP workflow check through the Vite proxy
  (cookies + CSRF + full attempt lifecycle), not a DOM test. Add Playwright in an
  environment with browser downloads to cover rendering, taps and keyboard flows.
- **No measured performance scores.** Bundle splitting, compression, caching and
  lazy routes are configured, but Lighthouse/load-test numbers were not collected.
- **SQLite is single-node.** Concurrent multi-instance writes need a shared SQL
  database and a migration of the query layer; the in-memory rate limiter would also
  need a shared store (e.g. Redis) behind multiple instances.
- **Email/SMS/push are integration boundaries.** Password-reset token generation is
  implemented; delivery is not bundled. No payment gateway is included.
- **Hindi coverage is partial.** The UI and schema are bilingual, and Hindi options
  appear only where translated questions exist; edit/import more `hi`/`bilingual`
  questions to broaden it.
- **Demo content is clearly labelled.** The 433 seeded questions are original
  practice items, not official exam papers. Replace them with licensed content
  before a public launch.
- **Accessibility is engineered, not certified.** A manual WCAG 2.2 AA audit with
  assistive technology is still recommended before launch.

---

## 12. License / content

Code in this repository is provided for your project. The seeded questions and the
VidyaPariksha name/mark are original demo material created for this build; review
licensing and replace content as appropriate for your use case. No third-party
brand assets from shardatest.in are included.
