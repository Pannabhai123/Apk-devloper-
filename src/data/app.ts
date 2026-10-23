export const SITE = {
  title: 'RAILWAY ALP MATHEMATICS MOCK TEST',
  titleHi: 'रेलवे ALP गणित मॉक टेस्ट',
  subtitle: 'रेलवे ALP एवं अन्य प्रतियोगी परीक्षाओं की गणित तैयारी',
  subtitleEn: 'Mathematics preparation for Railway ALP and other competitive exams',
  contactEmail: 'support@example.com', // अपना वास्तविक संपर्क ईमेल यहाँ बदलें (see README)
  version: '1.0.0',
};

export const TEST_DURABILITY = 90; // minutes per test
export const QUESTIONS_PER_TEST = 60;
export const TOTAL_TESTS = 20;
export const TOTAL_QUESTIONS = 1200;

export function testDifficulty(n: number): string {
  return n <= 5 ? 'Easy to Moderate' : n <= 10 ? 'Moderate' : n <= 15 ? 'Moderate to Difficult' : 'Difficult and Advanced';
}

export function testDifficultyHi(n: number): string {
  return n <= 5 ? 'सरल से मध्यम' : n <= 10 ? 'मध्यम' : n <= 15 ? 'मध्यम से कठिन' : 'कठिन एवं उच्च स्तर';
}

export const INSTRUCTIONS: { hi: string; en: string }[] = [
  { hi: 'प्रत्येक टेस्ट में 60 प्रश्न होंगे।', en: 'Each test contains 60 questions.' },
  { hi: 'प्रत्येक टेस्ट की समय सीमा 90 मिनट होगी।', en: 'The time limit for each test is 90 minutes.' },
  { hi: 'प्रत्येक प्रश्न में चार विकल्प होंगे।', en: 'Each question has four options.' },
  { hi: 'प्रत्येक प्रश्न का केवल एक सही उत्तर होगा।', en: 'Each question has exactly one correct answer.' },
  { hi: 'सभी प्रश्नों का उत्तर देना अनिवार्य नहीं है।', en: 'Answering all questions is not compulsory.' },
  { hi: 'छात्र किसी भी प्रश्न को छोड़ सकता है।', en: 'You may skip any question.' },
  { hi: 'छात्र किसी भी प्रश्न पर वापस जा सकता है।', en: 'You can go back to any question.' },
  { hi: 'समय समाप्त होने पर टेस्ट अपने आप सबमिट हो जाएगा।', en: 'The test will auto-submit when time expires.' },
  { hi: 'सबमिट करने के बाद परिणाम प्रदर्शित होगा।', en: 'Results appear after submission.' },
  { hi: 'परिणाम में सही, गलत और बिना उत्तर वाले प्रश्न दिखेंगे।', en: 'Correct, incorrect and unanswered counts are shown.' },
  { hi: 'प्रत्येक प्रश्न का विस्तृत समाधान उपलब्ध होगा।', en: 'Detailed solutions are available for every question.' },
  { hi: 'एक बार टेस्ट सबमिट करने के बाद उत्तर नहीं बदले जा सकेंगे।', en: 'Answers cannot be changed once the test is submitted.' },
];
