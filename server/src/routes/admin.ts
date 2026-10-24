import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { config } from '../config.js';
import { contentHash, paginate, slugify, transaction } from '../db.js';
import { hashPassword } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { badRequest, conflict, notFound, send } from '../lib/http.js';
import { requireAdmin, requirePermission } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { selectQuestions } from '../lib/selection.js';
import { computeAnalytics, buildResult } from './results.js';
import { getSettings, setSetting } from './settings.js';
export const adminRouter = Router();
adminRouter.use(requireAdmin);

const zBool = z.union([z.boolean(), z.coerce.number().min(0).max(1)]).transform((v) => Boolean(v));

// ── Overview ───────────────────────────────────────────────────────────────
adminRouter.get('/overview', requirePermission('analytics.view', 'catalog.manage', 'questions.manage', 'tests.manage'), (req, res) => {
  const db = req.db;
  const one = (sql: string, ...params: any[]) => (db.prepare(sql).get(...params) as { c: number }).c;
  const recentActivity = db.prepare(
    `SELECT id, action, entity, entity_id, actor_email, created_at FROM audit_logs ORDER BY id DESC LIMIT 12`,
  ).all();
  const attemptsByDay = db.prepare(
    `SELECT substr(COALESCE(submitted_at, started_at), 1, 10) AS day, COUNT(*) AS attempts
     FROM attempts WHERE status IN ('submitted','expired') GROUP BY day ORDER BY day DESC LIMIT 14`,
  ).all();
  send(res, {
    totalStudents: one("SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key = 'student'"),
    guestAttempts: one('SELECT COUNT(*) AS c FROM attempts WHERE user_id IS NULL'),
    totalQuestions: one('SELECT COUNT(*) AS c FROM questions'),
    publishedQuestions: one("SELECT COUNT(*) AS c FROM questions WHERE status = 'published'"),
    totalBooks: one('SELECT COUNT(*) AS c FROM books'),
    totalSubjects: one('SELECT COUNT(*) AS c FROM subjects'),
    totalTopics: one('SELECT COUNT(*) AS c FROM topics'),
    publishedTests: one('SELECT COUNT(*) AS c FROM tests WHERE is_published = 1'),
    activeSessions: one("SELECT COUNT(*) AS c FROM attempts WHERE status = 'in_progress' AND deadline_at > ?", new Date().toISOString()),
    completedAttempts: one("SELECT COUNT(*) AS c FROM attempts WHERE status IN ('submitted','expired')"),
    openReports: one("SELECT COUNT(*) AS c FROM question_reports WHERE status = 'open'"),
    recentActivity, attemptsByDay,
  });
});

// ── Categories ─────────────────────────────────────────────────────────────
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(500).optional().default(''),
  icon: z.string().trim().max(40).optional().default('book'),
  color: z.string().trim().max(20).optional().default('#2563EB'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: zBool.optional().default(true),
});

adminRouter.get('/categories', requirePermission('catalog.manage', 'analytics.view'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM book_categories bc WHERE bc.category_id = c.id) AS book_count,
      (SELECT COUNT(DISTINCT t.id) FROM tests t JOIN book_categories bc ON bc.book_id = t.book_id WHERE bc.category_id = c.id) AS test_count
     FROM categories c ORDER BY c.sort_order, c.name`,
  ).all();
  send(res, rows);
});

adminRouter.post('/categories', requirePermission('catalog.manage'), validateBody(categorySchema), (req, res) => {
  const db = req.db;
  const b = req.body;
  const slug = b.slug || slugify(b.name);
  if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) throw conflict('A category with this slug already exists.');
  const info = db.prepare('INSERT INTO categories (slug, name, description, icon, color, sort_order, is_active) VALUES (?,?,?,?,?,?,?)')
    .run(slug, b.name, b.description, b.icon, b.color, b.sortOrder, b.isActive ? 1 : 0);
  audit(db, req, 'category.create', 'categories', Number(info.lastInsertRowid), { slug });
  send(res, { id: Number(info.lastInsertRowid), slug }, 201);
});

adminRouter.put('/categories/:id', requirePermission('catalog.manage'), validateBody(categorySchema.partial()), (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  if (!current) throw notFound('Category not found.');
  const b = req.body;
  const fields: string[] = []; const params: any[] = [];
  const map: Record<string, string> = { name: 'name', description: 'description', icon: 'icon', color: 'color', sortOrder: 'sort_order', isActive: 'is_active' };
  for (const [key, col] of Object.entries(map)) {
    if (b[key] !== undefined) { fields.push(`${col} = ?`); params.push(key === 'isActive' ? (b[key] ? 1 : 0) : b[key]); }
  }
  if (b.slug && b.slug !== current.slug) {
    if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(b.slug)) throw conflict('Slug already in use.');
    fields.push('slug = ?'); params.push(b.slug);
  }
  if (fields.length) db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...params, id);
  audit(db, req, 'category.update', 'categories', id, b);
  send(res, { updated: true });
});

adminRouter.delete('/categories/:id', requirePermission('catalog.manage'), (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  const usage = (db.prepare('SELECT COUNT(*) AS c FROM book_categories WHERE category_id = ?').get(id) as { c: number }).c;
  if (usage) throw conflict(`This category is assigned to ${usage} book(s). Remove those assignments first.`);
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (!result.changes) throw notFound('Category not found.');
  audit(db, req, 'category.delete', 'categories', id);
  send(res, { deleted: true });
});

// ── Books ──────────────────────────────────────────────────────────────────
const bookSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(1000).optional().default(''),
  coverUrl: z.string().trim().max(300).nullable().optional(),
  badge: z.enum(['new', 'popular']).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: zBool.optional().default(true),
  categoryIds: z.array(z.coerce.number().int().positive()).max(50).optional().default([]),
  subjectIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  topicIds: z.array(z.coerce.number().int().positive()).max(300).optional(),
});

function syncBookRelations(db: any, bookId: number, b: any) {
  if (b.categoryIds) {
    db.prepare('DELETE FROM book_categories WHERE book_id = ?').run(bookId);
    const ins = db.prepare('INSERT INTO book_categories (book_id, category_id) VALUES (?,?)');
    for (const cid of b.categoryIds) if (db.prepare('SELECT id FROM categories WHERE id = ?').get(cid)) ins.run(bookId, cid);
  }
  if (b.subjectIds) {
    db.prepare('DELETE FROM book_subjects WHERE book_id = ?').run(bookId);
    const ins = db.prepare('INSERT INTO book_subjects (book_id, subject_id) VALUES (?,?)');
    for (const sid of b.subjectIds) if (db.prepare('SELECT id FROM subjects WHERE id = ?').get(sid)) ins.run(bookId, sid);
  }
  if (b.topicIds) {
    db.prepare('DELETE FROM book_topics WHERE book_id = ?').run(bookId);
    const ins = db.prepare('INSERT OR IGNORE INTO book_topics (book_id, topic_id) VALUES (?,?)');
    for (const tid of b.topicIds) if (db.prepare('SELECT id FROM topics WHERE id = ?').get(tid)) ins.run(bookId, tid);
  }
}

adminRouter.get('/books', requirePermission('catalog.manage', 'analytics.view'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT b.*,
      (SELECT COUNT(*) FROM questions q WHERE q.book_id = b.id) AS question_count,
      (SELECT COUNT(*) FROM tests t WHERE t.book_id = b.id) AS test_count,
      (SELECT group_concat(c.slug) FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id) AS category_slugs
     FROM books b ORDER BY b.sort_order, b.title`,
  ).all();
  send(res, rows);
});

