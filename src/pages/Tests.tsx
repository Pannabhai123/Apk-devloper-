import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { testDifficulty, testDifficultyHi, QUESTIONS_PER_TEST, TEST_DURABILITY, TOTAL_TESTS } from '../data/app';
import { loadIndex } from '../lib/questions';
import { attemptsForTest } from '../lib/storage';
import { getUnpublished } from '../lib/storage';
import type { BankIndex } from '../lib/types';

const FILTERS = [
  { id: 'all', label: 'सभी / All' },
  { id: '1', label: 'सरल से मध्यम (01–05)' },
  { id: '2', label: 'मध्यम (06–10)' },
  { id: '3', label: 'मध्यम से कठिन (11–15)' },
  { id: '4', label: 'कठिन (16–20)' },
];

export default function Tests() {
  const [idx, setIdx] = useState<BankIndex | null>(null);
  const [filter, setFilter] = useState('all');
  const [err, setErr] = useState('');

  useEffect(() => {
    loadIndex().then(setIdx).catch(() => setErr('प्रश्न बैंक लोड नहीं हो सका। कृपया पेज रीफ्रेश करें।'));
  }, []);

  const unpublished = getUnpublished();
  const tests = idx?.tests.filter((t) => !unpublished.includes(t.testNumber)) ?? [];

  return (
    <>
      <div className="section-title"><h2>सभी मॉक टेस्ट / All Mock Tests</h2></div>
      <div className="info-notice mb">
        20 क्रमांकित मॉक टेस्ट • प्रत्येक में {QUESTIONS_PER_TEST} प्रश्न • {TEST_DURABILITY} मिनट • ये मूल अभ्यास टेस्ट हैं (आधिकारिक प्रश्नपत्र नहीं)।
      </div>

      <div className="tabs" role="tablist" aria-label="कठिनाई फ़िल्टर">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'tab active' : 'tab'} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {err && <div className="card"><p style={{ color: 'var(--red)' }}>{err}</p></div>}
      {!idx && !err && <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />}

      <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
        {tests
          .filter((t) => filter === 'all' || (filter === '1' && t.testNumber <= 5) || (filter === '2' && t.testNumber > 5 && t.testNumber <= 10) || (filter === '3' && t.testNumber > 10 && t.testNumber <= 15) || (filter === '4' && t.testNumber > 15))
          .map((t) => {
            const attempts = attemptsForTest(t.testNumber);
            const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
            return (
              <div className="test-card" key={t.testNumber}>
                <div className="test-num" aria-hidden="true">{String(t.testNumber).padStart(2, '0')}</div>
                <div className="info">
                  <div className="name">Mock Test {String(t.testNumber).padStart(2, '0')} — गणित (Mathematics)</div>
                  <div className="meta">
                    <span>📝 {t.count} प्रश्न</span>
                    <span>⏱️ {TEST_DURABILITY} मिनट</span>
                    <span>📊 {testDifficultyHi(t.testNumber)} ({testDifficulty(t.testNumber)})</span>
                    {attempts.length > 0 && <span className="badge badge-green">प्रयास: {attempts.length}{best !== null ? ` • सर्वश्रेष्ठ: ${best}/60` : ''}</span>}
                  </div>
                </div>
                <Link to={`/tests/${t.testNumber}/instructions`} className="btn btn-primary">Start Test →</Link>
              </div>
            );
          })}
      </div>

      {idx && (
        <p className="small muted mt">
          कुल उपलब्ध प्रश्न: {idx.totalQuestions.toLocaleString('en-IN')} • विषय: {idx.topics.length} •{' '}
          {unpublished.length > 0 && `${TOTAL_TESTS - unpublished.length}/${TOTAL_TESTS} टेस्ट प्रकाशित (स्थानीय सेटिंग)`}
        </p>
      )}
    </>
  );
}
