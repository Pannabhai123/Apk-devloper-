# VidyaPariksha — Online Mock Test & CBT Platform

A mobile-first, full-stack computer-based testing platform with a real question bank,
a server-authoritative exam engine, backend-calculated results, student dashboards and
an admin console. **VidyaPariksha is original branding and design.** The workflow was
informed by the public flow of shardatest.in, but no logos, illustrations, copy or
proprietary assets were copied.

> **Status legend used below:** **Implemented** = code exists · **Tested** = covered by
> an automated check that ran green in this workspace · **Configured** = available via
> settings/env, needs your values/credentials · **Deployed** = running on infrastructure
> you control.
>
> **THE WEBSITE IS NOT LIVE YET.** Nothing in this repository has been deployed to a
> public host. The application is complete, hardened and deployment-ready — §9a gives
> the exact steps to make it live in one click — but that final step needs a hosting
> account that this build environment does not have and cannot create.

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
| `npm test` | Vitest unit + API integration + security-hardening suite (**76 tests**, 3 files) |
| `npm run e2e` | Live HTTP workflow check against a running stack (**35 checks**) |
| `npm run test:browser` | **Real Chromium** DOM workflow (`playwright-core` + `@sparticuz/chromium`), **68 checks** |
| `npm run test:lighthouse` | Real Lighthouse audit; writes `artifacts/lighthouse.json` |
| `npm run build` | Production web bundle into `dist/` **and** compiled server into `dist-server/` |
| `npm start` | Production single-process server: serves API + built SPA |

### What was actually run in this workspace

| Check | Result |
| --- | --- |
| `npm run typecheck` | ✅ passed (server + web) |
| `npm test` (Vitest) | ✅ **76/76** passed — `unit` 20, `api.workflow` 31, `hardening` 25 |
| `npm run build` | ✅ passed; split chunks: `react-vendor` 83 kB gz, app 41 kB gz, icons 8 kB gz |
| `npm run migrate` on a **fresh** database file | ✅ `schema v2`; `npm run seed` then inserted **433 questions / 28 tests** |
| `npm run e2e` against compiled production server (`:4100`) | ✅ **35/35** with a real admin login |
| Compiled production server with `SEED_DEMO_ON_EMPTY=true` + `ADMIN_BOOTSTRAP_SECRET` | ✅ 433 questions seeded once, `/setup-admin` opened, wrong secret **401**, correct secret **201**, status then `allowed:false`, second attempt **409** |
| **Persistence across a real process restart** (same database file) | ✅ attempt, saved answer, mark-for-review, bookmark, user account, admin role and results all survived; the seed did **not** re-run |
| `npm run test:browser` against Vite (`:5173`) | ✅ **68/68**, 0 skipped |
| `npm run test:browser` against compiled production (`:4100`) | ✅ **68/68**, 0 skipped |
| Lighthouse (mobile emulation, production build, 5 runs) | ✅ **Performance 93–97 (median 96) · Accessibility 100 · Best practices 100 · SEO 100**; FCP 1.8–2.1 s, LCP 2.0–2.5 s, TBT 100–200 ms, CLS 0–0.001. Scores vary between runs — the range is reported, not a cherry-picked best. |
| Compiled `NODE_ENV=production node dist-server/index.js` | ✅ health, SPA deep links, static assets/fonts, manifest, admin guard, `Cache-Control: no-store` on API, honest **503** for unconfigured mail |
| Deployment to hosting/TLS/domain | ❌ **not performed** — needs your credentials and explicit authorisation (see §9) |

Browser artifacts (screenshots at 360/390/768/1366 px, downloaded PDFs, Lighthouse
JSON) are written to the gitignored `artifacts/` directory. The browser run includes
a genuine **65-second wait** for a one-minute server deadline to expire; it does not
fake the timer.

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

Never put a real password in `.env` or commit it. There are two supported routes,
both secure, and neither stores a password in source or in the frontend bundle.

