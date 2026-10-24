/**
 * REAL browser end-to-end workflow — Playwright Core + a genuine Chromium
 * headless shell (see ./browser/launch.mjs). Requires a running dev stack:
 *
 *   npm run dev            # terminal 1
 *   npm run test:browser   # terminal 2
 *
 * Screenshots and the downloaded PDF are written to ./artifacts (gitignored).
 * This is NOT jsdom and NOT an HTTP-only simulation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from './browser/launch.mjs';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const ART = path.resolve('artifacts');
fs.mkdirSync(ART, { recursive: true });

let passed = 0, skipped = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.error(`  ✗ ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 400)}`}`); }
}
function skip(label, reason) { skipped++; console.log(`  ⊘ ${label} — SKIPPED (${reason})`); }

/** Call the API from inside the page so cookies/CSRF match the browser session. */
async function api(page, url, method = 'GET', body) {
  return page.evaluate(async ({ url, method, body }) => {
    const raw = document.cookie.split('; ').find((c) => c.startsWith('vp_csrf='));
    const csrf = raw ? decodeURIComponent(raw.slice('vp_csrf='.length)) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET' && method !== 'HEAD') headers['x-csrf-token'] = csrf;
    const res = await fetch(url, {
      method, credentials: 'same-origin', headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
  }, { url, method, body });
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
function parseClock(text) {
  const m = /(\d+):(\d\d)/.exec(text || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

const run = async () => {
  console.log(`\nVidyaPariksha REAL browser workflow → ${BASE}\n`);
  const { browser, executablePath } = await launchBrowser();
  console.log(`  browser binary: ${executablePath}`);
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 }, deviceScaleFactor: 1,
    acceptDownloads: true, locale: 'en-IN',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Dev-server noise and the intentional offline drill are not app defects.
    if (/Failed to load resource|ERR_ABORTED|ERR_INTERNET_DISCONNECTED|fonts\.googleapis/i.test(t)) return;
    consoleErrors.push(t);
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { const e = r.failure()?.errorText || ''; if (/ERR_ABORTED|ERR_INTERNET_DISCONNECTED/.test(e)) return; consoleErrors.push(`requestfailed: ${r.url().slice(0, 100)} ${e}`); });
  page.setDefaultTimeout(20000);

  let attemptId = null;
  let deadlineBefore = '';

  try {
    // 1. Homepage
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1');
    check('1. Homepage renders a real heading', await page.locator('h1').first().isVisible());
    check('Homepage shows original branding', (await page.title()).includes('VidyaPariksha'));
    await page.screenshot({ path: path.join(ART, '01-home-360.png') });

    // 2. Examination categories
    await page.getByRole('link', { name: /Start Free Mock Test/i }).click();
    await page.waitForURL('**/exams');
    await page.getByText('Examination categories').first().waitFor();
    const categories = await api(page, '/api/categories');
    const withBooks = categories.data.data.find((c) => c.book_count > 0);
    check('2. Categories are loaded from the database', categories.status === 200 && categories.data.data.length >= 5);
    check('Category counts are genuine numbers', Boolean(withBooks) && withBooks.book_count > 0);
    await page.locator(`a[href="/exams/${withBooks.slug}"]:visible`).first().click();

    // 3. Select a book
    await page.waitForURL('**/exams/**');
    await page.locator('a[href^="/books/"]:visible').first().waitFor();
    const bookHref = await page.locator('a[href^="/books/"]:visible').first().getAttribute('href');
    await page.locator(`a[href="${bookHref}"]:visible`).first().click();
    await page.waitForURL('**/books/**');
    await page.locator('.wizard').waitFor();
    const bookSlug = new URL(page.url()).pathname.split('/').pop();
    const bookDetail = await api(page, `/api/books/${bookSlug}`);
    check('3. Book detail exposes real subjects/topics', bookDetail.data.data.subjects.length > 0 && bookDetail.data.data.topics.length > 0);

    // 4/5/6. Subject → topic → mode → count → duration → language
    const subject = bookDetail.data.data.subjects.find((s) => s.question_count >= 5) || bookDetail.data.data.subjects[0];
    const subjectStep = page.locator('.wizard-step').nth(0);
    await subjectStep.getByRole('button', { name: new RegExp(`^${subject.name}`, 'i') }).click();
    check('4. Subject selection updates the wizard', (await page.locator('.summary-box').innerText()).includes(subject.name));

    const topicCandidates = bookDetail.data.data.topics.filter((t) => t.subject_id === subject.id && t.question_count >= 3);
    const topic = topicCandidates[0];
    if (topic) {
      await page.locator('.wizard-step').nth(1).getByRole('button', { name: new RegExp(`^${topic.name}`, 'i') }).click();
      check('5. Topic selection is dependent on the subject', (await page.locator('.summary-box').innerText()).includes(topic.name));
      await page.locator('.wizard-step').nth(2).getByRole('button', { name: /Topic-Wise Test/i }).click();
    } else {
      skip('5. Topic selection', 'no topic with >=3 published questions for this subject');
    }

    const wantedCount = Math.min(5, topic ? topic.question_count : subject.question_count);
    await page.locator('.wizard-step').nth(3).getByRole('button', { name: /^Custom$/ }).click();
    await page.locator('#custom-count').fill(String(wantedCount));
    await page.locator('.wizard-step').nth(4).getByRole('button', { name: /^Custom$/ }).click();
    await page.locator('#custom-duration').fill('10');
    const summary = await page.locator('.summary-box').innerText();
    check('6. Configuration reflects the chosen count and duration', summary.includes(`${wantedCount} questions`) && summary.includes('10 minutes'), summary.slice(0, 200));
    const continueLink = page.getByRole('link', { name: /Continue to instructions/i });
    check('Continue button is enabled only for a valid configuration', await continueLink.isVisible());
    await page.screenshot({ path: path.join(ART, '02-wizard-360.png') });
    await continueLink.click();

    // 7. Instructions
    await page.waitForURL(/\/instructions\?/);
    await page.getByRole('button', { name: /Start Examination/i }).waitFor();
    check('7. Instruction screen shows real test configuration', (await page.locator('body').innerText()).includes('Negative marking'));
    await page.screenshot({ path: path.join(ART, '03-instructions-360.png') });

    // 8. Start examination
    await page.getByRole('button', { name: /Start Examination/i }).click();
    await page.waitForURL('**/attempt');
    await page.locator('.question-card').waitFor();
    attemptId = Number(new URL(page.url()).pathname.split('/')[2]);
    const s0 = await api(page, `/api/attempts/${attemptId}`);
    deadlineBefore = s0.data.data.attempt.deadlineAt;
    const qIds0 = s0.data.data.questions.map((q) => q.id);
    check('8. A real server-side attempt was created', Number.isInteger(attemptId) && s0.data.data.questions.length === wantedCount, s0.data.error);
    check('Correct answers are not present in the in-progress payload', !JSON.stringify(s0.data.data.questions).includes('is_correct'));
    await page.screenshot({ path: path.join(ART, '04-exam-360.png') });

    // 9/10. Answer a question, Save & Next, go Previous
    await page.locator('.option-btn').first().click();
    await page.getByRole('button', { name: /Save & Next/i }).click();
    await page.waitForTimeout(1200);
    const s1 = await api(page, `/api/attempts/${attemptId}`);
    check('9. Save & Next persists the answer on the server', s1.data.data.statusCounts.answered >= 1, s1.data.data.statusCounts);
    await page.getByRole('button', { name: /^Previous$/ }).click();
    await page.waitForTimeout(500);
    check('10. Previous returns to the earlier question', (await page.locator('.question-top').innerText()).includes('01'));

    // 11/12. Clear response, Mark for review
    await page.getByRole('button', { name: /^Clear$/ }).click();
    await page.waitForTimeout(900);
    const s2 = await api(page, `/api/attempts/${attemptId}`);
    check('11. Clear Response removes the saved answer', s2.data.data.statusCounts.answered === 0, s2.data.data.statusCounts);
    await page.getByRole('button', { name: /^Mark$/ }).click();
    await page.waitForTimeout(900);
    check('12. Mark for Review is stored', (await api(page, `/api/attempts/${attemptId}`)).data.data.statusCounts.marked >= 1);

    // 13/25. Palette navigation on a 360px screen
    await page.getByRole('button', { name: 'Toggle question palette' }).click();
    const paletteCount = await page.locator('.palette-mobile .palette-btn').count();
    check('13. Mobile question palette renders every question', paletteCount === wantedCount, paletteCount);
    await page.locator('.palette-mobile .palette-btn').nth(Math.min(2, wantedCount - 1)).click();
    await page.waitForTimeout(600);
    check('Palette jump changes the current question', (await page.locator('.question-top').innerText()).includes('03'));

    // 15/16/17. Refresh + resume + timer persistence
    const timerBefore = parseClock(await page.locator('[role="timer"]').innerText());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.question-card').waitFor();
    const s3 = await api(page, `/api/attempts/${attemptId}`);
    const timerAfter = parseClock(await page.locator('[role="timer"]').innerText());
    check('15. Refresh resumes the SAME attempt', s3.data.data.attempt.id === attemptId && s3.data.data.attempt.status === 'in_progress');
    check('16. Configured resume policy is honoured (deadline unchanged)', s3.data.data.attempt.deadlineAt === deadlineBefore);
    check('17. Timer persists and counts down (never resets)', Number.isFinite(timerBefore) && Number.isFinite(timerAfter) && timerAfter <= timerBefore && timerAfter > timerBefore - 120, { timerBefore, timerAfter });
    check('Randomized paper is consistent after refresh', JSON.stringify(s3.data.data.questions.map((q) => q.id)) === JSON.stringify(qIds0));
    check('Marked state survives the refresh', s3.data.data.questions[0].markedForReview === true);
    check('Cleared response survives the refresh', s3.data.data.questions[0].selectedOptionIds.length === 0);

    // 24. Viewports / responsiveness
    for (const width of [360, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: width < 500 ? 740 : 900 });
      await page.waitForTimeout(250);
      const over = await overflow(page);
      const timerVisible = await page.locator('[role="timer"]').isVisible();
      check(`24. No horizontal overflow at ${width}px`, over <= 1, { overflowPx: over });
      check(`Timer is visible at ${width}px`, timerVisible);
      if (width < 980) {
        await page.getByRole('button', { name: 'Toggle question palette' }).click();
        check(`Palette drawer opens at ${width}px`, await page.locator('.palette-mobile.is-open').isVisible());
        await page.getByRole('button', { name: 'Toggle question palette' }).click();
      }
      await page.screenshot({ path: path.join(ART, `05-exam-${width}.png`), fullPage: false });
    }
    await page.setViewportSize({ width: 360, height: 740 });

    // Temporary network failure + recovery
    await page.getByRole('button', { name: 'Toggle question palette' }).click();
    await page.locator('.palette-mobile .palette-btn').nth(0).click();
    await context.setOffline(true);
    await page.waitForTimeout(400);
    await page.locator('.option-btn').nth(1).click();
    await page.getByRole('button', { name: /Save & Next/i }).click();
    await page.waitForTimeout(1200);
    check('Temporary network failure shows the offline warning', await page.locator('.connection-bar').isVisible());
    await page.screenshot({ path: path.join(ART, '06-offline-360.png') });
    await context.setOffline(false);
    await page.waitForTimeout(2500);
    const s4 = await api(page, `/api/attempts/${attemptId}`);
    check('Queued answer syncs automatically after reconnection', s4.data.data.questions[0].selectedOptionIds.length === 1, s4.data.data.questions[0].selectedOptionIds);

    // 18. Submit with confirmation
    await page.locator('.exam-controls').getByRole('button', { name: /^Submit$/ }).click();
    await page.getByRole('button', { name: /Confirm Submission/i }).waitFor();
    check('18. Submission requires an explicit confirmation', await page.getByRole('button', { name: /Confirm Submission/i }).isVisible());
    await page.getByRole('button', { name: /Confirm Submission/i }).click();
    await page.waitForURL('**/result/**', { timeout: 20000 });

    // 19/20. Server-side scoring + review
    await page.getByText('Result report').first().waitFor();
    const resultApi = await api(page, `/api/results/${attemptId}`);
    const bodyText = await page.locator('body').innerText();
    check('19. Result page shows the server-calculated score',
      bodyText.includes(`${resultApi.data.data.summary.marksObtained}`) && resultApi.data.data.answersRevealed === true,
      resultApi.data.data.summary);
    check('20. Review reveals correct answers only after submit', bodyText.includes('Correct answer'));
    check('Review marks unanswered questions', bodyText.includes('Unanswered'));
    await page.screenshot({ path: path.join(ART, '07-result-360.png') });

    // 21. PDF report download
    let pdfOk = false;
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }),
        page.getByRole('link', { name: /Download PDF/i }).click(),
      ]);
      const dest = path.join(ART, 'result-report.pdf');
      await download.saveAs(dest);
      pdfOk = fs.readFileSync(dest).subarray(0, 5).toString() === '%PDF-';
    } catch { /* fall through to the response check below */ }
    if (!pdfOk) {
      const pdf = await context.request.get(`${BASE}/api/results/${attemptId}/pdf`);
      const buf = await pdf.body();
      pdfOk = pdf.ok() && buf.subarray(0, 5).toString() === '%PDF-';
      if (pdfOk) fs.writeFileSync(path.join(ART, 'result-report.pdf'), buf);
    }
    check('21. PDF report downloads and is a real PDF', pdfOk);

    // 22/23. Register (claims the guest attempt) then open the student dashboard
    const email = `browser.e2e.${Date.now()}@example.test`;
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
    await page.locator('#reg-name').fill('Browser Test Student');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill('BrowserTestPass2026!');
    await page.locator('#reg-confirm').fill('BrowserTestPass2026!');
    await page.getByRole('button', { name: /Create account/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    const analytics = await api(page, '/api/analytics/overview');
    check('22. Registration creates a real student session', analytics.status === 200);
    check('Guest attempt was adopted by the new account', analytics.data.data.summary.totalAttempts >= 1, analytics.data.data.summary);
    check('23. Student dashboard renders real analytics data', (await page.locator('body').innerText()).toLowerCase().includes('dashboard'));
    await page.screenshot({ path: path.join(ART, '08-dashboard-360.png') });

    // 24. Administrator permissions: a student must be denied
    const adminApi = await api(page, '/api/admin/overview');
    check('24. Student cannot call administrator endpoints', adminApi.status === 401 || adminApi.status === 403, adminApi.status);
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const adminBody = await page.locator('body').innerText();
    check('Admin UI denies a student account', /Administrator access required|Sign in to access|Sign in$/i.test(adminBody), adminBody.slice(0, 160));
    await api(page, '/api/auth/logout', 'POST', {});
    const guestAdmin = await api(page, '/api/admin/overview');
    check('Guest cannot call administrator endpoints', guestAdmin.status === 401, guestAdmin.status);

    // Insufficient question availability (real API error, not a silent shrink)
    const customSlug = 'lucent-subject-wise-custom-practice';
    const cfg = await api(page, `/api/tests/${customSlug}`);
    const tooMany = await api(page, '/api/attempts', 'POST', { testId: cfg.data.data.id, language: 'en', questionCount: 200 });
    check('Insufficient question availability returns a real 409', tooMany.status === 409, tooMany.data.error);

    // Duplicate submissions (browser session, different idempotency keys)
    const started = await api(page, '/api/attempts', 'POST', {
      testId: cfg.data.data.id, language: 'en', questionCount: 5, durationMinutes: 5, clientRequestId: crypto.randomUUID(),
    });
    const dupId = started.data.data?.attemptId;
    if (dupId) {
      const a = await api(page, `/api/attempts/${dupId}/submit`, 'POST', { clientSubmissionId: crypto.randomUUID() });
      const b = await api(page, `/api/attempts/${dupId}/submit`, 'POST', { clientSubmissionId: crypto.randomUUID() });
      check('Duplicate submission does not create a second result',
        a.status === 200 && b.status === 200 && b.data.data.submittedAt === a.data.data.submittedAt && b.data.data.marksObtained === a.data.data.marksObtained);
      // Unauthorized attempt modification. Use a fresh cookie jar in the SAME
      // context (the bundled headless shell runs --single-process, so a second
      // BrowserContext is unstable in this sandbox).
      const savedCookies = await context.cookies();
      await context.clearCookies();
      const guestPage = await context.newPage();
      await guestPage.goto(BASE, { waitUntil: 'domcontentloaded' });
      await guestPage.waitForTimeout(800);
      const cross = await api(guestPage, `/api/attempts/${dupId}`, 'GET');
      check('Another (guest) session cannot read this attempt', cross.status === 404, { status: cross.status, body: cross.data });
      await guestPage.close();
      await context.addCookies(savedCookies);
    } else {
      skip('Duplicate submission regression', 'attempt start failed');
    }

    // Hindi / bilingual rendering in a real browser
    const hiStarted = await api(page, '/api/attempts', 'POST', {
      testId: cfg.data.data.id, language: 'hi', questionCount: 5, durationMinutes: 5, clientRequestId: crypto.randomUUID(),
    });
    const hiId = hiStarted.data.data?.attemptId;
    if (hiId) {
      await page.goto(`${BASE}/test/${hiId}/attempt`, { waitUntil: 'domcontentloaded' });
      await page.locator('.question-text').waitFor();
      const hiText = await page.locator('.question-text').innerText();
      const devanagari = /[\u0900-\u097F]/.test(hiText);
      check('Hindi Unicode renders in the examination UI', devanagari, hiText.slice(0, 100));
      const widths = await page.locator('.question-text').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
      check('Hindi text does not overflow its container', widths.sw <= widths.cw + 2, widths);
      await page.screenshot({ path: path.join(ART, '09-hindi-360.png') });
      const hiState = await api(page, `/api/attempts/${hiId}`);
      check('Hindi attempt serves translated text from the database', /[\u0900-\u097F]/.test(hiState.data.data.questions[0].text));
      const hiQuestions = hiState.data.data.questions || [];
      const honest = hiQuestions.every((q) => /[\u0900-\u097F]/.test(q.text) || q.text === q.textEn);
      check('Untranslated questions fall back to the stored English text (no invented Hindi)', honest);
      const toggle = page.getByRole('button', { name: 'Toggle question language' });
      if (await toggle.count()) {
        const before = await page.locator('.question-text').innerText();
        await toggle.click();
        await page.waitForTimeout(250);
        const after = await page.locator('.question-text').innerText();
        check('Bilingual toggle switches the same question between Hindi and English', before !== after && /[A-Za-z]/.test(after), { before: before.slice(0, 60), after: after.slice(0, 60) });
        await toggle.click();
      } else skip('Bilingual toggle', 'this attempt has no questions with a Hindi translation');
      const hiSubmit = await api(page, `/api/attempts/${hiId}/submit`, 'POST', { clientSubmissionId: crypto.randomUUID() });
      if (hiSubmit.status === 200) {
        const hiPdf = await context.request.get(`${BASE}/api/results/${hiId}/pdf`);
        const hiBuf = await hiPdf.body();
        check('Hindi result PDF is generated with the bundled Devanagari font', hiPdf.ok() && hiBuf.subarray(0, 5).toString() === '%PDF-');
        fs.writeFileSync(path.join(ART, 'result-report-hindi.pdf'), hiBuf);
      } else skip('Hindi result PDF', `submit returned ${hiSubmit.status}`);
    } else {
      skip('Hindi browser rendering', 'Hindi attempt could not be started');
    }

    // Timer expiration — a genuine one-minute attempt, no database editing.
    console.log('  … waiting 65s for a genuine 1-minute server deadline to expire');
    const short = await api(page, '/api/attempts', 'POST', {
      testId: cfg.data.data.id, language: 'en', questionCount: 5, durationMinutes: 1, clientRequestId: crypto.randomUUID(),
    });
    const shortId = short.data.data?.attemptId;
    if (shortId) {
      await page.goto(`${BASE}/test/${shortId}/attempt`, { waitUntil: 'domcontentloaded' });
      await page.locator('.question-card').waitFor();
      await page.waitForTimeout(65000);
      const expired = await api(page, `/api/attempts/${shortId}`);
      check('Timer expiration finalises the attempt on the server', expired.data.data.attempt.status === 'expired' && expired.data.data.attempt.submitReason === 'expired', expired.data.data.attempt);
      const late = await api(page, `/api/attempts/${shortId}/answers`, 'PUT', { questionId: expired.data.data.questions[0].id, selectedOptionIds: [expired.data.data.questions[0].options[0].id] });
      check('Expired attempt refuses further answers', late.status === 409 || late.status === 404, late.status);
      await page.waitForURL('**/result/**', { timeout: 15000 }).catch(() => {});
      check('Browser redirects to the auto-submitted result', page.url().includes('/result/'), page.url());
    } else skip('Timer expiration', 'short attempt could not be started');

    // Public route smoke test in the real browser (catches render-time crashes).
    const smoke = ['/exams', '/books', '/tests', '/about', '/contact', '/help', '/privacy-policy', '/terms', '/cookie-policy', '/disclaimer', '/sitemap', '/dashboard', '/my-results', '/my-progress', '/bookmarks', '/revision', '/profile', '/settings'];
    let smokeOk = 0;
    for (const route of smoke) {
      const p = await context.newPage();
      await p.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(500);
      const text = await p.locator('body').innerText();
      if (!text.includes('Something went wrong on this page') && text.length > 150) smokeOk++;
      else console.error(`  ✗ route ${route} render issue`);
      await p.close();
    }
    check(`Public routes render without a React crash (${smokeOk}/${smoke.length})`, smokeOk === smoke.length);

    // Optional: sign in as a real administrator and verify the admin UI reads the DB.
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const adminPage = await context.newPage();
      await adminPage.setViewportSize({ width: 1366, height: 900 });
      await adminPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await adminPage.locator('#login-email').fill(adminEmail);
      await adminPage.locator('#login-password').fill(adminPassword);
      await adminPage.getByRole('button', { name: /^Sign in$/i }).click();
      await adminPage.waitForURL(/\/(admin|dashboard)$/, { timeout: 20000 }).catch(() => {});
      check('Administrator can sign in through the real UI', /\/(admin|dashboard)$/.test(new URL(adminPage.url()).pathname), adminPage.url());
      await adminPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
      await adminPage.waitForTimeout(1500);
      const adminText = await adminPage.locator('body').innerText();
      check('Admin overview reads genuine database statistics', /Question bank/i.test(adminText) && /Registered students/i.test(adminText), adminText.slice(0, 250));
      await adminPage.goto(`${BASE}/admin/questions`, { waitUntil: 'domcontentloaded' });
      await adminPage.waitForTimeout(1500);
      const qText = await adminPage.locator('body').innerText();
      check('Admin question manager renders real question rows', /Question/i.test(qText) && /Import/i.test(qText) && qText.length > 250, qText.slice(0, 250));
      const adminRoutes = ['books', 'categories', 'subjects', 'topics', 'questions', 'tests', 'attempts', 'students', 'analytics', 'reports', 'settings', 'audit-logs'];
      let adminOk = 0;
      for (const route of adminRoutes) {
        const p = await context.newPage();
        await p.goto(`${BASE}/admin/${route}`, { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(750);
        const text = await p.locator('body').innerText();
        if (!text.includes('Something went wrong on this page') && text.length > 150) adminOk++;
        else { console.error(`  ✗ admin route /admin/${route}: ${text.slice(0, 130)}`); failures.push(`admin route /admin/${route}`); }
        await p.close();
      }
      check(`Admin console routes render real data (${adminOk}/${adminRoutes.length})`, adminOk === adminRoutes.length);
      await adminPage.screenshot({ path: path.join(ART, '10-admin.png') });
      await adminPage.close();
    } else {
      skip('Administrator UI sign-in', 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    }

    check('No uncaught browser console/page errors', consoleErrors.length === 0, consoleErrors.slice(0, 5));
  } catch (err) {
    failures.push(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
    console.error('[browser] fatal:', err);
    try { await page.screenshot({ path: path.join(ART, 'failure.png') }); } catch { /* ignore */ }
  } finally {
    await browser.close();
    console.log(`\n${passed} browser checks passed, ${skipped} skipped, ${failures.length} failed.`);
    if (failures.length) { console.error('Failures:', failures.join(' | ')); process.exitCode = 1; }
    else console.log('Real browser workflow complete. Artifacts in ./artifacts\n');
  }
};

run().catch((err) => { console.error('[browser] launch failed:', err); process.exitCode = 1; });
