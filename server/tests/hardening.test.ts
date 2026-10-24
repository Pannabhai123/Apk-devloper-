import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DB } from '../src/db.js';
import { migrate, openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemoContent, seedRolesAndSettings, seedAdmin } from '../src/seed.js';
import { config, checkProductionConfig, mailDeliveryConfigured } from '../src/config.js';
import { sessionTokenHash, sha256 } from '../src/lib/auth.js';
import { resetRateLimits } from '../src/lib/rateLimit.js';

let db: DB;
let app: Express;
const ADMIN = { email: 'hardening-admin@test.local', password: 'HardeningPass2026!' };

async function csrf(agent: request.Agent) {
  return (await agent.get('/api/auth/me').expect(200)).body.data.csrfToken as string;
}
async function adminAgent() {
  const agent = request.agent(app);
  const token = await csrf(agent);
  await agent.post('/api/auth/login').set('x-csrf-token', token).send(ADMIN).expect(200);
  return { agent, token: await csrf(agent) };
}
function correctOption(questionId: number): number {
  return (db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').get(questionId) as { id: number }).id;
}
function wrongOption(questionId: number): number {
  return (db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 0').get(questionId) as { id: number }).id;
}

beforeAll(() => {
  db = openDatabase(':memory:');
  migrate(db);
  seedRolesAndSettings(db);
  seedDemoContent(db);
  seedAdmin(db, ADMIN.email, ADMIN.password);
  app = createApp(db, { serveStatic: false });
});
afterEach(() => { resetRateLimits(); });
afterAll(() => { db.close(); });

describe('production secret & session hardening', () => {
  it('stores session tokens as a keyed HMAC, not a plain digest', () => {
    const token = 'a-raw-session-token-value';
    expect(sessionTokenHash(token)).not.toBe(sha256(token));
    expect(sessionTokenHash(token)).toBe(sessionTokenHash(token));
    expect(sessionTokenHash(token)).not.toContain(token);
  });

  it('refuses the placeholder SESSION_SECRET shipped in .env.example', () => {
    expect(() => checkProductionConfig({
      sessionSecret: 'replace-with-a-long-random-development-value',
      cookieSecure: true, allowInsecureCookies: false, exposeDevResetToken: false,
      publicOrigin: 'https://example.com', mailConfigured: true,
    })).toThrow(/SESSION_SECRET/);
  });

  it('refuses short secrets, insecure cookies and exposed reset tokens', () => {
    const base = {
      sessionSecret: 'a'.repeat(64), cookieSecure: true, allowInsecureCookies: false,
      exposeDevResetToken: false, publicOrigin: 'https://example.com', mailConfigured: true,
    };
    expect(() => checkProductionConfig(base)).not.toThrow();
    expect(() => checkProductionConfig({ ...base, sessionSecret: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => checkProductionConfig({ ...base, cookieSecure: false })).toThrow(/COOKIE_SECURE/);
    expect(() => checkProductionConfig({ ...base, exposeDevResetToken: true })).toThrow(/EXPOSE_DEV_RESET_TOKEN/);
  });

  it('only reports mail as configured for genuinely usable providers', () => {
    const original = { provider: config.mailProvider, host: config.smtpHost, from: config.mailFrom, key: config.resendApiKey };
    try {
      config.mailProvider = 'none';
      expect(mailDeliveryConfigured()).toBe(false);
      config.mailProvider = 'console';
      expect(mailDeliveryConfigured()).toBe(!config.isProd);
      config.mailProvider = 'smtp';
      expect(mailDeliveryConfigured()).toBe(false);
      config.smtpHost = 'smtp.example.com'; config.mailFrom = 'noreply@example.com';
      expect(mailDeliveryConfigured()).toBe(true);
      config.mailProvider = 'resend';
      expect(mailDeliveryConfigured()).toBe(false);
      config.resendApiKey = 're_test_key';
      expect(mailDeliveryConfigured()).toBe(true);
    } finally {
      config.mailProvider = original.provider; config.smtpHost = original.host;
      config.mailFrom = original.from; config.resendApiKey = original.key;
    }
  });

  it('returns an honest 503 (never a fake success) when email delivery is unconfigured', async () => {
    const original = config.mailProvider;
    config.mailProvider = 'none';
    try {
      const agent = request.agent(app);
      const token = await csrf(agent);
      const res = await agent.post('/api/auth/password/forgot').set('x-csrf-token', token)
        .send({ email: ADMIN.email }).expect(503);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/not configured/i);
      // No usable reset token should have been created.
      const count = (db.prepare('SELECT COUNT(*) AS c FROM password_resets').get() as { c: number }).c;
      expect(count).toBe(0);
    } finally { config.mailProvider = original; }
  });

  it('does not create a database session row for anonymous health probes', async () => {
    const before = (db.prepare('SELECT COUNT(*) AS c FROM sessions').get() as { c: number }).c;
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(200);
    const after = (db.prepare('SELECT COUNT(*) AS c FROM sessions').get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it('sets no-store on API responses and clickjacking protection in production config', async () => {
    const res = await request(app).get('/api/settings').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    // CSP hardening is asserted directly because helmet only runs with NODE_ENV=production.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    expect(source).toContain('frameAncestors: ["\'none\'"]');
  });
});

describe('examination engine integrity', () => {
  let agent: request.Agent;
  let token: string;
  beforeAll(async () => {
    agent = request.agent(app);
    token = await csrf(agent);
  });

  async function start(slug = 'physics-subject-wise', extra: Record<string, unknown> = {}) {
    const cfg = await agent.get(`/api/tests/${slug}`).expect(200);
    return (await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: cfg.body.data.id, language: 'en', ...extra }).expect(201)).body.data.attemptId as number;
  }
  async function state(id: number) {
    return (await agent.get(`/api/attempts/${id}`).expect(200)).body.data;
  }

  it('never assigns the same question twice within one randomized attempt', async () => {
    const id = await start('ssc-mock-set-1');
    const s = await state(id);
    const ids = s.questions.map((q: any) => q.id);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the randomized paper and deadline identical after a refresh', async () => {
    resetRateLimits();
    const id = await start('chemistry-subject-wise');
    const first = await state(id);
    const second = await state(id);
    expect(second.questions.map((q: any) => q.id)).toEqual(first.questions.map((q: any) => q.id));
    expect(second.attempt.deadlineAt).toBe(first.attempt.deadlineAt);
  });

  it('ignores client-supplied marks and computes the score server-side', async () => {
    resetRateLimits();
    const id = await start();
    const s = await state(id);
    const q0 = s.questions[0];
    const q1 = s.questions[1];
    await agent.put(`/api/attempts/${id}/answers`).set('x-csrf-token', token)
      .send({ questionId: q0.id, selectedOptionIds: [correctOption(q0.id)] }).expect(200);
    await agent.put(`/api/attempts/${id}/answers`).set('x-csrf-token', token)
      .send({ questionId: q1.id, selectedOptionIds: [wrongOption(q1.id)] }).expect(200);
    const submitted = await agent.post(`/api/attempts/${id}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: 'hardening-submit-0001', marksObtained: 9999, correctCount: 9999 }).expect(200);
    expect(submitted.body.data.marksObtained).toBe(0.75); // +1, −0.25
    expect(submitted.body.data.correctCount).toBe(1);
    expect(submitted.body.data.incorrectCount).toBe(1);
    expect(submitted.body.data.negativeMarks).toBe(0.25);
  });

  it('does not create a duplicate result when the same attempt is submitted twice with different idempotency keys', async () => {
    resetRateLimits();
    const id = await start('railway-mixed-practice');
    const before = (db.prepare('SELECT COUNT(*) AS c FROM attempts WHERE id = ?').get(id) as { c: number }).c;
    const a = await agent.post(`/api/attempts/${id}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: 'hardening-submit-0002' }).expect(200);
    const b = await agent.post(`/api/attempts/${id}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: 'hardening-submit-0003' }).expect(200);
    const after = (db.prepare('SELECT COUNT(*) AS c FROM attempts WHERE id = ?').get(id) as { c: number }).c;
    expect(before).toBe(1);
    expect(after).toBe(1);
    expect(b.body.data.attemptId).toBe(a.body.data.attemptId);
    expect(b.body.data.marksObtained).toBe(a.body.data.marksObtained);
    expect(b.body.data.submittedAt).toBe(a.body.data.submittedAt);
  });

  it('blocks a different session from writing answers or reading the result', async () => {
    resetRateLimits();
    const id = await start('computer-fundamentals-test');
    const mine = await state(id);
    const stranger = request.agent(app);
    const strangerToken = await csrf(stranger);
    await stranger.put(`/api/attempts/${id}/answers`).set('x-csrf-token', strangerToken)
      .send({ questionId: mine.questions[0].id, selectedOptionIds: [mine.questions[0].options[0].id] }).expect(404);
    await stranger.get(`/api/attempts/${id}`).expect(404);
    await stranger.get(`/api/results/${id}`).expect(404);
  });

  it('rejects answers once the server deadline has passed', async () => {
    resetRateLimits();
    const id = await start('mechanics-topic-wise');
    const s = await state(id);
    db.prepare('UPDATE attempts SET deadline_at = ? WHERE id = ?').run(new Date(Date.now() - 2000).toISOString(), id);
    await agent.put(`/api/attempts/${id}/answers`).set('x-csrf-token', token)
      .send({ questionId: s.questions[0].id, selectedOptionIds: [s.questions[0].options[0].id] }).expect(409);
    const expired = await state(id);
    expect(expired.attempt.status).toBe('expired');
    expect(expired.attempt.submitReason).toBe('expired');
  });

  it('honours result_visibility=hidden by withholding keys even after submission', async () => {
    resetRateLimits();
    const { agent: admin, token: adminToken } = await adminAgent();
    const books = await admin.get('/api/admin/books').expect(200);
    const created = await admin.post('/api/admin/tests').set('x-csrf-token', adminToken).send({
      title: 'Hidden-key regression test', bookId: books.body.data[0].id, mode: 'practice',
      selectionMode: 'random', questionCount: 5, durationMinutes: 6, languages: ['en'],
      marksPerQuestion: 1, negativeMarks: 0, customCountEnabled: false, customDurationEnabled: false,
      practiceFeedback: false, resultVisibility: 'hidden', resumePolicy: 'resume', autoSubmit: true,
      isPublished: true, isActive: true, rules: [],
    }).expect(201);
    const id = await start(String(created.body.data.slug));
    await agent.post(`/api/attempts/${id}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: 'hardening-submit-0004' }).expect(200);
    const result = await agent.get(`/api/results/${id}`).expect(200);
    expect(result.body.data.answersRevealed).toBe(false);
    for (const row of result.body.data.review) expect(row.correctOptionIds).toBeUndefined();
    // Regression: the attempt/review endpoint used to reveal the key purely on
    // status !== 'in_progress', bypassing the test's hidden-results setting.
    const attempt = await agent.get(`/api/attempts/${id}`).expect(200);
    expect(attempt.body.data.attempt.resultVisibility).toBe('hidden');
    for (const q of attempt.body.data.questions) {
      expect(q.correctOptionIds).toBeUndefined();
      expect(q.explanation).toBeUndefined();
      for (const o of q.options) expect(o.isCorrect).toBeUndefined();
    }
    const pdf = await agent.get(`/api/results/${id}/pdf`).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('resumes an in-progress attempt instead of restarting the timer', async () => {
    resetRateLimits();
    const cfg = await agent.get('/api/tests/optics-topic-wise').expect(200);
    const first = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: cfg.body.data.id, language: 'en' }).expect(201);
    const second = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: cfg.body.data.id, language: 'en' }).expect(200);
    expect(second.body.data.attemptId).toBe(first.body.data.attemptId);
    expect(second.body.data.resumed).toBe(true);
    expect(second.body.data.deadlineAt).toBe(first.body.data.deadlineAt);
  });

  it('returns 409 for an impossible question count instead of shrinking the paper', async () => {
    resetRateLimits();
    const cfg = await agent.get('/api/tests/lucent-subject-wise-custom-practice').expect(200);
    const res = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: cfg.body.data.id, language: 'en', questionCount: 200 }).expect(409);
    expect(res.body.error).toMatch(/Not enough eligible questions/);
  });
});