**Route A — one-time web form (best for a hosted deployment).** Set
`ADMIN_BOOTSTRAP_SECRET` to a random 16+ character value in the server's
environment. The login page then shows a *“Set up the first administrator”* link
that opens `/setup-admin`, where you paste the secret and choose the admin email
and password. The server accepts the form **only while the database has no
administrator at all**; the first successful submission creates the account,
signs you in, and the flow is closed permanently (a second attempt returns 409
even with the correct secret). No password ever appears in a log or an API
response.

**Route B — CLI (best for a server you control).** Create the account from the
CLI after migrating, then remove the credentials from your shell history.

```bash
# Development — generate the password, never reuse one shown in a chat or a README
DEV_ADMIN_PASS="$(openssl rand -hex 24)"
npx tsx server/src/index.ts --setup-admin admin@vidyapariksha.local "$DEV_ADMIN_PASS"
printf 'Local dev admin password (store it yourself, then clear this shell): %s\n' "$DEV_ADMIN_PASS"
unset DEV_ADMIN_PASS

# Production (from the project root, with the same DATABASE_PATH as the service)
NODE_ENV=production SESSION_SECRET="$(openssl rand -hex 32)" \
  npx tsx server/src/index.ts --setup-admin you@example.com "$(openssl rand -hex 24)"

# Rotate an existing administrator's password (also invalidates nothing else):
npx tsx server/src/index.ts --rotate-admin you@example.com "$(openssl rand -hex 24)"
```

> **Rotation notice.** An earlier revision of this README printed a sample
> development password (`DevAdminPass2026!`). **That value is no longer valid**: the
> sandbox administrator password was rotated with `--rotate-admin` to a random
> 24-byte value. If you ever copy a password from documentation, chat or logs, treat
> it as compromised and rotate it before exposing the service. Never place a real
> credential in `.env` in source control — use `--setup-admin` / `--rotate-admin`.

Both routes call the same `seedAdmin()` logic. `--setup-admin` creates the
account only if no administrator exists, prints
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
| `PUBLIC_ORIGIN` / `SITE_URL` | Used for canonical URLs, `robots.txt`, `sitemap.xml` and the production CSP. **Leave blank on a provider-assigned subdomain** — the server then derives the public HTTPS origin from each request, including for password-reset links. |
| `ADMIN_BOOTSTRAP_SECRET` | Unlocks the one-time **first-administrator** form at `/setup-admin`. Required for §9a. See §3. |
| `SEED_DEMO_ON_EMPTY` | `true` loads the 433-question demo bank the first time the database is empty. Idempotent — see §9c. |
| `DATABASE_PATH` | Defaults to `./data/vidyapariksha.db`. |
| `WEB_DIST` | Defaults to `./dist`; the compiled server resolves `schema.sql` next to itself or from the project root. |
| `ALLOW_REGISTRATION`, `GUEST_TESTS_ENABLED`, `MAINTENANCE_MODE` | Feature switches, also editable by an admin in **Admin → Settings**. |
| `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Used by `npm run e2e` and `npm run test:browser`. Admin checks are **skipped** (not faked) if the admin variables are absent. Set them in your shell, not in a committed file. |
| `LIGHTHOUSE_URL` | Target for `npm run test:lighthouse` (default `http://127.0.0.1:4000/`). |
| `MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_*`, `RESEND_API_KEY`, `RESET_TOKEN_TTL_SECONDS` | Password-recovery delivery boundary. See §10. |
| `EXPOSE_DEV_RESET_TOKEN`, `ALLOW_INSECURE_COOKIES` | Development/smoke-test escapes. **Production boot refuses** `EXPOSE_DEV_RESET_TOKEN=true` and refuses insecure cookies unless the escape hatch is set. |

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
  WCAG 2.2 AA is targeted where practical. Lighthouse's automated axe-based
  accessibility audit scored **100/100** on the production homepage after the
  muted-text contrast and footer heading-order defects were fixed; a formal manual
  audit with assistive technology has **not** been performed.
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

