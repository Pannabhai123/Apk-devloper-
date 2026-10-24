import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DB } from '../src/db.js';
import { migrate, openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedDemoContent, seedRolesAndSettings, seedAdmin } from '../src/seed.js';
import { resetRateLimits } from '../src/lib/rateLimit.js';

let db: DB;
let app: Express;
const ADMIN = { email: 'admin@test.local', password: 'TestAdminPass123!' };

async function csrf(agent: request.Agent) {
  const res = await agent.get('/api/auth/me').expect(200);
  return res.body.data.csrfToken as string;
}

beforeAll(() => {
  db = openDatabase(':memory:');
  migrate(db);
  seedRolesAndSettings(db);
  seedDemoContent(db);
  seedAdmin(db, ADMIN.email, ADMIN.password);
  app = createApp(db, { serveStatic: false });
});

afterAll(() => { db.close(); });

describe('public API', () => {
  it('reports health and real database counts', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.questions).toBeGreaterThan(100);
  });

  it('returns only configured categories with genuine book/test counts', async () => {
    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.data.length).toBeGreaterThan(5);
    for (const c of res.body.data) {
      expect(typeof c.book_count).toBe('number');
      expect(typeof c.test_count).toBe('number');
    }
  });

  it('returns a book with dependent subjects, topics and a custom test slug', async () => {
    const res = await request(app).get('/api/books/lucent-subject-wise').expect(200);
    expect(res.body.data.subjects.length).toBeGreaterThan(0);
    expect(res.body.data.topics.length).toBeGreaterThan(0);
    expect(res.body.data.customTestSlug).toBe('lucent-subject-wise-custom-practice');
    expect(res.body.data.question_count).toBeGreaterThan(0);
  });

  it('searches real data and returns a useful empty result', async () => {
    const hit = await request(app).get('/api/search?q=physics').expect(200);
    expect(hit.body.data.subjects.length).toBeGreaterThan(0);
    const miss = await request(app).get('/api/search?q=zzzznotarealthing').expect(200);
    const total = miss.body.data.books.length + miss.body.data.tests.length + miss.body.data.subjects.length + miss.body.data.topics.length;
    expect(total).toBe(0);
  });

  it('serves robots.txt and a database-generated sitemap', async () => {
    const robots = await request(app).get('/robots.txt').expect(200);
    expect(robots.text).toContain('Disallow: /admin');
    const sitemap = await request(app).get('/sitemap.xml').expect(200);
    expect(sitemap.text).toContain('/books/lucent-subject-wise');
    expect(sitemap.text).not.toContain('custom-practice');
  });
});

describe('authentication and authorization', () => {
  it('blocks guest access to the admin panel', async () => {
    await request(app).get('/api/admin/overview').expect(401);
  });

  it('requires a CSRF token for state-changing requests', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/me');
    await agent.post('/api/auth/register').send({ name: 'No Token', email: 'no-token@test.local', password: 'Password123!' }).expect(403);
  });

  it('registers a student, who is then forbidden from admin routes', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const res = await agent.post('/api/auth/register')
      .set('x-csrf-token', token)
      .send({ name: 'Student One', email: 'student@test.local', password: 'Password123!' }).expect(201);
    expect(res.body.data.user.role).toBe('student');
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.data.user.email).toBe('student@test.local');
    await agent.get('/api/admin/overview').expect(403);
  });

  it('rejects invalid credentials and weak registration passwords', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    await agent.post('/api/auth/login').set('x-csrf-token', token).send({ email: ADMIN.email, password: 'wrong' }).expect(401);
    await agent.post('/api/auth/register').set('x-csrf-token', token)
      .send({ name: 'Weak', email: 'weak@test.local', password: '123' }).expect(422);
  });

  it('logs in the administrator and exposes real permission keys', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const res = await agent.post('/api/auth/login').set('x-csrf-token', token).send(ADMIN).expect(200);
    expect(res.body.data.user.role).toBe('super_admin');
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.data.user.permissions).toContain('questions.manage');
    const overview = await agent.get('/api/admin/overview').expect(200);
    expect(overview.body.data.totalQuestions).toBeGreaterThan(100);
    expect(overview.body.data.publishedTests).toBeGreaterThan(0);
  });

  it('issues a single-use password reset token in development', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const forgot = await agent.post('/api/auth/password/forgot').set('x-csrf-token', token)
      .send({ email: 'student@test.local' }).expect(200);
    expect(forgot.body.data.devResetToken).toBeTruthy();
    await agent.post('/api/auth/password/reset').set('x-csrf-token', token)
      .send({ token: forgot.body.data.devResetToken, password: 'NewPassword123!' }).expect(200);
    await agent.post('/api/auth/password/reset').set('x-csrf-token', token)
      .send({ token: forgot.body.data.devResetToken, password: 'AnotherPass123!' }).expect(400);
  });
});

