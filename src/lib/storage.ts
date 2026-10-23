import type { ActiveAttempt, AttemptRecord, Bookmark, PracticeStat } from './types';

const K = {
  attempts: 'alp_attempts_v1',
  active: 'alp_active_v1',
  bookmarks: 'alp_bookmarks_v1',
  theme: 'alp_theme_v1',
  practice: 'alp_practice_v1',
  overrides: 'alp_overrides_v1',
  unpublished: 'alp_unpublished_v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode — app continues without persistence
  }
}

// ---------- attempts ----------
export function listAttempts(): AttemptRecord[] {
  return read<AttemptRecord[]>(K.attempts, []).sort((a, b) => b.submittedAt - a.submittedAt);
}
export function saveAttempt(rec: AttemptRecord): void {
  const all = read<AttemptRecord[]>(K.attempts, []);
  if (all.some((a) => a.attemptId === rec.attemptId)) return; // prevent duplicates
  all.push(rec);
  write(K.attempts, all);
}
export function getAttempt(attemptId: string): AttemptRecord | undefined {
  return read<AttemptRecord[]>(K.attempts, []).find((a) => a.attemptId === attemptId);
}
export function attemptsForTest(testNumber: number): AttemptRecord[] {
  return listAttempts().filter((a) => a.testNumber === testNumber);
}

// ---------- active attempt (live test state) ----------
export function getActive(testNumber: number): ActiveAttempt | undefined {
  const map = read<Record<string, ActiveAttempt>>(K.active, {});
  return map[String(testNumber)];
}
export function setActive(a: ActiveAttempt): void {
  const map = read<Record<string, ActiveAttempt>>(K.active, {});
  map[String(a.testNumber)] = a;
  write(K.active, map);
}
export function clearActive(testNumber: number): void {
  const map = read<Record<string, ActiveAttempt>>(K.active, {});
  delete map[String(testNumber)];
  write(K.active, map);
}

// ---------- bookmarks ----------
export function listBookmarks(): Bookmark[] {
  return read<Bookmark[]>(K.bookmarks, []).sort((a, b) => b.savedAt - a.savedAt);
}
export function isBookmarked(id: string): boolean {
  return read<Bookmark[]>(K.bookmarks, []).some((b) => b.id === id);
}
export function toggleBookmark(b: Bookmark): boolean {
  const all = read<Bookmark[]>(K.bookmarks, []);
  const i = all.findIndex((x) => x.id === b.id);
  if (i >= 0) {
    all.splice(i, 1);
    write(K.bookmarks, all);
    return false;
  }
  all.push(b);
  write(K.bookmarks, all);
  return true;
}

// ---------- practice stats (separate from mock attempts) ----------
export function getPracticeStats(): Record<string, PracticeStat> {
  return read<Record<string, PracticeStat>>(K.practice, {});
}
export function recordPractice(topic: string, correct: boolean): void {
  const s = getPracticeStats();
  const cur = s[topic] || { attempted: 0, correct: 0 };
  cur.attempted += 1;
  if (correct) cur.correct += 1;
  s[topic] = cur;
  write(K.practice, s);
}

// ---------- theme ----------
export type Theme = 'light' | 'dark';
export function getTheme(): Theme {
  const t = read<string>(K.theme, '');
  if (t === 'light' || t === 'dark') return t;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function setTheme(t: Theme): void {
  write(K.theme, t);
}

// ---------- admin local overrides ----------
export interface QuestionOverride {
  question?: string;
  questionEn?: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  solution?: string[];
  shortcut?: string;
  topic?: string;
  difficulty?: string;
}
export function getOverrides(): Record<string, QuestionOverride> {
  return read<Record<string, QuestionOverride>>(K.overrides, {});
}
export function setOverride(id: string, o: QuestionOverride): void {
  const all = getOverrides();
  all[id] = { ...all[id], ...o };
  write(K.overrides, all);
}
export function clearOverride(id: string): void {
  const all = getOverrides();
  delete all[id];
  write(K.overrides, all);
}

// ---------- unpublished tests (local admin toggle) ----------
export function getUnpublished(): number[] {
  return read<number[]>(K.unpublished, []);
}
export function setUnpublished(list: number[]): void {
  write(K.unpublished, list);
}

// ---------- reset ----------
export function resetAllData(): void {
  for (const k of [K.attempts, K.active, K.bookmarks, K.practice, K.overrides, K.unpublished]) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

/** Approximate size of stored data, for the data-management UI */
export function storageUsage(): string {
  let bytes = 0;
  for (const k of [K.attempts, K.active, K.bookmarks, K.practice, K.overrides, K.unpublished]) {
    const v = localStorage.getItem(k);
    if (v) bytes += v.length;
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
