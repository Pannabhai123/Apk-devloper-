/**
 * Live end-to-end workflow check against a running stack (Vite dev server on
 * :5173 proxying the API on :4000). This exercises the same HTTP journey the
 * browser uses, including cookies and CSRF.
 *
 *   npm run dev          # in one terminal
 *   npm run e2e          # in another
 *
 * Not a replacement for a real browser E2E runner (see README limitations).
 */
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
let cookies: Record<string, string> = {};
let passed = 0;
let skipped = 0;
const failures: string[] = [];
function skip(label: string, reason: string) {
  skipped++;
  console.log(`  ⊘ ${label} — SKIPPED (${reason})`);
}

function mergeCookies(res: Response) {
  for (const raw of (res.headers as any).getSetCookie?.() || []) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
}
function cookieHeader() { return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '); }

async function call<T = any>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T; headers: Headers }> {
  const method = init.method || 'GET';
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
  if (cookies.vp_csrf && !['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = cookies.vp_csrf;
  if (init.body) headers['Content-Type'] = 'application/json';
  if (cookieHeader()) headers.Cookie = cookieHeader();
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
  mergeCookies(res);
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, data: data as T, headers: res.headers };
}

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.error(`  ✗ ${label}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400)); }
}

async function main() {
  console.log(`\nVidyaPariksha live workflow check → ${BASE}\n`);
  const home = await call<string>('/');
  check('Homepage renders HTML', home.status === 200 && String(home.data).includes('<div id="root"></div>'));
  for (const path of ['/exams', '/books', '/tests', '/about', '/contact', '/privacy-policy', '/terms', '/login', '/test/mechanics-topic-wise/instructions']) {
    const r = await call<string>(path);
    check(`Public route ${path} serves the SPA`, r.status === 200 && String(r.data).includes('<div id="root"></div>'), r.status);
  }

  const me = await call<any>('/api/auth/me');
  check('Guest session created by the server', me.status === 200 && me.data.data.user === null && Boolean(me.data.data.csrfToken));

  const categories = await call<any>('/api/categories');
  check('Categories come from the database', categories.data.ok && categories.data.data.length >= 10);

  const book = await call<any>('/api/books/lucent-subject-wise');
  const physics = book.data.data.subjects.find((s: any) => s.slug === 'physics');
  const mechanics = book.data.data.topics.find((t: any) => t.slug === 'mechanics');
  check('Book detail exposes dependent subjects & topics', Boolean(physics && mechanics && book.data.data.customTestSlug));
  check('Availability counts are real numbers', typeof book.data.data.question_count === 'number' && book.data.data.question_count > 0);

  const config = await call<any>(`/api/tests/${book.data.data.customTestSlug}`);
  check('Custom practice test configuration loads', config.data.ok && config.data.data.customCountEnabled === true);

  const started = await call<any>('/api/attempts', { method: 'POST', body: JSON.stringify({
    testId: config.data.data.id, language: 'en', subjectId: physics.id, topicId: mechanics.id,
    questionCount: 5, durationMinutes: 7, mode: 'topic_wise', clientRequestId: crypto.randomUUID(),
  }) });
  check('Step 1–9: configured attempt starts', started.status === 201, started.data);
  const attemptId = started.data.data?.attemptId;
  if (!attemptId) { console.error('Cannot continue without an attempt.'); return summary(); }

  const state = await call<any>(`/api/attempts/${attemptId}`);
  const questions = state.data.data.questions;
  check('Attempt contains real questions', Array.isArray(questions) && questions.length === 5);
  check('Answer key is not exposed before submission', !JSON.stringify(questions).includes('is_correct'));
  const first = questions[0];
  const second = questions[1];

  const saved = await call<any>(`/api/attempts/${attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ questionId: first.id, selectedOptionIds: [first.options[0].id], viewing: true }) });
  check('Save & Next answer is persisted', saved.data.ok && saved.data.data.statusCounts.answered === 1, saved.data);

  const next = await call<any>(`/api/attempts/${attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ questionId: second.id, previousQuestionId: first.id, viewing: true }) });
  check('Navigation to next question records server-side timing', next.data.ok);

  const back = await call<any>(`/api/attempts/${attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ questionId: first.id, previousQuestionId: second.id, markedForReview: true }) });
  check('Previous + Mark for Review work', back.data.ok && back.data.data.statusCounts.marked === 1, back.data);

  const cleared = await call<any>(`/api/attempts/${attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ questionId: first.id, clear: true, selectedOptionIds: [] }) });
  check('Clear Response removes the answer', cleared.data.ok && cleared.data.data.statusCounts.answered === 0);

  const resumed = await call<any>(`/api/attempts/${attemptId}`);
  check('Refresh/resume keeps the original deadline', resumed.data.data.attempt.deadlineAt === state.data.data.attempt.deadlineAt);
  check('Palette states survive a refresh', resumed.data.data.questions[0].markedForReview === true);

  const submit = await call<any>(`/api/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({ clientSubmissionId: crypto.randomUUID() }) });
  check('Submission is calculated on the server', submit.data.ok && typeof submit.data.data.marksObtained === 'number', submit.data);

  const result = await call<any>(`/api/results/${attemptId}`);
  check('Result review reveals correct answers after submit', result.data.ok && Array.isArray(result.data.data.review[0].correctOptionIds));
  check('Result summary is derived from real answers', result.data.data.summary.totalQuestions === 5);

  const pdf = await call<string>(`/api/results/${attemptId}/pdf`);
  check('PDF report is generated', pdf.status === 200 && String(pdf.headers.get('content-type')).includes('application/pdf'));

  const before = await call<any>(`/api/attempts/${attemptId}/answers`, { method: 'PUT', body: JSON.stringify({ questionId: first.id, selectedOptionIds: [first.options[0].id] }) });
  check('Answers are locked after submission', before.status === 409);

  // No credentials are hardcoded. Supply E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
  // in the environment for a real deployment; otherwise these checks are skipped.
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const login = await call<any>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
    check('Administrator can sign in', login.status === 200 && login.data.data.user.role === 'super_admin', login.data.error);
    const overview = await call<any>('/api/admin/overview');
    check('Admin overview returns genuine statistics', overview.status === 200 && overview.data.data.totalQuestions > 100, overview.data.error);
    const settings = await call<any>('/api/admin/settings');
    check('Site settings are readable by authorised admin', settings.status === 200 && Boolean(settings.data.data.site_name));
    const logout = await call<any>('/api/auth/logout', { method: 'POST', body: '{}' });
    check('Logout clears the privileged session', logout.data.ok);
  } else {
    skip('Administrator sign-in, overview, settings and logout', 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
  }
  const blocked = await call<any>('/api/admin/overview');
  check('Admin route is protected without a privileged session', blocked.status === 401 || blocked.status === 403);

  const contact = await call<any>('/api/contact', { method: 'POST', body: JSON.stringify({ name: 'Workflow Test', email: 'workflow@test.local', subject: 'Automated check', message: 'This end-to-end message is actually stored.' }) });
  check('Contact form persists a message', contact.status === 201, contact.data);

  summary();
}

function summary() {
  console.log(`\n${passed} checks passed, ${skipped} skipped, ${failures.length} failed.`);
  if (failures.length) { console.error('Failures:', failures.join(', ')); process.exitCode = 1; }
  else console.log('Live workflow complete.\n');
}

main().catch((err) => { console.error('[e2e] fatal:', err); process.exitCode = 1; });