describe('admin content management', () => {
  let agent: request.Agent;
  let token: string;
  beforeAll(async () => {
    agent = request.agent(app);
    token = await csrf(agent);
    await agent.post('/api/auth/login').set('x-csrf-token', token).send(ADMIN).expect(200);
    token = await csrf(agent);
  });

  it('creates, edits and rejects duplicate category slugs', async () => {
    const created = await agent.post('/api/admin/categories').set('x-csrf-token', token)
      .send({ name: 'Test Category', description: 'Created by automated test' }).expect(201);
    expect(created.body.data.slug).toBe('test-category');
    await agent.post('/api/admin/categories').set('x-csrf-token', token)
      .send({ name: 'Test Category Again', slug: 'test-category' }).expect(409);
    await agent.put(`/api/admin/categories/${created.body.data.id}`).set('x-csrf-token', token)
      .send({ isActive: false }).expect(200);
    const hidden = await request(app).get('/api/categories').expect(200);
    expect(hidden.body.data.find((c: any) => c.slug === 'test-category')).toBeUndefined();
  });

  it('creates a question with a validated answer key', async () => {
    const books = await agent.get('/api/admin/books').expect(200);
    const subjects = await agent.get('/api/admin/subjects').expect(200);
    const bookId = books.body.data[0].id;
    const subjectId = subjects.body.data[0].id;
    const res = await agent.post('/api/admin/questions').set('x-csrf-token', token).send({
      bookId, subjectId, textEn: 'An original automated-test practice question?',
      difficulty: 'easy', qtype: 'single', language: 'en', status: 'published',
      options: [
        { label: 'A', textEn: 'First option', isCorrect: false },
        { label: 'B', textEn: 'Second option', isCorrect: true },
      ],
    }).expect(201);
    const detail = await agent.get(`/api/admin/questions/${res.body.data.id}`).expect(200);
    expect(detail.body.data.options.filter((o: any) => o.is_correct === 1)).toHaveLength(1);
    await agent.delete(`/api/admin/questions/${res.body.data.id}`).set('x-csrf-token', token).expect(200);
  });

  it('rejects a question with no correct option', async () => {
    const books = await agent.get('/api/admin/books').expect(200);
    const subjects = await agent.get('/api/admin/subjects').expect(200);
    await agent.post('/api/admin/questions').set('x-csrf-token', token).send({
      bookId: books.body.data[0].id, subjectId: subjects.body.data[0].id,
      textEn: 'This question has no correct answer configured.', qtype: 'single',
      options: [{ label: 'A', textEn: 'One', isCorrect: false }, { label: 'B', textEn: 'Two', isCorrect: false }],
    }).expect(422);
  });

  it('validates CSV imports with row numbers before saving anything', async () => {
    const csv = [
      'book_slug,subject_slug,topic_slug,difficulty,qtype,text_en,text_hi,explanation_en,marks,negative_marks,language,status,tags,source,options,correct_labels',
      'lucent-subject-wise,physics,mechanics,easy,single,What is the SI unit of force in this import row?,,Because it is defined that way,1,0.25,en,draft,import,test,A:Newton||B:Joule||C:Watt||D:Pascal,A',
      'does-not-exist,physics,,easy,single,This row has an invalid book slug,,,1,0,en,draft,import,test,A:One||B:Two,B',
    ].join('\n');
    const preview = await agent.post('/api/admin/questions/import/preview').set('x-csrf-token', token).send({ csv }).expect(200);
    expect(preview.body.data.validCount).toBe(1);
    expect(preview.body.data.errorCount).toBe(1);
    expect(preview.body.data.errors[0].row).toBe(3);
    const committed = await agent.post('/api/admin/questions/import').set('x-csrf-token', token).send({ csv }).expect(201);
    expect(committed.body.data.imported).toBe(1);
    expect(committed.body.data.rejected).toBe(1);
  });

  it('creates and previews a configured test', async () => {
    const books = await agent.get('/api/admin/books').expect(200);
    const res = await agent.post('/api/admin/tests').set('x-csrf-token', token).send({
      title: 'Automated Test Pattern', bookId: books.body.data[0].id, mode: 'practice', selectionMode: 'random',
      questionCount: 5, durationMinutes: 6, languages: ['en'], isPublished: true,
      marksPerQuestion: 1, negativeMarks: 0, customCountEnabled: false, customDurationEnabled: false,
      practiceFeedback: false, resultVisibility: 'after_submit', resumePolicy: 'resume', autoSubmit: true,
      isActive: true, rules: [],
    }).expect(201);
    const preview = await agent.get(`/api/admin/tests/${res.body.data.id}/preview`).expect(200);
    expect(preview.body.data.count).toBe(5);
  });

  it('rejects a pattern whose sections do not add up', async () => {
    const books = await agent.get('/api/admin/books').expect(200);
    const subjects = await agent.get('/api/admin/subjects').expect(200);
    await agent.post('/api/admin/tests').set('x-csrf-token', token).send({
      title: 'Invalid pattern', bookId: books.body.data[0].id, mode: 'full_mock', selectionMode: 'topic',
      questionCount: 10, durationMinutes: 10, languages: ['en'],
      rules: [{ subjectId: subjects.body.data[0].id, questionCount: 4 }],
    }).expect(400);
  });
});