adminRouter.post('/books', requirePermission('catalog.manage'), validateBody(bookSchema), (req, res) => {
  const db = req.db;
  const b = req.body;
  const slug = b.slug || slugify(b.title);
  if (db.prepare('SELECT id FROM books WHERE slug = ?').get(slug)) throw conflict('A book with this slug already exists.');
  const id = transaction(db, () => {
    const info = db.prepare('INSERT INTO books (slug, title, description, cover_url, badge, sort_order, is_active) VALUES (?,?,?,?,?,?,?)')
      .run(slug, b.title, b.description, b.coverUrl || null, b.badge || null, b.sortOrder, b.isActive ? 1 : 0);
    const bookId = Number(info.lastInsertRowid);
    syncBookRelations(db, bookId, b);
    return bookId;
  });
  audit(db, req, 'book.create', 'books', id, { slug });
  send(res, { id, slug }, 201);
});

adminRouter.put('/books/:id', requirePermission('catalog.manage'), validateBody(bookSchema.partial()), (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  const current = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
  if (!current) throw notFound('Book not found.');
  const b = req.body;
  transaction(db, () => {
    const fields: string[] = []; const params: any[] = [];
    const map: Record<string, string> = { title: 'title', description: 'description', coverUrl: 'cover_url', badge: 'badge', sortOrder: 'sort_order', isActive: 'is_active' };
    for (const [key, col] of Object.entries(map)) {
      if (b[key] !== undefined) { fields.push(`${col} = ?`); params.push(key === 'isActive' ? (b[key] ? 1 : 0) : b[key]); }
    }
    if (b.slug && b.slug !== current.slug) {
      if (db.prepare('SELECT id FROM books WHERE slug = ?').get(b.slug)) throw conflict('Slug already in use.');
      fields.push('slug = ?'); params.push(b.slug);
    }
    if (fields.length) { fields.push('updated_at = ?'); params.push(new Date().toISOString()); db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...params, id); }
    syncBookRelations(db, id, b);
  });
  audit(db, req, 'book.update', 'books', id, b);
  send(res, { updated: true });
});

adminRouter.delete('/books/:id', requirePermission('catalog.manage'), (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  const questions = (db.prepare('SELECT COUNT(*) AS c FROM questions WHERE book_id = ?').get(id) as { c: number }).c;
  const attempts = (db.prepare('SELECT COUNT(*) AS c FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.book_id = ?').get(id) as { c: number }).c;
  if (attempts) throw conflict(`This book has ${attempts} recorded attempt(s). Unpublish it instead of deleting it.`);
  if (questions) throw conflict(`This book contains ${questions} question(s). Move or delete them first.`);
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  if (!result.changes) throw notFound('Book not found.');
  audit(db, req, 'book.delete', 'books', id);
  send(res, { deleted: true });
});

// ── Subjects & topics ──────────────────────────────────────────────────────
adminRouter.get('/subjects', requirePermission('catalog.manage', 'questions.manage', 'analytics.view'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) AS question_count,
      (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id) AS topic_count
     FROM subjects s ORDER BY s.sort_order, s.name`,
  ).all();
  send(res, rows);
});

adminRouter.post('/subjects', requirePermission('catalog.manage'), validateBody(z.object({
  name: z.string().trim().min(2).max(80), slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9-]+$/).optional(),
  nameHi: z.string().trim().max(80).nullable().optional(), description: z.string().trim().max(500).optional().default(''),
  icon: z.string().trim().max(40).optional().default('book-open'), sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: zBool.optional().default(true),
})), (req, res) => {
  const db = req.db; const b = req.body; const slug = b.slug || slugify(b.name);
  if (db.prepare('SELECT id FROM subjects WHERE slug = ?').get(slug)) throw conflict('Subject slug already exists.');
  const info = db.prepare('INSERT INTO subjects (slug, name, name_hi, description, icon, sort_order, is_active) VALUES (?,?,?,?,?,?,?)')
    .run(slug, b.name, b.nameHi || null, b.description, b.icon, b.sortOrder, b.isActive ? 1 : 0);
  audit(db, req, 'subject.create', 'subjects', Number(info.lastInsertRowid));
  send(res, { id: Number(info.lastInsertRowid), slug }, 201);
});

adminRouter.put('/subjects/:id', requirePermission('catalog.manage'), validateBody(z.object({
  name: z.string().trim().min(2).max(80).optional(), nameHi: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(500).optional(), icon: z.string().trim().max(40).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(), isActive: zBool.optional(),
})), (req, res) => {
  const db = req.db; const id = Number(req.params.id); const b = req.body;
  if (!db.prepare('SELECT id FROM subjects WHERE id = ?').get(id)) throw notFound('Subject not found.');
  const map: Record<string, string> = { name: 'name', nameHi: 'name_hi', description: 'description', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active' };
  const fields: string[] = []; const params: any[] = [];
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) { fields.push(`${col} = ?`); params.push(k === 'isActive' ? (b[k] ? 1 : 0) : b[k]); }
  if (fields.length) db.prepare(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`).run(...params, id);
  audit(db, req, 'subject.update', 'subjects', id, b);
  send(res, { updated: true });
});

adminRouter.delete('/subjects/:id', requirePermission('catalog.manage'), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const count = (db.prepare('SELECT COUNT(*) AS c FROM questions WHERE subject_id = ?').get(id) as { c: number }).c;
  if (count) throw conflict(`This subject has ${count} question(s). Reassign or delete them first.`);
  const r = db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  if (!r.changes) throw notFound('Subject not found.');
  audit(db, req, 'subject.delete', 'subjects', id);
  send(res, { deleted: true });
});

