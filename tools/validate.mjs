// ============================================================
// Independent validator — reads the generated JSON files from disk
// and verifies every structural & consistency requirement:
//   1. exactly 20 test files, each with exactly 60 questions
//   2. total = 1200 questions
//   3. every question has exactly 4 distinct options (A–D)
//   4. exactly one correct answer letter, valid & present
//   5. every question has a multi-step solution & final answer
//   6. finalAnswer matches the correct option text
//   7. all IDs unique, correctly formatted
//   8. no duplicate question text anywhere in the bank
//   9. topic / difficulty / language fields valid
//  10. per-topic files and index are consistent with test files
//  11. numeric spot-check: options that parse as numbers must have
//      exactly one option equal to finalAnswer's numeric core
// Exit code 1 on any failure.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'src', 'data', 'tests');
const TOPICS_DIR = path.join(ROOT, 'src', 'data', 'topics');

const errors = [];
const warn = [];
const push = (m) => errors.push(m);

// ---- tests ----
const files = fs.existsSync(TESTS_DIR) ? fs.readdirSync(TESTS_DIR).filter((f) => /^test-\d{2}\.json$/.test(f)).sort() : [];
if (files.length !== 20) push(`expected 20 test files, found ${files.length}`);

const ids = new Set();
const texts = new Set();
const perTopic = {};
let total = 0;
const numbersSeen = new Set();

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, f), 'utf8'));
  const t = data.testNumber;
  if (numbersSeen.has(t)) push(`${f}: duplicate testNumber ${t}`);
  numbersSeen.add(t);
  if (data.durationMinutes !== 90) push(`${f}: duration must be 90`);
  if (!Array.isArray(data.questions) || data.questions.length !== 60) { push(`${f}: must contain exactly 60 questions (found ${data.questions?.length})`); continue; }
  if (!data.difficulty) push(`${f}: missing difficulty label`);
  data.questions.forEach((q, i) => {
    const tag = `${f} Q${i + 1}`;
    if (q.questionNumber !== i + 1) push(`${tag}: questionNumber out of order`);
    const expectedId = `ALP-MATH-T${String(t).padStart(2, '0')}-Q${String(i + 1).padStart(3, '0')}`;
    if (q.id !== expectedId) push(`${tag}: id should be ${expectedId}, got ${q.id}`);
    if (ids.has(q.id)) push(`${tag}: duplicate id ${q.id}`);
    ids.add(q.id);
    const textKey = q.question.replace(/\s+/g, ' ').trim();
    if (texts.has(textKey)) push(`${tag}: duplicate question text`);
    texts.add(textKey);
    const optKeys = Object.keys(q.options || {});
    if (optKeys.length !== 4 || !['A', 'B', 'C', 'D'].every((k) => optKeys.includes(k))) push(`${tag}: options must be exactly A,B,C,D`);
    const vals = Object.values(q.options || {});
    if (new Set(vals).size !== 4) push(`${tag}: duplicate option values: ${vals.join(' | ')}`);
    if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) push(`${tag}: invalid correctAnswer ${q.correctAnswer}`);
    else if (q.options[q.correctAnswer] !== q.finalAnswer) push(`${tag}: finalAnswer "${q.finalAnswer}" ≠ correct option "${q.options[q.correctAnswer]}"`);
    if (!Array.isArray(q.solution) || q.solution.length < 2) push(`${tag}: solution must have ≥2 steps`);
    if (q.solution && q.solution.some((s) => typeof s !== 'string' || s.trim() === '')) push(`${tag}: empty solution step`);
    if (!q.question || !q.question.trim()) push(`${tag}: empty question`);
    if (!q.questionEn || !q.questionEn.trim()) push(`${tag}: empty English question`);
    if (!q.topic) push(`${tag}: missing topic`);
    if (!q.topicHi) push(`${tag}: missing Hindi topic name`);
    if (!['Easy', 'Moderate', 'Hard'].includes(q.difficulty)) push(`${tag}: invalid difficulty "${q.difficulty}"`);
    if (q.marks !== 1) push(`${tag}: marks must be 1`);
    // numeric spot-check: normalize each option to a pure numeric value when possible
    const numericVal = (s) => {
      let t = String(s)
        .replace(/₹|,/g, '')
        .replace(/किमी\/घंटा|मी\/से|मिनट|घंटे|दिन|वर्ष|मीटर|सेमी|वर्ग सेमी|वर्ग मीटर|वर्ग इकाई|घन सेमी|इकाई|सेकंड|लीटर|किग्रा|रन|°|%/g, '')
        .replace(/[−]/g, '-')
        .replace(/\s+/g, '')
        .trim();
      if (t.includes('√') || /[क-हa-zA-Z]/.test(t)) return null; // surds / words: not comparable
      const fm = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
      if (fm) return parseFloat(fm[1]) / parseFloat(fm[2]);
      if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
      return null;
    };
    const numeric = vals.map(numericVal);
    const target = numericVal(q.finalAnswer);
    if (target !== null && numeric.every((n) => n !== null)) {
      const matches = numeric.filter((n) => Math.abs(n - target) < 1e-9);
      if (matches.length !== 1) push(`${tag}: numeric answer ambiguity — ${matches.length} options match finalAnswer (${vals.join(' | ')})`);
    }
    perTopic[q.topic] = (perTopic[q.topic] || 0) + 1;
    total++;
  });
}

if (total !== 1200) push(`total questions = ${total}, expected 1200`);

// ---- topic files ----
if (fs.existsSync(TOPICS_DIR)) {
  const tfiles = fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json'));
  const topicTotal = new Map();
  for (const f of tfiles) {
    const data = JSON.parse(fs.readFileSync(path.join(TOPICS_DIR, f), 'utf8'));
    if (!Array.isArray(data.questions)) { push(`topic/${f}: missing questions array`); continue; }
    for (const q of data.questions) {
      if (!ids.has(q.id)) push(`topic/${f}: unknown question id ${q.id}`);
      topicTotal.set(q.topic, (topicTotal.get(q.topic) || 0) + 1);
    }
    if (topicTotal.get(data.topic) !== data.count) push(`topic/${f}: count mismatch`);
  }
  for (const [topic, n] of Object.entries(perTopic)) {
    if ((topicTotal.get(topic) || 0) !== n) push(`topic "${topic}": test files have ${n} but topic file has ${topicTotal.get(topic) || 0}`);
  }
} else warn.push('no topics directory found');

// ---- index ----
const idxPath = path.join(ROOT, 'src', 'data', 'index.json');
if (fs.existsSync(idxPath)) {
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  if (idx.totalQuestions !== total) push(`index.totalQuestions = ${idx.totalQuestions}, actual ${total}`);
  if (idx.tests?.length !== files.length) push('index.tests length mismatch');
} else warn.push('no index.json found');

// ---- report ----
console.log('================ VALIDATION REPORT ================');
console.log(`Test files:          ${files.length} / 20`);
console.log(`Total questions:     ${total} / 1200`);
console.log(`Unique IDs:          ${ids.size}`);
console.log(`Unique question text:${texts.size}`);
console.log(`Topics covered:      ${Object.keys(perTopic).length}`);
console.log('Per-topic counts:');
for (const [t, n] of Object.entries(perTopic).sort((a, b) => b[1] - a[1])) console.log(`   ${t.padEnd(26)} ${n}`);
if (warn.length) { console.log('\nWarnings:'); warn.forEach((w) => console.log('  ~ ' + w)); }
if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 60).forEach((e) => console.error('  ✗ ' + e));
  if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
  process.exit(1);
}
console.log('\n✔ ALL CHECKS PASSED');