describe('examination workflow', () => {
  let agent: request.Agent;
  let token: string;

  beforeAll(async () => {
    agent = request.agent(app);
    token = await csrf(agent);
  });

  it('starts a real attempt without leaking the answer key', async () => {
    const config = await agent.get('/api/tests/mechanics-topic-wise').expect(200);
    expect(config.body.data.questionCount).toBe(5);
    expect(config.body.data.hasPattern).toBe(false);

    const started = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: config.body.data.id, language: 'en' }).expect(201);
    const attemptId = started.body.data.attemptId;
    expect(started.body.data.remainingSeconds).toBeGreaterThan(0);

    const state = await agent.get(`/api/attempts/${attemptId}`).expect(200);
    expect(state.body.data.questions).toHaveLength(5);
    expect(state.body.data.questions[0].correctOptionIds).toBeUndefined();
    expect(JSON.stringify(state.body.data.questions)).not.toContain('is_correct');

    const first = state.body.data.questions[0];
    const invalid = await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: first.id, selectedOptionIds: [999999] }).expect(400);
    expect(invalid.body.error).toMatch(/do not belong/);

    // Look up the key server-side (the student never receives it before submit).
    const correct = db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').get(first.id) as { id: number };
    const saved = await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: first.id, selectedOptionIds: [correct.id], viewing: true }).expect(200);
    expect(saved.body.data.statusCounts.answered).toBe(1);

    // Refresh/resume: same attempt, same stored deadline, answer preserved.
    const resumed = await agent.get(`/api/attempts/${attemptId}`).expect(200);
    expect(resumed.body.data.attempt.deadlineAt).toBe(state.body.data.attempt.deadlineAt);
    expect(resumed.body.data.questions[0].selectedOptionIds).toEqual([correct.id]);

    // Mark for review and clear response both update the palette state.
    await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: first.id, markedForReview: true }).expect(200);
    let marked = await agent.get(`/api/attempts/${attemptId}`).expect(200);
    expect(marked.body.data.questions[0].markedForReview).toBe(true);
    expect(marked.body.data.statusCounts.marked).toBe(1);
    await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: first.id, clear: true, selectedOptionIds: [] }).expect(200);
    marked = await agent.get(`/api/attempts/${attemptId}`).expect(200);
    expect(marked.body.data.statusCounts.answered).toBe(0);

    // Submit with an idempotency key; a repeat must not create a second result.
    const submissionId = 'e2e-submission-000001';
    const submitted = await agent.post(`/api/attempts/${attemptId}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: submissionId }).expect(200);
    expect(submitted.body.data.status).toBe('submitted');
    expect(submitted.body.data.correctCount).toBe(0);
    expect(submitted.body.data.unansweredCount).toBe(5);
    const again = await agent.post(`/api/attempts/${attemptId}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: submissionId }).expect(200);
    expect(again.body.data.attemptId).toBe(attemptId);
    expect(again.body.data.marksObtained).toBe(submitted.body.data.marksObtained);

    // Answers cannot be changed after submission.
    await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: first.id, selectedOptionIds: [correct.id] }).expect(409);

    const result = await agent.get(`/api/results/${attemptId}`).expect(200);
    expect(result.body.data.answersRevealed).toBe(true);
    expect(result.body.data.review).toHaveLength(5);
    expect(result.body.data.review[0].correctOptionIds).toContain(correct.id);
    expect(result.body.data.summary.unanswered).toBe(5);
  });

  it('calculates a correct score from stored answers on the server', async () => {
    const config = await agent.get('/api/tests/physics-subject-wise').expect(200);
    const started = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: config.body.data.id, language: 'en' }).expect(201);
    const attemptId = started.body.data.attemptId;
    const state = await agent.get(`/api/attempts/${attemptId}`).expect(200);
    const questions = state.body.data.questions;
    const option = (qid: number) => db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1').get(qid) as { id: number };
    const wrong = (qid: number) => db.prepare('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 0').get(qid) as { id: number };
    await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: questions[0].id, selectedOptionIds: [option(questions[0].id).id] }).expect(200);
    await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: questions[1].id, selectedOptionIds: [wrong(questions[1].id).id] }).expect(200);
    const submitted = await agent.post(`/api/attempts/${attemptId}/submit`).set('x-csrf-token', token)
      .send({ clientSubmissionId: 'e2e-submission-000002' }).expect(200);
    expect(submitted.body.data.correctCount).toBe(1);
    expect(submitted.body.data.incorrectCount).toBe(1);
    expect(submitted.body.data.unansweredCount).toBe(config.body.data.questionCount - 2);
    expect(submitted.body.data.marksObtained).toBe(0.75); // +1 then -0.25
    expect(submitted.body.data.negativeMarks).toBe(0.25);
    expect(submitted.body.data.accuracy).toBe(50);
  });

  it('resumes the same in-progress attempt instead of resetting the timer', async () => {
    const config = await agent.get('/api/tests/mechanics-topic-wise').expect(200);
    const first = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: config.body.data.id, language: 'en' }).expect(201);
    const second = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: config.body.data.id, language: 'en' }).expect(200);
    expect(second.body.data.attemptId).toBe(first.body.data.attemptId);
    expect(second.body.data.resumed).toBe(true);
  });

  it('refuses to silently shrink an oversized custom question count', async () => {
    const config = await agent.get('/api/tests/lucent-subject-wise-custom-practice').expect(200);
    const res = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: config.body.data.id, language: 'en', questionCount: 200 }).expect(409);
    expect(res.body.error).toMatch(/Not enough eligible questions/);
  });

  it('honours subject and topic filters for custom practice', async () => {
    const config = await agent.get('/api/tests/lucent-subject-wise-custom-practice').expect(200);
    const book = await agent.get('/api/books/lucent-subject-wise').expect(200);
    const physics = book.body.data.subjects.find((s: any) => s.slug === 'physics');
    const mechanics = book.body.data.topics.find((t: any) => t.slug === 'mechanics');
    const started = await agent.post('/api/attempts').set('x-csrf-token', token).send({
      testId: config.body.data.id, language: 'en', subjectId: physics.id, topicId: mechanics.id,
      questionCount: 5, durationMinutes: 7, mode: 'topic_wise',
    }).expect(201);
    const state = await agent.get(`/api/attempts/${started.body.data.attemptId}`).expect(200);
    expect(state.body.data.questions).toHaveLength(5);
    for (const q of state.body.data.questions) expect(q.topicName).toBe('Mechanics');
    expect(state.body.data.attempt.deadlineAt).toBeTruthy();
  });

  it('finalises an expired attempt and blocks late answers', async () => {
    const config = await agent.get('/api/tests/optics-topic-wise').expect(200);
    const started = await agent.post('/api/attempts').set('x-csrf-token', token)
      .send({ testId: config.body.data.id, language: 'en' }).expect(201);
    const attemptId = started.body.data.attemptId;
    db.prepare('UPDATE attempts SET deadline_at = ? WHERE id = ?').run(new Date(Date.now() - 5000).toISOString(), attemptId);
    const expired = await agent.get(`/api/attempts/${attemptId}`).expect(200);
    expect(expired.body.data.attempt.status).toBe('expired');
    expect(expired.body.data.attempt.submitReason).toBe('expired');
    const qid = expired.body.data.questions[0].id;
    await agent.put(`/api/attempts/${attemptId}/answers`).set('x-csrf-token', token)
      .send({ questionId: qid, selectedOptionIds: [expired.body.data.questions[0].options[0].id] }).expect(409);
  });

  it('builds a retry attempt from incorrect questions only', async () => {
    const results = await agent.get('/api/results?page=1&limit=1').expect(200);
    expect(results.body.data.length).toBeGreaterThan(0);
    const sourceId = results.body.data[0].id;
    const res = await agent.post('/api/attempts/retry').set('x-csrf-token', token)
      .send({ attemptId: sourceId, filter: 'unanswered' }).expect(201);
    expect(res.body.data.questionCount).toBeGreaterThan(0);
    const state = await agent.get(`/api/attempts/${res.body.data.attemptId}`).expect(200);
    expect(state.body.data.questions.length).toBe(res.body.data.questionCount);
  });

  it('does not expose a result belonging to a different session', async () => {
    const results = await agent.get('/api/results?page=1&limit=1').expect(200);
    const attemptId = results.body.data[0].id;
    const stranger = request.agent(app);
    await stranger.get('/api/auth/me');
    await stranger.get(`/api/results/${attemptId}`).expect(404);
  });

  it('generates analytics only from real attempts', async () => {
    const res = await agent.get('/api/analytics/overview').expect(200);
    expect(res.body.data.summary.totalAttempts).toBeGreaterThanOrEqual(3);
    expect(res.body.data.summary.totalQuestions).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.progression)).toBe(true);
    expect(Array.isArray(res.body.data.subjectPerformance)).toBe(true);
  });

  it('stores contact messages and supports question reports', async () => {
    await agent.post('/api/contact').set('x-csrf-token', token)
      .send({ name: 'API Tester', email: 'api@test.local', subject: 'Automated check', message: 'This message should be persisted.' }).expect(201);
    const questionId = db.prepare("SELECT id FROM questions WHERE status = 'published' LIMIT 1").get() as { id: number };
    const report = await agent.post('/api/question-reports').set('x-csrf-token', token)
      .send({ questionId: questionId.id, reason: 'typo', details: 'Automated report details for validation.' }).expect(201);
    expect(report.body.data.status).toBe('open');
  });

  it('generates a real PDF result report', async () => {
    const results = await agent.get('/api/results?page=1&limit=1').expect(200);
    const id = results.body.data[0].id;
    const pdf = await agent.get(`/api/results/${id}/pdf`).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');
  });
});

