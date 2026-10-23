import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import { loadIndex, loadQuestionsByIds, loadTopic, TOPIC_META } from '../lib/questions';
import { getPracticeStats, recordPractice } from '../lib/storage';
import type { BankIndex, Question } from '../lib/types';

/**
 * Untimed practice mode — separate from the exam mode.
 * Shows correct answer + solution right after each question.
 * Accepts ?ids=... (comma-separated) to practise a fixed set (revision / bookmarks)
 * or ?topic=slug for topic practice.
 */
export default function Practice() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const idsParam = params.get('ids');
  const topicParam = params.get('topic');
  const diffParam = params.get('diff') || 'all';

  const [idx, setIdx] = useState<BankIndex | null>(null);
  const [queue, setQueue] = useState<Question[] | null>(null);
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<string | undefined>();
  const [revealed, setRevealed] = useState(false);
  const [sessionStats, setSessionStats] = useState({ attempted: 0, correct: 0 });
  const [err, setErr] = useState('');

  // ---------- loading ----------
  useEffect(() => {
    setQueue(null); setPos(0); setSelected(undefined); setRevealed(false);
    loadIndex().then(setIdx).catch(() => setErr('प्रश्न बैंक लोड नहीं हो सका।'));
    if (idsParam) {
      loadQuestionsByIds(idsParam.split(',').filter(Boolean))
        .then((qs) => { if (qs.length === 0) setErr('निर्दिष्ट प्रश्न नहीं मिले।'); else setQueue(shuffle(qs)); })
        .catch(() => setErr('प्रश्न लोड नहीं हो सका।'));
    } else if (topicParam) {
      loadTopic(topicParam)
        .then((tf) => setQueue(shuffle(filterDiff(tf.questions, diffParam))))
        .catch(() => setErr('विषय लोड नहीं हो सका।'));
    }
  }, [idsParam, topicParam, diffParam]);

  const stats = getPracticeStats();

  const current = queue?.[pos];
  const total = queue?.length ?? 0;

  const pick = (l: 'A' | 'B' | 'C' | 'D') => {
    if (revealed || !current) return;
    setSelected(l);
    setRevealed(true);
    const correct = l === current.correctAnswer;
    recordPractice(current.topic, correct);
    setSessionStats((s) => ({ attempted: s.attempted + 1, correct: s.correct + (correct ? 1 : 0) }));
  };

  const next = () => { setPos((p) => p + 1); setSelected(undefined); setRevealed(false); window.scrollTo({ top: 0 }); };
  const skip = () => { if (!revealed) { setRevealed(true); setSelected(undefined); } };

  // ---------- topic selection UI ----------
  if (!idsParam && !topicParam) {
    return (
      <>
        <div className="section-title"><h2>गणित अभ्यास / Mathematics Practice</h2></div>
        <div className="info-notice mb">
          बिना टाइमर का अभ्यास मोड — हर प्रश्न का उत्तर चुनते ही सही उत्तर और विस्तृत समाधान दिख जाता है।
          यह मॉक टेस्ट (परीक्षा मोड) से अलग है और आपकी परीक्षा प्रगति में गिना नहीं जाता।
        </div>
        {err && <div className="card"><p style={{ color: 'var(--red)' }}>{err}</p></div>}
        {!idx && !err && <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />}
        {idx && (
          <>
            <div className="grid grid-2">
              {TOPIC_META.map((t) => {
                const count = idx.topics.find((x) => x.slug === t.slug)?.count ?? 0;
                const s = stats[t.topic];
                return (
                  <Link key={t.slug} to={`/practice?topic=${t.slug}`} className="test-card" style={{ textDecoration: 'none' }}>
                    <div className="info">
                      <div className="name">{t.hi}</div>
                      <div className="meta">
                        <span>📝 {count} प्रश्न</span>
                        {s && <span className="badge badge-green">अभ्यास: {s.correct}/{s.attempted} सही</span>}
                      </div>
                    </div>
                    <span className="btn btn-primary btn-sm">अभ्यास →</span>
                  </Link>
                );
              })}
            </div>
            <p className="small muted mt">कुल {idx.totalQuestions.toLocaleString('en-IN')} प्रश्न, {idx.topics.length} विषयों में।</p>
          </>
        )}
      </>
    );
  }

  // ---------- practice session ----------
  return (
    <>
      <div className="exam-topbar">
        <div>
          <b>अभ्यास मोड / Practice Mode</b>
          <div className="exam-stats">
            <span>प्रश्न <b>{Math.min(pos + 1, total)}</b>/{total}</span>
            <span>इस सत्र में सही <b style={{ color: '#6ee7a0' }}>{sessionStats.correct}</b>/{sessionStats.attempted}</span>
          </div>
        </div>
        <Link to="/practice" className="btn btn-ghost btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'transparent' }}>✕ बाहर निकलें</Link>
      </div>

      {err && <div className="card"><p style={{ color: 'var(--red)' }}>{err}</p><Link className="btn btn-ghost" to="/practice">← विषय सूची</Link></div>}
      {!queue && !err && <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />}

      {queue && !current && (
        <div className="card center">
          <div className="empty-state">
            <div className="icon">🎉</div>
            <h3>अभ्यास पूरा हुआ!</h3>
            <p>इस सत्र में {sessionStats.attempted} प्रश्न हल किए, {sessionStats.correct} सही।</p>
          </div>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link to="/practice" className="btn btn-primary">← विषय सूची</Link>
            <Link to="/tests" className="btn btn-navy">मॉक टेस्ट दें</Link>
          </div>
        </div>
      )}

      {current && (
        <>
          <QuestionCard mode="practice" q={current} selected={selected as 'A' | 'B' | 'C' | 'D' | undefined} revealed={revealed} onSelect={pick} />
          <div className="card mt">
            <div className="btn-row">
              {!revealed && <button className="btn btn-ghost" onClick={skip}>उत्तर देखें / Reveal</button>}
              {pos + 1 < total && <button className="btn btn-primary" onClick={next} disabled={!revealed}>अगला प्रश्न →</button>}
              {pos + 1 >= total && <Link to="/practice" className="btn btn-green">अभ्यास समाप्त करें ✔</Link>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function filterDiff(qs: Question[], diff: string): Question[] {
  if (diff === 'all') return qs;
  return qs.filter((q) => q.difficulty === diff);
}