adminRouter.get('/topics', requirePermission('catalog.manage', 'questions.manage', 'analytics.view'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT t.*, s.name AS subject_name, s.slug AS subject_slug,
      (SELECT COUNT(*) FROM questions q WHERE q.topic_id = t.id) AS question_count
     FROM topics t JOIN subjects s ON s.id = t.subject_id ORDER BY s.sort_order, t.sort_order, t.name`,
  ).all();
  send(res, rows);
});

adminRouter.post('/topics', requirePermission('catalog.manage'), validateBody(z.object({
  subjectId: z.coerce.number().int().positive(), name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(500).optional().default(''), sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: zBool.optional().default(true),
})), (req, res) => {
  const db = req.db; const b = req.body; const slug = b.slug || slugify(b.name);
  if (!db.prepare('SELECT id FROM subjects WHERE id = ?').get(b.subjectId)) throw badRequest('Subject does not exist.');
  if (db.prepare('SELECT id FROM topics WHERE subject_id = ? AND slug = ?').get(b.subjectId, slug)) throw conflict('Topic slug already exists for this subject.');
  const info = db.prepare('INSERT INTO topics (subject_id, slug, name, description, sort_order, is_active) VALUES (?,?,?,?,?,?)')
    .run(b.subjectId, slug, b.name, b.description, b.sortOrder, b.isActive ? 1 : 0);
  audit(db, req, 'topic.create', 'topics', Number(info.lastInsertRowid));
  send(res, { id: Number(info.lastInsertRowid), slug }, 201);
});

adminRouter.put('/topics/:id', requirePermission('catalog.manage'), validateBody(z.object({
  subjectId: z.coerce.number().int().positive().optional(), name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional(), sortOrder: z.coerce.number().int().min(0).optional(), isActive: zBool.optional(),
})), (req, res) => {
  const db = req.db; const id = Number(req.params.id); const b = req.body;
  if (!db.prepare('SELECT id FROM topics WHERE id = ?').get(id)) throw notFound('Topic not found.');
  const map: Record<string, string> = { subjectId: 'subject_id', name: 'name', description: 'description', sortOrder: 'sort_order', isActive: 'is_active' };
  const fields: string[] = []; const params: any[] = [];
  for (const [k, col] of Object.entries(map)) if (b[k] !== undefined) { fields.push(`${col} = ?`); params.push(k === 'isActive' ? (b[k] ? 1 : 0) : b[k]); }
  if (fields.length) db.prepare(`UPDATE topics SET ${fields.join(', ')} WHERE id = ?`).run(...params, id);
  audit(db, req, 'topic.update', 'topics', id, b);
  send(res, { updated: true });
});

adminRouter.delete('/topics/:id', requirePermission('catalog.manage'), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const count = (db.prepare('SELECT COUNT(*) AS c FROM questions WHERE topic_id = ?').get(id) as { c: number }).c;
  if (count) throw conflict(`This topic has ${count} question(s). Reassign or delete them first.`);
  const r = db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  if (!r.changes) throw notFound('Topic not found.');
  audit(db, req, 'topic.delete', 'topics', id);
  send(res, { deleted: true });
});

// ── Questions ──────────────────────────────────────────────────────────────
const optionSchema = z.object({
  label: z.string().trim().min(1).max(3), textEn: z.string().trim().max(2000),
  textHi: z.string().trim().max(2000).nullable().optional(), imageUrl: z.string().trim().max(300).nullable().optional(),
  isCorrect: zBool,
});
const questionSchema = z.object({
  bookId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  subjectId: z.coerce.number().int().positive(),
  topicId: z.coerce.number().int().positive().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  qtype: z.enum(['single', 'multiple']).default('single'),
  textEn: z.string().trim().min(4).max(5000),
  textHi: z.string().trim().max(5000).nullable().optional(),
  explanationEn: z.string().trim().max(5000).nullable().optional(),
  explanationHi: z.string().trim().max(5000).nullable().optional(),
  marks: z.coerce.number().min(0).max(100).default(1),
  negativeMarks: z.coerce.number().min(0).max(100).default(0),
  language: z.enum(['en', 'hi', 'bilingual']).default('en'),
  imageUrl: z.string().trim().max(300).nullable().optional(),
  source: z.string().trim().max(300).nullable().optional(),
  isVerifiedPyq: zBool.optional().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  tags: z.string().trim().max(300).optional().default(''),
  options: z.array(optionSchema).min(2).max(8),
}).superRefine((v, ctx) => {
  const correct = v.options.filter((o) => o.isCorrect).length;
  if (!correct) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'At least one correct option is required.' });
  if (v.qtype === 'single' && correct > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Single-answer questions may have only one correct option.' });
  if (new Set(v.options.map((o) => o.label.toUpperCase())).size !== v.options.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Option labels must be unique.' });
});

function writeOptions(db: any, questionId: number, options: any[]) {
  db.prepare('DELETE FROM question_options WHERE question_id = ?').run(questionId);
  const ins = db.prepare('INSERT INTO question_options (question_id, label, text_en, text_hi, image_url, is_correct, sort_order) VALUES (?,?,?,?,?,?,?)');
  options.forEach((o, i) => ins.run(questionId, o.label.toUpperCase(), o.textEn, o.textHi || null, o.imageUrl || null, o.isCorrect ? 1 : 0, i));
}

function questionCode(db: any) {
  const n = (db.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number }).c + 1;
  return `Q-${Date.now().toString(36).toUpperCase()}-${n}`;
}

adminRouter.get('/questions', requirePermission('questions.manage', 'analytics.view'), (req, res) => {
  const db = req.db;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const where: string[] = ['1=1']; const params: any[] = [];
  const filters: Record<string, string> = { bookId: 'q.book_id', subjectId: 'q.subject_id', topicId: 'q.topic_id', difficulty: 'q.difficulty', status: 'q.status', qtype: 'q.qtype' };
  for (const [key, col] of Object.entries(filters)) if (req.query[key]) { where.push(`${col} = ?`); params.push(String(req.query[key])); }
  if (req.query.q) { where.push('(q.text_en LIKE ? OR q.code LIKE ? OR q.tags LIKE ?)'); const like = `%${String(req.query.q).slice(0, 100)}%`; params.push(like, like, like); }
  const clause = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM questions q WHERE ${clause}`).get(...params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT q.id, q.code, q.text_en, q.text_hi, q.difficulty, q.qtype, q.status, q.language, q.is_verified_pyq,
      q.marks, q.negative_marks, q.created_at, q.updated_at, b.title AS book_title, s.name AS subject_name, tp.name AS topic_name,
      (SELECT COUNT(*) FROM question_options o WHERE o.question_id = q.id AND o.is_correct = 1) AS correct_count
     FROM questions q JOIN books b ON b.id = q.book_id JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN topics tp ON tp.id = q.topic_id WHERE ${clause} ORDER BY q.id DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  send(res, rows, 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

adminRouter.get('/questions/:id', requirePermission('questions.manage'), (req, res) => {
  const db = req.db;
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(req.params.id)) as any;
  if (!q) throw notFound('Question not found.');
  const options = db.prepare('SELECT id, label, text_en, text_hi, image_url, is_correct FROM question_options WHERE question_id = ? ORDER BY sort_order, label').all(q.id);
  send(res, { ...q, options });
});

function assertRefs(db: any, b: any) {
  if (!db.prepare('SELECT id FROM books WHERE id = ?').get(b.bookId)) throw badRequest('Book does not exist.');
  if (!db.prepare('SELECT id FROM subjects WHERE id = ?').get(b.subjectId)) throw badRequest('Subject does not exist.');
  if (b.topicId && !db.prepare('SELECT id FROM topics WHERE id = ?').get(b.topicId)) throw badRequest('Topic does not exist.');
  if (b.categoryId && !db.prepare('SELECT id FROM categories WHERE id = ?').get(b.categoryId)) throw badRequest('Category does not exist.');
}

function insertQuestion(db: any, b: any, userId: number | null) {
  assertRefs(db, b);
  const hash = contentHash([b.textEn, ...b.options.map((o: any) => o.textEn)]);
  const info = db.prepare(
    `INSERT INTO questions (code, book_id, category_id, subject_id, topic_id, difficulty, qtype, text_en, text_hi,
      explanation_en, explanation_hi, marks, negative_marks, language, image_url, source, is_verified_pyq, status, tags,
      content_hash, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(questionCode(db), b.bookId, b.categoryId ?? null, b.subjectId, b.topicId ?? null, b.difficulty, b.qtype,
    b.textEn, b.textHi || null, b.explanationEn || null, b.explanationHi || null, b.marks, b.negativeMarks,
    b.language, b.imageUrl || null, b.source || null, b.isVerifiedPyq ? 1 : 0, b.status, b.tags || '', hash, userId);
  const id = Number(info.lastInsertRowid);
  writeOptions(db, id, b.options);
  return id;
}

adminRouter.post('/questions', requirePermission('questions.manage'), validateBody(questionSchema), (req, res) => {
  const db = req.db;
  const id = transaction(db, () => insertQuestion(db, req.body, req.auth.user!.id));
  audit(db, req, 'question.create', 'questions', id);
  send(res, { id }, 201);
});

adminRouter.put('/questions/:id', requirePermission('questions.manage'), validateBody(questionSchema), (req, res) => {
  const db = req.db; const id = Number(req.params.id); const b = req.body;
  if (!db.prepare('SELECT id FROM questions WHERE id = ?').get(id)) throw notFound('Question not found.');
  assertRefs(db, b);
  transaction(db, () => {
    db.prepare(
      `UPDATE questions SET book_id=?, category_id=?, subject_id=?, topic_id=?, difficulty=?, qtype=?, text_en=?, text_hi=?,
        explanation_en=?, explanation_hi=?, marks=?, negative_marks=?, language=?, image_url=?, source=?, is_verified_pyq=?,
        status=?, tags=?, content_hash=?, updated_at=? WHERE id=?`,
    ).run(b.bookId, b.categoryId ?? null, b.subjectId, b.topicId ?? null, b.difficulty, b.qtype, b.textEn, b.textHi || null,
      b.explanationEn || null, b.explanationHi || null, b.marks, b.negativeMarks, b.language, b.imageUrl || null,
      b.source || null, b.isVerifiedPyq ? 1 : 0, b.status, b.tags || '', contentHash([b.textEn, ...b.options.map((o: any) => o.textEn)]),
      new Date().toISOString(), id);
    writeOptions(db, id, b.options);
  });
  audit(db, req, 'question.update', 'questions', id);
  send(res, { updated: true });
});

adminRouter.post('/questions/:id/duplicate', requirePermission('questions.manage'), (req, res) => {
  const db = req.db; const srcId = Number(req.params.id);
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(srcId) as any;
  if (!q) throw notFound('Question not found.');
  const opts = db.prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY sort_order').all(srcId) as any[];
  const id = transaction(db, () => {
    const info = db.prepare(
      `INSERT INTO questions (code, book_id, category_id, subject_id, topic_id, difficulty, qtype, text_en, text_hi,
        explanation_en, explanation_hi, marks, negative_marks, language, image_url, source, is_verified_pyq, status, tags,
        content_hash, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(questionCode(db), q.book_id, q.category_id, q.subject_id, q.topic_id, q.difficulty, q.qtype, q.text_en, q.text_hi,
      q.explanation_en, q.explanation_hi, q.marks, q.negative_marks, q.language, q.image_url, q.source, q.is_verified_pyq,
      'draft', q.tags, q.content_hash, req.auth.user!.id);
    const newId = Number(info.lastInsertRowid);
    writeOptions(db, newId, opts.map((o) => ({ label: o.label, textEn: o.text_en, textHi: o.text_hi, imageUrl: o.image_url, isCorrect: Boolean(o.is_correct) })));
    return newId;
  });
  audit(db, req, 'question.duplicate', 'questions', id, { sourceId: srcId });
  send(res, { id }, 201);
});

adminRouter.delete('/questions/:id', requirePermission('questions.manage'), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const used = (db.prepare('SELECT COUNT(*) AS c FROM attempt_questions WHERE question_id = ?').get(id) as { c: number }).c;
  if (used) throw conflict(`This question appears in ${used} stored attempt(s). Archive it instead of deleting it.`);
  db.prepare('DELETE FROM test_questions WHERE question_id = ?').run(id);
  const r = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  if (!r.changes) throw notFound('Question not found.');
  audit(db, req, 'question.delete', 'questions', id);
  send(res, { deleted: true });
});

