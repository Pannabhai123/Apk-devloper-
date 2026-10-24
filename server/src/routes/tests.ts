import { Router } from 'express';
import { paginate } from '../db.js';
import { notFound, send } from '../lib/http.js';
import { safeLanguages } from './catalog.js';

export const testsRouter = Router();

function testRow(db: any, where: string, params: (string | number)[]) {
  return db.prepare(
    `SELECT t.*, b.slug AS book_slug, b.title AS book_title, c.slug AS category_slug, c.name AS category_name,
      s.slug AS subject_slug, s.name AS subject_name, tp.slug AS topic_slug, tp.name AS topic_name
     FROM tests t LEFT JOIN books b ON b.id = t.book_id LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN subjects s ON s.id = t.subject_id LEFT JOIN topics tp ON tp.id = t.topic_id
     WHERE ${where}`,
  ).get(...params) as Record<string, any> | undefined;
}

export function shapeTest(db: any, t: Record<string, any>) {
  const rules = db.prepare(
    `SELECT r.id, r.question_count, r.difficulty, s.slug AS subject_slug, s.name AS subject_name, tp.slug AS topic_slug, tp.name AS topic_name
     FROM test_rules r LEFT JOIN subjects s ON s.id = r.subject_id LEFT JOIN topics tp ON tp.id = r.topic_id
     WHERE r.test_id = ? ORDER BY r.sort_order, r.id`,
  ).all(t.id) as any[];
  const subjects = db.prepare(
    `SELECT s.id, s.slug, s.name, s.name_hi,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.subject_id = s.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.subject_id = s.id AND q.status = 'published' AND q.language IN ('hi','bilingual')) AS hindi_question_count
     FROM subjects s JOIN book_subjects bs ON bs.subject_id = s.id WHERE bs.book_id = ? AND s.is_active = 1 ORDER BY s.sort_order`,
  ).all(t.book_id, t.book_id, t.book_id);
  const topics = db.prepare(
    `SELECT tp.id, tp.slug, tp.name, tp.subject_id, s.slug AS subject_slug,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.topic_id = tp.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.topic_id = tp.id AND q.status = 'published' AND q.language IN ('hi','bilingual')) AS hindi_question_count
     FROM topics tp JOIN book_topics bt ON bt.topic_id = tp.id JOIN subjects s ON s.id = tp.subject_id
     WHERE bt.book_id = ? AND tp.is_active = 1 ORDER BY tp.sort_order, tp.name`,
  ).all(t.book_id, t.book_id, t.book_id);
  const maxQuestions = (db.prepare("SELECT COUNT(*) AS c FROM questions WHERE book_id = ? AND status = 'published'").get(t.book_id) as { c: number }).c;
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    mode: t.mode,
    selectionMode: t.selection_mode,
    instructions: t.instructions,
    durationMinutes: t.duration_minutes,
    questionCount: t.question_count,
    customCountEnabled: Boolean(t.custom_count_enabled),
    customDurationEnabled: Boolean(t.custom_duration_enabled),
    marksPerQuestion: t.marks_per_question,
    negativeMarks: t.negative_marks,
    languages: safeLanguages(t.languages),
    practiceFeedback: Boolean(t.practice_feedback),
    resultVisibility: t.result_visibility,
    resumePolicy: t.resume_policy,
    autoSubmit: Boolean(t.auto_submit),
    publishedAt: t.published_at,
    seriesName: t.series_name,
    book: t.book_id ? { id: t.book_id, slug: t.book_slug, title: t.book_title } : null,
    category: t.category_slug ? { slug: t.category_slug, name: t.category_name } : null,
    fixedSubject: t.subject_slug ? { slug: t.subject_slug, name: t.subject_name } : null,
    fixedTopic: t.topic_slug ? { slug: t.topic_slug, name: t.topic_name } : null,
    pattern: rules.map((r) => ({ subject: r.subject_slug ? { slug: r.subject_slug, name: r.subject_name } : null, topic: r.topic_slug ? { slug: r.topic_slug, name: r.topic_name } : null, count: r.question_count, difficulty: r.difficulty })),
    hasPattern: rules.length > 0,
    subjectOptions: subjects,
    topicOptions: topics,
    maxQuestions,
  };
}

testsRouter.get('/', (req, res) => {
  const db = req.db;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const where = ["t.is_published = 1", "t.is_listed = 1", "t.is_active = 1", "(t.scheduled_at IS NULL OR t.scheduled_at <= ?)"];
  const params: (string | number)[] = [new Date().toISOString()];
  if (req.query.category) {
    where.push('EXISTS (SELECT 1 FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = t.book_id AND c.slug = ?)');
    params.push(String(req.query.category));
  }
  if (req.query.book) { where.push('b.slug = ?'); params.push(String(req.query.book)); }
  if (req.query.mode) { where.push('t.mode = ?'); params.push(String(req.query.mode)); }
  if (req.query.q) { where.push('(t.title LIKE ? OR t.description LIKE ?)'); const q = `%${String(req.query.q).slice(0, 100)}%`; params.push(q, q); }
  const clause = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM tests t LEFT JOIN books b ON b.id = t.book_id WHERE ${clause}`).get(...params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT t.id, t.slug, t.title, t.description, t.mode, t.question_count, t.duration_minutes,
      t.negative_marks, t.languages, t.practice_feedback, t.published_at, t.series_name,
      b.slug AS book_slug, b.title AS book_title
     FROM tests t LEFT JOIN books b ON b.id = t.book_id WHERE ${clause}
     ORDER BY COALESCE(t.published_at, t.created_at) DESC, t.id DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset) as any[];
  send(res, rows.map((r) => ({ ...r, languages: safeLanguages(r.languages) })), 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

testsRouter.get('/recent', (req, res) => {
  const rows = req.db.prepare(
    `SELECT t.id, t.slug, t.title, t.mode, t.question_count, t.duration_minutes, t.published_at,
      b.slug AS book_slug, b.title AS book_title
     FROM tests t LEFT JOIN books b ON b.id = t.book_id
     WHERE t.is_published = 1 AND t.is_listed = 1 AND t.is_active = 1 AND (t.scheduled_at IS NULL OR t.scheduled_at <= ?)
     ORDER BY COALESCE(t.published_at, t.created_at) DESC LIMIT 6`,
  ).all(new Date().toISOString());
  send(res, rows);
});

testsRouter.get('/:slug', (req, res) => {
  const db = req.db;
  const t = testRow(db, 't.slug = ? AND t.is_published = 1 AND t.is_active = 1', [req.params.slug]);
  if (!t) throw notFound('Test not found or not yet published.');
  if (t.scheduled_at && Date.parse(t.scheduled_at) > Date.now()) throw notFound('This test is scheduled for a future date.');
  send(res, shapeTest(db, t));
});
