import { config } from './config.js';
import { migrate, openDatabase, nowIso, contentHash, slugify } from './db.js';
import { hashPassword } from './lib/auth.js';
import {
  BOOKS, CATEGORIES, DEFAULT_SETTINGS, HINDI_TRANSLATIONS, HINDI_OPTION_HINTS, SUBJECTS, parseBank,
} from './seedData.js';
import type { DB } from './db.js';

const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'catalog.manage', description: 'Manage categories, books, subjects and topics' },
  { key: 'questions.manage', description: 'Create, edit, import and publish questions' },
  { key: 'tests.manage', description: 'Create and configure tests' },
  { key: 'users.manage', description: 'Manage student accounts and roles' },
  { key: 'analytics.view', description: 'View platform analytics' },
  { key: 'settings.manage', description: 'Change site settings' },
  { key: 'attempts.view', description: 'Review test attempts' },
  { key: 'reports.manage', description: 'Handle reported questions' },
  { key: 'roles.manage', description: 'Configure roles and permissions' },
];

const ROLES: { key: string; name: string; description: string; permissions: string[] }[] = [
  { key: 'student', name: 'Student', description: 'Registered learner', permissions: [] },
  { key: 'super_admin', name: 'Super Admin', description: 'Full administrative access', permissions: PERMISSIONS.map((p) => p.key) },
  { key: 'content_manager', name: 'Content Manager', description: 'Catalog and content', permissions: ['catalog.manage', 'questions.manage', 'tests.manage', 'reports.manage'] },
  { key: 'question_editor', name: 'Question Editor', description: 'Question bank only', permissions: ['questions.manage'] },
  { key: 'test_manager', name: 'Test Manager', description: 'Tests and attempts', permissions: ['tests.manage', 'attempts.view', 'analytics.view'] },
  { key: 'analyst', name: 'Analyst', description: 'Reports and analytics', permissions: ['analytics.view', 'attempts.view'] },
  { key: 'support_staff', name: 'Support Staff', description: 'Student support and reports', permissions: ['users.manage', 'reports.manage'] },
];

export function seedRolesAndSettings(db: DB) {
  db.transaction(() => {
    const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (key, description) VALUES (?, ?)');
    for (const p of PERMISSIONS) insertPerm.run(p.key, p.description);
    const insertRole = db.prepare('INSERT OR IGNORE INTO roles (key, name, description, is_system) VALUES (?,?,?,1)');
    for (const r of ROLES) insertRole.run(r.key, r.name, r.description);
    const permId = db.prepare('SELECT id FROM permissions WHERE key = ?');
    const roleId = db.prepare('SELECT id FROM roles WHERE key = ?');
    const link = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    for (const r of ROLES) {
      const rid = (roleId.get(r.key) as { id: number }).id;
      for (const key of r.permissions) {
        const pid = (permId.get(key) as { id: number }).id;
        link.run(rid, pid);
      }
    }
    const set = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) set.run(key, JSON.stringify(value));
    const examDate = new Date(Date.now() + 96 * 86400000).toISOString().slice(0, 10);
    if ((db.prepare('SELECT COUNT(*) AS c FROM exam_countdowns').get() as { c: number }).c === 0) {
      db.prepare('INSERT INTO exam_countdowns (title, exam_date) VALUES (?, ?)').run('Next practice milestone', examDate);
    }
  })();
}

