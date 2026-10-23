import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import { getAttempt } from '../lib/storage';
import { loadTest } from '../lib/questions';
import type { AttemptRecord, Letter, Question, TestFile } from '../lib/types';

type Filter = 'all' | 'correct' | 'incorrect' | 'unanswered' | 'marked';

export default function Solutions() {
  const { attemptId } = useParams();
  const [rec, setRec] = useState<AttemptRecord | null | undefined>(undefined);
  const [test, setTest] = useState<TestFile | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [err, setErr] = useState('');

  useEffect(() => { setRec(getAttempt(attemptId || '')); }, [attemptId]);
  useEffect(() => {
    if (rec) loadTest(rec.testNumber).then(setTest).catch(() => setErr('प्रश्न लोड नहीं हो सका।'));
  }, [rec]);

  const filtered = useMemo(() => {
    if (!rec || !test) return [] as { q: Question; sel?: Letter }[];
    const marked = new Set(rec.marked);
    return test.questions
      .map((q) => ({ q, sel: rec.answers[q.questionNumber] }))
      .filter(({ q, sel }) => {
        if (filter === 'correct') return sel === q.correctAnswer;
        if (filter === 'incorrect') return sel !== undefined && sel !== q.correctAnswer;
        if (filter === 'unanswered') return sel === undefined;
        if (filter === 'marked') return marked.has(q.questionNumber);
        return true;
      });
  }, [rec, test, filter]);

  if (rec === undefined) return <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />;
  if (rec === null || err) {
    return (
      <div className="card center">
        <div className="empty-state"><div className="icon">🔍</div>{err || 'परिणाम नहीं मिला।'}</div>
        <Link to="/progress" className="btn btn-navy">मेरे परिणाम →</Link>
      </div>
    );
  }
  if (!test) return <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />;

  const counts = {
    all: test.questions.length,
    correct: test.questions.filter((q) => rec.answers[q.questionNumber] === q.correctAnswer).length,
    incorrect: test.questions.filter((q) => { const s = rec.answers[q.questionNumber]; return s !== undefined && s !== q.correctAnswer; }).length,
    unanswered: test.questions.filter((q) => rec.answers[q.questionNumber] === undefined).length,
    marked: rec.marked.length,
  };

  return (
    <>
      <div className="section-title">
        <h2>विस्तृत समाधान / Detailed Solutions</h2>
      </div>
      <div className="info-notice mb">
        Mock Test {String(rec.testNumber).padStart(2, '0')} • प्रयास: {rec.attemptId} • स्कोर: {rec.score}/60 • सटीकता: {rec.accuracy}%
        {' '}<Link to={`/results/${rec.attemptId}`}>← परिणाम डैशबोर्ड</Link>
      </div>

      <div className="tabs" role="tablist" aria-label="समाधान फ़िल्टर">
        {([
          ['all', `सभी प्रश्न (${counts.all})`],
          ['correct', `✅ सही उत्तर (${counts.correct})`],
          ['incorrect', `❌ गलत उत्तर (${counts.incorrect})`],
          ['unanswered', `⏭ छोड़े गए (${counts.unanswered})`],
          ['marked', `★ समीक्षा हेतु चिह्नित (${counts.marked})`],
        ] as [Filter, string][]).map(([id, label]) => (
          <button key={id} className={filter === id ? 'tab active' : 'tab'} onClick={() => setFilter(id)} role="tab" aria-selected={filter === id}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card"><div className="empty-state"><div className="icon">📭</div>इस श्रेणी में कोई प्रश्न नहीं।</div></div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
        {filtered.map(({ q, sel }) => (
          <QuestionCard key={q.id} mode="review" q={q} selected={sel} />
        ))}
      </div>
    </>
  );
}
