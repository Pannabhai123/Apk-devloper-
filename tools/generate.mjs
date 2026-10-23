// ============================================================
// Question-bank generator — builds all 20 mock tests (1,200 questions)
// Usage:
//   node tools/generate.mjs            (all 4 batches)
//   node tools/generate.mjs --batch 1  (tests 01–05)
//   node tools/generate.mjs --batch 2  (tests 06–10)
//   node tools/generate.mjs --batch 3  (tests 11–15)
//   node tools/generate.mjs --batch 4  (tests 16–20)
// Every run re-validates the batch it produces.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, R } from './gen/core.mjs';
import { NUMBER_SYSTEM, SIMPLIFICATION, BODMAS, FRACTIONS_DECIMALS, SQUARE_CUBE_ROOTS, HCF_LCM } from './gen/topics-basic.mjs';
import { PERCENTAGE, PROFIT_LOSS, DISCOUNT, SIMPLE_INTEREST, COMPOUND_INTEREST, PARTNERSHIP, MIXTURE_ALLIGATION } from './gen/topics-commercial.mjs';
import { RATIO_PROPORTION, AVERAGE, AGE_PROBLEMS, STATISTICS } from './gen/topics-ratio.mjs';
import { TIME_WORK, PIPES_CISTERNS, TIME_SPEED_DISTANCE, TRAINS, BOAT_STREAM } from './gen/topics-rates.mjs';
import { ALGEBRA, COORDINATE_GEOMETRY } from './gen/topics-algebra.mjs';
import { GEOMETRY, MENSURATION, TRIGONOMETRY } from './gen/topics-geo.mjs';
import { DATA_INTERPRETATION } from './gen/topics-di.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const TESTS_DIR = path.join(DATA_DIR, 'tests');
const TOPICS_DIR = path.join(DATA_DIR, 'topics');