describe('admin upload and export boundary', () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('minimal-test-image-body'),
  ]);

  it('accepts a magic-byte-verified PNG and writes it under a random name', async () => {
    resetRateLimits();
    const { agent, token } = await adminAgent();
    const res = await agent.post('/api/admin/uploads')
      .set('x-csrf-token', token).set('Content-Type', 'image/png').send(png).expect(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    const file = path.join(config.uploadDir, path.basename(res.body.data.url));
    expect(fs.existsSync(file)).toBe(true);
    fs.rmSync(file, { force: true });
  });

  it('rejects payloads whose bytes are not a supported image', async () => {
    resetRateLimits();
    const { agent, token } = await adminAgent();
    await agent.post('/api/admin/uploads')
      .set('x-csrf-token', token).set('Content-Type', 'text/plain')
      .send('this is definitely not an image').expect(400);
  });

  it('denies image uploads to a guest session', async () => {
    resetRateLimits();
    const guest = request.agent(app);
    const token = await csrf(guest);
    await guest.post('/api/admin/uploads')
      .set('x-csrf-token', token).set('Content-Type', 'image/png').send(png).expect(401);
  });

  it('exports the real question bank as a downloadable CSV', async () => {
    resetRateLimits();
    const { agent } = await adminAgent();
    const res = await agent.get('/api/admin/questions-export').expect(200);
    expect(res.headers['content-type']).toMatch(/csv|text\/plain/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(String(res.text)).toContain('book_slug');
  });
});