adminRouter.post('/questions/bulk-status', requirePermission('questions.manage'), validateBody(z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500), status: z.enum(['draft', 'published', 'archived']),
})), (req, res) => {
  const db = req.db;
  const placeholders = req.body.ids.map(() => '?').join(',');
  const r = db.prepare(`UPDATE questions SET status = ?, updated_at = ? WHERE id IN (${placeholders})`)
    .run(req.body.status, new Date().toISOString(), ...req.body.ids);
  audit(db, req, 'question.bulk_status', 'questions', null, { status: req.body.status, count: r.changes });
  send(res, { updated: r.changes });
});

adminRouter.get('/questions-export', requirePermission('questions.manage', 'analytics.view'), (req, res) => {
  const db = req.db;
  const params: any[] = [];
  let clause = '1=1';
  if (req.query.bookId) { clause += ' AND q.book_id = ?'; params.push(Number(req.query.bookId)); }
  const rows = db.prepare(
    `SELECT q.code, b.slug AS book_slug, s.slug AS subject_slug, tp.slug AS topic_slug, q.difficulty, q.qtype,
      q.text_en, q.text_hi, q.explanation_en, q.marks, q.negative_marks, q.language, q.status, q.tags, q.source,
      (SELECT group_concat(o.label || ':' || replace(o.text_en, char(10), ' '), '||') FROM (SELECT * FROM question_options WHERE question_id = q.id ORDER BY sort_order) o) AS options,
      (SELECT group_concat(o.label, ',') FROM question_options o WHERE o.question_id = q.id AND o.is_correct = 1) AS correct_labels
     FROM questions q JOIN books b ON b.id = q.book_id JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN topics tp ON tp.id = q.topic_id WHERE ${clause} ORDER BY q.id LIMIT 20000`,
  ).all(...params) as any[];
  const csv = stringify([
    ['code', 'book_slug', 'subject_slug', 'topic_slug', 'difficulty', 'qtype', 'text_en', 'text_hi', 'explanation_en', 'marks', 'negative_marks', 'language', 'status', 'tags', 'source', 'options', 'correct_labels'],
    ...rows.map((r) => [r.code, r.book_slug, r.subject_slug, r.topic_slug, r.difficulty, r.qtype, r.text_en, r.text_hi, r.explanation_en, r.marks, r.negative_marks, r.language, r.status, r.tags, r.source, r.options, r.correct_labels]),
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="questions-export.csv"');
  res.send(csv);
});

interface ImportRow { row: number; data: any; errors: string[] }
function parseImportCsv(db: any, csvText: string, defaultBookId?: number): { valid: ImportRow[]; errors: ImportRow[] } {
  let records: Record<string, string>[];
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }) as Record<string, string>[];
  } catch (err) {
    throw badRequest(`CSV parse error: ${err instanceof Error ? err.message : 'invalid CSV'}`);
  }
  if (!records.length) throw badRequest('The CSV file contains no data rows.');
  if (records.length > 2000) throw badRequest('Import is limited to 2000 rows per file.');
  const valid: ImportRow[] = []; const errors: ImportRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i]; const rowNumber = i + 2; const issues: string[] = [];
    const bookSlug = r.book_slug || '';
    const book = bookSlug
      ? db.prepare('SELECT id FROM books WHERE slug = ?').get(bookSlug) as { id: number } | undefined
      : defaultBookId ? { id: defaultBookId } : undefined;
    if (!book) issues.push('book_slug is missing or does not match any book');
    const subject = db.prepare('SELECT id FROM subjects WHERE slug = ?').get(r.subject_slug || '') as { id: number } | undefined;
    if (!subject) issues.push('subject_slug is missing or does not match any subject');
    let topic: { id: number } | undefined;
    if (r.topic_slug) {
      topic = db.prepare('SELECT id FROM topics WHERE slug = ? AND subject_id = ?').get(r.topic_slug, subject?.id ?? -1) as { id: number } | undefined;
      if (!topic) issues.push('topic_slug does not belong to the specified subject');
    }
    const text = r.text_en || '';
    if (text.length < 4) issues.push('text_en must be at least 4 characters');
    if (text.length > 5000) issues.push('text_en exceeds 5000 characters');
    const optionPairs = (r.options || '').split('||').map((p) => p.trim()).filter(Boolean);
    const parsedOptions = optionPairs.map((pair) => {
      const idx = pair.indexOf(':');
      if (idx <= 0) return null;
      const label = pair.slice(0, idx).trim().toUpperCase();
      const textEn = pair.slice(idx + 1).trim();
      return label && textEn ? { label, textEn } : null;
    });
    // Malformed option pairs must produce a row-level validation error, never a
    // 500 crash. Only well-formed options are kept for further validation.
    const options = parsedOptions.filter((o): o is { label: string; textEn: string } => o !== null);
    if (parsedOptions.length !== options.length || options.length < 2) {
      issues.push('options must contain at least 2 entries in the form A:Text||B:Text');
    }
    if (new Set(options.map((o) => o.label)).size !== options.length) issues.push('option labels must be unique');
    const correctLabels = (r.correct_labels || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!correctLabels.length) issues.push('correct_labels is required (e.g. A or A,C)');
    if (correctLabels.some((l) => !options.some((o) => o && o.label === l))) issues.push('correct_labels references an option that does not exist');
    const qtype = r.qtype === 'multiple' ? 'multiple' : 'single';
    if (qtype === 'single' && correctLabels.length > 1) issues.push('single-answer questions may only have one correct_labels entry');
    const difficulty = ['easy', 'medium', 'hard'].includes(r.difficulty || '') ? r.difficulty : 'medium';
    const status = ['draft', 'published', 'archived'].includes(r.status || '') ? r.status : 'draft';
    const language = ['en', 'hi', 'bilingual'].includes(r.language || '') ? r.language : 'en';
    const marks = Number(r.marks || 1); const negative = Number(r.negative_marks || 0);
    if (!Number.isFinite(marks) || marks < 0 || marks > 100) issues.push('marks must be between 0 and 100');
    if (!Number.isFinite(negative) || negative < 0 || negative > 100) issues.push('negative_marks must be between 0 and 100');
    const hash = contentHash([text, ...options.map((o) => o?.textEn || '')]);
    if (seen.has(hash) || db.prepare('SELECT id FROM questions WHERE content_hash = ?').get(hash)) issues.push('duplicate question (same text and options already exist)');
    seen.add(hash);
    const data = {
      bookId: book?.id, subjectId: subject?.id, topicId: topic?.id ?? null, difficulty, qtype,
      textEn: text, textHi: r.text_hi || null, explanationEn: r.explanation_en || null,
      marks, negativeMarks: negative, language, status, tags: r.tags || '', source: r.source || 'CSV import',
      isVerifiedPyq: false, options: options.map((o) => ({ label: o.label, textEn: o.textEn, textHi: null, imageUrl: null, isCorrect: correctLabels.includes(o.label) })),
    };
    const entry = { row: rowNumber, data, errors: issues };
    if (issues.length) errors.push(entry); else valid.push(entry);
  }
  return { valid, errors };
}

