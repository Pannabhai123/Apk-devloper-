export type Letter = 'A' | 'B' | 'C' | 'D';
export type Difficulty = 'Easy' | 'Moderate' | 'Hard';

export interface Question {
  id: string;
  testNumber: number;
  questionNumber: number;
  topic: string;
  topicHi: string;
  difficulty: Difficulty;
  language: string;
  question: string;
  questionEn: string;
  options: Record<Letter, string>;
  correctAnswer: Letter;
  solution: string[];
  finalAnswer: string;
  shortcut: string;
  marks: number;
}

export interface TestFile {
  testNumber: number;
  title: string;
  difficulty: string;
  durationMinutes: number;
  totalQuestions: number;
  markingScheme: { correct: number; incorrect: number; unanswered: number };
  questions: Question[];
}

export interface TopicFile {
  topic: string;
  topicHi: string;
  slug: string;
  count: number;
  questions: Question[];
}

export interface BankIndex {
  totalQuestions: number;
  totalTests: number;
  questionsPerTest: number;
  durationMinutes: number;
  tests: { testNumber: number; difficulty: string; count: number }[];
  topics: { topic: string; topicHi: string; slug: string; count: number }[];
}

/** State of a live (in-progress) attempt, persisted so refreshes never lose data */
export interface ActiveAttempt {
  testNumber: number;
  startedAt: number; // epoch ms — timer is derived from this, refresh-safe
  durationSec: number;
  negativeMarking: boolean;
  negValue: number; // e.g. 0.3333 for −1/3
  answers: Record<number, Letter>; // questionNumber -> selected option
  marked: number[]; // marked-for-review question numbers
  visited: number[]; // seen question numbers
}

export interface TopicStat {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
}

/** Immutable record of a submitted attempt */
export interface AttemptRecord {
  attemptId: string;
  testNumber: number;
  startedAt: number;
  submittedAt: number;
  durationSec: number;
  timeTakenSec: number;
  negativeMarking: boolean;
  negValue: number;
  answers: Record<number, Letter>;
  marked: number[];
  correct: number;
  incorrect: number;
  attempted: number;
  unanswered: number;
  score: number;
  accuracy: number;
  topicStats: Record<string, TopicStat>;
}

export interface Bookmark {
  id: string;
  testNumber: number;
  questionNumber: number;
  topic: string;
  topicHi: string;
  savedAt: number;
}

export interface PracticeStat {
  attempted: number;
  correct: number;
}