// ---------- topic registry ----------
const TOPICS = [
  { key: 'Number System', hi: 'संख्या पद्धति', slug: 'number-system', list: NUMBER_SYSTEM, perTest: 2 },
  { key: 'Simplification', hi: 'सरलीकरण', slug: 'simplification', list: SIMPLIFICATION, perTest: 2 },
  { key: 'BODMAS', hi: 'BODMAS (कोष्ठक)', slug: 'bodmas', list: BODMAS, perTest: 2 },
  { key: 'HCF and LCM', hi: 'महत्तम समापवर्तक एवं लघुत्तम समापवर्त्य', slug: 'hcf-lcm', list: HCF_LCM, perTest: 2 },
  { key: 'Percentage', hi: 'प्रतिशत', slug: 'percentage', list: PERCENTAGE, perTest: 3 },
  { key: 'Profit and Loss', hi: 'लाभ एवं हानि', slug: 'profit-loss', list: PROFIT_LOSS, perTest: 3 },
  { key: 'Discount', hi: 'छूट', slug: 'discount', list: DISCOUNT, perTest: 2 },
  { key: 'Ratio and Proportion', hi: 'अनुपात एवं समानुपात', slug: 'ratio-proportion', list: RATIO_PROPORTION, perTest: 2 },
  { key: 'Average', hi: 'औसत', slug: 'average', list: AVERAGE, perTest: 2 },
  { key: 'Simple Interest', hi: 'साधारण ब्याज', slug: 'simple-interest', list: SIMPLE_INTEREST, perTest: 2 },
  { key: 'Compound Interest', hi: 'चक्रवृद्धि ब्याज', slug: 'compound-interest', list: COMPOUND_INTEREST, perTest: 2 },
  { key: 'Time and Work', hi: 'समय एवं कार्य', slug: 'time-work', list: TIME_WORK, perTest: 2 },
  { key: 'Pipes and Cisterns', hi: 'पाइप एवं टंकी', slug: 'pipes-cisterns', list: PIPES_CISTERNS, perTest: 2 },
  { key: 'Time, Speed and Distance', hi: 'समय, चाल एवं दूरी', slug: 'time-speed-distance', list: TIME_SPEED_DISTANCE, perTest: 2 },
  { key: 'Train Problems', hi: 'रेलगाड़ी से संबंधित प्रश्न', slug: 'trains', list: TRAINS, perTest: 2 },
  { key: 'Boat and Stream', hi: 'नाव एवं धारा', slug: 'boat-stream', list: BOAT_STREAM, perTest: 2 },
  { key: 'Algebra', hi: 'बीजगणित', slug: 'algebra', list: ALGEBRA, perTest: 3 },
  { key: 'Geometry', hi: 'ज्यामिति', slug: 'geometry', list: GEOMETRY, perTest: 3 },
  { key: 'Mensuration', hi: 'क्षेत्रमिति', slug: 'mensuration', list: MENSURATION, perTest: 3 },
  { key: 'Trigonometry', hi: 'त्रिकोणमिति', slug: 'trigonometry', list: TRIGONOMETRY, perTest: 2 },
  { key: 'Data Interpretation', hi: 'आँकड़ों का विश्लेषण', slug: 'data-interpretation', list: DATA_INTERPRETATION, perTest: 2 },
  { key: 'Statistics', hi: 'सांख्यिकी', slug: 'statistics', list: STATISTICS, perTest: 2 },
  { key: 'Age Problems', hi: 'आयु संबंधी प्रश्न', slug: 'age-problems', list: AGE_PROBLEMS, perTest: 2 },
  { key: 'Mixture and Alligation', hi: 'मिश्रण', slug: 'mixture-alligation', list: MIXTURE_ALLIGATION, perTest: 2 },
  { key: 'Partnership', hi: 'साझेदारी', slug: 'partnership', list: PARTNERSHIP, perTest: 2 },
  { key: 'Fractions and Decimals', hi: 'भिन्न एवं दशमलव', slug: 'fractions-decimals', list: FRACTIONS_DECIMALS, perTest: 2 },
  { key: 'Square Roots and Cube Roots', hi: 'वर्गमूल एवं घनमूल', slug: 'square-cube-roots', list: SQUARE_CUBE_ROOTS, perTest: 2 },
  { key: 'Coordinate Geometry', hi: 'निर्देशांक ज्यामिति', slug: 'coordinate-geometry', list: COORDINATE_GEOMETRY, perTest: 1 },
];

const SLOT_SUM = TOPICS.reduce((a, t) => a + t.perTest, 0);
if (SLOT_SUM !== 60) { console.error(`FATAL: slot plan sums to ${SLOT_SUM}, expected 60`); process.exit(1); }

const DIFF_BY_TEST = (n) => (n <= 5 ? 'Easy to Moderate' : n <= 10 ? 'Moderate' : n <= 15 ? 'Moderate to Difficult' : 'Difficult and Advanced');
const LEVEL_BY_TEST = (n) => (n <= 5 ? 1 : n <= 10 ? 2 : n <= 15 ? 3 : 4);
const PREFER = { 1: ['Easy'], 2: ['Moderate', 'Easy'], 3: ['Hard', 'Moderate'], 4: ['Hard', 'Moderate'] };

// ---------- load existing question texts (cross-batch uniqueness) ----------
function loadExistingTexts(excludeTests = new Set()) {
  const texts = new Set();
  const ids = new Set();
  if (!fs.existsSync(TESTS_DIR)) return { texts, ids };
  for (const f of fs.readdirSync(TESTS_DIR).sort()) {
    if (!f.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, f), 'utf8'));
    if (excludeTests.has(data.testNumber)) continue; // own batch is being regenerated
    for (const q of data.questions) { texts.add(q.question); ids.add(q.id); }
  }
  return { texts, ids };
}

