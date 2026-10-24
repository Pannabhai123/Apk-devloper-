import type { DB } from '../db.js';
import { badRequest, conflict } from './http.js';

export interface SnapshotOption {
  id: number;
  label: string;
  text_en: string;
  text_hi: string | null;
  image_url: string | null;
  is_correct: number;
}

export type AnswerOutcome = 'correct' | 'incorrect' | 'unanswered';

export interface QuestionScore {
  outcome: AnswerOutcome;
  marks: number;
  correctOptionIds: number[];
}

/**
 * Score one question from the *stored* attempt snapshot and answer.
 * Multi-correct questions are all-or-nothing (no partial credit).
 */
export function scoreQuestion(
  snapshot: { marks: number; negative_marks: number; snapshot_options: string },
  selectedOptionIds: number[],
): QuestionScore {
  const options = JSON.parse(snapshot.snapshot_options) as SnapshotOption[];
  const correctOptionIds = options.filter((o) => Number(o.is_correct) === 1).map((o) => o.id);
  if (correctOptionIds.length === 0) {
    throw new Error('Question has no correct answer configured.');
  }
  if (!selectedOptionIds || selectedOptionIds.length === 0) {
    return { outcome: 'unanswered', marks: 0, correctOptionIds };
  }
  const selected = new Set(selectedOptionIds);
  const isCorrect =
    selected.size === correctOptionIds.length && correctOptionIds.every((id) => selected.has(id));
  return {
    outcome: isCorrect ? 'correct' : 'incorrect',
    marks: isCorrect ? snapshot.marks : -Math.abs(snapshot.negative_marks),
    correctOptionIds,
  };
}

export interface AttemptTotals {
  questionCount: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  marksPossible: number;
  marksObtained: number;
  negativeMarks: number;
  accuracy: number;
  percentage: number;
}