adminRouter.post('/questions/import/preview', requirePermission('questions.manage'), validateBody(z.object({ csv: z.string().min(10).max(4_000_000), defaultBookId: z.coerce.number().int().positive().optional() })), (req, res) => {
  const result = parseImportCsv(req.db, req.body.csv, req.body.defaultBookId);
  send(res, { total: result.valid.length + result.errors.length, validCount: result.valid.length, errorCount: result.errors.length,
    preview: result.valid.slice(0, 20).map((r) => ({ row: r.row, text: String(r.data.textEn).slice(0, 160), subjectId: r.data.subjectId, qtype: r.data.qtype })),
    errors: result.errors.slice(0, 100) });
});

adminRouter.post('/questions/import', requirePermission('questions.manage'), validateBody(z.object({ csv: z.string().min(10).max(4_000_000), defaultBookId: z.coerce.number().int().positive().optional() })), (req, res) => {
  const db = req.db;
  const result = parseImportCsv(db, req.body.csv, req.body.defaultBookId);
  if (!result.valid.length) throw badRequest('No valid rows to import. Fix the reported errors and try again.');
  const ids = transaction(db, () => result.valid.map((r) => insertQuestion(db, r.data, req.auth.user!.id)));
  audit(db, req, 'question.import', 'questions', null, { imported: ids.length, rejected: result.errors.length });
  send(res, { imported: ids.length, rejected: result.errors.length, errors: result.errors.slice(0, 50) }, 201);
});