function generateTest(testNumber, existing) {
  const level = LEVEL_BY_TEST(testNumber);
  const rng = mulberry32(101203 + testNumber * 7919 + level * 104729);
  const prefer = PREFER[level];
  const questions = [];
  const usedTemplates = new Map(); // topic -> Set of template names used in this test

  for (const topic of TOPICS) {
    for (let slot = 0; slot < topic.perTest; slot++) {
      if (!usedTemplates.has(topic.key)) usedTemplates.set(topic.key, new Set());
      const used = usedTemplates.get(topic.key);
      let made = null;
      let lastErr = null;
      for (let attempt = 0; attempt < 400 && !made; attempt++) {
        // candidates: prefer unused-in-test, then prefer tier difficulty
        let candidates = topic.list.filter((t) => !used.has(t.name));
        if (candidates.length === 0) candidates = topic.list.slice();
        const ranked = candidates.slice().sort((a, b) => {
          const sa = prefer.indexOf(a.base) === -1 ? prefer.length : prefer.indexOf(a.base);
          const sb = prefer.indexOf(b.base) === -1 ? prefer.length : prefer.indexOf(b.base);
          return sa - sb;
        });
        const pool = ranked.slice(0, Math.max(1, Math.min(ranked.length, topic.perTest + 2)));
        const tpl = R.pick(rng, pool);
        try {
          const raw = tpl.fn(rng, level);
          if (!raw || existing.texts.has(raw.question)) throw new Error('duplicate text');
          made = { raw, tplName: tpl.name };
        } catch (e) { lastErr = e; }
      }
      if (!made) { console.error(`FATAL: could not generate topic "${topic.key}" slot ${slot} for test ${testNumber}: ${lastErr}`); process.exit(1); }
      used.add(made.tplName);
      questions.push({ raw: made.raw, topic });
      existing.texts.add(made.raw.question);
    }
  }

  // interleave topics (exam feel) and assign numbers
  const shuffled = R.shuffle(rng, questions);
  const nn = String(testNumber).padStart(2, '0');
  return shuffled.map((item, i) => ({
    id: `ALP-MATH-T${nn}-Q${String(i + 1).padStart(3, '0')}`,
    testNumber,
    questionNumber: i + 1,
    topic: item.topic.key,
    topicHi: item.topic.hi,
    difficulty: item.raw.difficulty,
    language: 'Hindi-English',
    question: item.raw.question,
    questionEn: item.raw.questionEn,
    options: item.raw.options,
    correctAnswer: item.raw.correctAnswer,
    solution: item.raw.solution,
    finalAnswer: item.raw.finalAnswer,
    shortcut: item.raw.shortcut || '',
    marks: 1,
  }));
}

function validateBatch(tests) {
  const errors = [];
  const allTexts = new Set();
  const allIds = new Set();
  for (const { testNumber, questions } of tests) {
    if (questions.length !== 60) errors.push(`Test ${testNumber}: ${questions.length} questions (expected 60)`);
    for (const q of questions) {
      const tag = `${q.id}`;
      if (allIds.has(q.id)) errors.push(`${tag}: duplicate ID`);
      allIds.add(q.id);
      if (allTexts.has(q.question)) errors.push(`${tag}: duplicate question text`);
      allTexts.add(q.question);
      const letters = Object.keys(q.options);
      if (letters.length !== 4 || !['A', 'B', 'C', 'D'].every((l) => letters.includes(l))) errors.push(`${tag}: options must be A-D`);
      if (new Set(letters.map((l) => q.options[l])).size !== 4) errors.push(`${tag}: duplicate option values`);
      if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) errors.push(`${tag}: bad correctAnswer`);
      if (q.options[q.correctAnswer] !== q.finalAnswer) errors.push(`${tag}: finalAnswer mismatch with correct option`);
      if (!Array.isArray(q.solution) || q.solution.length < 2) errors.push(`${tag}: solution missing/too short`);
      if (!q.question || !q.questionEn) errors.push(`${tag}: question text missing`);
      if (!q.topic || !q.topicHi) errors.push(`${tag}: topic missing`);
      if (!['Easy', 'Moderate', 'Hard'].includes(q.difficulty)) errors.push(`${tag}: bad difficulty`);
    }
  }
  return errors;
}

