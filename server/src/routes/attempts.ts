import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { isoAfter, isExpired, nowIso, parseJson, remainingSeconds, transaction } from '../db.js';
import { badRequest, conflict, notFound, send, unauthorized } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { finalizeAttempt, negativeMarksForAttempt, scoreQuestion, validateAnswerSelection, type SnapshotOption } from '../lib/scoring.js';
import { selectQuestions } from '../lib/selection.js';
import { validateBody } from '../lib/validate.js';
import { isFeatureEnabled } from './settings.js';
import { safeLanguages } from './catalog.js';

export const attemptsRouter = Router();

interface AttemptRow {
  id: number; test_id: number; user_id: number | null; guest_session_id: number | null;
  status: string; language: string; question_count: number; marks_per_question: number; negative_marks: number;
  started_at: string; deadline_at: string; submitted_at: string | null; submit_reason: string | null;
  time_taken_seconds: number | null; mode: string; subject_id: number | null; topic_id: number | null;
  title?: string; slug?: string; practice_feedback?: number; result_visibility?: string; resume_policy?: string;
  selection_mode?: string; book_id?: number | null; category_id?: number | null;
}

function ownerClause(req: Express.Request) {
  const user = req.auth.user;
  if (user) return { sql: '(a.user_id = ? OR a.guest_session_id = ?)', params: [user.id, req.auth.session.id] as (number | null)[] };
  return { sql: 'a.guest_session_id = ?', params: [req.auth.session.id] as (number | null)[] };
}

export function getOwnedAttempt(req: Express.Request, id: number): AttemptRow {
  const owner = ownerClause(req);
  const row = req.db.prepare(
    `SELECT a.*, t.title, t.slug, t.practice_feedback, t.result_visibility, t.resume_policy,
      t.selection_mode, t.book_id, t.category_id, t.mode AS test_mode
     FROM attempts a JOIN tests t ON t.id = a.test_id
     WHERE a.id = ? AND ${owner.sql}`,
  ).get(id, ...owner.params) as AttemptRow | undefined;
  if (!row) throw notFound('Attempt not found.');
  return row;
}

function counts(db: any, attemptId: number) {
  const rows = db.prepare(
    `SELECT COALESCE(aa.selected_option_ids, '[]') AS selected_option_ids,
            COALESCE(aa.marked_for_review, 0) AS marked_for_review,
            COALESCE(aa.visited, 0) AS visited
     FROM attempt_questions aq LEFT JOIN attempt_answers aa ON aa.attempt_id = aq.attempt_id AND aa.question_id = aq.question_id
     WHERE aq.attempt_id = ?`,
  ).all(attemptId) as { selected_option_ids: string; marked_for_review: number; visited: number }[];
  let answered = 0, marked = 0, notAnswered = 0, visited = 0;
  for (const r of rows) {
    let sel: number[] = [];
    try { sel = JSON.parse(r.selected_option_ids) as number[]; } catch { sel = []; }
    if (sel.length) answered++;
    if (Number(r.marked_for_review)) marked++;
    if (Number(r.visited)) { visited++; if (!sel.length) notAnswered++; }
  }
  return { total: rows.length, answered, unanswered: rows.length - answered, marked, visited, notAnswered };
}

function publicQuestion(q: any, language: string, includeSolution = false) {
  const options = parseJson<SnapshotOption[]>(q.snapshot_options, []);
  const text = language === 'hi' && q.snapshot_hi ? q.snapshot_hi : q.snapshot_en;
  const out: Record<string, unknown> = {
    id: q.question_id,
    position: q.position,
    text,
    textEn: q.snapshot_en,
    textHi: q.snapshot_hi,
    imageUrl: q.snapshot_image_url || null,
    qtype: q.snapshot_qtype || 'single',
    marks: q.marks,
    negativeMarks: q.negative_marks,
    difficulty: q.difficulty,
    subjectName: q.subject_name,
    topicName: q.topic_name,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      text: language === 'hi' && o.text_hi ? o.text_hi : o.text_en,
      textEn: o.text_en,
      textHi: o.text_hi,
      imageUrl: o.image_url || null,
    })),
  };
  if (includeSolution) {
    out.correctOptionIds = options.filter((o) => Number(o.is_correct) === 1).map((o) => o.id);
    out.explanation = language === 'hi' && q.snapshot_explanation_hi ? q.snapshot_explanation_hi : q.snapshot_explanation_en;
  }
  return out;
}

