import type { ActiveAttempt, AttemptRecord, Letter, Question, TopicStat } from './types';

export interface ScoreResult {
  correct: number;
  incorrect: number;
  attempted: number;
  unanswered: number;
  score: number;
  accuracy: number;
  topicStats: Record<string, TopicStat>;
}

/** Compute the full result from questions + selected answers. Pure function. */
export function computeResult(questions: Question[], active: ActiveAttempt): ScoreResult {
  const answers = active.answers || {};
  let correct = 0, incorrect = 0, attempted = 0;
  const topicStats: Record<string, TopicStat> = {};

  for (const q of questions) {
    const ts = (topicStats[q.topic] = topicStats[q.topic] || { total: 0, correct: 0, incorrect: 0, unanswered: 0 });
    ts.total += 1;
    const sel = answers[q.questionNumber] as Letter | undefined;
    if (!sel) {
      ts.unanswered += 1;
    } else {
      attempted += 1;
      if (sel === q.correctAnswer) { correct += 1; ts.correct += 1; }
      else { incorrect += 1; ts.incorrect += 1; }
    }
  }

  const unanswered = questions.length - attempted;
  let score = correct; // +1 per correct
  if (active.negativeMarking) score = correct - incorrect * active.negValue;
  score = Math.round(score * 100) / 100;

  const accuracy = attempted === 0 ? 0 : (correct / attempted) * 100;

  return {
    correct, incorrect, attempted, unanswered,
    score,
    accuracy: Math.round(accuracy * 100) / 100,
    topicStats,
  };
}

export function buildAttemptRecord(questions: Question[], active: ActiveAttempt): AttemptRecord {
  const r = computeResult(questions, active);
  const now = Date.now();
  const elapsedSec = Math.min(Math.floor((now - active.startedAt) / 1000), active.durationSec);
  return {
    attemptId: `T${String(active.testNumber).padStart(2, '0')}-${active.startedAt}`,
    testNumber: active.testNumber,
    startedAt: active.startedAt,
    submittedAt: now,
    durationSec: active.durationSec,
    timeTakenSec: Math.max(0, elapsedSec),
    negativeMarking: active.negativeMarking,
    negValue: active.negValue,
    answers: { ...active.answers },
    marked: [...active.marked],
    ...r,
  };
}

export function remainingSeconds(active: ActiveAttempt, now = Date.now()): number {
  return Math.max(0, active.durationSec - Math.floor((now - active.startedAt) / 1000));
}

export function fmtHMS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((x) => String(x).padStart(2, '0')).join(':');
}

export function fmtMinutes(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  return `${m} मिनट`;
}

export function fmtDate(epoch: number): string {
  return new Date(epoch).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** strong / weak topics from a result */
export function topicPerformance(topicStats: Record<string, TopicStat>) {
  const rows = Object.entries(topicStats)
    .map(([topic, s]) => ({ topic, acc: s.correct + s.incorrect > 0 ? (s.correct / (s.correct + s.incorrect)) * 100 : -1, ...s }))
    .filter((r) => r.total > 0);
  const strong = rows.filter((r) => r.acc >= 75).sort((a, b) => b.acc - a.acc);
  const weak = rows.filter((r) => r.acc >= 0 && r.acc < 50).sort((a, b) => a.acc - b.acc);
  const skipped = rows.filter((r) => r.acc < 0);
  return { strong, weak, skipped };
}
