import { describe, expect, it } from 'vitest';
import { aggregateTotals, paletteStatus, scoreQuestion, validateAnswerSelection, round2 } from '../src/lib/scoring.js';
import { isExpired, isoAfter, remainingSeconds, contentHash, slugify, paginate } from '../src/db.js';

const snapshot = (correctIds: number[], marks = 1, negative = 0.25) => ({
  marks,
  negative_marks: negative,
  snapshot_options: JSON.stringify([
    { id: 11, label: 'A', text_en: 'Alpha', text_hi: null, image_url: null, is_correct: correctIds.includes(11) ? 1 : 0 },
    { id: 12, label: 'B', text_en: 'Beta', text_hi: null, image_url: null, is_correct: correctIds.includes(12) ? 1 : 0 },
    { id: 13, label: 'C', text_en: 'Gamma', text_hi: null, image_url: null, is_correct: correctIds.includes(13) ? 1 : 0 },
    { id: 14, label: 'D', text_en: 'Delta', text_hi: null, image_url: null, is_correct: correctIds.includes(14) ? 1 : 0 },
  ]),
});

describe('scoreQuestion', () => {
  it('awards full marks for a correct single answer', () => {
    expect(scoreQuestion(snapshot([12]), [12])).toEqual({ outcome: 'correct', marks: 1, correctOptionIds: [12] });
  });

  it('applies negative marking for an incorrect answer', () => {
    const r = scoreQuestion(snapshot([12]), [11]);
    expect(r.outcome).toBe('incorrect');
    expect(r.marks).toBe(-0.25);
  });

  it('scores unanswered questions as zero', () => {
    expect(scoreQuestion(snapshot([12]), [])).toEqual({ outcome: 'unanswered', marks: 0, correctOptionIds: [12] });
  });

  it('supports all-or-nothing multiple-correct questions', () => {
    expect(scoreQuestion(snapshot([11, 13]), [11, 13]).outcome).toBe('correct');
    expect(scoreQuestion(snapshot([11, 13]), [11]).outcome).toBe('incorrect');
  });

  it('refuses to score a question with no configured key', () => {
    expect(() => scoreQuestion(snapshot([]), [11])).toThrow(/no correct answer/);
  });
});

describe('aggregateTotals', () => {
  it('computes totals, accuracy and percentage from stored rows', () => {
    const rows = [
      { ...snapshot([11]), selected_option_ids: '[11]' },   // correct +1
      { ...snapshot([12]), selected_option_ids: '[11]' },   // incorrect -0.25
      { ...snapshot([13]), selected_option_ids: '[]' },     // unanswered 0
      { ...snapshot([14]), selected_option_ids: '[14]' },   // correct +1
    ];
    const t = aggregateTotals(rows);
    expect(t.questionCount).toBe(4);
    expect(t.attemptedCount).toBe(3);
    expect(t.correctCount).toBe(2);
    expect(t.incorrectCount).toBe(1);
    expect(t.unansweredCount).toBe(1);
    expect(t.marksPossible).toBe(4);
    expect(t.marksObtained).toBe(1.75);
    expect(t.negativeMarks).toBe(0.25);
    expect(t.accuracy).toBe(66.67);
    expect(t.percentage).toBe(43.75);
  });

  it('never reports a negative percentage when negative marking exceeds correct marks', () => {
    const rows = [
      { ...snapshot([12], 1, 4), selected_option_ids: '[11]' },
      { ...snapshot([12], 1, 4), selected_option_ids: '[12]' },
    ];
    expect(aggregateTotals(rows).percentage).toBe(0);
  });

  it('reports zero accuracy when nothing was attempted', () => {
    const t = aggregateTotals([{ ...snapshot([11]), selected_option_ids: '[]' }]);
    expect(t.accuracy).toBe(0);
    expect(t.attemptedCount).toBe(0);
  });

  it('rounds to two decimals', () => {
    expect(round2(1 / 3 * 100)).toBe(33.33);
  });
});

describe('validateAnswerSelection', () => {
  const single = snapshot([11]).snapshot_options;
  it('rejects more than one option for single-answer questions', () => {
    expect(() => validateAnswerSelection(single, [11, 12], 'single')).toThrow(/only one answer/);
  });
  it('rejects duplicate ids', () => {
    expect(() => validateAnswerSelection(single, [11, 11], 'multiple')).toThrow(/Duplicate/);
  });
  it('rejects ids that do not belong to the question', () => {
    expect(() => validateAnswerSelection(single, [999], 'single')).toThrow(/do not belong/);
  });
  it('accepts multiple ids for multiple-correct questions', () => {
    expect(validateAnswerSelection(single, [11, 12], 'multiple')).toEqual([11, 12]);
  });
});

describe('question palette state machine', () => {
  it('prioritises the current question', () => {
    expect(paletteStatus({ visited: true, answered: true, marked: true }, true)).toBe('current');
  });
  it('distinguishes all six documented states', () => {
    expect(paletteStatus({ visited: false, answered: false, marked: false }, false)).toBe('not_visited');
    expect(paletteStatus({ visited: true, answered: false, marked: false }, false)).toBe('not_answered');
    expect(paletteStatus({ visited: true, answered: true, marked: false }, false)).toBe('answered');
    expect(paletteStatus({ visited: true, answered: false, marked: true }, false)).toBe('marked');
    expect(paletteStatus({ visited: true, answered: true, marked: true }, false)).toBe('answered_marked');
  });
});

describe('timer deadline calculations', () => {
  it('derives remaining seconds from an absolute deadline', () => {
    const now = Date.parse('2026-10-24T10:00:00.000Z');
    const deadline = new Date(now + 90_000).toISOString();
    expect(remainingSeconds(deadline, now)).toBe(90);
    expect(remainingSeconds(deadline, now + 30_000)).toBe(60);
    expect(remainingSeconds(deadline, now + 120_000)).toBe(0);
  });

  it('detects expiry without a decrementing counter', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = isoAfter(120);
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
  });
});

describe('content helpers', () => {
  it('normalises whitespace, punctuation and case for duplicate detection', () => {
    expect(contentHash([' The SI unit? ', 'Newton'])).toBe(contentHash(['the si unit', ' newton ']));
  });
  it('slugifies unicode and spaces', () => {
    expect(slugify('Bihar Special GK!')).toBe('bihar-special-gk');
  });
  it('clamps pagination values', () => {
    expect(paginate('-4', '10000')).toEqual({ page: 1, limit: 200, offset: 0 });
    expect(paginate('3', '20')).toEqual({ page: 3, limit: 20, offset: 40 });
  });
});