const startSchema = z.object({
  testId: z.coerce.number().int().positive(),
  language: z.enum(['en', 'hi']).default('en'),
  subjectId: z.coerce.number().int().positive().nullable().optional(),
  topicId: z.coerce.number().int().positive().nullable().optional(),
  questionCount: z.coerce.number().int().min(1).max(200).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  mode: z.enum(['full_mock', 'subject_wise', 'topic_wise', 'practice', 'previous_year']).optional(),
  clientRequestId: z.string().min(8).max(80).optional(),
});

attemptsRouter.post('/', validateBody(startSchema), (req, res) => {
  const db = req.db;
  const { testId, language, subjectId, topicId, questionCount, durationMinutes, mode } = req.body;
  const test = db.prepare(
    `SELECT t.*, b.is_active AS book_active FROM tests t LEFT JOIN books b ON b.id = t.book_id
     WHERE t.id = ? AND t.is_published = 1 AND t.is_active = 1`,
  ).get(testId) as Record<string, any> | undefined;
  if (!test) throw notFound('Test is not available.');
  if (test.book_active === 0) throw conflict('This collection is currently unavailable.');
  if (test.scheduled_at && Date.parse(test.scheduled_at) > Date.now()) throw conflict('This test is scheduled for a future date.');
  const languages = safeLanguages(test.languages);
  if (!languages.includes(language)) throw badRequest('This language is not available for the selected test.');
  if (!req.auth.user && !isFeatureEnabled(db, 'guest_tests_enabled', config.guestTestsEnabled)) {
    throw unauthorized('Guest tests are disabled. Please sign in to continue.');
  }

  const rules = db.prepare('SELECT COUNT(*) AS c FROM test_rules WHERE test_id = ?').get(testId) as { c: number };
  if (rules.c > 0 && (subjectId || topicId)) {
    throw badRequest('This test uses a fixed subject pattern. Start it without a subject or topic filter.');
  }
  if (test.subject_id && subjectId && Number(test.subject_id) !== Number(subjectId)) throw badRequest('Subject is fixed for this test.');
  if (test.topic_id && topicId && Number(test.topic_id) !== Number(topicId)) throw badRequest('Topic is fixed for this test.');

  let count = test.question_count as number;
  if (questionCount != null) {
    if (!test.custom_count_enabled) throw badRequest('Custom question count is not enabled for this test.');
    count = questionCount;
  }
  if (rules.c > 0 && count !== test.question_count) {
    throw badRequest(`This test pattern requires exactly ${test.question_count} questions.`);
  }
  let duration = test.duration_minutes as number;
  if (durationMinutes != null) {
    if (!test.custom_duration_enabled) throw badRequest('Custom duration is not enabled for this test.');
    duration = durationMinutes;
  }

  const effectiveSubject = subjectId ?? test.subject_id ?? null;
  const effectiveTopic = topicId ?? test.topic_id ?? null;
  const effectiveMode = mode || test.mode;
  const selected = selectQuestions(db, {
    testId,
    bookId: test.book_id ?? null,
    categoryId: test.category_id ?? null,
    mode: effectiveMode,
    selectionMode: test.selection_mode,
    subjectId: effectiveSubject,
    topicId: effectiveTopic,
    count,
    language,
  });

  // Duplicate-start protection: with a clientRequestId, retrying the same POST
  // returns the original attempt instead of creating a second one.
  if (req.body.clientRequestId) {
    const prior = db.prepare('SELECT * FROM attempts WHERE client_submission_id = ?').get(`start:${req.body.clientRequestId}`) as AttemptRow | undefined;
    if (prior) {
      const own = ownerClause(req);
      const visible = db.prepare(`SELECT id FROM attempts a WHERE a.id = ? AND ${own.sql}`).get(prior.id, ...own.params);
      if (visible) {
        return send(res, { attemptId: prior.id, status: prior.status, deadlineAt: prior.deadline_at, resumed: true });
      }
      throw conflict('This start request was already used by another session.');
    }
  }

  const owner = ownerClause(req);
  const existing = db.prepare(
    `SELECT a.* FROM attempts a WHERE a.test_id = ? AND a.status = 'in_progress' AND ${owner.sql} ORDER BY a.id DESC LIMIT 1`,
  ).get(testId, ...owner.params) as AttemptRow | undefined;
  if (existing) {
    if (test.resume_policy === 'resume' && !isExpired(existing.deadline_at)) {
      return send(res, { attemptId: existing.id, status: existing.status, deadlineAt: existing.deadline_at, resumed: true });
    }
    if (test.resume_policy === 'resume') finalizeAttempt(db, existing.id, 'expired');
    else finalizeAttempt(db, existing.id, 'auto');
  }

  const startedAt = nowIso();
  const deadlineAt = isoAfter(duration * 60);
  const insertAttempt = db.prepare(
    `INSERT INTO attempts (test_id, user_id, guest_session_id, status, language, mode, subject_id, topic_id,
      question_count, marks_per_question, negative_marks, started_at, deadline_at, client_submission_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insertSnapshot = db.prepare(
    `INSERT INTO attempt_questions (attempt_id, question_id, position, marks, negative_marks,
      snapshot_en, snapshot_hi, snapshot_options, snapshot_qtype, snapshot_image_url,
      snapshot_explanation_en, snapshot_explanation_hi)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const attemptId = transaction(db, () => {
    const info = insertAttempt.run(
      testId, req.auth.user?.id ?? null, req.auth.session.id, 'in_progress', language, effectiveMode,
      effectiveSubject, effectiveTopic, count, test.marks_per_question, test.negative_marks,
      startedAt, deadlineAt, req.body.clientRequestId ? `start:${req.body.clientRequestId}` : null,
    );
    const id = Number(info.lastInsertRowid);
    selected.forEach((q, index) => {
      const row = db.prepare(
        `SELECT q.*, (SELECT json_group_array(json_object('id', o.id, 'label', o.label, 'text_en', o.text_en,
            'text_hi', o.text_hi, 'image_url', o.image_url, 'is_correct', o.is_correct))
          FROM (SELECT * FROM question_options WHERE question_id = q.id ORDER BY sort_order, label) o) AS options_json
         FROM questions q WHERE q.id = ?`,
      ).get(q.id) as Record<string, any>;
      insertSnapshot.run(
        id, q.id, index + 1, test.marks_per_question, test.negative_marks,
        row.text_en, row.text_hi, row.options_json || '[]', row.qtype || 'single', row.image_url || null,
        row.explanation_en || null, row.explanation_hi || null,
      );
    });
    return id;
  });
  audit(db, req, 'attempt.start', 'attempts', attemptId, { testId, language, count, duration });
  send(res, { attemptId, status: 'in_progress', deadlineAt, serverNow: nowIso(), remainingSeconds: remainingSeconds(deadlineAt), resumed: false }, 201);
});

attemptsRouter.post('/retry', validateBody(z.object({
  attemptId: z.coerce.number().int().positive(),
  filter: z.enum(['incorrect', 'unanswered', 'all', 'bookmarked']).default('incorrect'),
})), (req, res) => {
  const db = req.db;
  const source = getOwnedAttempt(req, req.body.attemptId);
  if (source.status === 'in_progress') throw conflict('Submit the original test before retrying its questions.');
  if (!req.auth.user && !isFeatureEnabled(db, 'guest_tests_enabled', config.guestTestsEnabled)) throw unauthorized();
  const rows = db.prepare(
    `SELECT aq.question_id, aq.snapshot_options, COALESCE(aa.selected_option_ids, '[]') AS selected_option_ids
     FROM attempt_questions aq LEFT JOIN attempt_answers aa ON aa.attempt_id = aq.attempt_id AND aa.question_id = aq.question_id
     WHERE aq.attempt_id = ? ORDER BY aq.position`,
  ).all(source.id) as any[];
  let ids: number[];
  if (req.body.filter === 'bookmarked') {
    const owner = req.auth.user ? { sql: 'user_id = ?', params: [req.auth.user.id] } : { sql: 'guest_session_id = ?', params: [req.auth.session.id] };
    const marks = db.prepare(`SELECT question_id FROM bookmarks WHERE ${owner.sql}`).all(...owner.params) as { question_id: number }[];
    const inAttempt = new Set(rows.map((r) => r.question_id));
    ids = marks.map((m) => m.question_id).filter((qid) => inAttempt.has(qid));
  } else {
    ids = rows.filter((r) => {
      let selected: number[] = [];
      try { selected = JSON.parse(r.selected_option_ids) as number[]; } catch { selected = []; }
      const outcome = scoreQuestion(r as any, selected).outcome;
      if (req.body.filter === 'incorrect') return outcome === 'incorrect';
      if (req.body.filter === 'unanswered') return outcome === 'unanswered';
      return true;
    }).map((r) => r.question_id);
  }
  ids = ids.slice(0, 50);
  if (!ids.length) throw conflict('No questions match this retry filter yet.');
  const startedAt = nowIso();
  const deadlineAt = isoAfter(15 * 60);
  const attemptId = transaction(db, () => {
    const info = db.prepare(
      `INSERT INTO attempts (test_id, user_id, guest_session_id, status, language, mode, subject_id, topic_id,
        question_count, marks_per_question, negative_marks, started_at, deadline_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(source.test_id, req.auth.user?.id ?? null, req.auth.session.id, 'in_progress', source.language,
      'practice', null, null, ids.length, source.marks_per_question, source.negative_marks, startedAt, deadlineAt);
    const id = Number(info.lastInsertRowid);
    const insert = db.prepare(
      `INSERT INTO attempt_questions (attempt_id, question_id, position, marks, negative_marks,
        snapshot_en, snapshot_hi, snapshot_options, snapshot_qtype, snapshot_image_url,
        snapshot_explanation_en, snapshot_explanation_hi)
       SELECT ?, question_id, ?, marks, negative_marks, snapshot_en, snapshot_hi, snapshot_options,
        snapshot_qtype, snapshot_image_url, snapshot_explanation_en, snapshot_explanation_hi
       FROM attempt_questions WHERE attempt_id = ? AND question_id = ?`,
    );
    ids.forEach((qid, i) => insert.run(id, i + 1, source.id, qid));
    return id;
  });
  audit(db, req, 'attempt.retry', 'attempts', attemptId, { sourceId: source.id, filter: req.body.filter, count: ids.length });
  send(res, { attemptId, questionCount: ids.length, deadlineAt, remainingSeconds: remainingSeconds(deadlineAt) }, 201);
});

attemptsRouter.get('/:id', (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('Invalid attempt id.');
  const attempt = getOwnedAttempt(req, id);
  let expired = false;
  if (attempt.status === 'in_progress' && isExpired(attempt.deadline_at)) {
    finalizeAttempt(db, id, 'expired');
    expired = true;
  }
  const fresh = getOwnedAttempt(req, id);
  const rows = db.prepare(
    `SELECT aq.*, q.difficulty, s.name AS subject_name, tp.name AS topic_name
     FROM attempt_questions aq JOIN questions q ON q.id = aq.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
     WHERE aq.attempt_id = ? ORDER BY aq.position`,
  ).all(id) as any[];
  const answers = db.prepare('SELECT * FROM attempt_answers WHERE attempt_id = ?').all(id) as any[];
  const answerMap = new Map(answers.map((a) => [a.question_id, a]));
  const statusCounts = counts(db, id);
  // Submission alone is not enough: a test configured with result_visibility
  // 'hidden' shows the score but must never leak the answer key through the
  // attempt/review payload. Keep this in sync with buildResult() in results.ts.
  const canReveal = fresh.status !== 'in_progress' && fresh.result_visibility !== 'hidden';
  const questions = rows.map((q) => {
    const a = answerMap.get(q.question_id);
    const qobj = publicQuestion(q, fresh.language, canReveal);
    return {
      ...qobj,
      selectedOptionIds: parseJson<number[]>(a?.selected_option_ids, []),
      markedForReview: Boolean(a?.marked_for_review),
      visited: Boolean(a?.visited),
      timeSpentSeconds: Number(a?.time_spent_seconds || 0),
    };
  });
  send(res, {
    attempt: {
      id: fresh.id,
      testId: fresh.test_id,
      testTitle: fresh.title,
      testSlug: fresh.slug,
      status: fresh.status,
      submitReason: fresh.submit_reason,
      language: fresh.language,
      mode: fresh.mode,
      questionCount: fresh.question_count,
      marksPerQuestion: fresh.marks_per_question,
      negativeMarks: fresh.negative_marks,
      startedAt: fresh.started_at,
      deadlineAt: fresh.deadline_at,
      submittedAt: fresh.submitted_at,
      practiceFeedback: Boolean(fresh.practice_feedback),
      resultVisibility: fresh.result_visibility,
      expired,
    },
    serverNow: nowIso(),
    remainingSeconds: remainingSeconds(fresh.deadline_at),
    statusCounts,
    questions,
  });
});

const answerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  previousQuestionId: z.coerce.number().int().positive().optional(),
  selectedOptionIds: z.array(z.coerce.number().int().positive()).max(10).optional(),
  markedForReview: z.boolean().optional(),
  clear: z.boolean().optional(),
  viewing: z.boolean().optional(),
});

attemptsRouter.put('/:id/answers', validateBody(answerSchema), (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  const attempt = getOwnedAttempt(req, id);
  if (attempt.status !== 'in_progress') throw conflict('This attempt has already been submitted.');
  if (isExpired(attempt.deadline_at)) {
    finalizeAttempt(db, id, 'expired');
    // 409 (not 429): this is a state conflict, not a rate limit. Keep the same
    // status whether expiry was detected by GET or by this write.
    throw conflict('The time limit has expired and the test was submitted automatically.');
  }
  const body = req.body;
  const qrow = db.prepare('SELECT * FROM attempt_questions WHERE attempt_id = ? AND question_id = ?').get(id, body.questionId) as any;
  if (!qrow) throw badRequest('That question is not part of this attempt.');
  const now = nowIso();

  const selected = body.clear
    ? []
    : body.selectedOptionIds !== undefined
      ? validateAnswerSelection(qrow.snapshot_options, body.selectedOptionIds, qrow.snapshot_qtype || 'single')
      : undefined;

  transaction(db, () => {
    // Close the timer for the question the student just left (server clock).
    if (body.previousQuestionId && body.previousQuestionId !== body.questionId) {
      const prev = db.prepare('SELECT time_spent_seconds, last_viewed_at FROM attempt_answers WHERE attempt_id = ? AND question_id = ?')
        .get(id, body.previousQuestionId) as { time_spent_seconds: number; last_viewed_at: string | null } | undefined;
      if (prev?.last_viewed_at) {
        const delta = Math.min(3600, Math.max(0, Math.round((Date.parse(now) - Date.parse(prev.last_viewed_at)) / 1000)));
        db.prepare('UPDATE attempt_answers SET time_spent_seconds = time_spent_seconds + ?, last_viewed_at = NULL WHERE attempt_id = ? AND question_id = ?')
          .run(delta, id, body.previousQuestionId);
      }
    }
    const existing = db.prepare('SELECT id, last_viewed_at FROM attempt_answers WHERE attempt_id = ? AND question_id = ?')
      .get(id, body.questionId) as { id: number; last_viewed_at: string | null } | undefined;
    if (!existing) {
      db.prepare(
        `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_ids, marked_for_review, visited, last_viewed_at, answered_at, updated_at)
         VALUES (?,?,?,?,1,?,?,?)`,
      ).run(id, body.questionId, JSON.stringify(selected ?? []), body.markedForReview ? 1 : 0,
        body.viewing === false ? null : now, selected && selected.length ? now : null, now);
    } else {
      db.prepare(
        `UPDATE attempt_answers SET
          selected_option_ids = COALESCE(?, selected_option_ids),
          marked_for_review = COALESCE(?, marked_for_review),
          visited = 1,
          last_viewed_at = CASE WHEN ? = 1 THEN COALESCE(last_viewed_at, ?) ELSE last_viewed_at END,
          answered_at = CASE WHEN ? IS NOT NULL THEN ? ELSE answered_at END,
          updated_at = ?
         WHERE attempt_id = ? AND question_id = ?`,
      ).run(
        selected !== undefined ? JSON.stringify(selected) : null,
        body.markedForReview !== undefined ? (body.markedForReview ? 1 : 0) : null,
        body.viewing === false ? 0 : 1, now,
        selected !== undefined ? JSON.stringify(selected) : null,
        selected !== undefined && selected.length ? now : null,
        now, id, body.questionId,
      );
    }
  });

  const result: Record<string, unknown> = { saved: true, statusCounts: counts(db, id), remainingSeconds: remainingSeconds(attempt.deadline_at) };
  if (attempt.practice_feedback && attempt.mode === 'practice' && selected !== undefined && selected.length) {
    const scored = scoreQuestion(qrow, selected);
    result.feedback = {
      correct: scored.outcome === 'correct',
      correctOptionIds: scored.correctOptionIds,
      explanation: parseJson<SnapshotOption[]>(qrow.snapshot_options, []).length
        ? (qrow.snapshot_explanation_en || null)
        : null,
    };
  }
  send(res, result);
});

attemptsRouter.post('/:id/submit', validateBody(z.object({ clientSubmissionId: z.string().min(8).max(80).optional() })), (req, res) => {
  const db = req.db;
  const id = Number(req.params.id);
  const attempt = getOwnedAttempt(req, id);
  const owner = ownerClause(req);
  // Idempotency: the same clientSubmissionId on a different attempt must not create a second result.
  if (req.body.clientSubmissionId) {
    const prior = db.prepare(`SELECT a.id FROM attempts a WHERE a.client_submission_id = ? AND ${owner.sql}`)
      .get(req.body.clientSubmissionId, ...owner.params) as { id: number } | undefined;
    if (prior && prior.id !== id) throw conflict('This submission has already been recorded.');
  }
  if (attempt.status === 'in_progress') {
    const reason = isExpired(attempt.deadline_at) ? 'expired' : 'manual';
    finalizeAttempt(db, id, reason, req.body.clientSubmissionId);
  }
  const fresh = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id) as any;
  audit(db, req, 'attempt.submit', 'attempts', id, { reason: fresh.submit_reason });
  send(res, {
    attemptId: id,
    status: fresh.status,
    submittedAt: fresh.submitted_at,
    marksObtained: fresh.marks_obtained,
    marksPossible: fresh.marks_possible,
    correctCount: fresh.correct_count,
    incorrectCount: fresh.incorrect_count,
    unansweredCount: fresh.unanswered_count,
    negativeMarks: negativeMarksForAttempt(db, id),
    accuracy: fresh.accuracy,
    percentage: fresh.percentage,
  });
});

/** Finalize attempts whose authoritative deadline has passed. */
export function expireDueAttempts(db: any): number {
  const rows = db.prepare("SELECT id FROM attempts WHERE status = 'in_progress' AND deadline_at <= ?").all(nowIso()) as { id: number }[];
  let done = 0;
  for (const row of rows) {
    try { finalizeAttempt(db, row.id, 'expired'); done++; }
    catch (err) { console.error('[expiry]', row.id, err instanceof Error ? err.message : 'unknown error'); }
  }
  return done;
}
