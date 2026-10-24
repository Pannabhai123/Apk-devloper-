import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { paginate, parseJson } from '../db.js';
import { badRequest, forbidden, notFound, send, unauthorized } from '../lib/http.js';
import { negativeMarksForAttempt, scoreQuestion, type SnapshotOption } from '../lib/scoring.js';
import { validateBody } from '../lib/validate.js';
import { getOwnedAttempt } from './attempts.js';

export const resultsRouter = Router();

function ownerWhere(req: Express.Request) {
  if (req.auth.user) return { sql: '(user_id = ? OR guest_session_id = ?)', params: [req.auth.user.id, req.auth.session.id] as (number | null)[] };
  return { sql: 'guest_session_id = ?', params: [req.auth.session.id] as (number | null)[] };
}

resultsRouter.get('/', (req, res) => {
  const db = req.db;
  const { page, limit, offset } = paginate(req.query.page, req.query.limit);
  const owner = ownerWhere(req);
  const where = `a.status IN ('submitted','expired') AND ${owner.sql}`;
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM attempts a WHERE ${where}`).get(...owner.params) as { c: number }).c;
  const rows = db.prepare(
    `SELECT a.id, a.status, a.submitted_at, a.submit_reason, a.time_taken_seconds, a.question_count,
      a.marks_obtained, a.marks_possible, a.correct_count, a.incorrect_count, a.unanswered_count,
      a.attempted_count, a.accuracy, a.percentage, a.language, t.title AS test_title, t.slug AS test_slug,
      b.slug AS book_slug
     FROM attempts a JOIN tests t ON t.id = a.test_id LEFT JOIN books b ON b.id = t.book_id
     WHERE ${where} ORDER BY COALESCE(a.submitted_at, a.started_at) DESC LIMIT ? OFFSET ?`,
  ).all(...owner.params, limit, offset);
  send(res, rows, 200, { page, limit, total, pages: Math.ceil(total / limit) });
});

export function buildResult(db: any, attemptId: number) {
  const attempt = db.prepare(
    `SELECT a.*, t.title AS test_title, t.slug AS test_slug, t.result_visibility, t.practice_feedback, t.mode,
      b.title AS book_title, b.slug AS book_slug
     FROM attempts a JOIN tests t ON t.id = a.test_id LEFT JOIN books b ON b.id = t.book_id WHERE a.id = ?`,
  ).get(attemptId) as Record<string, any> | undefined;
  if (!attempt) throw notFound('Result not found.');
  if (attempt.status === 'in_progress') throw forbidden('This test has not been submitted yet.');
  const rows = db.prepare(
    `SELECT aq.*, aa.selected_option_ids, aa.marked_for_review, aa.time_spent_seconds,
      s.name AS subject_name, tp.name AS topic_name
     FROM attempt_questions aq
     LEFT JOIN attempt_answers aa ON aa.attempt_id = aq.attempt_id AND aa.question_id = aq.question_id
     LEFT JOIN questions q ON q.id = aq.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
     WHERE aq.attempt_id = ? ORDER BY aq.position`,
  ).all(attemptId) as any[];
  const reveal = attempt.result_visibility !== 'hidden';
  const review = rows.map((row) => {
    const selected = parseJson<number[]>(row.selected_option_ids, []);
    const scored = scoreQuestion(row, selected);
    const options = parseJson<SnapshotOption[]>(row.snapshot_options, []);
    return {
      position: row.position,
      questionId: row.question_id,
      text: attempt.language === 'hi' && row.snapshot_hi ? row.snapshot_hi : row.snapshot_en,
      imageUrl: row.snapshot_image_url || null,
      subjectName: row.subject_name,
      topicName: row.topic_name,
      marks: row.marks,
      negativeMarks: row.negative_marks,
      outcome: scored.outcome,
      marksAwarded: scored.marks,
      timeSpentSeconds: Number(row.time_spent_seconds || 0),
      markedForReview: Boolean(row.marked_for_review),
      selectedOptionIds: selected,
      options: options.map((o) => ({ id: o.id, label: o.label, text: attempt.language === 'hi' && o.text_hi ? o.text_hi : o.text_en, imageUrl: o.image_url || null })),
      ...(reveal ? {
        correctOptionIds: scored.correctOptionIds,
        explanation: attempt.language === 'hi' && row.snapshot_explanation_hi ? row.snapshot_explanation_hi : row.snapshot_explanation_en,
      } : {}),
    };
  });
  const negative = negativeMarksForAttempt(db, attemptId);
  const totalTime = Number(attempt.time_taken_seconds || 0);
  return {
    attempt: {
      id: attempt.id,
      testId: attempt.test_id,
      testTitle: attempt.test_title,
      testSlug: attempt.test_slug,
      bookTitle: attempt.book_title,
      bookSlug: attempt.book_slug,
      status: attempt.status,
      submitReason: attempt.submit_reason,
      language: attempt.language,
      mode: attempt.mode,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      deadlineAt: attempt.deadline_at,
      resultVisibility: attempt.result_visibility,
      practiceFeedback: Boolean(attempt.practice_feedback),
    },
    summary: {
      totalQuestions: attempt.question_count,
      attempted: attempt.attempted_count,
      correct: attempt.correct_count,
      incorrect: attempt.incorrect_count,
      unanswered: attempt.unanswered_count,
      marksPossible: attempt.marks_possible,
      marksObtained: attempt.marks_obtained,
      negativeMarks: negative,
      accuracy: attempt.accuracy,
      percentage: attempt.percentage,
      timeTakenSeconds: totalTime,
      averageSecondsPerQuestion: attempt.question_count ? Math.round(totalTime / attempt.question_count) : 0,
    },
    answersRevealed: reveal,
    review,
  };
}

resultsRouter.get('/:attemptId', (req, res) => {
  const attemptId = Number(req.params.attemptId);
  if (!Number.isInteger(attemptId)) throw badRequest('Invalid result id.');
  getOwnedAttempt(req, attemptId); // authorization + ownership
  send(res, buildResult(req.db, attemptId));
});

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * PDFKit does not do automatic font fallback. DejaVu Sans covers Latin but has
 * no Devanagari glyphs, so a bundled OFL-licensed Noto Sans Devanagari TTF is
 * used for Hindi reports. Licensed content is never guessed/transliterated.
 */
function fontPath(language = 'en'): string | null {
  const latin = [
    path.join(here, 'assets', 'DejaVuSans.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  ];
  const devanagari = [
    path.join(here, 'assets', 'NotoSansDevanagari-Regular.ttf'),
    path.join(here, '..', '..', 'server', 'assets', 'NotoSansDevanagari-Regular.ttf'),
    path.resolve(process.cwd(), 'server/assets/NotoSansDevanagari-Regular.ttf'),
  ];
  const candidates = language === 'hi' ? [...devanagari, ...latin] : latin;
  return candidates.find((p) => fs.existsSync(p)) || null;
}

resultsRouter.get('/:attemptId/pdf', (req, res) => {
  const attemptId = Number(req.params.attemptId);
  getOwnedAttempt(req, attemptId);
  const result = buildResult(req.db, attemptId);
  const s = result.summary;
  const font = fontPath(result.attempt.language);
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="vidyapariksha-result-${attemptId}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  if (font) doc.registerFont('Body', font);
  const F = font ? 'Body' : 'Helvetica';
  const ascii = (v: unknown) => (font ? String(v ?? '') : String(v ?? '').replace(/[^\x20-\x7E\n]/g, '?'));
  doc.font(F).fontSize(18).fillColor('#0B4FA8').text('VidyaPariksha — Result Report');
  doc.moveDown(0.4).fontSize(12).fillColor('#172033').text(ascii(result.attempt.testTitle));
  doc.fontSize(9).fillColor('#64748B').text(`Attempt #${attemptId}  •  ${result.attempt.submittedAt || result.attempt.startedAt}`);
  doc.moveDown(0.8);
  doc.fontSize(12).fillColor('#172033').text('Summary');
  doc.moveDown(0.3).fontSize(10);
  const lines = [
    `Total questions: ${s.totalQuestions}`,
    `Attempted: ${s.attempted}    Correct: ${s.correct}    Incorrect: ${s.incorrect}    Unanswered: ${s.unanswered}`,
    `Marks obtained: ${s.marksObtained} / ${s.marksPossible}    Negative marks: ${s.negativeMarks}`,
    `Accuracy: ${s.accuracy}%    Final percentage: ${s.percentage}%`,
    `Time taken: ${Math.floor(s.timeTakenSeconds / 60)} min ${s.timeTakenSeconds % 60} sec    Avg/question: ${s.averageSecondsPerQuestion} sec`,
  ];
  lines.forEach((l) => doc.text(ascii(l)));
  doc.moveDown(0.9).fontSize(12).text('Question Review');
  doc.moveDown(0.3);
  for (const item of result.review) {
    if (doc.y > 730) doc.addPage();
    doc.fontSize(10).fillColor('#172033').text(ascii(`Q${item.position}. ${item.text}`));
    doc.fontSize(9).fillColor('#475569');
    for (const o of item.options) {
      const mark = item.selectedOptionIds.includes(o.id) ? '>' : ' ';
      const correct = result.answersRevealed && item.correctOptionIds?.includes(o.id) ? ' [correct]' : '';
      doc.text(ascii(`   ${mark} ${o.label}. ${o.text}${correct}`));
    }
    const label = item.outcome === 'correct' ? 'Correct' : item.outcome === 'incorrect' ? 'Incorrect' : 'Unanswered';
    doc.fillColor(item.outcome === 'correct' ? '#16A34A' : item.outcome === 'incorrect' ? '#DC2626' : '#64748B')
      .text(ascii(`${label}   |   Marks: ${item.marksAwarded}   |   Time: ${item.timeSpentSeconds}s`));
    if (result.answersRevealed && item.explanation) doc.fillColor('#334155').text(ascii(`Explanation: ${item.explanation}`));
    doc.moveDown(0.5);
  }
  doc.moveDown(0.6).fontSize(8).fillColor('#94A3B8')
    .text(ascii('Generated by VidyaPariksha from stored attempt records. Demo questions are original practice content.'));
  doc.end();
});