export function seedDemoContent(db: DB) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number };
  if (existing.c > 0) return { skipped: true, questions: existing.c };

  const bank = parseBank();
  db.transaction(() => {
    const catId = new Map<string, number>();
    const insCat = db.prepare('INSERT INTO categories (slug, name, description, icon, color, sort_order) VALUES (?,?,?,?,?,?)');
    CATEGORIES.forEach((c, i) => {
      const info = insCat.run(c.slug, c.name, c.description, c.icon, c.color, i);
      catId.set(c.slug, Number(info.lastInsertRowid));
    });

    const subjectId = new Map<string, number>();
    const topicId = new Map<string, number>();
    const insSubject = db.prepare('INSERT INTO subjects (slug, name, name_hi, icon, sort_order) VALUES (?,?,?,?,?)');
    const insTopic = db.prepare('INSERT OR IGNORE INTO topics (subject_id, slug, name, sort_order) VALUES (?,?,?,?)');
    SUBJECTS.forEach((s, si) => {
      const info = insSubject.run(s.slug, s.name, s.nameHi, s.icon, si);
      subjectId.set(s.slug, Number(info.lastInsertRowid));
      s.topics.forEach((t, ti) => {
        insTopic.run(subjectId.get(s.slug), t.slug, t.name, ti);
        const row = db.prepare('SELECT id FROM topics WHERE subject_id = ? AND slug = ?').get(subjectId.get(s.slug), t.slug) as { id: number };
        topicId.set(`${s.slug}:${t.slug}`, row.id);
      });
    });
    // Mix topic is a UI convenience, not a database topic: selection uses subject-wide pool.

    const bookId = new Map<string, number>();
    const insBook = db.prepare('INSERT INTO books (slug, title, description, badge, sort_order, is_active) VALUES (?,?,?,?,?,1)');
    const linkCat = db.prepare('INSERT INTO book_categories (book_id, category_id) VALUES (?,?)');
    const linkSubject = db.prepare('INSERT INTO book_subjects (book_id, subject_id) VALUES (?,?)');
    const linkTopic = db.prepare('INSERT OR IGNORE INTO book_topics (book_id, topic_id) VALUES (?,?)');
    BOOKS.forEach((b, bi) => {
      const info = insBook.run(b.slug, b.title, b.description, b.badge, bi);
      const bid = Number(info.lastInsertRowid);
      bookId.set(b.slug, bid);
      for (const c of b.categories) if (catId.has(c)) linkCat.run(bid, catId.get(c));
      for (const s of b.subjects) {
        linkSubject.run(bid, subjectId.get(s));
        for (const t of SUBJECTS.find((x) => x.slug === s)?.topics || []) {
          linkTopic.run(bid, topicId.get(`${s}:${t.slug}`));
        }
      }
    });

    const insQuestion = db.prepare(
      `INSERT INTO questions
       (code, book_id, category_id, subject_id, topic_id, difficulty, qtype, text_en, text_hi,
        explanation_en, marks, negative_marks, language, source, is_verified_pyq, status, tags,
        content_hash, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    const insOption = db.prepare(
      'INSERT INTO question_options (question_id, label, text_en, text_hi, is_correct, sort_order) VALUES (?,?,?,?,?,?)',
    );
    const now = nowIso();
    let total = 0;
    const firstQuestionByKey = new Map<string, number>();
    for (const book of BOOKS) {
      const bid = bookId.get(book.slug)!;
      const primaryCat = book.categories[0] ? catId.get(book.categories[0])! : null;
      for (const subjectSlug of book.subjects) {
        const sid = subjectId.get(subjectSlug)!;
        for (const item of bank[subjectSlug] || []) {
          const hi = HINDI_TRANSLATIONS[item.text];
          const code = `DEMO-${book.slug}-${subjectSlug}-${String(total + 1).padStart(4, '0')}`;
          const language = hi ? 'bilingual' : 'en';
          const info = insQuestion.run(
            code, bid, primaryCat, sid, topicId.get(`${subjectSlug}:${item.topic}`) || null,
            item.difficulty, 'single', item.text, hi || null, item.explanation,
            1, book.slug === 'speedy-current-affairs' ? 0 : 0.25, language,
            'Original practice content — VidyaPariksha demo bank', 0, 'published',
            `${subjectSlug},${item.topic},demo`, contentHash([item.text, ...item.options]), now, now,
          );
          const qid = Number(info.lastInsertRowid);
          const hints = hi ? HINDI_OPTION_HINTS[item.text] : undefined;
          item.options.forEach((opt, idx) => {
            insOption.run(qid, 'ABCD'[idx], opt, hints?.[idx] || null, idx === item.correct - 1 ? 1 : 0, idx);
          });
          firstQuestionByKey.set(`${book.slug}:${subjectSlug}:${item.topic}`, firstQuestionByKey.get(`${book.slug}:${subjectSlug}:${item.topic}`) ?? qid);
          total++;
        }
      }
    }

    interface TestSeed {
      slug: string; title: string; book: string; mode: string; selection: 'random' | 'fixed' | 'topic';
      category?: string; subject?: string; topic?: string; desired: number; minutes: number;
      negative: number; feedback?: number; rules?: { subject: string; count: number }[];
      description?: string;
    }
    const tests: TestSeed[] = [
      { slug: 'lucent-gk-full-mock', title: 'Lucent GK Full Mock Test', book: 'lucent-subject-wise', mode: 'full_mock', selection: 'topic', category: 'lucent-books', desired: 25, minutes: 30, negative: 0.25,
        rules: [{ subject: 'physics', count: 5 }, { subject: 'chemistry', count: 5 }, { subject: 'biology', count: 4 }, { subject: 'history', count: 4 }, { subject: 'geography', count: 3 }, { subject: 'polity', count: 4 }],
        description: 'A balanced multi-subject mock test with negative marking.' },
      { slug: 'physics-subject-wise', title: 'Physics Subject Wise Test', book: 'lucent-subject-wise', mode: 'subject_wise', selection: 'random', category: 'lucent-books', subject: 'physics', desired: 10, minutes: 15, negative: 0.25 },
      { slug: 'chemistry-subject-wise', title: 'Chemistry Subject Wise Test', book: 'lucent-subject-wise', mode: 'subject_wise', selection: 'random', category: 'lucent-books', subject: 'chemistry', desired: 10, minutes: 15, negative: 0.25 },
      { slug: 'biology-subject-wise', title: 'Biology Subject Wise Test', book: 'lucent-subject-wise', mode: 'subject_wise', selection: 'random', category: 'lucent-books', subject: 'biology', desired: 10, minutes: 15, negative: 0.25 },
      { slug: 'mechanics-topic-wise', title: 'Mechanics Topic Wise Practice', book: 'lucent-topic-wise', mode: 'topic_wise', selection: 'random', category: 'lucent-books', subject: 'physics', topic: 'mechanics', desired: 5, minutes: 8, negative: 0 },
      { slug: 'electricity-topic-wise', title: 'Electricity Topic Wise Practice', book: 'lucent-topic-wise', mode: 'topic_wise', selection: 'random', category: 'lucent-books', subject: 'physics', topic: 'electricity', desired: 4, minutes: 6, negative: 0 },
      { slug: 'optics-topic-wise', title: 'Optics Topic Wise Practice', book: 'lucent-topic-wise', mode: 'topic_wise', selection: 'random', category: 'lucent-books', subject: 'physics', topic: 'optics', desired: 4, minutes: 6, negative: 0 },
      { slug: 'constitution-topic-wise', title: 'Constitution Topic Practice', book: 'lucent-topic-wise', mode: 'topic_wise', selection: 'random', category: 'lucent-books', subject: 'polity', topic: 'constitution', desired: 4, minutes: 6, negative: 0 },
      { slug: 'objective-gk-mix', title: 'Objective GK Mixed Practice', book: 'lucent-objective-gk', mode: 'practice', selection: 'random', category: 'general-knowledge', desired: 20, minutes: 20, negative: 0, feedback: 1 },
      { slug: 'current-affairs-weekly', title: 'Current Affairs Weekly Practice', book: 'speedy-current-affairs', mode: 'practice', selection: 'random', category: 'current-affairs', desired: 9, minutes: 10, negative: 0, feedback: 1 },
      { slug: 'railway-mixed-practice', title: 'Railway Mixed Practice Set', book: 'railway-previous-year', mode: 'practice', selection: 'random', category: 'railway-exams', desired: 25, minutes: 30, negative: 0.25,
        description: 'Original exam-style practice questions. These are NOT verified previous-year papers.' },
      { slug: 'railway-quant-reasoning', title: 'Railway Quant & Reasoning Sprint', book: 'railway-previous-year', mode: 'full_mock', selection: 'topic', category: 'railway-exams', desired: 15, minutes: 18, negative: 0.25,
        rules: [{ subject: 'mathematics', count: 8 }, { subject: 'reasoning', count: 7 }] },
      { slug: 'bihar-gk-practice', title: 'Bihar Special GK Practice', book: 'bihar-special-gk', mode: 'practice', selection: 'random', category: 'bihar-gk', desired: 15, minutes: 15, negative: 0, feedback: 1 },
      { slug: 'computer-fundamentals-test', title: 'Computer Fundamentals Test', book: 'computer-test-series', mode: 'practice', selection: 'random', category: 'computer-tests', desired: 11, minutes: 12, negative: 0, feedback: 1 },
      { slug: 'teaching-aptitude-test', title: 'Teaching Aptitude Practice', book: 'teaching-exam-practice', mode: 'practice', selection: 'random', category: 'teaching-exams', desired: 12, minutes: 14, negative: 0 },
      { slug: 'general-knowledge-mix', title: 'General Knowledge Mix', book: 'general-knowledge', mode: 'practice', selection: 'random', category: 'general-knowledge', desired: 20, minutes: 20, negative: 0 },
      { slug: 'board-science-practice', title: 'Board Science Practice', book: 'board-exam-practice', mode: 'subject_wise', selection: 'random', category: 'bihar-board', desired: 20, minutes: 25, negative: 0 },
      { slug: 'ssc-mock-set-1', title: 'SSC Style Mock Set 1', book: 'lucent-objective-gk', mode: 'full_mock', selection: 'fixed', category: 'ssc-exams', desired: 15, minutes: 20, negative: 0.25,
        description: 'A fixed question set assembled from the demo bank.' },
    ];

    const insTest = db.prepare(
      `INSERT INTO tests (slug, title, description, book_id, category_id, subject_id, topic_id, mode, selection_mode, instructions,
        duration_minutes, question_count, custom_count_enabled, custom_duration_enabled, marks_per_question,
        negative_marks, languages, practice_feedback, result_visibility, resume_policy, auto_submit,
        is_active, is_published, published_at, created_at, updated_at, series_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?,?,?)`,
    );
    const insRule = db.prepare('INSERT INTO test_rules (test_id, subject_id, topic_id, question_count, sort_order) VALUES (?,?,?,?,?)');
    const insFixed = db.prepare('INSERT OR IGNORE INTO test_questions (test_id, question_id, position) VALUES (?,?,?)');
    const publishedAt = nowIso();
    tests.forEach((t, ti) => {
      const bid = bookId.get(t.book);
      if (!bid) return;
      const clauses = ["q.book_id = ?", "q.status = 'published'"];
      const params: (string | number)[] = [bid];
      if (t.subject) { clauses.push('q.subject_id = ?'); params.push(subjectId.get(t.subject)!); }
      if (t.topic) { clauses.push('q.topic_id = ?'); params.push(topicId.get(`${t.subject}:${t.topic}`)!); }
      const available = (db.prepare(`SELECT COUNT(*) AS c FROM questions q WHERE ${clauses.join(' AND ')}`).get(...params) as { c: number }).c;
      let count = Math.min(t.desired, available);
      if (t.rules) {
        // Rules define the section sizes; skip the demo test entirely if any section
        // cannot be filled, rather than silently reducing the published pattern.
        const enough = t.rules.every((r) => {
          const c = (db.prepare('SELECT COUNT(*) AS c FROM questions WHERE book_id = ? AND subject_id = ? AND status = ?').get(bid, subjectId.get(r.subject)!, 'published') as { c: number }).c;
          return c >= r.count;
        });
        if (!enough) return;
        count = t.rules.reduce((s, r) => s + r.count, 0);
      }
      if (count < 1) return;
      const languages = ['en'];
      // Hindi is offered only when every section of the pattern has enough translated questions.
      let hiEligible = t.rules
        ? t.rules.every((r) => {
            const c = (db.prepare("SELECT COUNT(*) AS c FROM questions WHERE book_id = ? AND subject_id = ? AND status = 'published' AND language IN ('hi','bilingual')").get(bid, subjectId.get(r.subject)!) as { c: number }).c;
            return c >= r.count;
          })
        : false;
      if (!t.rules) {
        const hiCount = (db.prepare(`SELECT COUNT(*) AS c FROM questions q WHERE ${clauses.join(' AND ')} AND q.language IN ('hi','bilingual')`).get(...params) as { c: number }).c;
        hiEligible = hiCount >= count && count > 0;
      }
      if (hiEligible) languages.push('hi');
      const info = insTest.run(
        t.slug, t.title, t.description || `Practice test from ${t.book.replace(/-/g, ' ')}.`, bid,
        t.category ? catId.get(t.category) || null : null,
        t.subject ? subjectId.get(t.subject) ?? null : null,
        t.topic ? topicId.get(`${t.subject}:${t.topic}`) ?? null : null,
        t.mode, t.selection,
        null, t.minutes, count, t.mode === 'practice' ? 1 : 0, t.mode === 'practice' ? 1 : 0,
        1, t.negative, JSON.stringify(languages), t.feedback || 0, 'after_submit', 'resume', 1,
        publishedAt, now, now, ti % 3 === 0 ? 'Starter Series' : null,
      );
      const tid = Number(info.lastInsertRowid);
      if (t.rules) t.rules.forEach((r, i) => insRule.run(tid, subjectId.get(r.subject)!, null, r.count, i));
      if (t.selection === 'fixed') {
        const rows = db.prepare(`SELECT q.id FROM questions q WHERE ${clauses.join(' AND ')} ORDER BY q.id LIMIT ?`).all(...params, count) as { id: number }[];
        rows.forEach((r, i) => insFixed.run(tid, r.id, i));
      }
    });

    // One hidden-but-startable "custom practice" test per collection powers the
    // dependent book → subject → topic → settings wizard without hardcoding a
    // paper in the frontend.
    const insCustom = db.prepare(
      `INSERT INTO tests (slug, title, description, book_id, category_id, mode, selection_mode,
        duration_minutes, question_count, custom_count_enabled, custom_duration_enabled,
        marks_per_question, negative_marks, languages, practice_feedback, result_visibility,
        resume_policy, auto_submit, is_active, is_published, is_listed, published_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,0,?,?,?)`,
    );
    for (const book of BOOKS) {
      const bid = bookId.get(book.slug)!;
      const available = (db.prepare("SELECT COUNT(*) AS c FROM questions WHERE book_id = ? AND status = 'published'").get(bid) as { c: number }).c;
      const hindi = (db.prepare("SELECT COUNT(*) AS c FROM questions WHERE book_id = ? AND status = 'published' AND language IN ('hi','bilingual')").get(bid) as { c: number }).c;
      if (available < 1) continue;
      const langs = hindi >= Math.min(10, available) ? ['en', 'hi'] : ['en'];
      insCustom.run(
        `${book.slug}-custom-practice`, `Custom Practice — ${book.title}`,
        'Build your own timed practice set by selecting a subject, topic, length and language.',
        bid, book.categories[0] ? catId.get(book.categories[0]) ?? null : null,
        'practice', 'random', 15, Math.min(10, available), 1, 1, 1, 0, JSON.stringify(langs),
        0, 'after_submit', 'resume', 1, publishedAt, now, now,
      );
    }
  })();

  return { skipped: false, questions: (db.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number }).c };
}

export function seedAdmin(db: DB, email?: string, password?: string) {
  const existing = db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key = 'super_admin' LIMIT 1`).get();
  if (existing) return { created: false as const, reason: 'An administrator already exists.' };
  if (!email || !password) return { created: false as const, reason: 'Administrator credentials not provided.' };
  const role = db.prepare("SELECT id FROM roles WHERE key = 'super_admin'").get() as { id: number };
  const studentRole = db.prepare("SELECT id FROM roles WHERE key = 'student'").get() as { id: number };
  const existingUser = db.prepare('SELECT id, role_id FROM users WHERE email = ?').get(email) as { id: number; role_id: number } | undefined;
  if (existingUser) {
    db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(role.id, existingUser.id);
    return { created: true as const, email, reason: 'Existing account promoted to Super Admin.' };
  }
  db.prepare('INSERT INTO users (name, email, password_hash, role_id) VALUES (?,?,?,?)').run(
    'Administrator', email, hashPassword(password), role.id,
  );
  void studentRole;
  return { created: true as const, email };
}

export function runSeed() {
  const db = openDatabase(config.databasePath);
  migrate(db);
  seedRolesAndSettings(db);
  const content = seedDemoContent(db);
  const args = process.argv.slice(2);
  const adminIdx = args.indexOf('--admin');
  const email = adminIdx >= 0 ? args[adminIdx + 1] : process.env.SEED_ADMIN_EMAIL;
  const password = adminIdx >= 0 ? args[adminIdx + 2] : process.env.SEED_ADMIN_PASSWORD;
  const admin = seedAdmin(db, email, password);
  db.close();
  return { content, admin };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() || '')) {
  const result = runSeed();
  console.log('[seed]', JSON.stringify(result, null, 2));
  if (result.admin.created) console.log('[seed] Administrator ready:', result.admin.email);
  else console.log('[seed]', result.admin.reason);
  console.log('[seed] Demo content:', result.content.skipped ? `already present (${result.content.questions} questions)` : `inserted ${result.content.questions} original practice questions`);
}

export { slugify };