## 9. Deployment

The application is a single process that serves the built SPA **and** the API, so
there is no second server to run and no CORS configuration to get wrong.
`Dockerfile` and `render.yaml` are committed, so a free hosting plan can build and
run the whole thing.

Everything user-owned lives under one directory — **`/app/data`** in the image —
which must be a **persistent** volume:

| Path | Contents | Lost if the volume is lost |
| --- | --- | --- |
| `/app/data/vidyapariksha.db` | questions, books, categories, subjects, topics, tests, users, attempts, answers, results, bookmarks, settings, audit log | **yes — everything** |
| `/app/data/uploads/` | question images uploaded from the admin console | yes |

Nothing is kept in memory or in temporary JSON files; SQLite (WAL mode) is the
system of record.

### 9a. Free hosting, no domain, no payment (Render)

This is the shortest path and it needs no command line on your machine.

1. Sign up at **render.com** with an email address — the free plan is enough.
2. In the Render dashboard: **New → New Web Service → Connect GitHub**, pick
   `Pannabhai123/Apk-devloper-`, choose the branch, **Continue → Review →
   Deploy**. Render reads `render.yaml` and builds the image (the first build
   takes a few minutes because it compiles the web bundle and the server).
3. When the service turns green, Render shows a public URL shaped like
   `https://<service-name>.onrender.com`. Open it in a phone browser — that is
   your website.
4. Open the service in the dashboard → **Environment** tab → copy the value of
   `ADMIN_BOOTSTRAP_SECRET`.
5. On the live site open `/setup-admin`, paste that secret, and choose the admin
   email and a strong password. You are signed in as the administrator.
6. You can then clear `ADMIN_BOOTSTRAP_SECRET` from the dashboard. The form is
   closed permanently anyway, because an administrator now exists.

`render.yaml` sets `SESSION_SECRET` and `ADMIN_BOOTSTRAP_SECRET` with
`generateValue: true`, so Render creates both. `PUBLIC_ORIGIN` is deliberately
**not** set: the server derives the public HTTPS origin from each request, which
is what you want on a host assigned after deploy.

The same image runs on Fly.io, a cheap VPS, Kubernetes or a laptop. Point the
volume at `/app/data` wherever you put it.

### 9b. Deploying on a server you control

```bash
npm ci                                   # or: npm_config_nodedir=/usr/local npm ci
npm run migrate
npm run seed                             # optional demo bank; skip for a clean install
npm run build
NODE_ENV=production npm start            # listens on 0.0.0.0:$PORT, serves dist/ + /api
```

Then put a TLS-terminating reverse proxy in front and set
`COOKIE_SECURE=true`, `TRUST_PROXY=1`, and (only if the site is served from a
host you control) `PUBLIC_ORIGIN`/`SITE_URL`.

Create the administrator with Route B from §3:

```bash
NODE_ENV=production SESSION_SECRET="$(openssl rand -hex 32)" \
  npx tsx server/src/index.ts --setup-admin you@example.com "$(openssl rand -hex 24)"
```

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
database — do not copy only the `.db` file while the process is writing. Restore
by copying back before starting the service, then run `npm run migrate` to apply
any additive schema changes.

### 9c. First-run content

`SEED_DEMO_ON_EMPTY=true` (set in `render.yaml`) loads the 433-question demo bank
the first time the database contains **zero** questions. `seedDemoContent()` is
idempotent and returns `{ skipped: true }` once any content exists, so it can
never duplicate or overwrite your own imports. Set it to `false` if you want an
empty bank and to import your own questions.

### 9d. Post-deploy verification

```bash
curl https://<host>/api/health          # {"ok":true,"status":"healthy",...}
curl https://<host>/api/auth/bootstrap-status   # {"data":{"allowed":false}} once an admin exists
```

