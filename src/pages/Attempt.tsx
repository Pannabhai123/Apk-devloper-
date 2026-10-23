import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import Modal from '../components/Modal';
import { loadTest } from '../lib/questions';
import { clearActive, getActive, setActive, saveAttempt } from '../lib/storage';
import { buildAttemptRecord, fmtHMS, remainingSeconds } from '../lib/scoring';
import type { ActiveAttempt, Letter, TestFile } from '../lib/types';

export default function Attempt() {
  const { testNumber } = useParams();
  const n = parseInt(testNumber || '0', 10);
  const nav = useNavigate();

  const [test, setTest] = useState<TestFile | null>(null);
  const [active, setActiveState] = useState<ActiveAttempt | null>(null);
  const [current, setCurrent] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [showSubmit, setShowSubmit] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [err, setErr] = useState('');
  const submittingRef = useRef(false);
  const loadedRef = useRef(false);

  // ---------- load test + active attempt ----------
  useEffect(() => {
    loadedRef.current = false;
    setTest(null);
    setActiveState(null);
    loadTest(n)
      .then((t) => {
        setTest(t);
        const a = getActive(n);
        if (!a) {
          nav(`/tests/${n}/instructions`, { replace: true });
          return;
        }
        setActiveState(a);
        setCurrent(a.visited.length ? Math.min(Math.max(...a.visited), t.questions.length) : 1);
        if (!a.visited.includes(1)) setActive({ ...a, visited: [...a.visited, 1] });
        loadedRef.current = true;
      })
      .catch(() => setErr('टेस्ट लोड नहीं हो सका। कृपया वापस जाकर पुनः प्रयास करें।'));
  }, [n, nav]);

  // ---------- persist helper ----------
  const update = useCallback(
    (patch: Partial<ActiveAttempt>) => {
      setActiveState((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        setActive(next);
        return next;
      });
    },
    [],
  );

  // ---------- timer ----------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => (active ? remainingSeconds(active, now) : 0), [active, now]);

  // auto-submit when time expires (never waits for confirmation)
  const submit = useCallback(
    (auto: boolean) => {
      if (submittingRef.current || !test || !active) return;
      submittingRef.current = true;
      const rec = buildAttemptRecord(test.questions, active);
      saveAttempt(rec);
      clearActive(n);
      nav(`/results/${rec.attemptId}`, { replace: true });
      void auto;
    },
    [test, active, n, nav],
  );

  useEffect(() => {
    if (loadedRef.current && active && remaining <= 0) submit(true);
  }, [remaining, active, submit]);

  // warn before leaving during a live test (refresh is allowed and resumes)
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (active) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [active]);

  // ---------- interactions ----------
  const q = test?.questions[current - 1];
  const total = test?.questions.length ?? 60;

  const goto = (num: number) => {
    if (num < 1 || num > total) return;
    setCurrent(num);
    update({ visited: Array.from(new Set([...(active?.visited || []), num])) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const select = (l: Letter) => {
    if (!active) return;
    update({ answers: { ...active.answers, [current]: l } });
  };

  const clearResponse = () => {
    if (!active) return;
    const answers = { ...active.answers };
    delete answers[current];
    update({ answers });
  };

  const toggleMark = () => {
    if (!active) return;
    const marked = active.marked.includes(current)
      ? active.marked.filter((x) => x !== current)
      : [...active.marked, current];
    update({ marked });
  };

  // ---------- derived counts ----------
  const answeredCount = active ? Object.keys(active.answers).length : 0;
  const markedCount = active ? active.marked.length : 0;
  const visited = new Set(active?.visited || []);
  const unansweredVisited = [...visited].filter((v) => !active?.answers[v]).length;

  const timerClass = remaining <= 60 ? 'timer critical' : remaining <= 300 ? 'timer warn' : 'timer';
  const timerLabel = remaining <= 60 ? '⚠ केवल 1 मिनट बचा!' : remaining <= 300 ? '⚠ केवल 5 मिनट बचे!' : remaining <= 900 ? '15 मिनट बचे' : 'शेष समय';

  if (err) return <div className="card"><p style={{ color: 'var(--red)' }}>{err}</p><Link className="btn btn-ghost mt" to="/tests">← टेस्ट सूची</Link></div>;
  if (!test || !active || !q) return <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />;

  return (
    <div className="attempt-layout">
      {/* ---------- left: exam ---------- */}
      <div>
        <div className="exam-topbar" role="region" aria-label="टेस्ट स्थिति">
          <div>
            <b>Mock Test {String(n).padStart(2, '0')}</b>
            <div className="exam-stats">
              <span>प्रश्न <b>{current}</b>/{total}</span>
              <span>उत्तरित <b style={{ color: '#6ee7a0' }}>{answeredCount}</b></span>
              <span>अनुत्तरित <b style={{ color: '#fda4af' }}>{total - answeredCount}</b></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className={timerClass} role="timer" aria-live="off" aria-label={`शेष समय ${fmtHMS(remaining)}`}>
              ⏱ {fmtHMS(remaining)}
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: 3 }}>{timerLabel}</div>
          </div>
        </div>

        <QuestionCard mode="exam" q={q} selected={active.answers[current]} onSelect={select} />

        <div className="card mt no-print">
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => goto(current - 1)} disabled={current === 1}>← पिछला प्रश्न</button>
            <button className="btn btn-outline" onClick={clearResponse}>Clear Response</button>
            <button className={`btn ${active.marked.includes(current) ? 'btn-red' : 'btn-ghost'}`} onClick={toggleMark} aria-pressed={active.marked.includes(current)}>
              {active.marked.includes(current) ? '★ Marked for Review' : '☆ Mark for Review'}
            </button>
            <button className="btn btn-primary" onClick={() => goto(current + 1)} disabled={current === total}>Save &amp; Next →</button>
            {current === total && <button className="btn btn-green" onClick={() => setShowSubmit(true)}>SUBMIT TEST ✔</button>}
          </div>
          <div className="btn-row mt" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPalette((s) => !s)}>
              {showPalette ? '▲ पैलेट छिपाएँ' : '▼ प्रश्न पैलेट दिखाएँ'}
            </button>
            <button className="btn btn-green btn-sm" onClick={() => setShowSubmit(true)}>SUBMIT TEST ✔</button>
          </div>
        </div>
      </div>

      {/* ---------- right: palette ---------- */}
      <aside className={`palette-panel card${showPalette ? ' open' : ''}`} aria-label="प्रश्न पैलेट">
        <h3>प्रश्न पैलेट / Question Palette</h3>
        <div className="palette-grid">
          {test.questions.map((qq, i) => {
            const num = qq.questionNumber;
            const isAnswered = Boolean(active.answers[num]);
            const isMarked = active.marked.includes(num);
            const cls = [
              'pal',
              isMarked && isAnswered ? 'marked-answered' : isMarked ? 'marked' : isAnswered ? 'answered' : visited.has(num) ? 'not-answered' : '',
              current === num ? 'current' : '',
            ].filter(Boolean).join(' ');
            const state = isMarked && isAnswered ? 'उत्तर दिया गया, समीक्षा हेतु चिह्नित' : isMarked ? 'समीक्षा हेतु चिह्नित' : isAnswered ? 'उत्तर दिया गया' : visited.has(num) ? 'देखा गया, उत्तर नहीं' : 'नहीं देखा गया';
            return (
              <button key={num} className={cls} onClick={() => goto(num)} aria-label={`प्रश्न ${num}: ${state}`} title={`प्रश्न ${num}: ${state}`}>
                {num}
              </button>
            );
          })}
        </div>
        <div className="palette-legend">
          <span><span className="legend-dot" style={{ background: 'var(--grey-soft)' }} />नहीं देखा गया</span>
          <span><span className="legend-dot" style={{ background: 'var(--red)' }} />देखा गया, उत्तर नहीं</span>
          <span><span className="legend-dot" style={{ background: 'var(--green)' }} />उत्तर दिया गया</span>
          <span><span className="legend-dot" style={{ background: 'var(--purple)' }} />समीक्षा हेतु चिह्नित</span>
        </div>
        <div className="mt small muted">
          <p>उत्तरित: <b>{answeredCount}</b> • अनुत्तरित: <b>{total - answeredCount}</b> • चिह्नित: <b>{markedCount}</b></p>
          <p>देखे गए-अनुत्तरित: <b>{unansweredVisited}</b></p>
          <p className="small">पेज रिफ्रेश करने पर टाइमर और उत्तर सुरक्षित रहते हैं।</p>
        </div>
      </aside>

      {/* ---------- submit confirmation ---------- */}
      {showSubmit && (
        <Modal title="क्या आप वाकई टेस्ट सबमिट करना चाहते हैं? / Submit the test?" onClose={() => setShowSubmit(false)} closeLabel="← Continue Test">
          <div style={{ display: 'grid', gap: 6, margin: '12px 0' }}>
            <b>Total Questions: {total}</b>
            <span>Answered / उत्तरित: <b style={{ color: 'var(--green)' }}>{answeredCount}</b></span>
            <span>Unanswered / अनुत्तरित: <b style={{ color: 'var(--red)' }}>{total - answeredCount}</b></span>
            <span>Marked for Review / समीक्षा हेतु चिह्नित: <b style={{ color: 'var(--purple)' }}>{markedCount}</b></span>
            <span className="muted small">शेष समय: {fmtHMS(remaining)}</span>
          </div>
          <div className="notice small">सबमिट करने के बाद उत्तर नहीं बदले जा सकते।</div>
          <div className="btn-row mt">
            <button className="btn btn-ghost" onClick={() => setShowSubmit(false)}>← Continue Test</button>
            <button className="btn btn-green" onClick={() => submit(false)}>✔ Confirm Submit</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