// ── Tests ──────────────────────────────────────────────────────────────────
const testSchema = z.object({
  title: z.string().trim().min(3).max(160), slug: z.string().trim().min(2).max(90).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(1000).optional().default(''),
  bookId: z.coerce.number().int().positive(), categoryId: z.coerce.number().int().positive().nullable().optional(),
  subjectId: z.coerce.number().int().positive().nullable().optional(), topicId: z.coerce.number().int().positive().nullable().optional(),
  mode: z.enum(['full_mock', 'subject_wise', 'topic_wise', 'practice', 'previous_year']).default('practice'),
  selectionMode: z.enum(['random', 'fixed', 'topic']).default('random'),
  instructions: z.string().trim().max(5000).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(20),
  questionCount: z.coerce.number().int().min(1).max(200).default(10),
  customCountEnabled: zBool.optional().default(false), customDurationEnabled: zBool.optional().default(false),
  marksPerQuestion: z.coerce.number().min(0).max(100).default(1), negativeMarks: z.coerce.number().min(0).max(100).default(0),
  languages: z.array(z.enum(['en', 'hi'])).min(1).max(2).default(['en']),
  practiceFeedback: zBool.optional().default(false), resultVisibility: z.enum(['after_submit', 'hidden']).default('after_submit'),
  resumePolicy: z.enum(['resume', 'restart']).default('resume'), autoSubmit: zBool.optional().default(true),
  isActive: zBool.optional().default(true), isPublished: zBool.optional().default(false),
  scheduledAt: z.string().trim().max(40).nullable().optional(), seriesName: z.string().trim().max(100).nullable().optional(),
  rules: z.array(z.object({ subjectId: z.coerce.number().int().positive().nullable().optional(), topicId: z.coerce.number().int().positive().nullable().optional(), questionCount: z.coerce.number().int().min(1).max(200), difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional() })).max(30).optional().default([]),
  fixedQuestionIds: z.array(z.coerce.number().int().positive()).max(200).optional(),
});

function validateTestRefs(db: any, b: any) {
  if (!db.prepare('SELECT id FROM books WHERE id = ?').get(b.bookId)) throw badRequest('Book does not exist.');
  if (b.subjectId && !db.prepare('SELECT id FROM subjects WHERE id = ?').get(b.subjectId)) throw badRequest('Subject does not exist.');
  if (b.topicId && !db.prepare('SELECT id FROM topics WHERE id = ?').get(b.topicId)) throw badRequest('Topic does not exist.');
  const ruleTotal = b.rules.reduce((sum: number, r: any) => sum + r.questionCount, 0);
  if (b.rules.length && ruleTotal !== b.questionCount) throw badRequest(`Test pattern sections total ${ruleTotal} questions but questionCount is ${b.questionCount}.`);
  if (b.selectionMode === 'fixed' && (!b.fixedQuestionIds || b.fixedQuestionIds.length < b.questionCount)) {
    throw badRequest(`Fixed tests need at least ${b.questionCount} selected questions.`);
  }
  if (b.languages.includes('hi')) {
    const hi = (db.prepare("SELECT COUNT(*) AS c FROM questions WHERE book_id = ? AND status = 'published' AND language IN ('hi','bilingual')").get(b.bookId) as { c: number }).c;
    if (hi < b.questionCount) throw badRequest(`Hindi is not available: only ${hi} translated question(s) exist in this collection.`);
  }
}

adminRouter.get('/tests', requirePermission('tests.manage', 'analytics.view'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT t.*, b.title AS book_title,
      (SELECT COUNT(*) FROM test_rules r WHERE r.test_id = t.id) AS rule_count,
      (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id) AS attempt_count
     FROM tests t LEFT JOIN books b ON b.id = t.book_id ORDER BY t.id DESC`,
  ).all();
  send(res, rows);
});

adminRouter.get('/tests/:id', requirePermission('tests.manage'), (req, res) => {
  const db = req.db;
  const t = db.prepare('SELECT * FROM tests WHERE id = ?').get(Number(req.params.id)) as any;
  if (!t) throw notFound('Test not found.');
  const rules = db.prepare('SELECT * FROM test_rules WHERE test_id = ? ORDER BY sort_order, id').all(t.id);
  const fixed = db.prepare('SELECT question_id FROM test_questions WHERE test_id = ? ORDER BY position').all(t.id);
  send(res, { ...t, languages: JSON.parse(t.languages || '["en"]'), rules, fixedQuestionIds: fixed.map((f: any) => f.question_id) });
});

function syncTestChildren(db: any, testId: number, b: any) {
  db.prepare('DELETE FROM test_rules WHERE test_id = ?').run(testId);
  const ins = db.prepare('INSERT INTO test_rules (test_id, subject_id, topic_id, question_count, difficulty, sort_order) VALUES (?,?,?,?,?,?)');
  b.rules.forEach((r: any, i: number) => ins.run(testId, r.subjectId ?? null, r.topicId ?? null, r.questionCount, r.difficulty ?? null, i));
  if (b.selectionMode === 'fixed') {
    db.prepare('DELETE FROM test_questions WHERE test_id = ?').run(testId);
    const insF = db.prepare('INSERT OR IGNORE INTO test_questions (test_id, question_id, position) VALUES (?,?,?)');
    b.fixedQuestionIds.forEach((qid: number, i: number) => insF.run(testId, qid, i));
  }
}

adminRouter.post('/tests', requirePermission('tests.manage'), validateBody(testSchema), (req, res) => {
  const db = req.db; const b = req.body;
  const slug = b.slug || slugify(b.title);
  if (db.prepare('SELECT id FROM tests WHERE slug = ?').get(slug)) throw conflict('Test slug already exists.');
  validateTestRefs(db, b);
  const id = transaction(db, () => {
    const info = db.prepare(
      `INSERT INTO tests (slug, title, description, book_id, category_id, subject_id, topic_id, mode, selection_mode,
        instructions, duration_minutes, question_count, custom_count_enabled, custom_duration_enabled, marks_per_question,
        negative_marks, languages, practice_feedback, result_visibility, resume_policy, auto_submit, is_active,
        is_published, published_at, scheduled_at, series_name, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(slug, b.title, b.description, b.bookId, b.categoryId ?? null, b.subjectId ?? null, b.topicId ?? null,
      b.mode, b.selectionMode, b.instructions || null, b.durationMinutes, b.questionCount,
      b.customCountEnabled ? 1 : 0, b.customDurationEnabled ? 1 : 0, b.marksPerQuestion, b.negativeMarks,
      JSON.stringify(b.languages), b.practiceFeedback ? 1 : 0, b.resultVisibility, b.resumePolicy, b.autoSubmit ? 1 : 0,
      b.isActive ? 1 : 0, b.isPublished ? 1 : 0, b.isPublished ? new Date().toISOString() : null,
      b.scheduledAt || null, b.seriesName || null, req.auth.user!.id);
    const testId = Number(info.lastInsertRowid);
    syncTestChildren(db, testId, b);
    return testId;
  });
  audit(db, req, 'test.create', 'tests', id, { slug });
  send(res, { id, slug }, 201);
});