// ── Analytics ──────────────────────────────────────────────────────────────
export const analyticsRouter = Router();

function attemptScope(req: Express.Request) {
  if (req.auth.user) return { sql: 'a.user_id = ?', params: [req.auth.user.id] as number[] };
  return { sql: 'a.guest_session_id = ?', params: [req.auth.session.id] as number[] };
}

export function computeAnalytics(db: any, scope: { sql: string; params: number[] }) {
  const where = `a.status IN ('submitted','expired') AND ${scope.sql}`;
  const base = db.prepare(
    `SELECT a.id, a.submitted_at, a.started_at, a.time_taken_seconds, a.question_count, a.marks_obtained,
      a.marks_possible, a.correct_count, a.incorrect_count, a.unanswered_count, a.attempted_count,
      a.accuracy, a.percentage, t.title AS test_title, t.slug AS test_slug
     FROM attempts a JOIN tests t ON t.id = a.test_id WHERE ${where}
     ORDER BY COALESCE(a.submitted_at, a.started_at) DESC`,
  ).all(...scope.params) as any[];
  const totalAttempts = base.length;
  const sum = (key: string) => base.reduce((acc, r) => acc + Number(r[key] || 0), 0);
  const totalCorrect = sum('correct_count');
  const totalIncorrect = sum('incorrect_count');
  const totalAnswered = totalCorrect + totalIncorrect;
  const totalQuestions = sum('question_count');
  const totalTime = sum('time_taken_seconds');
  const percentages = base.map((r) => Number(r.percentage || 0));
  const bestScore = totalAttempts ? Math.max(...percentages) : 0;
  const averageScore = totalAttempts ? Math.round((percentages.reduce((a, b) => a + b, 0) / totalAttempts) * 100) / 100 : 0;
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 10000) / 100 : 0;

  // Portable per-subject / per-topic aggregation computed from stored snapshots.
  const detailRows = db.prepare(
    `SELECT aq.attempt_id, aq.question_id, aq.snapshot_options, aq.marks, aq.negative_marks,
      COALESCE(aa.selected_option_ids, '[]') AS selected_option_ids,
      s.name AS subject_name, s.slug AS subject_slug, tp.name AS topic_name, tp.slug AS topic_slug
     FROM attempt_questions aq
     JOIN attempts a ON a.id = aq.attempt_id
     JOIN questions q ON q.id = aq.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
     LEFT JOIN attempt_answers aa ON aa.attempt_id = aq.attempt_id AND aa.question_id = aq.question_id
     WHERE ${where}`,
  ).all(...scope.params) as any[];

  const group = (key: 'subject' | 'topic') => {
    const map = new Map<string, { name: string; slug: string; questions: number; correct: number; attempted: number; incorrect: number }>();
    for (const r of detailRows) {
      const name = key === 'subject' ? r.subject_name : r.topic_name;
      const slug = key === 'subject' ? r.subject_slug : r.topic_slug;
      if (!name) continue;
      const entry = map.get(name) || { name, slug, questions: 0, correct: 0, attempted: 0, incorrect: 0 };
      entry.questions++;
      let selected: number[] = [];
      try { selected = JSON.parse(r.selected_option_ids) as number[]; } catch { selected = []; }
      if (selected.length) {
        entry.attempted++;
        const outcome = scoreQuestion(r, selected).outcome;
        if (outcome === 'correct') entry.correct++;
        else entry.incorrect++;
      }
      map.set(name, entry);
    }
    return [...map.values()].map((e) => ({ ...e, accuracy: e.attempted ? Math.round((e.correct / e.attempted) * 10000) / 100 : 0 }))
      .sort((a, b) => b.questions - a.questions);
  };
  const subjectPerformance = group('subject');
  const topicPerformance = group('topic');

  const misses = new Map<number, { questionId: number; count: number; text: string; topic: string | null }>();
  for (const r of detailRows) {
    let selected: number[] = [];
    try { selected = JSON.parse(r.selected_option_ids) as number[]; } catch { selected = []; }
    if (!selected.length) continue;
    if (scoreQuestion(r, selected).outcome === 'incorrect') {
      const entry = misses.get(r.question_id) || { questionId: r.question_id, count: 0, text: String(r.snapshot_en || '').slice(0, 160), topic: r.topic_name };
      entry.count++;
      misses.set(r.question_id, entry);
    }
  }
  const repeatedMistakes = [...misses.values()].filter((m) => m.count > 1).sort((a, b) => b.count - a.count).slice(0, 10);

  const progression = [...base].reverse().slice(-20).map((r, i) => ({
    index: i + 1, attemptId: r.id, label: new Date(r.submitted_at || r.started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    score: Number(r.percentage || 0), accuracy: Number(r.accuracy || 0), timeTaken: Number(r.time_taken_seconds || 0),
    testTitle: r.test_title,
  }));
  const days = new Set(base.map((r) => String(r.submitted_at || r.started_at).slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const todayQuestions = detailRows.filter((r) => String(base.find((b) => b.id === r.attempt_id)?.submitted_at || '').slice(0, 10) === today).length;

  const recommendations: string[] = [];
  if (totalAttempts >= 3) {
    const weak = [...subjectPerformance].filter((s) => s.attempted >= 3).sort((a, b) => a.accuracy - b.accuracy)[0];
    const strong = [...subjectPerformance].filter((s) => s.attempted >= 3).sort((a, b) => b.accuracy - a.accuracy)[0];
    if (weak && strong && weak.name !== strong.name && strong.accuracy - weak.accuracy >= 15) {
      recommendations.push(`Your accuracy in ${strong.name} (${strong.accuracy}%) is higher than in ${weak.name} (${weak.accuracy}%). Try more ${weak.name} topic-wise tests.`);
    }
    if (repeatedMistakes.length) recommendations.push(`You have repeated mistakes on ${repeatedMistakes.length} question(s). Review the explanations in your revision list.`);
    const lastThree = progression.slice(-3);
    if (lastThree.length === 3 && lastThree.every((p) => p.score > 0)) {
      const delta = lastThree[2].score - lastThree[0].score;
      if (delta > 5) recommendations.push('Your recent scores are trending upward. Keep the same practice cadence.');
      else if (delta < -5) recommendations.push('Your recent scores dipped. Revisit earlier topic-wise practice before more full mocks.');
    }
  }
  return {
    summary: {
      totalAttempts, totalQuestions, totalCorrect, totalIncorrect,
      totalAnswered, totalUnanswered: Math.max(0, totalQuestions - totalAnswered),
      bestScore, averageScore, overallAccuracy, totalPracticeSeconds: totalTime,
      totalPracticeMinutes: Math.round(totalTime / 60), streakDays: streak, todayQuestions,
    },
    progression, subjectPerformance, topicPerformance, repeatedMistakes,
    recentResults: base.slice(0, 8), recommendations,
    hasEnoughData: totalAttempts >= 3,
  };
}

analyticsRouter.get('/overview', (req, res) => {
  const scope = attemptScope(req);
  const data = computeAnalytics(req.db, scope);
  const goal = req.auth.user?.daily_goal_questions || 0;
  send(res, { ...data, dailyGoal: goal, goalProgress: goal ? Math.min(100, Math.round((data.summary.todayQuestions / goal) * 100)) : null });
});

// ── Bookmarks, revision & question reports ────────────────────────────────
export const practiceRouter = Router();

practiceRouter.get('/bookmarks', (req, res) => {
  const db = req.db;
  const owner = req.auth.user
    ? { sql: 'b.user_id = ?', params: [req.auth.user.id] }
    : { sql: 'b.guest_session_id = ?', params: [req.auth.session.id] };
  const rows = db.prepare(
    `SELECT b.id, b.note, b.source, b.created_at, q.id AS question_id, q.text_en, q.text_hi, q.difficulty,
      s.name AS subject_name, tp.name AS topic_name
     FROM bookmarks b JOIN questions q ON q.id = b.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
     WHERE ${owner.sql} ORDER BY b.created_at DESC LIMIT 200`,
  ).all(...owner.params);
  send(res, rows);
});

practiceRouter.post('/bookmarks', validateBody(z.object({
  questionId: z.coerce.number().int().positive(),
  note: z.string().trim().max(500).optional().default(''),
  attemptId: z.coerce.number().int().positive().optional(),
})), (req, res) => {
  const db = req.db;
  const { questionId, note, attemptId } = req.body;
  if (!db.prepare("SELECT id FROM questions WHERE id = ? AND status = 'published'").get(questionId)) throw notFound('Question not found.');
  if (attemptId) getOwnedAttempt(req, attemptId);
  const userId = req.auth.user?.id ?? null;
  const guestId = req.auth.user ? null : req.auth.session.id;
  const existing = db.prepare('SELECT id FROM bookmarks WHERE question_id = ? AND user_id IS ? AND guest_session_id IS ?')
    .get(questionId, userId, guestId) as { id: number } | undefined;
  if (existing) return send(res, { id: existing.id, alreadySaved: true });
  const info = db.prepare('INSERT INTO bookmarks (user_id, guest_session_id, question_id, note, source, attempt_id) VALUES (?,?,?,?,?,?)')
    .run(userId, guestId, questionId, note, attemptId ? 'revision' : 'manual', attemptId ?? null);
  send(res, { id: Number(info.lastInsertRowid), alreadySaved: false }, 201);
});

practiceRouter.delete('/bookmarks/:id', (req, res) => {
  const db = req.db;
  const owner = req.auth.user
    ? { sql: 'user_id = ?', params: [req.auth.user.id] }
    : { sql: 'guest_session_id = ?', params: [req.auth.session.id] };
  const result = db.prepare(`DELETE FROM bookmarks WHERE id = ? AND ${owner.sql}`).run(Number(req.params.id), ...owner.params);
  if (!result.changes) throw notFound('Bookmark not found.');
  send(res, { deleted: true });
});

practiceRouter.get('/revision', (req, res) => {
  const db = req.db;
  const scope = attemptScope(req);
  const rows = db.prepare(
    `SELECT aq.question_id, aq.snapshot_options, aq.marks, aq.negative_marks,
      COALESCE(aa.selected_option_ids, '[]') AS selected_option_ids,
      q.text_en, q.text_hi, q.difficulty, q.explanation_en,
      s.name AS subject_name, tp.name AS topic_name,
      COALESCE(a.submitted_at, a.started_at) AS occurred_at
     FROM attempt_questions aq
     JOIN attempts a ON a.id = aq.attempt_id
     JOIN questions q ON q.id = aq.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
     LEFT JOIN attempt_answers aa ON aa.attempt_id = aq.attempt_id AND aa.question_id = aq.question_id
     WHERE ${scope.sql} AND a.status IN ('submitted','expired')`,
  ).all(...scope.params) as any[];
  const grouped = new Map<number, any>();
  for (const r of rows) {
    let selected: number[] = [];
    try { selected = JSON.parse(r.selected_option_ids) as number[]; } catch { selected = []; }
    const outcome = scoreQuestion(r, selected).outcome;
    if (outcome === 'correct') continue;
    const entry = grouped.get(r.question_id) || {
      questionId: r.question_id, textEn: r.text_en, textHi: r.text_hi, difficulty: r.difficulty,
      explanation: r.explanation_en, subjectName: r.subject_name, topicName: r.topic_name,
      wrongCount: 0, unansweredCount: 0, lastWrongAt: r.occurred_at,
    };
    if (outcome === 'incorrect') entry.wrongCount++;
    else entry.unansweredCount++;
    if (String(r.occurred_at) > String(entry.lastWrongAt)) entry.lastWrongAt = r.occurred_at;
    grouped.set(r.question_id, entry);
  }
  const questions = [...grouped.values()].sort((a, b) => b.wrongCount - a.wrongCount || String(b.lastWrongAt).localeCompare(String(a.lastWrongAt))).slice(0, 100);
  const owner = req.auth.user ? { sql: 'b.user_id = ?', params: [req.auth.user.id] } : { sql: 'b.guest_session_id = ?', params: [req.auth.session.id] };
  const saved = db.prepare(
    `SELECT q.id AS question_id, q.text_en, q.text_hi, q.difficulty, s.name AS subject_name, tp.name AS topic_name, b.id AS bookmark_id, b.note
     FROM bookmarks b JOIN questions q ON q.id = b.question_id
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
     WHERE ${owner.sql} ORDER BY b.created_at DESC LIMIT 100`,
  ).all(...owner.params);
  send(res, { incorrectCount: questions.filter((q) => q.wrongCount > 0).length, saved, questions });
});

practiceRouter.post('/question-reports', validateBody(z.object({
  questionId: z.coerce.number().int().positive(),
  reason: z.enum(['wrong_key', 'typo', 'broken_image', 'ambiguous', 'other']),
  details: z.string().trim().min(5).max(1000),
  attemptId: z.coerce.number().int().positive().optional(),
})), (req, res) => {
  const db = req.db;
  if (!db.prepare('SELECT id FROM questions WHERE id = ?').get(req.body.questionId)) throw notFound('Question not found.');
  if (req.body.attemptId) getOwnedAttempt(req, req.body.attemptId);
  const info = db.prepare(
    `INSERT INTO question_reports (question_id, user_id, guest_session_id, reason, details) VALUES (?,?,?,?,?)`,
  ).run(req.body.questionId, req.auth.user?.id ?? null, req.auth.user ? null : req.auth.session.id, req.body.reason, req.body.details);
  send(res, { id: Number(info.lastInsertRowid), status: 'open' }, 201);
});