// ---------- main ----------
const args = process.argv.slice(2);
let batch = null;
if (args.includes('--batch')) batch = parseInt(args[args.indexOf('--batch') + 1], 10);
const batches = batch ? [batch] : [1, 2, 3, 4];
const BATCH_RANGE = { 1: [1, 5], 2: [6, 10], 3: [11, 15], 4: [16, 20] };

fs.mkdirSync(TESTS_DIR, { recursive: true });
fs.mkdirSync(TOPICS_DIR, { recursive: true });

for (const b of batches) {
  const [start, end] = BATCH_RANGE[b];
  const existing = loadExistingTexts(new Set(Array.from({ length: end - start + 1 }, (_, i) => start + i)));
  const produced = [];
  for (let t = start; t <= end; t++) {
    const questions = generateTest(t, existing);
    produced.push({ testNumber: t, questions });
    const out = {
      testNumber: t,
      title: `Mock Test ${String(t).padStart(2, '0')}`,
      difficulty: DIFF_BY_TEST(t),
      durationMinutes: 90,
      totalQuestions: 60,
      markingScheme: { correct: 1, incorrect: 0, unanswered: 0 },
      questions,
    };
    fs.writeFileSync(path.join(TESTS_DIR, `test-${String(t).padStart(2, '0')}.json`), JSON.stringify(out, null, 1));
    console.log(`Batch ${b}: test-${String(t).padStart(2, '0')}.json — 60 questions ✔`);
  }
  const errs = validateBatch(produced);
  if (errs.length) { console.error(`BATCH ${b} FAILED VALIDATION:`); errs.forEach((e) => console.error('  - ' + e)); process.exit(1); }
  console.log(`Batch ${b} validated: ${produced.length} tests × 60 = ${produced.length * 60} questions, 0 errors.`);
}

// ---------- rebuild per-topic files + index from ALL test files ----------
const allTests = fs.readdirSync(TESTS_DIR).filter((f) => /^test-\d{2}\.json$/.test(f)).sort();
const topicAgg = new Map();
let totalQ = 0;
for (const t of TOPICS) topicAgg.set(t.key, { topic: t, questions: [] });
for (const f of allTests) {
  const data = JSON.parse(fs.readFileSync(path.join(TESTS_DIR, f), 'utf8'));
  for (const q of data.questions) {
    topicAgg.get(q.topic).questions.push(q);
    totalQ++;
  }
}
for (const [, agg] of topicAgg) {
  const out = { topic: agg.topic.key, topicHi: agg.topic.hi, slug: agg.topic.slug, count: agg.questions.length, questions: agg.questions };
  fs.writeFileSync(path.join(TOPICS_DIR, `${agg.topic.slug}.json`), JSON.stringify(out, null, 1));
}
const index = {
  generatedAt: new Date().toISOString(),
  totalQuestions: totalQ,
  totalTests: allTests.length,
  questionsPerTest: 60,
  durationMinutes: 90,
  tests: allTests.map((f) => { const n = parseInt(f.match(/\d+/)[0], 10); return { testNumber: n, difficulty: DIFF_BY_TEST(n), count: 60 }; }),
  topics: [...topicAgg.values()].map((a) => ({ topic: a.topic.key, topicHi: a.topic.hi, slug: a.topic.slug, count: a.questions.length })),
};
fs.writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 1));
console.log(`\nIndex rebuilt: ${totalQ} questions across ${allTests.length} tests, ${topicAgg.size} topic files.`);
if (totalQ !== 1200 || allTests.length !== 20) console.log('NOTE: full bank not yet complete (run remaining batches).');
