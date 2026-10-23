/** Data-layer smoke: loaders, counts, override merge. */
import { loadTest, loadTopic, loadIndex, loadQuestionsByIds, topicHi, topicSlug, TOPIC_META } from '../src/lib/questions';
import { setOverride, clearOverride, getUnpublished, setUnpublished } from '../src/lib/storage';

let passed = 0; let failed = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

const idx = await loadIndex();
ok(idx.totalQuestions === 1200 && idx.tests.length === 20, `index: 20 tests / 1200 questions`);
ok(idx.topics.length === 28, `index: 28 topics (${idx.topics.length})`);
ok(TOPIC_META.length === 28, `TOPIC_META has 28 entries`);

for (const n of [1, 7, 14, 20]) {
  const t = await loadTest(n);
  ok(t.questions.length === 60, `loadTest(${n}): 60 questions`);
  ok(t.durationMinutes === 90, `loadTest(${n}): 90 minutes`);
  ok(t.questions.every((q) => q.testNumber === n), `loadTest(${n}): all questions carry testNumber`);
  ok(t.questions.every((q) => q.options[q.correctAnswer] === q.finalAnswer), `loadTest(${n}): correctAnswer ↔ finalAnswer consistent`);
  ok(t.questions.every((q) => q.solution.length >= 2), `loadTest(${n}): every question has ≥2 solution steps`);
}

const tf = await loadTopic('percentage');
ok(tf.questions.length === tf.count && tf.count > 0, `loadTopic('percentage'): ${tf.count} questions (== count field)`);
ok(tf.topic === 'Percentage', 'topic file topic name');

const some = await loadQuestionsByIds(['ALP-MATH-T01-Q001', 'ALP-MATH-T05-Q030', 'ALP-MATH-T20-Q060', 'NO-SUCH-ID']);
ok(some.length === 3 && some[0].id === 'ALP-MATH-T01-Q001', `loadQuestionsByIds: 3/4 found (bad id skipped)`);

// admin override merge
setOverride('ALP-MATH-T01-Q001', { question: 'CHANGED प्रश्न' });
const t1 = await loadTest(1);
ok(t1.questions[0].question === 'CHANGED प्रश्न', 'applyOverride merges localStorage edit');
ok(t1.questions[1].question !== 'CHANGED प्रश्न', 'override affects only its question');
clearOverride('ALP-MATH-T01-Q001');
const t1b = await loadTest(1);
ok(t1b.questions[0].question !== 'CHANGED प्रश्न', 'clearOverride restores original');

// unpublished tests
setUnpublished([3]);
ok(JSON.stringify(getUnpublished()) === '[3]', 'setUnpublished/getUnpublished roundtrip');
setUnpublished([]);

ok(topicHi('Percentage').length > 0, `topicHi('Percentage') = ${topicHi('Percentage')}`);
ok(topicSlug('Percentage') === 'percentage', 'topicSlug maps correctly');

console.log(`\n═══ DATA SMOKE: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) (globalThis as any).process.exitCode = 1;
