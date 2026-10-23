import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAttempts } from '../lib/storage';
import { loadTest, topicHi } from '../lib/questions';
import type { Letter, Question, TestFile } from '../lib/types';

/**
 * Wrong-question revision: collects every question answered incorrectly
 * across submitted attempts (most recent answer wins), lets the student
 * re-practise exactly those questions.
 */
export default function Revision() {
  const [state, setState] = useState<{ wrong: Question[]; attemptsScanned: number } | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const attempts = listAttempts().slice().sort((a, b) => a.submittedAt - b.submittedAt);
      const latestAnswer = new Map<string, { testNumber: number; qn: number; sel: Letter }>();
      for (const a of attempts) {
        for (const [qnStr, sel] of Object.entries(a.answers)) {
          const qn = parseInt(qnStr, 10);
          latestAnswer.set(`T${a.testNumber}-Q${qn}`, { testNumber: a.testNumber, qn, sel });
        }
      }
      const testCache = new Map<number, TestFile>();
      const wrong = new Map<string, Question>();
      for (const [key, info] of latestAnswer) {
        if (!testCache.has(info.testNumber)) {
          testCache.set(info.testNumber, await loadTest(info.testNumber));
        }
        const t = testCache.get(info.testNumber)!;
        const q = t.questions[info.qn - 1];
        if (q && info.sel !== q.correctAnswer) wrong.set(key, q);
      }
      if (!cancelled) setState({ wrong: Array.from(wrong.values()), attemptsScanned: attempts.length });
    })().catch(() => { if (!cancelled) setErr('प्रश्न डेटा लोड नहीं हो सका।'); });
    return () => { cancelled = true; };
  }, []);

  const wrongList = state?.wrong ?? [];
  const topics = Array.from(new Set(wrongList.map((q) => q.topic)));
  const shown = filter === 'all' ? wrongList : wrongList.filter((q) => q.topic === filter);
  const ids = shown.map((q) => q.id).join(',');

  return (
    <>
      <div className="section-title"><h2>गलत प्रश्नों का रिवीज़न / Wrong-Question Revision</h2></div>
      <div className="info-notice mb">
        पिछले सभी प्रयासों में जो प्रश्न आपने गलत किए हैं (नवीनतम उत्तर के आधार पर), वे यहाँ एकत्र हैं।
        इन्हें अभ्यास मोड में दोबारा हल करें — समाधान के साथ।
      </div>

      {err && <div className="card"><p style={{ color: 'var(--red)' }}>{err}</p></div>}
      {!state && !err && <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />}

      {state && wrongList.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🏆</div>
            <h3>कोई गलत प्रश्न नहीं!</h3>
            <p>{state.attemptsScanned > 0 ? 'आपके अब तक के सभी उत्तर सही रहे हैं — शानदार!' : 'पहले एक मॉक टेस्ट दें, फिर यहाँ गलत प्रश्नों का संग्रह मिलेगा।'}</p>
            <Link to="/tests" className="btn btn-primary">मॉक टेस्ट देखें</Link>
          </div>
        </div>
      )}

      {state && wrongList.length > 0 && (
        <div className="card">
          <p>
            <b>{wrongList.length} गलत प्रश्न</b> ({state.attemptsScanned} प्रयासों से) • विषय: {topics.length}
          </p>
          <div className="tabs">
            <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>सभी ({wrongList.length})</button>
            {topics.map((t) => (
              <button key={t} className={filter === t ? 'tab active' : 'tab'} onClick={() => setFilter(t)}>
                {topicHi(t)} ({wrongList.filter((q) => q.topic === t).length})
              </button>
            ))}
          </div>
          <div className="btn-row">
            <Link to={`/practice?ids=${ids}`} className="btn btn-primary">✏️ इन {shown.length} प्रश्नों का अभ्यास करें</Link>
          </div>
          <div className="table-wrap mt">
            <table className="data-table">
              <thead><tr><th>प्रश्न आईडी</th><th>टेस्ट</th><th>विषय</th><th>कठिनाई</th><th></th></tr></thead>
              <tbody>
                {shown.map((q) => (
                  <tr key={q.id}>
                    <td className="mono small">{q.id}</td>
                    <td>Mock Test {String(q.testNumber).padStart(2, '0')}</td>
                    <td>{q.topicHi}</td>
                    <td>{q.difficulty === 'Easy' ? 'सरल' : q.difficulty === 'Moderate' ? 'मध्यम' : 'कठिन'}</td>
                    <td><Link className="btn btn-ghost btn-sm" to={`/practice?ids=${q.id}`}>हल करें →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
