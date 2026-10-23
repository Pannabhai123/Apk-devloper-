import type { BankIndex, Letter, Question, TestFile, TopicFile } from './types';
import { getOverrides } from './storage';

/** Lazy loaders — each test / topic JSON becomes its own small network chunk. */
export async function loadTest(n: number): Promise<TestFile> {
  const mod = await import(`../data/tests/test-${String(n).padStart(2, '0')}.json`);
  const data = mod.default as TestFile;
  // never mutate the (cached) module object — build a fresh view with overrides applied
  return { ...data, questions: data.questions.map(applyOverride) };
}

export async function loadTopic(slug: string): Promise<TopicFile> {
  const mod = await import(`../data/topics/${slug}.json`);
  const data = mod.default as TopicFile;
  return { ...data, questions: data.questions.map(applyOverride) };
}

export async function loadIndex(): Promise<BankIndex> {
  const mod = await import('../data/index.json');
  return mod.default as BankIndex;
}

/** Admin local overrides (browser-only) are merged on load. */
function applyOverride(q: Question): Question {
  const o = getOverrides()[q.id];
  if (!o) return q;
  return {
    ...q,
    question: o.question ?? q.question,
    questionEn: o.questionEn ?? q.questionEn,
    options: (o.options as Question['options']) ?? q.options,
    correctAnswer: (o.correctAnswer as Letter) ?? q.correctAnswer,
    solution: o.solution ?? q.solution,
    shortcut: o.shortcut ?? q.shortcut,
    topic: o.topic ?? q.topic,
    difficulty: (o.difficulty as Question['difficulty']) ?? q.difficulty,
  };
}

/** Load a set of questions by id from their topic files (used by revision & bookmarks). */
export async function loadQuestionsByIds(ids: string[]): Promise<Question[]> {
  const idx = await loadIndex();
  const byTopic = new Map<string, string[]>();
  for (const id of ids) {
    // id format: ALP-MATH-T01-Q001 → test number encoded; find topic via index topics
    for (const t of idx.topics) {
      byTopic.set(t.slug, byTopic.get(t.slug) || []);
    }
  }
  // We don't know topics from ids alone cheaply — load all topic files lazily in parallel
  const topics = await Promise.all(idx.topics.map((t) => loadTopic(t.slug).catch(() => null)));
  const pool = new Map<string, Question>();
  for (const tf of topics) {
    if (!tf) continue;
    for (const q of tf.questions) pool.set(q.id, q);
  }
  return ids.map((id) => pool.get(id)).filter((q): q is Question => Boolean(q));
}

export const TOPIC_META = [
  { topic: 'Number System', hi: 'संख्या पद्धति', slug: 'number-system' },
  { topic: 'Simplification', hi: 'सरलीकरण', slug: 'simplification' },
  { topic: 'BODMAS', hi: 'BODMAS (कोष्ठक)', slug: 'bodmas' },
  { topic: 'HCF and LCM', hi: 'महत्तम समापवर्तक एवं लघुत्तम समापवर्त्य', slug: 'hcf-lcm' },
  { topic: 'Percentage', hi: 'प्रतिशत', slug: 'percentage' },
  { topic: 'Profit and Loss', hi: 'लाभ एवं हानि', slug: 'profit-loss' },
  { topic: 'Discount', hi: 'छूट', slug: 'discount' },
  { topic: 'Ratio and Proportion', hi: 'अनुपात एवं समानुपात', slug: 'ratio-proportion' },
  { topic: 'Average', hi: 'औसत', slug: 'average' },
  { topic: 'Simple Interest', hi: 'साधारण ब्याज', slug: 'simple-interest' },
  { topic: 'Compound Interest', hi: 'चक्रवृद्धि ब्याज', slug: 'compound-interest' },
  { topic: 'Time and Work', hi: 'समय एवं कार्य', slug: 'time-work' },
  { topic: 'Pipes and Cisterns', hi: 'पाइप एवं टंकी', slug: 'pipes-cisterns' },
  { topic: 'Time, Speed and Distance', hi: 'समय, चाल एवं दूरी', slug: 'time-speed-distance' },
  { topic: 'Train Problems', hi: 'रेलगाड़ी से संबंधित प्रश्न', slug: 'trains' },
  { topic: 'Boat and Stream', hi: 'नाव एवं धारा', slug: 'boat-stream' },
  { topic: 'Algebra', hi: 'बीजगणित', slug: 'algebra' },
  { topic: 'Geometry', hi: 'ज्यामिति', slug: 'geometry' },
  { topic: 'Mensuration', hi: 'क्षेत्रमिति', slug: 'mensuration' },
  { topic: 'Trigonometry', hi: 'त्रिकोणमिति', slug: 'trigonometry' },
  { topic: 'Data Interpretation', hi: 'आँकड़ों का विश्लेषण', slug: 'data-interpretation' },
  { topic: 'Statistics', hi: 'सांख्यिकी', slug: 'statistics' },
  { topic: 'Age Problems', hi: 'आयु संबंधी प्रश्न', slug: 'age-problems' },
  { topic: 'Mixture and Alligation', hi: 'मिश्रण', slug: 'mixture-alligation' },
  { topic: 'Partnership', hi: 'साझेदारी', slug: 'partnership' },
  { topic: 'Fractions and Decimals', hi: 'भिन्न एवं दशमलव', slug: 'fractions-decimals' },
  { topic: 'Square Roots and Cube Roots', hi: 'वर्गमूल एवं घनमूल', slug: 'square-cube-roots' },
  { topic: 'Coordinate Geometry', hi: 'निर्देशांक ज्यामिति', slug: 'coordinate-geometry' },
];

export function topicHi(topic: string): string {
  return TOPIC_META.find((t) => t.topic === topic)?.hi ?? topic;
}
export function topicSlug(topic: string): string {
  return TOPIC_META.find((t) => t.topic === topic)?.slug ?? topic;
}