adminRouter.put('/tests/:id', requirePermission('tests.manage'), validateBody(testSchema), (req, res) => {
  const db = req.db; const id = Number(req.params.id); const b = req.body;
  const current = db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as any;
  if (!current) throw notFound('Test not found.');
  if (b.slug && b.slug !== current.slug && db.prepare('SELECT id FROM tests WHERE slug = ?').get(b.slug)) throw conflict('Test slug already exists.');
  validateTestRefs(db, b);
  transaction(db, () => {
    db.prepare(
      `UPDATE tests SET slug=?, title=?, description=?, book_id=?, category_id=?, subject_id=?, topic_id=?, mode=?,
        selection_mode=?, instructions=?, duration_minutes=?, question_count=?, custom_count_enabled=?,
        custom_duration_enabled=?, marks_per_question=?, negative_marks=?, languages=?, practice_feedback=?,
        result_visibility=?, resume_policy=?, auto_submit=?, is_active=?, is_published=?, published_at=?,
        scheduled_at=?, series_name=?, updated_at=? WHERE id=?`,
    ).run(b.slug || current.slug, b.title, b.description, b.bookId, b.categoryId ?? null, b.subjectId ?? null,
      b.topicId ?? null, b.mode, b.selectionMode, b.instructions || null, b.durationMinutes, b.questionCount,
      b.customCountEnabled ? 1 : 0, b.customDurationEnabled ? 1 : 0, b.marksPerQuestion, b.negativeMarks,
      JSON.stringify(b.languages), b.practiceFeedback ? 1 : 0, b.resultVisibility, b.resumePolicy, b.autoSubmit ? 1 : 0,
      b.isActive ? 1 : 0, b.isPublished ? 1 : 0, b.isPublished ? (current.published_at || new Date().toISOString()) : null,
      b.scheduledAt || null, b.seriesName || null, new Date().toISOString(), id);
    syncTestChildren(db, id, b);
  });
  audit(db, req, 'test.update', 'tests', id);
  send(res, { updated: true });
});

adminRouter.delete('/tests/:id', requirePermission('tests.manage'), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const attempts = (db.prepare('SELECT COUNT(*) AS c FROM attempts WHERE test_id = ?').get(id) as { c: number }).c;
  if (attempts) throw conflict(`This test has ${attempts} attempt(s). Unpublish it instead of deleting it.`);
  const r = db.prepare('DELETE FROM tests WHERE id = ?').run(id);
  if (!r.changes) throw notFound('Test not found.');
  audit(db, req, 'test.delete', 'tests', id);
  send(res, { deleted: true });
});

adminRouter.get('/tests/:id/preview', requirePermission('tests.manage'), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const t = db.prepare('SELECT * FROM tests WHERE id = ?').get(id) as any;
  if (!t) throw notFound('Test not found.');
  try {
    const picked = selectQuestions(db, { testId: id, bookId: t.book_id, categoryId: t.category_id, mode: t.mode,
      selectionMode: t.selection_mode, subjectId: t.subject_id, topicId: t.topic_id, count: t.question_count, language: 'en' });
    const questions = picked.map((q) => db.prepare('SELECT id, code, text_en, difficulty FROM questions WHERE id = ?').get(q.id));
    send(res, { count: questions.length, questions });
  } catch (err) {
    send(res, { count: 0, questions: [], error: err instanceof Error ? err.message : 'Unable to build preview' });
  }
});