export function aggregateTotals(
  rows: { marks: number; negative_marks: number; snapshot_options: string; selected_option_ids: string }[],
): AttemptTotals {
  let attempted = 0;
  let correct = 0;
  let incorrect = 0;
  let possible = 0;
  let obtained = 0;
  let negative = 0;
  for (const row of rows) {
    possible += row.marks;
    let selected: number[] = [];
    try {
      selected = JSON.parse(row.selected_option_ids || '[]') as number[];
    } catch {
      selected = [];
    }
    const scored = scoreQuestion(row, selected);
    if (scored.outcome === 'correct') {
      correct++;
      attempted++;
    } else if (scored.outcome === 'incorrect') {
      incorrect++;
      attempted++;
      negative += Math.abs(scored.marks);
    }
    obtained += scored.marks;
  }
  const questionCount = rows.length;
  return {
    questionCount,
    attemptedCount: attempted,
    correctCount: correct,
    incorrectCount: incorrect,
    unansweredCount: questionCount - attempted,
    marksPossible: round2(possible),
    marksObtained: round2(obtained),
    negativeMarks: round2(negative),
    accuracy: attempted === 0 ? 0 : round2((correct / attempted) * 100),
    percentage: possible === 0 ? 0 : round2(Math.max(0, (obtained / possible) * 100)),
  };
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateAnswerSelection(
  snapshotOptionsRaw: string,
  selectedOptionIds: unknown,
  qtype: 'single' | 'multiple',
): number[] {
  if (!Array.isArray(selectedOptionIds) || selectedOptionIds.some((v) => !Number.isInteger(v))) {
    throw badRequest('Answer must be an array of option ids.');
  }
  const ids = selectedOptionIds as number[];
  if (new Set(ids).size !== ids.length) throw badRequest('Duplicate option ids are not allowed.');
  if (qtype === 'single' && ids.length > 1) throw badRequest('This question allows only one answer.');
  const options = JSON.parse(snapshotOptionsRaw) as SnapshotOption[];
  const valid = new Set(options.map((o) => o.id));
  for (const id of ids) if (!valid.has(id)) throw badRequest('One or more selected options do not belong to this question.');
  return ids;
}

export interface PaletteState {
  visited: boolean;
  answered: boolean;
  marked: boolean;
}

/** Pure state machine used by both API responses and the question palette UI. */
export function paletteStatus(s: PaletteState, isCurrent: boolean): string {
  if (isCurrent) return 'current';
  if (s.answered && s.marked) return 'answered_marked';
  if (s.marked) return 'marked';
  if (s.answered) return 'answered';
  if (s.visited) return 'not_answered';
  return 'not_visited';
}

/** Finalize an attempt exactly once. Safe to call repeatedly (idempotent). */
export function finalizeAttempt(
  db: DB,
  attemptId: number,
  reason: 'manual' | 'expired' | 'auto',
  clientSubmissionId?: string | null,
): AttemptTotals {
  const finalize = db.transaction(() => {
    const attempt = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as
      | { id: number; status: string; started_at: string; deadline_at: string; question_count: number; client_submission_id: string | null }
      | undefined;
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status !== 'in_progress') {
      return readTotals(db, attemptId);
    }
    const rows = db
      .prepare(
        `SELECT q.marks, q.negative_marks, q.snapshot_options,
                COALESCE(a.selected_option_ids, '[]') AS selected_option_ids
         FROM attempt_questions q
         LEFT JOIN attempt_answers a ON a.attempt_id = q.attempt_id AND a.question_id = q.question_id
         WHERE q.attempt_id = ? ORDER BY q.position`,
      )
      .all(attemptId) as { marks: number; negative_marks: number; snapshot_options: string; selected_option_ids: string }[];
    if (rows.length === 0) throw new Error('Attempt has no questions; refusing to finalize an empty test.');
    if (rows.length !== attempt.question_count) throw new Error('Attempt question snapshot is incomplete.');

    const totals = aggregateTotals(rows);
    if (reason === 'manual' && clientSubmissionId) {
      const taken = db
        .prepare('SELECT id FROM attempts WHERE client_submission_id = ? AND id <> ?')
        .get(clientSubmissionId, attemptId);
      if (taken) throw conflict('This submission was already processed.');
    }
    const submittedAt = new Date().toISOString();
    const started = Date.parse(attempt.started_at);
    const end = reason === 'expired' ? Date.parse(attempt.deadline_at) : Date.now();
    const timeTaken = Math.max(0, Math.min(Math.round((end - started) / 1000), Math.round((Date.parse(attempt.deadline_at) - started) / 1000)));
    db.prepare(
      `UPDATE attempts SET status = ?, submitted_at = ?, submit_reason = ?, time_taken_seconds = ?,
        marks_possible = ?, marks_obtained = ?, correct_count = ?, incorrect_count = ?,
        unanswered_count = ?, attempted_count = ?, accuracy = ?, percentage = ?,
        client_submission_id = COALESCE(?, client_submission_id)
       WHERE id = ? AND status = 'in_progress'`,
    ).run(
      reason === 'expired' ? 'expired' : 'submitted',
      submittedAt,
      reason,
      timeTaken,
      totals.marksPossible,
      totals.marksObtained,
      totals.correctCount,
      totals.incorrectCount,
      totals.unansweredCount,
      totals.attemptedCount,
      totals.accuracy,
      totals.percentage,
      clientSubmissionId ?? null,
      attemptId,
    );
    return totals;
  });
  return finalize();
}

function readTotals(db: DB, attemptId: number): AttemptTotals {
  const a = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as Record<string, number> | undefined;
  if (!a) throw new Error('Attempt not found');
  return {
    questionCount: a.question_count,
    attemptedCount: a.attempted_count,
    correctCount: a.correct_count,
    incorrectCount: a.incorrect_count,
    unansweredCount: a.unanswered_count,
    marksPossible: a.marks_possible,
    marksObtained: a.marks_obtained,
    negativeMarks: 0,
    accuracy: a.accuracy,
    percentage: a.percentage,
  };
}

/** Recompute negative marks for display from stored rows. */
export function negativeMarksForAttempt(db: DB, attemptId: number): number {
  const rows = db
    .prepare(
      `SELECT q.negative_marks, COALESCE(a.selected_option_ids, '[]') AS selected_option_ids, q.snapshot_options
       FROM attempt_questions q LEFT JOIN attempt_answers a ON a.attempt_id = q.attempt_id AND a.question_id = q.question_id
       WHERE q.attempt_id = ?`,
    )
    .all(attemptId) as { negative_marks: number; selected_option_ids: string; snapshot_options: string }[];
  let total = 0;
  for (const row of rows) {
    let selected: number[] = [];
    try { selected = JSON.parse(row.selected_option_ids) as number[]; } catch { selected = []; }
    if (selected.length && scoreQuestion({ ...row, marks: 1 }, selected).outcome === 'incorrect') {
      total += Math.abs(row.negative_marks);
    }
  }
  return round2(total);
}