describe('admin database workflows', () => {
  it('creates, edits and publishes a book so it appears in the public catalog', async () => {
    resetRateLimits();
    const { agent, token } = await adminAgent();
    const created = await agent.post('/api/admin/books').set('x-csrf-token', token).send({
      title: 'Hardening Regression Book', slug: 'hardening-regression-book',
      description: 'Created by an automated admin workflow test.', badge: 'new', isActive: true, sortOrder: 99,
    }).expect(201);
    const id = created.body.data.id;
    const before = await request(app).get('/api/books?limit=200').expect(200);
    expect(before.body.data.some((b: any) => b.slug === 'hardening-regression-book')).toBe(true);

    await agent.put(`/api/admin/books/${id}`).set('x-csrf-token', token)
      .send({ isActive: false }).expect(200);
    const hidden = await request(app).get('/api/books?limit=200').expect(200);
    expect(hidden.body.data.some((b: any) => b.slug === 'hardening-regression-book')).toBe(false);

    await agent.put(`/api/admin/books/${id}`).set('x-csrf-token', token)
      .send({ isActive: true }).expect(200);
    const visible = await request(app).get('/api/books/hardening-regression-book').expect(200);
    expect(visible.body.data.title).toBe('Hardening Regression Book');
  });

  it('previews CSV rows before committing and exports real rows afterwards', async () => {
    resetRateLimits();
    const { agent, token } = await adminAgent();
    const csv = [
      'book_slug,subject_slug,topic_slug,difficulty,qtype,text_en,explanation_en,marks,negative_marks,language,status,options,correct_labels',
      'lucent-subject-wise,physics,mechanics,easy,single,Which force unit is used in this hardening import row?,,1,0.25,en,draft,A:Newton||B:Joule,A',
      'missing-book,physics,,easy,single,This row has an invalid book reference,,,1,0,en,draft,A:One||B:Two,B',
    ].join('\n');
    const preview = await agent.post('/api/admin/questions/import/preview').set('x-csrf-token', token).send({ csv }).expect(200);
    expect(preview.body.data.validCount).toBe(1);
    expect(preview.body.data.errors[0].row).toBe(3);
    const committed = await agent.post('/api/admin/questions/import').set('x-csrf-token', token).send({ csv }).expect(201);
    expect(committed.body.data.imported).toBe(1);
    expect(committed.body.data.rejected).toBe(1);
    const exported = await agent.get('/api/admin/questions-export').expect(200);
    expect(exported.text).toContain('hardening import row');
  });

  it('creates a test, previews it with the real selector and lists attempts and audit logs', async () => {
    resetRateLimits();
    const { agent, token } = await adminAgent();
    const books = await agent.get('/api/admin/books').expect(200);
    const created = await agent.post('/api/admin/tests').set('x-csrf-token', token).send({
      title: 'Hardening Pattern Test', bookId: books.body.data[0].id, mode: 'practice',
      selectionMode: 'random', questionCount: 4, durationMinutes: 5, languages: ['en'],
      marksPerQuestion: 2, negativeMarks: 0.5, customCountEnabled: false, customDurationEnabled: false,
      practiceFeedback: false, resultVisibility: 'after_submit', resumePolicy: 'resume',
      autoSubmit: true, isPublished: true, isActive: true, rules: [],
    }).expect(201);
    const preview = await agent.get(`/api/admin/tests/${created.body.data.id}/preview`).expect(200);
    expect(preview.body.data.count).toBe(4);
    const attempts = await agent.get('/api/admin/attempts?page=1&limit=5').expect(200);
    expect(Array.isArray(attempts.body.data)).toBe(true);
    const logs = await agent.get('/api/admin/audit-logs?page=1&limit=5').expect(200);
    expect(logs.body.data.length).toBeGreaterThan(0);
  });

  it('reports malformed CSV option rows instead of returning a 500', async () => {
    resetRateLimits();
    const { agent, token } = await adminAgent();
    const csv = [
      'book_slug,subject_slug,options,correct_labels,text_en',
      'lucent-subject-wise,physics,A:One||B:Two,A,Valid row for the malformed CSV regression check',
      'lucent-subject-wise,physics,NO_COLON_HERE||B:Two,B,This row has a broken option pair',
    ].join('\n');
    const preview = await agent.post('/api/admin/questions/import/preview').set('x-csrf-token', token).send({ csv }).expect(200);
    expect(preview.body.data.validCount).toBe(1);
    expect(preview.body.data.errorCount).toBe(1);
    expect(preview.body.data.errors[0].row).toBe(3);
    expect(String(preview.body.data.errors[0].errors.join(' '))).toMatch(/options/);
  });

  it('rejects SQL-injection style search input without leaking database errors', async () => {
    const res = await request(app).get('/api/search').query({ q: "'; DROP TABLE questions;--" }).expect(200);
    expect(res.body.ok).toBe(true);
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body.questions).toBeGreaterThan(100);
  });
});
