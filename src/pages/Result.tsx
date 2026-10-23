import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAttempt } from '../lib/storage';
import { fmtDate, fmtHMS, fmtMinutes, topicPerformance } from '../lib/scoring';
import { topicHi } from '../lib/questions';
import type { AttemptRecord } from '../lib/types';

export default function Result() {
  const { attemptId } = useParams();
  const nav = useNavigate();
  const [rec, setRec] = useState<AttemptRecord | null | undefined>(undefined);

  useEffect(() => { setRec(getAttempt(attemptId || '')); }, [attemptId]);

  if (rec === undefined) return <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />;
  if (rec === null) {
    return (
      <div className="card center">
        <div className="empty-state"><div className="icon">🔍</div>परिणाम नहीं मिला / Result not found</div>
        <Link to="/progress" className="btn btn-navy">मेरे परिणाम →</Link>
      </div>
    );
  }

  const { strong, weak, skipped } = topicPerformance(rec.topicStats);
  const total = 60;
  const nextTest = rec.testNumber < 20 ? rec.testNumber + 1 : null;
  const recommended = recommendNext(rec);

  const print = () => window.print();

  return (
    <>
      <div className="card" id="result-printable">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <h2>📊 YOUR RESULT — आपका परिणाम</h2>
          <span className="badge badge-green">✓ Submitted / सबमिट हो गया</span>
        </div>
        <p className="small muted">
          प्रयास आईडी (Attempt ID): <b>{rec.attemptId}</b> • तिथि: {fmtDate(rec.submittedAt)} •{' '}
          टेस्ट: <b>Mock Test {String(rec.testNumber).padStart(2, '0')}</b>
        </p>

        <div className="score-hero">
          <div className="score-pill"><div className="v">{total}</div><div className="l">Total Questions<br />कुल प्रश्न</div></div>
          <div className="score-pill"><div className="v" style={{ color: 'var(--blue)' }}>{rec.attempted}</div><div className="l">Attempted<br />हल किए गए</div></div>
          <div className="score-pill"><div className="v" style={{ color: 'var(--green)' }}>{rec.correct}</div><div className="l">Correct<br />सही</div></div>
          <div className="score-pill"><div className="v" style={{ color: 'var(--red)' }}>{rec.incorrect}</div><div className="l">Incorrect<br />गलत</div></div>
          <div className="score-pill"><div className="v" style={{ color: 'var(--grey)' }}>{rec.unanswered}</div><div className="l">Unanswered<br />अनुत्तरित</div></div>
        </div>

        <div className="score-hero">
          <div className="score-pill" style={{ border: '2px solid var(--navy)' }}>
            <div className="v" style={{ color: 'var(--navy)' }}>{rec.score} / {total}</div>
            <div className="l">Final Score (अंक)</div>
          </div>
          <div className="score-pill">
            <div className="v" style={{ color: 'var(--green)' }}>{rec.accuracy}%</div>
            <div className="l">Accuracy (सटीकता)</div>
          </div>
          <div className="score-pill">
            <div className="v">{Math.round(rec.timeTakenSec / 60)}</div>
            <div className="l">Time Taken (मिनट)<br />{fmtHMS(rec.timeTakenSec)}</div>
          </div>
          <div className="score-pill">
            <div className="v small" style={{ fontSize: '0.95rem', paddingTop: 6 }}>
              {rec.negativeMarking ? `+1 / −${rec.negValue.toFixed(2)}` : '+1 / 0'}
            </div>
            <div className="l">Marking Scheme<br />अंकन योजना</div>
          </div>
        </div>

        <p className="small muted">
          सटीकता = सही उत्तर ÷ हल किए गए प्रश्न × 100 = {rec.correct}/{rec.attempted || 0} × 100 = {rec.accuracy}%
          {rec.attempted === 0 && ' (कोई प्रश्न हल नहीं किया गया — सटीकता 0%)'}
        </p>
      </div>

      {/* topic-wise performance */}
      <div className="card">
        <h3>विषयवार प्रदर्शन / Topic-wise Performance</h3>
        <div className="bar-row" style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '0.72rem' }}>
          <span>विषय</span><span>सही / गलत / छोड़ा</span><span>सटीकता</span>
        </div>
        {Object.entries(rec.topicStats)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([topic, s]) => {
            const attempted = s.correct + s.incorrect;
            const acc = attempted ? Math.round((s.correct / attempted) * 100) : 0;
            const cw = (s.correct / s.total) * 100;
            const iw = (s.incorrect / s.total) * 100;
            return (
              <div className="bar-row" key={topic}>
                <span title={topic}>{topicHi(topic)}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-correct" style={{ width: `${cw}%` }} />
                  <span className="bar-wrong" style={{ width: `${iw}%` }} />
                </span>
                <span className="small">{s.correct}/{s.incorrect}/{s.unanswered} • {attempted ? `${acc}%` : '—'}</span>
              </div>
            );
          })}
        <div className="palette-legend">
          <span><span className="legend-dot" style={{ background: 'var(--green)' }} />सही</span>
          <span><span className="legend-dot" style={{ background: 'var(--red)' }} />गलत</span>
          <span><span className="legend-dot" style={{ background: 'var(--grey-soft)' }} />छोड़ा गया</span>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-2">
        <div className="card">
          <h3>💪 मज़बूत विषय / Strong Topics</h3>
          {strong.length === 0 && <p className="muted small">इस प्रयास में 75%+ सटीकता वाला कोई विषय नहीं — अभ्यास जारी रखें!</p>}
          {strong.map((r) => <p key={r.topic}>✅ {topicHi(r.topic)} — {Math.round(r.acc)}% ({r.correct}/{r.correct + r.incorrect})</p>)}
          {skipped.length > 0 && (
            <>
              <h3 className="mt">⏭ छोड़े गए विषय</h3>
              <p className="small muted">{skipped.map((r) => topicHi(r.topic)).join(', ')}</p>
            </>
          )}
        </div>
        <div className="card">
          <h3>🎯 सुधार योग्य विषय / Topics Needing Improvement</h3>
          {weak.length === 0 && <p className="muted small">शानदार! 50% से कम सटीकता वाला कोई विषय नहीं।</p>}
          {weak.map((r) => <p key={r.topic}>📌 {topicHi(r.topic)} — {Math.round(r.acc)}% ({r.correct}/{r.correct + r.incorrect})</p>)}
          {weak.length > 0 && (
            <p className="small mt">
              सुझाव: <Link to="/practice">अभ्यास मोड</Link> में इन विषयों का अभ्यास करें या{' '}
              <Link to="/revision">गलत प्रश्नों का रिवीज़न</Link> करें।
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>सुझाव / Recommendation</h3>
        <p>
          {recommended.msg}{' '}
          {recommended.testNumber && (
            <Link to={`/tests/${recommended.testNumber}/instructions`} className="btn btn-primary btn-sm" style={{ marginLeft: 6 }}>
              Mock Test {String(recommended.testNumber).padStart(2, '0')} शुरू करें →
            </Link>
          )}
        </p>
      </div>

      {/* actions */}
      <div className="card no-print">
        <h3>आगे क्या करें / Next Actions</h3>
        <div className="btn-row">
          <Link to={`/results/${rec.attemptId}/solutions`} className="btn btn-navy">📖 View All Solutions</Link>
          <Link to={`/tests/${rec.testNumber}/instructions`} className="btn btn-outline">🔄 Retake Test</Link>
          {nextTest && <Link to={`/tests/${nextTest}/instructions`} className="btn btn-green">Next Mock Test →</Link>}
          <Link to="/tests" className="btn btn-ghost">← Back to Test Series</Link>
          <button className="btn btn-primary" onClick={print}>⬇ Download Result as PDF</button>
          <button className="btn btn-ghost" onClick={print}>🖨 Print Result</button>
          <button className="btn btn-ghost" onClick={() => nav('/progress')}>📊 मेरी प्रगति</button>
        </div>
        <p className="small muted mt">PDF के लिए: प्रिंट संवाद में "Save as PDF / PDF के रूप में सहेजें" चुनें — परिणाम पूरा प्रिंट-लेआउट में सहेजा जाएगा।</p>
      </div>
    </>
  );
}

function recommendNext(rec: AttemptRecord): { msg: string; testNumber: number | null } {
  const attemptedTests = new Set<number>();
  // (other attempts come from storage; cheap to re-list here)
  try {
    const all = JSON.parse(localStorage.getItem('alp_attempts_v1') || '[]') as AttemptRecord[];
    all.forEach((a) => attemptedTests.add(a.testNumber));
  } catch { /* ignore */ }
  for (let t = 1; t <= 20; t++) {
    if (!attemptedTests.has(t)) return { msg: `आपने अभी तक Mock Test ${String(t).padStart(2, '0')} नहीं दिया है — इसे आज़माएँ:`, testNumber: t };
  }
  if (rec.accuracy < 60) return { msg: 'समग्र सटीकता बढ़ाने के लिए कमज़ोर विषयों का अभ्यास करें, फिर इस टेस्ट को दोबारा दें।', testNumber: rec.testNumber };
  return { msg: 'बहुत बढ़िया! अगले स्तर के टेस्ट से अपनी तैयारी कठिन बनाएँ।', testNumber: rec.testNumber < 20 ? rec.testNumber + 1 : null };
}
