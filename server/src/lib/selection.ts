import type { DB } from '../db.js';
import { conflict } from './http.js';

export interface SelectionCriteria {
  testId: number;
  bookId: number | null;
  categoryId: number | null;
  mode: string;
  selectionMode: string;
  subjectId?: number | null;
  topicId?: number | null;
  count: number;
  language: string;
  difficulty?: string | null;
}

export interface SelectedQuestion {
  id: number;
  marks: number;
  negative_marks: number;
}

function pool(db: DB, c: SelectionCriteria, extra: { subjectId?: number | null; topicId?: number | null; difficulty?: string | null } = {}) {
  const clauses = ["q.status = 'published'", '(qq.correct_count > 0)'];
  const params: (string | number)[] = [];
  if (c.bookId) {
    clauses.push('q.book_id = ?');
    params.push(c.bookId);
  } else if (c.categoryId) {
    clauses.push('EXISTS (SELECT 1 FROM book_categories bc WHERE bc.book_id = q.book_id AND bc.category_id = ?)');
    params.push(c.categoryId);
  }
  if (extra.subjectId) { clauses.push('q.subject_id = ?'); params.push(extra.subjectId); }
  else if (c.subjectId) { clauses.push('q.subject_id = ?'); params.push(c.subjectId); }
  if (extra.topicId) { clauses.push('q.topic_id = ?'); params.push(extra.topicId); }
  else if (c.topicId) { clauses.push('q.topic_id = ?'); params.push(c.topicId); }
  if (extra.difficulty || c.difficulty) { clauses.push('q.difficulty = ?'); params.push(String(extra.difficulty || c.difficulty)); }
  if (c.mode === 'previous_year') clauses.push('q.is_verified_pyq = 1');
  if (c.language === 'en') clauses.push("q.language IN ('en','bilingual')");
  if (c.language === 'hi') clauses.push("q.language IN ('hi','bilingual')");
  return db
    .prepare(
      `SELECT q.id, q.marks, q.negative_marks, q.difficulty, q.subject_id, q.topic_id,
              (SELECT COUNT(*) FROM question_options o WHERE o.question_id = q.id AND o.is_correct = 1) AS correct_count
       FROM questions q
       JOIN (SELECT q2.id, (SELECT COUNT(*) FROM question_options o2 WHERE o2.question_id = q2.id AND o2.is_correct = 1) AS correct_count FROM questions q2) qq
         ON qq.id = q.id
       WHERE ${clauses.join(' AND ')}
       ORDER BY q.id`,
    )
    .all(...params) as SelectedQuestion[];
}

function takeRandom(rows: SelectedQuestion[], count: number, exclude: Set<number>): SelectedQuestion[] {
  const candidates = rows.filter((r) => !exclude.has(r.id));
  // Fisher–Yates on a copy; seeded determinism is unnecessary because the snapshot is stored.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}

/** Selects eligible, published, keyed questions. Throws when the bank is insufficient. */
export function selectQuestions(db: DB, c: SelectionCriteria): SelectedQuestion[] {
  if (!Number.isInteger(c.count) || c.count < 1 || c.count > 200) {
    throw conflict('Question count must be between 1 and 200.');
  }
  const rules = db
    .prepare('SELECT * FROM test_rules WHERE test_id = ? ORDER BY sort_order, id')
    .all(c.testId) as { subject_id: number | null; topic_id: number | null; question_count: number; difficulty: string | null }[];
  const useFixed = c.selectionMode === 'fixed';

  if (useFixed || rules.length > 0) {
    if (useFixed) {
      const rows = db
        .prepare(
          `SELECT q.id, q.marks, q.negative_marks
           FROM test_questions tq JOIN questions q ON q.id = tq.question_id
           JOIN (SELECT q2.id, (SELECT COUNT(*) FROM question_options o WHERE o.question_id = q2.id AND o.is_correct = 1) AS cc FROM questions q2) k ON k.id = q.id
           WHERE tq.test_id = ? AND q.status = 'published' AND k.cc > 0
             AND (? IS NULL OR q.subject_id = ?) AND (? IS NULL OR q.topic_id = ?)
           ORDER BY tq.position, tq.question_id`,
        )
        .all(c.testId, c.subjectId ?? null, c.subjectId ?? null, c.topicId ?? null, c.topicId ?? null) as SelectedQuestion[];
      if (rows.length < c.count) {
        throw conflict(`Not enough eligible questions. Requested ${c.count}, available ${rows.length}.`);
      }
      return c.selectionMode === 'fixed' && !c.subjectId && !c.topicId
        ? rows.slice(0, c.count)
        : takeRandom(rows, c.count, new Set());
    }
    const totalFromRules = rules.reduce((sum, r) => sum + r.question_count, 0);
    if (totalFromRules !== c.count) {
      throw conflict(`Test pattern requires ${totalFromRules} questions but ${c.count} were requested.`);
    }
    const chosen: SelectedQuestion[] = [];
    const seen = new Set<number>();
    for (const rule of rules) {
      const available = pool(db, c, { subjectId: rule.subject_id, topicId: rule.topic_id, difficulty: rule.difficulty });
      const picked = takeRandom(available, rule.question_count, seen);
      if (picked.length < rule.question_count) {
        throw conflict(
          `Not enough eligible questions for a test pattern section. Needed ${rule.question_count}, available ${picked.length}.`,
        );
      }
      picked.forEach((p) => seen.add(p.id));
      chosen.push(...picked);
    }
    // Shuffle the assembled paper so sections are interleaved like the real CBT.
    return takeRandom(chosen, chosen.length, new Set());
  }

  const available = pool(db, c);
  if (available.length < c.count) {
    throw conflict(`Not enough eligible questions. Requested ${c.count}, available ${available.length}. Add more questions in the admin panel or choose a smaller count.`);
  }
  // Difficulty balancing: interleave easy/medium/hard rather than clustering all of one level.
  if (c.mode === 'full_mock') {
    const byLevel = new Map<string, SelectedQuestion[]>();
    for (const row of available) {
      const level = (row as SelectedQuestion & { difficulty?: string }).difficulty || 'medium';
      const list = byLevel.get(level) || [];
      list.push(row);
      byLevel.set(level, list);
    }
    const levels = ['easy', 'medium', 'hard'].filter((l) => (byLevel.get(l) || []).length > 0);
    const picked: SelectedQuestion[] = [];
    const seen = new Set<number>();
    while (picked.length < c.count) {
      let progressed = false;
      for (const level of levels) {
        if (picked.length >= c.count) break;
        const next = takeRandom(byLevel.get(level) || [], 1, seen);
        if (next.length) { picked.push(next[0]); seen.add(next[0].id); progressed = true; }
      }
      if (!progressed) break;
    }
    if (picked.length < c.count) throw conflict(`Not enough eligible questions. Requested ${c.count}, available ${picked.length}.`);
    return picked;
  }
  return takeRandom(available, c.count, new Set());
}