Then load `/`, `/exams`, `/books`, `/test/<slug>/instructions`, sign in as the
administrator and open `/admin`, and run the full check against the live host:

```bash
E2E_BASE_URL=https://<host> E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='…' npm run e2e
E2E_BASE_URL=https://<host> E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='…' npm run test:browser
LIGHTHOUSE_URL=https://<host>/ npm run test:lighthouse
```

`npm run e2e` and `npm run test:browser` are **real** checks — they create real
attempts, save real answers, submit them and read the server-calculated result.
They never fabricate data.

### 9e. Free-tier limitations you should know before you rely on them

* **Idle spin-down.** Render's free web service sleeps after roughly 15 minutes of
  inactivity. The first request after a cold start can take ~30–60 s while the
  process wakes. Every request after that is fast. If that is unacceptable, you
  need a paid plan, a VPS, or a provider that does not sleep.
* **No custom domain on the free plan.** You get a `*.onrender.com` subdomain,
  which is what §9a uses. The user requirement was “no domain purchase”, so this
  fits, but you cannot use your own name.
* **Disk size is bounded** by the free plan. The demo database is small (a few
  MB); question images are the thing to watch.
* **I could not verify the current numbers.** The build sandbox has no outbound
  network access to `render.com`, so the plan limits, spin-down timing and disk
  quota quoted above are the provider's *documented* behaviour as of the last
  review, not a measurement taken today. Re-read
  <https://render.com/docs/free> and <https://render.com/pricing> before you
  depend on them, and keep a backup of `/app/data`.
