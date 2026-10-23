import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import { listAttempts, resetAllData, storageUsage } from '../lib/storage';
import { fmtDate, fmtHMS } from '../lib/scoring';
import { topicHi } from '../lib/questions';

export default function Progress() {
  const [, force] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const attempts = useMemo(() => listAttempts(), [force]);

  const byTest = new Map<number, typeof attempts>();
  for (const a of attempts) {
    if (!byTest.has(a.testNumber)) byTest.set(a.testNumber, []);
    byTest.get(a.testNumber)!.push(a);
  }

  const totalQuestionsAttempted = attempts.reduce((s, a) => s + a.attempted, 0);
  const totalCorrect = attempts.reduce((s, a) => s + a.correct, 0);
  const overallAcc = totalQuestionsAttempted ? ((totalCorrect / totalQuestionsAttempted) * 100).toFixed(2) : '0';
  const totalTime = attempts.reduce((s, a) => s + a.timeTakenSec, 0);
  const avgScore = attempts.length ? (attempts.reduce((s, a) => s + a.score, 0) / attempts.length).toFixed(2) : '—';
  const latest = attempts[0];
  const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
  const bestRec = attempts.find((a) => a.score === best);

  // topic-wise aggregation across attempts
  const topicAgg = new Map<string, { correct: number; incorrect: number; total: number }>();
  for (const a of attempts) {
    for (const [topic, s] of Object.entries(a.topicStats)) {
      const cur = topicAgg.get(topic) || { correct: 0, incorrect: 0, total: 0 };
      cur.correct += s.correct; cur.incorrect += s.incorrect; cur.total += s.total;
      topicAgg.set(topic, cur);
    }
  }

  return (
    <>
      <div className="section-title"><h2>मेरी प्रगति / My Progress</h2></div>

      {attempts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">📈</div>
            <h3>अभी कोई टेस्ट पूरा नहीं हुआ</h3>
            <p>पहला मॉक टेस्ट देकर अपनी प्रगति ट्रैक करना शुरू करें।</p>
            <Link to="/tests" className="btn btn-primary">🚆 पहला मॉक टेस्ट शुरू करें</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-4">
            <div className="stat-card"><div className="stat-num">{attempts.length}</div><div className="stat-label">पूर्ण किए टेस्ट (कुल प्रयास)</div></div>
            <div className="stat-card"><div className="stat-num">{best ?? '—'}</div><div className="stat-label">सर्वश्रेष्ठ स्कोर{bestRec ? ` (T${String(bestRec.testNumber).padStart(2, '0')})` : ''}</div></div>
            <div className="stat-card"><div className="stat-num">{latest ? latest.score : '—'}</div><div className="stat-label">नवीनतम स्कोर</div></div>
            <div className="stat-card"><div className="stat-num">{avgScore}</div><div className="stat-label">औसत स्कोर</div></div>
            <div className="stat-card"><div className="stat-num">{totalQuestionsAttempted}</div><div className="stat-label">कुल हल किए प्रश्न</div></div>
            <div className="stat-card"><div className="stat-num">{overallAcc}%</div><div className="stat-label">समग्र सटीकता</div></div>
            <div className="stat-card"><div className="stat-num">{Math.round(totalTime / 60)}</div><div className="stat-label">कुल अभ्यास समय (मिनट)</div></div>
            <div className="stat-card"><div className="stat-num">{byTest.size}/20</div><div className="stat-label">अलग-अलग टेस्ट दिए</div></div>
          </div>

          <div className="section-title"><h3>टेस्ट इतिहास / Test History</h3></div>
          <div className="card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>टेस्ट</th><th>तिथि</th><th>स्कोर</th><th>सटीकता</th><th>समय</th><th>प्रयास देखें</th></tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.attemptId}>
                      <td><b>Mock Test {String(a.testNumber).padStart(2, '0')}</b></td>
                      <td>{fmtDate(a.submittedAt)}</td>
                      <td>{a.score}/60</td>
                      <td>{a.accuracy}%</td>
                      <td>{fmtHMS(a.timeTakenSec)}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" to={`/results/${a.attemptId}`}>View Result →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted mt">पुनः दिए गए टेस्ट अलग-अलग प्रयास रिकॉर्ड के रूप में सुरक्षित रहते हैं — पुराने परिणाम मिटते नहीं।</p>
          </div>

          <div className="section-title"><h3>विषयवार समग्र प्रदर्शन / Overall Topic Performance</h3></div>
          <div className="card">
            {Object.entries(Object.fromEntries(topicAgg)).length === 0 && <p className="muted">कोई डेटा नहीं।</p>}
            {[...topicAgg.entries()]
              .sort((x, y) => y[1].total - x[1].total)
              .map(([topic, s]) => {
                const att = s.correct + s.incorrect;
                const acc = att ? Math.round((s.correct / att) * 100) : 0;
                const cw = (s.correct / s.total) * 100;
                const iw = (s.incorrect / s.total) * 100;
                return (
                  <div className="bar-row" key={topic}>
                    <span title={topic}>{topicHi(topic)}</span>
                    <span className="bar-track" aria-hidden="true">
                      <span className="bar-correct" style={{ width: `${cw}%` }} />
                      <span className="bar-wrong" style={{ width: `${iw}%` }} />
                    </span>
                    <span className="small">{s.correct}/{s.incorrect} • {att ? `${acc}%` : '—'}</span>
                  </div>
                );
              })}
          </div>
        </>
      )}

      <div className="section-title"><h3>डेटा प्रबंधन / Data Management</h3></div>
      <div className="card">
        <p className="small">
          आपके सभी परिणाम <b>केवल इस ब्राउज़र</b> (localStorage) में संग्रहीत हैं — उपयोग: {storageUsage()}।
          ब्राउज़र डेटा साफ़ होने या दूसरे डिवाइस पर यह डेटा उपलब्ध नहीं होगा (यह साइट लॉगिन/क्लाउड सिंक का दावा नहीं करती)।
        </p>
        <button className="btn btn-red btn-sm" onClick={() => setConfirmReset(true)}>🗑 सभी स्थानीय डेटा मिटाएँ / Reset All Data</button>
      </div>

      {confirmReset && (
        <Modal title="⚠ सभी डेटा मिटाएँ?" onClose={() => setConfirmReset(false)}>
          <p>इससे आपके <b>सभी प्रयास, परिणाम, बुकमार्क और अभ्यास आँकड़े</b> इस ब्राउज़र से स्थायी रूप से हट जाएँगे। यह क्रिया वापस नहीं हो सकती।</p>
          <div className="btn-row mt">
            <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>रद्द करें / Cancel</button>
            <button
              className="btn btn-red"
              onClick={() => { resetAllData(); setConfirmReset(false); force((x) => x + 1); }}
            >
              🗑 हाँ, सब मिटाएँ
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
