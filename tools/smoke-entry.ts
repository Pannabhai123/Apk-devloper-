/**
 * Functional smoke test of core logic (run via tools/smoke.mjs).
 * Bundles with esbuild, executes in Node with a localStorage shim.
 */
import { computeResult, buildAttemptRecord, remainingSeconds, fmtHMS, fmtMinutes, fmtDate, topicPerformance } from '../src/lib/scoring';
import { saveAttempt, getAttempt, attemptsForTest, listAttempts, setActive, getActive, clearActive, toggleBookmark, isBookmarked, listBookmarks, resetAllData } from '../src/lib/storage';

let passed = 0; let failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

// ---------- build 60 fake questions across 3 topics ----------
function mkQ(n: number, topic: string): any {
  return {
    id: `ALP-MATH-T01-Q${String(n).padStart(3, '0')}`,
    testNumber: 1, questionNumber: n, topic, topicHi: topic, difficulty: 'Easy',
    question: `प्रश्न ${n}`, questionEn: `Q ${n}`,
    options: { A: '1', B: '2', C: '3', D: '4' }, correctAnswer: 'A',
    solution: ['चरण 1', 'चरण 2'], finalAnswer: '1', marks: 1,
  };
}
const qs = Array.from({ length: 60 }, (_, i) => mkQ(i + 1, i < 20 ? 'Percentage' : i < 40 ? 'Algebra' : 'Mensuration'));

// answers: 40 correct (Q1–40), 10 wrong (Q41–50), 10 blank (Q51–60)
const answers: Record<number, any> = {};
for (let i = 1; i <= 40; i++) answers[i] = 'A';
for (let i = 41; i <= 50; i++) answers[i] = 'C';

const startedAt = Date.now() - 60_000; // 1 minute ago
const active = { testNumber: 1, startedAt, durationSec: 5400, negativeMarking: false, negValue: 0, answers, marked: [5, 41], visited: Array.from({ length: 50 }, (_, i) => i + 1) };

console.log('\n[1] computeResult — default marking');
const r1 = computeResult(qs, active as any);
ok(r1.correct === 40, `correct = 40 (got ${r1.correct})`);
ok(r1.incorrect === 10, `incorrect = 10 (got ${r1.incorrect})`);
ok(r1.attempted === 50, `attempted = 50 (got ${r1.attempted})`);
ok(r1.unanswered === 10, `unanswered = 10 (got ${r1.unanswered})`);
ok(r1.score === 40, `score = 40 without negative marking (got ${r1.score})`);
ok(r1.accuracy === 80, `accuracy = 80% (got ${r1.accuracy})`);
ok(r1.topicStats['Percentage'].correct === 20 && r1.topicStats['Percentage'].total === 20, 'topic stats: Percentage 20/20');

console.log('\n[2] computeResult — negative marking −1/3');
const r2 = computeResult(qs, { ...active, negativeMarking: true, negValue: 1 / 3 } as any);
ok(r2.score === Math.round((40 - 10 / 3) * 100) / 100, `score = 36.67 (got ${r2.score})`);
ok(r2.accuracy === 80, `accuracy unchanged = 80 (got ${r2.accuracy})`);

console.log('\n[3] accuracy zero-guard');
const r3 = computeResult(qs, { ...active, answers: {} } as any);
ok(r3.attempted === 0 && r3.accuracy === 0 && r3.score === 0, 'no answers → 0 attempted, 0% accuracy, 0 score');

console.log('\n[4] timer helpers');
const rem = remainingSeconds(active as any, startedAt + 120_000);
ok(rem === 5280, `remaining after 2 min = 5280s (got ${rem})`);
ok(remainingSeconds({ ...active, startedAt: startedAt - 5400_000 } as any, startedAt) === 0, 'expired → 0');
ok(fmtHMS(5400) === '01:30:00', `fmtHMS(5400) = 01:30:00 (got ${fmtHMS(5400)})`);
ok(fmtHMS(0) === '00:00:00', 'fmtHMS(0) = 00:00:00');
ok(fmtHMS(3665) === '01:01:05', `fmtHMS(3665) = 01:01:05 (got ${fmtHMS(3665)})`);
ok(fmtHMS(59) === '00:00:59', `fmtHMS(59) = 00:00:59 (got ${fmtHMS(59)})`);
ok(fmtMinutes(5400) === '90 मिनट', `fmtMinutes(5400s) = '90 मिनट' (got ${fmtMinutes(5400)})`);
ok(/\d{2}:\d{2}/.test(fmtDate(startedAt)), 'fmtDate returns HH:MM stamp');

console.log('\n[5] buildAttemptRecord');
const rec = buildAttemptRecord(qs, active as any);
ok(rec.attemptId === `T01-${startedAt}`, `attemptId = T01-${startedAt} (got ${rec.attemptId})`);
ok(rec.timeTakenSec <= 61 && rec.timeTakenSec >= 59, `timeTaken ≈ 60s (got ${rec.timeTakenSec})`);
ok(rec.marked.length === 2 && rec.marked.includes(5), 'marked carried over');
ok(rec.testNumber === 1 && rec.score === 40, 'record carries test + score');

console.log('\n[6] storage roundtrip');
saveAttempt(rec as any);
const got = getAttempt(rec.attemptId);
ok(!!got && got.score === 40, 'saveAttempt → getAttempt roundtrip');
ok(attemptsForTest(1).length === 1, 'attemptsForTest(1) = 1');
const same = buildAttemptRecord(qs, active as any);
saveAttempt(same as any); // same attemptId — must dedupe, not duplicate
ok(attemptsForTest(1).length === 1, 'duplicate attemptId deduped');
const active2 = { ...active, startedAt: startedAt + 5000 };
saveAttempt(buildAttemptRecord(qs, active2 as any) as any); // retake = new record
ok(attemptsForTest(1).length === 2, 'retake creates NEW record (2 records)');
ok(listAttempts()[0].attemptId === `T01-${active2.startedAt}`, 'listAttempts newest-first');

console.log('\n[7] active attempt persistence');
setActive({ ...active, startedAt: 123 } as any);
ok(getActive(1)?.startedAt === 123, 'setActive → getActive');
clearActive(1);
ok(getActive(1) === undefined || getActive(1) === null, 'clearActive removes');

console.log('\n[8] bookmarks');
toggleBookmark({ id: 'ALP-MATH-T01-Q001', testNumber: 1, questionNumber: 1, topic: 'Percentage', topicHi: 'प्रतिशत' } as any);
ok(isBookmarked('ALP-MATH-T01-Q001'), 'toggleBookmark → isBookmarked true');
toggleBookmark({ id: 'ALP-MATH-T01-Q001', testNumber: 1, questionNumber: 1, topic: 'Percentage', topicHi: 'प्रतिशत' } as any);
ok(!isBookmarked('ALP-MATH-T01-Q001'), 'toggle again → unbookmarked');
ok(listBookmarks().length === 0, 'bookmark list empty after untoggle');

console.log('\n[9] topic performance classification');
const tp = topicPerformance(rec.topicStats as any);
ok(tp.strong.some((s: any) => s.topic === 'Percentage'), 'Percentage (100%) classified strong');
ok(tp.weak.some((s: any) => s.topic === 'Mensuration'), 'Mensuration (0%) classified weak');
ok(!tp.weak.some((s: any) => s.topic === 'Percentage'), 'strong topic not in weak');

console.log('\n[10] resetAllData');
resetAllData();
ok(listAttempts().length === 0, 'resetAllData clears attempts');

console.log(`\n═══ SMOKE RESULT: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) (globalThis as any).process.exitCode = 1;