* **No load test has been run.** Nothing here tells you how many concurrent
  students the free instance will hold.

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
| Password reset returns **503** | Correct behaviour when `MAIL_PROVIDER=none`. No usable token is created, so the API never claims a mail was sent. Configure `MAIL_PROVIDER=smtp` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM`) or `MAIL_PROVIDER=resend` (`RESEND_API_KEY`, `MAIL_FROM`). `MAIL_PROVIDER=console` is **development/test only** and is refused in production. Tokens are single-use, hashed at rest, and expire after `RESET_TOKEN_TTL_SECONDS` (default 3600). Set `EXPOSE_DEV_RESET_TOKEN=true` only for local tests — production boot rejects it. If sending fails, the stored token is deleted. |
| Custom practice says "Not enough eligible questions" | The selector is honest: publish/import more questions for that book/subject/topic/difficulty/language, or lower the requested count. |
| Timer seems to jump after reload | Expected: the countdown re-syncs to the stored server deadline; it is not a local counter. |
| `503 Maintenance mode is enabled` | Disable `MAINTENANCE_MODE` or turn the switch off in **Admin → Settings**. GET/admin/auth routes remain reachable. |
| Contact form returns 422 | `/api/contact` requires name ≥ 2, a valid email, subject ≥ 3 and message ≥ 10 characters. |
| Question cannot be deleted | It appears in a stored attempt snapshot. Archive it instead — deleting would corrupt historical results. |

---

## 11. Known limitations (deliberate, not oversold)

- **Not deployed.** No hosting, domain, TLS certificate or CI/CD pipeline is part of
  this repository. §9 is a runbook, not a completed deployment.
- **Browser E2E is real but single-browser.** `@sparticuz/chromium` headless shell +
  `playwright-core` render the actual UI (68 checks, both dev and compiled production).
  Only Chromium was exercised — Safari/Firefox and real mobile devices were not. The
  headless shell runs `--single-process`, so the suite deliberately uses one
  `BrowserContext` and swaps cookie jars instead of opening isolated contexts.
- **Lighthouse is a lab score, not a field measurement.** Five runs on the sandbox's
  mobile emulation over loopback gave Performance 93–97 (median 96) and 100/100/100
  for Accessibility/Best practices/SEO. Real-world Core Web Vitals depend
  on hosting, network and device. **No load test** or capacity benchmark was run.
- **SQLite is single-node.** Concurrent multi-instance writes need a shared SQL
  database and a migration of the query layer; the in-memory rate limiter would also
  need a shared store (e.g. Redis) behind multiple instances.
- **Email delivery needs real credentials.** The reset-token flow, hashing, TTL,
  single-use enforcement and failure cleanup are implemented; SMTP and Resend are
  wired as configurable transports but were **not** exercised against a live provider
  because no credentials exist here. Unconfigured delivery returns an honest 503.
  SMS/push are not implemented. No payment gateway is included.
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


---

## 13. Honest verification matrix

| Area | Status | What that actually means |
| --- | --- | --- |
| **Implemented** | ✅ | Category→book→subject→topic→config→instructions→server-backed attempt→save/next/prev/clear/mark/palette→resume→server deadline→submit→server score→review→PDF→dashboard; DB-backed question bank with admin CRUD, CSV preview/import/export, preview/publish and rule-based test generation; registration/login/guest sessions, RBAC, bookmarks, revision, analytics, audit log; bilingual UI, PWA assets, seed + migrations. |
| **Automated-tested** | ✅ | `npm test` **76/76** (unit, API integration, security hardening incl. hidden answer keys, duplicate submit, session isolation, CSRF, rate limits, CSV validation, magic-byte upload checks, CSV export); `npm run e2e` **35/35** live HTTP workflow against the compiled production server. |
| **Browser-tested** | ✅ | `npm run test:browser` **68/68** in real Chromium against **both** Vite dev and the compiled production build: full journey, refresh/resume, 4 viewports with no horizontal overflow, offline queue/reconnect, timer expiry (real 65 s wait), Hindi/bilingual rendering, honest translation fallback, Devanagari PDF, PDF download, admin sign-in/permission denial, 18 public+student routes, 12 admin routes, and the closed first-administrator page rendered without a React crash. |
| **Performance-measured** | ✅ (lab only) | Lighthouse mobile emulation on the production build, **5 runs**: Performance **93–97 (median 96)**, Accessibility/Best practices/SEO **100/100/100**; FCP 1.8–2.1 s, LCP 2.0–2.5 s, TBT 100–200 ms, CLS 0–0.001. Assets split into cacheable vendor/app/icon chunks; fonts self-hosted. **No load test or field/RUM data.** |
| **Production-configured** | ✅ | Compiled `NODE_ENV=production` boot enforces a strong `SESSION_SECRET`, secure cookies (with a documented local-HTTP escape hatch), refuses dev reset-token exposure, sets CSP/no-store/HSTS-when-HTTPS, scrubs 500 errors, sweeps expired sessions, copies schema + Devanagari font into `dist-server`, prints honest warnings for localhost origin and missing mail. Config/docs/backups/systemd/nginx examples are in §9. |
| **Deployment-prepared** | ✅ | `Dockerfile` + `.dockerignore` + `render.yaml` committed. One container serves SPA + API + SQLite; `/app/data` is the single persistent volume. `render.yaml` generates `SESSION_SECRET`/`ADMIN_BOOTSTRAP_SECRET`, derives the public origin from requests, seeds once on an empty database and health-checks `/api/health`. A one-time `/setup-admin` form creates the first administrator with no password in source, env or logs. Verified end-to-end against the compiled production server in this sandbox (bootstrap + restart persistence, above). |
| **Actually-deployed** | ❌ | **Not deployed — THE WEBSITE IS NOT LIVE YET.** The build sandbox has no outbound network access to any hosting provider (`render.com`, `vercel.com`, `cloudflare.com`, `fly.io`, `api.netlify.com`, `supabase.com`, `onrender.com` all fail to connect) and holds no provider credentials. What ran here was a local production-mode server for verification, not a hosted site. §9a is the exact one-click path that turns this into a real public URL. |
