import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INSTRUCTIONS, testDifficulty, testDifficultyHi } from '../data/app';
import { loadTest } from '../lib/questions';
import { getActive, setActive } from '../lib/storage';
import type { TestFile } from '../lib/types';

export default function Instructions() {
  const { testNumber } = useParams();
  const n = parseInt(testNumber || '0', 10);
  const nav = useNavigate();
  const [test, setTest] = useState<TestFile | null>(null);
  const [err, setErr] = useState('');
  const [checked, setChecked] = useState(false);
  const [negative, setNegative] = useState(false);

  useEffect(() => {
    setTest(null);
    setChecked(false);
    loadTest(n).then(setTest).catch(() => setErr('टेस्ट डेटा लोड नहीं हो सका।'));
  }, [n]);

  const active = getActive(n);

  const begin = () => {
    if (!checked || !test) return;
    const now = Date.now();
    if (active && now - active.startedAt < active.durationSec * 1000) {
      // resume the existing attempt — timer must NOT restart
      nav(`/tests/${n}/attempt`);
      return;
    }
    const fresh = {
      testNumber: n,
      startedAt: now,
      durationSec: test.durationMinutes * 60,
      negativeMarking: negative,
      negValue: 1 / 3,
      answers: {} as Record<number, 'A' | 'B' | 'C' | 'D'>,
      marked: [] as number[],
      visited: [] as number[],
    };
    // persist before navigating so the timer survives instant refresh
    setActive(fresh);
    nav(`/tests/${n}/attempt`);
  };

  const resume = active && Date.now() - active.startedAt < active.durationSec * 1000;

  return (
    <>
      <div className="section-title">
        <h2>परीक्षा निर्देश / TEST INSTRUCTIONS</h2>
      </div>

      {err && <div className="card"><p style={{ color: 'var(--red)' }}>{err}</p></div>}
      {!test && !err && <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />}

      {test && (
        <div className="card">
          <h3>Mock Test {String(n).padStart(2, '0')} — गणित (Mathematics)</h3>
          <div className="btn-row" style={{ gap: 8, margin: '8px 0 14px' }}>
            <span className="badge">📝 {test.totalQuestions} प्रश्न</span>
            <span className="badge">⏱️ {test.durationMinutes} मिनट</span>
            <span className="badge badge-amber">{testDifficultyHi(n)} / {testDifficulty(n)}</span>
          </div>

          <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 7 }}>
            {INSTRUCTIONS.map((it, i) => (
              <li key={i}>{it.hi} <span className="muted small">({it.en})</span></li>
            ))}
          </ol>

          <div className="info-notice mt">
            <b>अंकन योजना / Marking Scheme:</b>{' '}
            {negative ? (
              <>सही उत्तर पर <b>+1</b>, गलत उत्तर पर <b>−1/3</b>, अनुत्तरित पर <b>0</b> (नकारात्मक अंकन सक्रिय)</>
            ) : (
              <>सही उत्तर पर <b>+1</b>, गलत/अनुत्तरित पर <b>0</b> (डिफ़ॉल्ट अभ्यास मोड)</>
            )}
            <label className="check-row mt small" style={{ fontWeight: 500 }}>
              <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} />
              <span>नकारात्मक अंकन (−1/3) सक्रिय करें — वैकल्पिक अभ्यास सेटिंग (यह किसी विशेष परीक्षा की आधिकारिक योजना नहीं है)</span>
            </label>
          </div>

          {resume && (
            <div className="notice mt">
              <b>⚠ चालू प्रयास मिला:</b> इस टेस्ट का एक प्रयास पहले से चल रहा है। BEGIN TEST दबाने पर वही प्रयास बाकी बचे समय के साथ जारी रहेगा (टाइमर रीसेट नहीं होगा)।
            </div>
          )}

          <label className="check-row mt" style={{ fontSize: '1rem', fontWeight: 600 }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <span>I have read the instructions and I am ready to begin. / मैंने निर्देश पढ़ लिए हैं और मैं शुरू करने के लिए तैयार हूँ।</span>
          </label>

          <div className="btn-row mt">
            <button className="btn btn-green btn-lg" onClick={begin} disabled={!checked}>
              ▶ BEGIN TEST
            </button>
            <Link to="/tests" className="btn btn-ghost">← टेस्ट सूची</Link>
          </div>
          <p className="small muted mt">टाइमर केवल BEGIN TEST दबाने के बाद शुरू होता है। अच्छे नेटवर्क के बिना भी आपके उत्तर ब्राउज़र में सुरक्षित रहते हैं।</p>
        </div>
      )}
    </>
  );
}