describe('abuse protection', () => {
  it('throttles repeated contact submissions', async () => {
    resetRateLimits();
    const agent = request.agent(app);
    const token = await csrf(agent);
    const body = { name: 'Rate Tester', email: 'rate@test.local', subject: 'Rate limit check', message: 'This is a valid message body for the rate limit check.' };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await agent.post('/api/contact').set('x-csrf-token', token).send(body);
      statuses.push(r.status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });

  it('throttles repeated failed logins for the same account', async () => {
    resetRateLimits();
    const agent = request.agent(app);
    const token = await csrf(agent);
    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) {
      const r = await agent.post('/api/auth/login').set('x-csrf-token', token).send({ email: ADMIN.email, password: 'definitely-wrong' });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 12)).toEqual(Array(12).fill(401));
    expect(statuses[12]).toBe(429);
  });

  it('caps state-changing API requests per minute', async () => {
    resetRateLimits();
    const agent = request.agent(app);
    const token = await csrf(agent);
    let last = 0;
    // The contact limiter is stricter, so use a harmless authenticated write
    // (profile update) to isolate the general API limiter.
    await agent.post('/api/auth/login').set('x-csrf-token', token).send(ADMIN).expect(200);
    const freshToken = await csrf(agent);
    resetRateLimits();
    for (let i = 0; i < 182; i++) {
      const r = await agent.patch('/api/auth/profile').set('x-csrf-token', freshToken).send({ name: 'Rate Limited Admin', locale: 'en' });
      last = r.status;
    }
    expect(last).toBe(429);
  });
});