// ── Attempts, students, analytics, reports, settings, logs, roles ──────────
adminRouter.get('/attempts', requirePermission('attempts.view', 'analytics.view'), (req, res) => {
  const db = req.db;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const where: string[] = ['1=1']; const params: any[] = [];
  if (req.query.status) { where.push('a.status = ?'); params.push(String(req.query.status)); }
  if (req.query.testId) { where.push('a.test_id = ?'); params.push(Number(req.query.testId)); }
  const clause = where.join(' AND ');
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM attempts a WHERE ${clause}`).get(...params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT a.id, a.status, a.submit_reason, a.started_at, a.submitted_at, a.question_count, a.marks_obtained,
      a.marks_possible, a.accuracy, a.percentage, a.language, u.email AS user_email, t.title AS test_title
     FROM attempts a JOIN tests t ON t.id = a.test_id LEFT JOIN users u ON u.id = a.user_id
     WHERE ${clause} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  send(res, rows, 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

adminRouter.get('/attempts/:id', requirePermission('attempts.view'), (req, res) => {
  const exists = req.db.prepare('SELECT id FROM attempts WHERE id = ?').get(Number(req.params.id));
  if (!exists) throw notFound('Attempt not found.');
  send(res, buildResult(req.db, Number(req.params.id)));
});

adminRouter.get('/students', requirePermission('users.manage', 'analytics.view'), (req, res) => {
  const db = req.db;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const q = String(req.query.q || '').trim();
  const where = q ? 'WHERE (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)' : '';
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM users u ${where}`).get(...params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, u.last_login_at, r.key AS role_key, r.name AS role_name,
      (SELECT COUNT(*) FROM attempts a WHERE a.user_id = u.id AND a.status IN ('submitted','expired')) AS attempt_count,
      (SELECT MAX(a.percentage) FROM attempts a WHERE a.user_id = u.id AND a.status IN ('submitted','expired')) AS best_score
     FROM users u JOIN roles r ON r.id = u.role_id ${where} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
  ).all(...params, limit, offset);
  send(res, rows, 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

adminRouter.patch('/students/:id', requirePermission('users.manage'), validateBody(z.object({
  status: z.enum(['active', 'suspended']).optional(), roleId: z.coerce.number().int().positive().optional(),
})), (req, res) => {
  const db = req.db; const id = Number(req.params.id); const b = req.body;
  const target = db.prepare('SELECT u.*, r.key AS role_key FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(id) as any;
  if (!target) throw notFound('Student not found.');
  if (b.roleId) {
    if (!db.prepare('SELECT id FROM roles WHERE id = ?').get(b.roleId)) throw badRequest('Role does not exist.');
    if (target.role_key === 'super_admin' && req.auth.user!.id !== id) throw conflict('Only the administrator themself can change the Super Admin role.');
  }
  if (b.status) db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(b.status, new Date().toISOString(), id);
  if (b.roleId) db.prepare('UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?').run(b.roleId, new Date().toISOString(), id);
  if (b.status === 'suspended') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  audit(db, req, 'student.update', 'users', id, b);
  send(res, { updated: true });
});

adminRouter.get('/analytics', requirePermission('analytics.view'), (req, res) => {
  const data = computeAnalytics(req.db, { sql: 'a.id > 0', params: [] });
  send(res, data);
});

adminRouter.get('/reports', requirePermission('reports.manage'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT qr.*, q.text_en, u.email AS user_email FROM question_reports qr
     JOIN questions q ON q.id = qr.question_id LEFT JOIN users u ON u.id = qr.user_id
     ORDER BY CASE qr.status WHEN 'open' THEN 0 ELSE 1 END, qr.id DESC LIMIT 200`,
  ).all();
  send(res, rows);
});

adminRouter.patch('/reports/:id', requirePermission('reports.manage'), validateBody(z.object({
  status: z.enum(['open', 'resolved', 'dismissed']), resolutionNote: z.string().trim().max(1000).optional().default(''),
})), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const r = db.prepare('UPDATE question_reports SET status = ?, resolution_note = ?, resolved_at = ?, resolved_by = ? WHERE id = ?')
    .run(req.body.status, req.body.resolutionNote, new Date().toISOString(), req.auth.user!.id, id);
  if (!r.changes) throw notFound('Report not found.');
  audit(db, req, 'report.update', 'question_reports', id, req.body);
  send(res, { updated: true });
});

adminRouter.get('/settings', requirePermission('settings.manage'), (req, res) => {
  send(res, getSettings(req.db));
});

adminRouter.put('/settings', requirePermission('settings.manage'), validateBody(z.object({
  values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
})), (req, res) => {
  const db = req.db;
  const allowed = new Set(['site_name', 'site_tagline', 'site_description', 'contact_email', 'contact_phone', 'address',
    'footer_about', 'primary_color', 'accent_color', 'default_language', 'allow_registration', 'guest_tests_enabled',
    'result_visibility', 'maintenance_mode', 'hero_badge', 'disclaimer', 'logo_url', 'demo_mode']);
  const entries = Object.entries(req.body.values).filter(([key]) => allowed.has(key));
  if (!entries.length) throw badRequest('No recognised settings were provided.');
  transaction(db, () => { for (const [key, value] of entries) setSetting(db, key, value); });
  audit(db, req, 'settings.update', 'settings', null, { keys: entries.map(([k]) => k) });
  send(res, { updated: entries.length, settings: getSettings(req.db) });
});

adminRouter.get('/contact-messages', requirePermission('reports.manage', 'users.manage'), (req, res) => {
  const rows = req.db.prepare('SELECT * FROM contact_messages ORDER BY CASE status WHEN \'open\' THEN 0 ELSE 1 END, id DESC LIMIT 200').all();
  send(res, rows);
});

adminRouter.patch('/contact-messages/:id', requirePermission('reports.manage', 'users.manage'), validateBody(z.object({ status: z.enum(['open', 'resolved']) })), (req, res) => {
  const r = req.db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id));
  if (!r.changes) throw notFound('Message not found.');
  audit(req.db, req, 'contact.update', 'contact_messages', req.params.id, req.body);
  send(res, { updated: true });
});

adminRouter.get('/audit-logs', requirePermission('analytics.view', 'settings.manage'), (req, res) => {
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const total = (req.db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get() as { c: number }).c;
  const rows = req.db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
  send(res, rows, 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

adminRouter.get('/roles', requirePermission('roles.manage', 'users.manage'), (req, res) => {
  const rows = req.db.prepare(
    `SELECT r.*, (SELECT group_concat(p.key) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id) AS permission_keys,
      (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
     FROM roles r ORDER BY r.id`,
  ).all();
  const permissions = req.db.prepare('SELECT key, description FROM permissions ORDER BY key').all();
  send(res, { roles: rows, permissions });
});

adminRouter.put('/roles/:id/permissions', requirePermission('roles.manage'), validateBody(z.object({
  permissions: z.array(z.string().max(60)).max(50),
})), (req, res) => {
  const db = req.db; const id = Number(req.params.id);
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as any;
  if (!role) throw notFound('Role not found.');
  if (role.key === 'super_admin') throw conflict('Super Admin permissions cannot be reduced.');
  transaction(db, () => {
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id);
    const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE key = ?');
    for (const key of req.body.permissions) ins.run(id, key);
  });
  audit(db, req, 'role.permissions', 'roles', id, { permissions: req.body.permissions });
  send(res, { updated: true });
});

adminRouter.post('/countdowns', requirePermission('settings.manage'), validateBody(z.object({
  title: z.string().trim().min(2).max(120), examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), isActive: zBool.optional().default(true),
})), (req, res) => {
  const info = req.db.prepare('INSERT INTO exam_countdowns (title, exam_date, is_active) VALUES (?,?,?)')
    .run(req.body.title, req.body.examDate, req.body.isActive ? 1 : 0);
  audit(req.db, req, 'countdown.create', 'exam_countdowns', Number(info.lastInsertRowid));
  send(res, { id: Number(info.lastInsertRowid) }, 201);
});

// ── Image upload (validated) ───────────────────────────────────────────────
adminRouter.post('/uploads', requirePermission('catalog.manage', 'questions.manage'), (req, res) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) { req.destroy(); return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    let ext: string | null = null;
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ext = 'jpg';
    else if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png';
    else if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') ext = 'webp';
    if (!ext || !buffer.length || buffer.length > 2 * 1024 * 1024) return res.status(400).json({ ok: false, error: 'Only valid PNG, JPEG or WebP images up to 2 MB are allowed.' });
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(config.uploadDir, name), buffer, { flag: 'wx' });
    audit(req.db, req, 'upload.create', 'uploads', name, { bytes: buffer.length });
    res.status(201).json({ ok: true, data: { url: `/uploads/${name}` } });
  });
  req.on('error', () => res.status(400).json({ ok: false, error: 'Upload failed.' }));
});

// ── Exports ────────────────────────────────────────────────────────────────
adminRouter.get('/export/:resource', requirePermission('analytics.view', 'catalog.manage'), (req, res) => {
  const db = req.db;
  const resource = req.params.resource;
  const queries: Record<string, string> = {
    books: 'SELECT id, slug, title, description, badge, is_active, sort_order FROM books ORDER BY sort_order',
    subjects: 'SELECT id, slug, name, name_hi, is_active FROM subjects ORDER BY sort_order',
    topics: 'SELECT t.id, t.name, t.is_active, s.slug AS subject_slug FROM topics t JOIN subjects s ON s.id = t.subject_id ORDER BY t.id',
    categories: 'SELECT id, slug, name, description, is_active FROM categories ORDER BY sort_order',
    tests: 'SELECT id, slug, title, mode, question_count, duration_minutes, negative_marks, is_published FROM tests ORDER BY id',
    results: `SELECT a.id, a.submitted_at, a.question_count, a.correct_count, a.incorrect_count, a.unanswered_count,
      a.marks_obtained, a.marks_possible, a.accuracy, a.percentage, a.time_taken_seconds, t.title AS test_title
      FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.status IN ('submitted','expired') ORDER BY a.id`,
  };
  const sql = queries[resource];
  if (!sql) throw notFound('Unknown export resource.');
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  const columns = rows.length ? Object.keys(rows[0]) : ['empty'];
  const csv = stringify([columns, ...rows.map((r) => columns.map((c) => r[c] ?? ''))]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${resource}-export.csv"`);
  res.send(csv);
});
