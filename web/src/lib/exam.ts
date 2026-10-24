export type PaletteState = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked' | 'current';

export function paletteStatus(question: { visited: boolean; selectedOptionIds: number[]; markedForReview: boolean }, isCurrent: boolean): PaletteState {
  if (isCurrent) return 'current';
  const answered = question.selectedOptionIds.length > 0;
  if (answered && question.markedForReview) return 'answered_marked';
  if (question.markedForReview) return 'marked';
  if (answered) return 'answered';
  if (question.visited) return 'not_answered';
  return 'not_visited';
}

export const PALETTE_LABELS: Record<PaletteState, string> = {
  not_visited: 'Not visited',
  not_answered: 'Not answered',
  answered: 'Answered',
  marked: 'Marked for review',
  answered_marked: 'Answered & marked',
  current: 'Current question',
};

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function deadlineRemaining(deadlineIso: string, serverOffsetMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineIso) - (now + serverOffsetMs)) / 1000));
}
