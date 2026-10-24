import { Router } from 'express';
import { paginate } from '../db.js';
import { notFound, send } from '../lib/http.js';

export const catalogRouter = Router();

catalogRouter.get('/categories', (req, res) => {
  const rows = req.db.prepare(
    `SELECT c.*,
      (SELECT COUNT(*) FROM book_categories bc JOIN books b ON b.id = bc.book_id AND b.is_active = 1 WHERE bc.category_id = c.id) AS book_count,
      (SELECT COUNT(DISTINCT t.id) FROM tests t JOIN book_categories bc ON bc.book_id = t.book_id
         WHERE bc.category_id = c.id AND t.is_published = 1 AND t.is_active = 1) AS test_count
     FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.name`,
  ).all();
  send(res, rows);
});

catalogRouter.get('/books', (req, res) => {
  const db = req.db;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const where: string[] = ['b.is_active = 1'];
  const params: (string | number)[] = [];
  if (req.query.category) {
    where.push('EXISTS (SELECT 1 FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id AND c.slug = ?)');
    params.push(String(req.query.category));
  }
  if (req.query.q) {
    where.push('(b.title LIKE ? OR b.description LIKE ?)');
    const q = `%${String(req.query.q).slice(0, 100)}%`;
    params.push(q, q);
  }
  if (req.query.badge) { where.push('b.badge = ?'); params.push(String(req.query.badge)); }
  const clause = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM books b WHERE ${clause}`).get(...params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT b.id, b.slug, b.title, b.description, b.cover_url, b.badge, b.sort_order,
      (SELECT COUNT(DISTINCT t.id) FROM tests t WHERE t.book_id = b.id AND t.is_published = 1 AND t.is_active = 1) AS test_count,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(DISTINCT bs.subject_id) FROM book_subjects bs WHERE bs.book_id = b.id) AS subject_count,
      (SELECT COUNT(DISTINCT bt.topic_id) FROM book_topics bt WHERE bt.book_id = b.id) AS topic_count
     FROM books b WHERE ${clause} ORDER BY b.sort_order, b.title LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  send(res, rows, 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

catalogRouter.get('/books/:slug', (req, res) => {
  const db = req.db;
  const book = db.prepare(
    `SELECT b.*,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.status = 'published' AND q.language IN ('hi','bilingual')) AS hindi_question_count,
      (SELECT COUNT(DISTINCT t.id) FROM tests t WHERE t.book_id = b.id AND t.is_published = 1 AND t.is_listed = 1 AND t.is_active = 1) AS test_count
     FROM books b WHERE b.slug = ? AND b.is_active = 1`,
  ).get(req.params.slug) as Record<string, unknown> | undefined;
  if (!book) throw notFound('Book not found or unavailable.');
  const id = book.id as number;
  const categories = db.prepare(
    'SELECT c.slug, c.name, c.icon, c.color FROM categories c JOIN book_categories bc ON bc.category_id = c.id WHERE bc.book_id = ? AND c.is_active = 1 ORDER BY c.sort_order',
  ).all(id);
  const subjects = db.prepare(
    `SELECT s.id, s.slug, s.name, s.name_hi, s.icon,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.subject_id = s.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.subject_id = s.id AND q.status = 'published' AND q.language IN ('hi','bilingual')) AS hindi_question_count
     FROM subjects s JOIN book_subjects bs ON bs.subject_id = s.id WHERE bs.book_id = ? AND s.is_active = 1 ORDER BY s.sort_order, s.name`,
  ).all(id, id, id);
  const topics = db.prepare(
    `SELECT t.id, t.slug, t.name, t.subject_id, s.slug AS subject_slug,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.topic_id = t.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = ? AND q.topic_id = t.id AND q.status = 'published' AND q.language IN ('hi','bilingual')) AS hindi_question_count
     FROM topics t JOIN book_topics bt ON bt.topic_id = t.id JOIN subjects s ON s.id = t.subject_id
     WHERE bt.book_id = ? AND t.is_active = 1 ORDER BY t.sort_order, t.name`,
  ).all(id, id, id);
  const tests = db.prepare(
    `SELECT t.id, t.slug, t.title, t.description, t.mode, t.duration_minutes, t.question_count,
      t.negative_marks, t.languages, t.practice_feedback, t.published_at, t.series_name, s.slug AS subject_slug, tp.slug AS topic_slug
     FROM tests t LEFT JOIN subjects s ON s.id = t.subject_id LEFT JOIN topics tp ON tp.id = t.topic_id
     WHERE t.book_id = ? AND t.is_published = 1 AND t.is_listed = 1 AND t.is_active = 1 ORDER BY COALESCE(t.published_at, t.created_at) DESC`,
  ).all(id);
  // Test subject/topic filters are declared through rules when a pattern exists.
  const testsWithFilters = tests.map((t: any) => {
    const rules = db.prepare(`SELECT s.slug AS subject_slug, tp.slug AS topic_slug FROM test_rules r
      LEFT JOIN subjects s ON s.id = r.subject_id LEFT JOIN topics tp ON tp.id = r.topic_id WHERE r.test_id = ?`).all(t.id) as { subject_slug: string | null; topic_slug: string | null }[];
    return { ...t, languages: safeLanguages(t.languages), subjects: rules.map((r) => r.subject_slug).filter(Boolean) };
  });
  const custom = db.prepare("SELECT slug FROM tests WHERE book_id = ? AND is_listed = 0 AND is_published = 1 AND is_active = 1 ORDER BY id LIMIT 1").get(id) as { slug: string } | undefined;
  send(res, { ...book, categories, subjects, topics, tests: testsWithFilters, customTestSlug: custom?.slug || null });
});

catalogRouter.get('/subjects', (req, res) => {
  const rows = req.db.prepare(
    `SELECT s.id, s.slug, s.name, s.name_hi, s.icon, s.description,
      (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(DISTINCT q.book_id) FROM questions q WHERE q.subject_id = s.id AND q.status = 'published') AS book_count,
      (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id AND t.is_active = 1) AS topic_count
     FROM subjects s WHERE s.is_active = 1 ORDER BY s.sort_order, s.name`,
  ).all();
  send(res, rows);
});

catalogRouter.get('/subjects/:slug', (req, res) => {
  const db = req.db;
  const subject = db.prepare('SELECT * FROM subjects WHERE slug = ? AND is_active = 1').get(req.params.slug) as Record<string, unknown> | undefined;
  if (!subject) throw notFound('Subject not found.');
  const topics = db.prepare(
    `SELECT t.id, t.slug, t.name, t.description,
      (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id AND q.status = 'published') AS question_count
     FROM topics t WHERE t.subject_id = ? AND t.is_active = 1 ORDER BY t.sort_order, t.name`,
  ).all(subject.id);
  const books = db.prepare(
    `SELECT b.slug, b.title, b.badge, (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.subject_id = ? AND q.status = 'published') AS question_count
     FROM books b JOIN book_subjects bs ON bs.book_id = b.id WHERE bs.subject_id = ? AND b.is_active = 1 ORDER BY b.sort_order`,
  ).all(subject.id, subject.id);
  send(res, { ...subject, topics, books });
});

catalogRouter.get('/topics/:subjectSlug/:topicSlug', (req, res) => {
  const db = req.db;
  const row = db.prepare(
    `SELECT t.id, t.subject_id, t.slug, t.name, t.description, s.slug AS subject_slug, s.name AS subject_name,
      (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id AND q.status = 'published') AS question_count
     FROM topics t JOIN subjects s ON s.id = t.subject_id
     WHERE t.slug = ? AND s.slug = ? AND t.is_active = 1 AND s.is_active = 1`,
  ).get(req.params.topicSlug, req.params.subjectSlug) as Record<string, unknown> | undefined;
  if (!row) throw notFound('Topic not found.');
  const books = db.prepare(
    `SELECT b.slug, b.title, (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.topic_id = ? AND q.status = 'published') AS question_count
     FROM books b JOIN book_topics bt ON bt.book_id = b.id
     WHERE bt.topic_id = ? AND b.is_active = 1 ORDER BY b.sort_order`,
  ).all(row.id, row.id);
  send(res, { ...row, books: books.filter((b: any) => b.question_count > 0) });
});

catalogRouter.get('/exams/:slug', (req, res) => {
  const db = req.db;
  const category = db.prepare('SELECT * FROM categories WHERE slug = ? AND is_active = 1').get(req.params.slug) as Record<string, unknown> | undefined;
  if (!category) throw notFound('Exam category not found.');
  const books = db.prepare(
    `SELECT b.id, b.slug, b.title, b.description, b.badge, b.cover_url,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.status = 'published') AS question_count,
      (SELECT COUNT(DISTINCT t.id) FROM tests t WHERE t.book_id = b.id AND t.is_published = 1 AND t.is_active = 1) AS test_count
     FROM books b JOIN book_categories bc ON bc.book_id = b.id WHERE bc.category_id = ? AND b.is_active = 1 ORDER BY b.sort_order`,
  ).all(category.id);
  const tests = db.prepare(
    `SELECT t.id, t.slug, t.title, t.mode, t.question_count, t.duration_minutes, t.negative_marks, t.languages, t.published_at
     FROM tests t JOIN book_categories bc ON bc.book_id = t.book_id
     WHERE bc.category_id = ? AND t.is_published = 1 AND t.is_listed = 1 AND t.is_active = 1
     ORDER BY COALESCE(t.published_at, t.created_at) DESC LIMIT 40`,
  ).all(category.id);
  send(res, { ...category, books, tests: tests.map((t: any) => ({ ...t, languages: safeLanguages(t.languages) })) });
});

catalogRouter.get('/search', (req, res) => {
  const db = req.db;
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q.length < 2) return send(res, { query: q, books: [], tests: [], subjects: [], topics: [] });
  const like = `%${q}%`;
  const books = db.prepare(
    `SELECT b.slug, b.title, b.description, b.badge,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id AND q.status = 'published') AS question_count
     FROM books b WHERE b.is_active = 1 AND (b.title LIKE ? OR b.description LIKE ?) LIMIT 8`,
  ).all(like, like);
  const tests = db.prepare(
    `SELECT t.slug, t.title, t.mode, t.question_count, t.duration_minutes, b.slug AS book_slug
     FROM tests t LEFT JOIN books b ON b.id = t.book_id
     WHERE t.is_published = 1 AND t.is_listed = 1 AND t.is_active = 1 AND (t.title LIKE ? OR t.description LIKE ?) LIMIT 8`,
  ).all(like, like);
  const subjects = db.prepare(
    `SELECT s.slug, s.name, s.icon, (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id AND q.status = 'published') AS question_count
     FROM subjects s WHERE s.is_active = 1 AND (s.name LIKE ? OR s.name_hi LIKE ?) LIMIT 8`,
  ).all(like, like);
  const topics = db.prepare(
    `SELECT t.slug, t.name, s.slug AS subject_slug, s.name AS subject_name,
      (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id AND q.status = 'published') AS question_count
     FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE t.is_active = 1 AND t.name LIKE ? LIMIT 8`,
  ).all(like);
  send(res, { query: q, books, tests, subjects, topics });
});

function safeLanguages(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed.filter((x) => x === 'en' || x === 'hi') : ['en'];
  } catch { return ['en']; }
}

export { safeLanguages };
