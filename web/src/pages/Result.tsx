import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Award, Bookmark, CheckCircle2, ChevronDown, Clock3, Download, FileQuestion,
  Home, ListFilter, RotateCcw, Target, XCircle,
} from 'lucide-react';
import { api, downloadUrl, formatError } from '../api/client';
import { Badge, Breadcrumbs, Button, Card, EmptyState, ErrorState, Loading, Notice, PageMeta, ProgressRing } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { formatDateTime, formatDuration } from '../lib/format';

interface ReviewItem {
  position: number; questionId: number; text: string; imageUrl: string | null; subjectName: string | null; topicName: string | null;
  marks: number; negativeMarks: number; outcome: 'correct' | 'incorrect' | 'unanswered'; marksAwarded: number;
  timeSpentSeconds: number; markedForReview: boolean; selectedOptionIds: number[];
  options: { id: number; label: string; text: string; imageUrl: string | null }[];
  correctOptionIds?: number[]; explanation?: string | null;
}
interface ResultData {
  attempt: { id: number; testId: number; testTitle: string; testSlug: string; bookTitle: string | null; bookSlug: string | null;
    status: string; submitReason: string | null; language: string; mode: string; startedAt: string; submittedAt: string | null;
    resultVisibility: string; practiceFeedback: boolean };
  summary: { totalQuestions: number; attempted: number; correct: number; incorrect: number; unanswered: number;
    marksPossible: number; marksObtained: number; negativeMarks: number; accuracy: number; percentage: number;
    timeTakenSeconds: number; averageSecondsPerQuestion: number };
  answersRevealed: boolean;
  review: ReviewItem[];
}

export function Result() {
  const { attemptId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<ResultData>(`/results/${attemptId}`);
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'unanswered' | 'correct'>('all');
  const [busy, setBusy] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.review;
    return data.review.filter((r) => r.outcome === filter);
  }, [data, filter]);

  const retry = async (kind: 'test' | 'incorrect' | 'unanswered') => {
    if (!data) return;
    setBusy(kind);
    try {
      let result: { attemptId: number };
      if (kind === 'test') {
        const config = await api.get<{ id: number; languages: string[] }>(`/tests/${data.attempt.testSlug}`);
        result = await api.post('/attempts', { testId: config.id, language: data.attempt.language, clientRequestId: crypto.randomUUID() });
      } else {
        result = await api.post('/attempts/retry', { attemptId: Number(attemptId), filter: kind });
      }
      nav(`/test/${result.attemptId}/attempt`);
    } catch (err) { toast(formatError(err), 'error'); } finally { setBusy(''); }
  };

  const saveAllIncorrect = async () => {
    if (!data) return;
    setBusy('bookmark');
    try {
      let count = 0;
      for (const item of data.review.filter((r) => r.outcome === 'incorrect')) {
        await api.post('/bookmarks', { questionId: item.questionId, attemptId: Number(attemptId) });
        count++;
      }
      toast(count ? `${count} question(s) added to your revision list.` : 'No incorrect questions to save.', count ? 'success' : 'info');
    } catch (err) { toast(formatError(err), 'error'); } finally { setBusy(''); }
  };

  if (loading) return <div className="container section"><PageMeta title="Result" /><Loading label="Calculating your result…" /></div>;
  if (error) return <div className="container section"><PageMeta title="Result" /><ErrorState message={error} onRetry={reload} /><div className="mt-2"><Link to="/tests" className="btn btn-outline">Browse tests</Link></div></div>;
  if (!data) return null;
  const s = data.summary;

  return (
    <div className="container section">
      <PageMeta title={`Result — ${data.attempt.testTitle}`} description="Your genuine, server-calculated test result and question-wise review." />
      <Breadcrumbs items={[{ label: 'My Results', to: '/my-results' }, { label: `Attempt #${data.attempt.id}` }]} />
      <div className="row-between mb-3" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="eyebrow">Result report</span>
          <h2>{data.attempt.testTitle}</h2>
          <p className="small muted mb-0">Attempt #{data.attempt.id} · Submitted {formatDateTime(data.attempt.submittedAt)} · {data.attempt.submitReason === 'expired' ? 'Auto-submitted at deadline' : 'Submitted by you'}</p>
        </div>
        <div className="btn-group">
          <a className="btn btn-outline btn-sm" href={downloadUrl(`/results/${attemptId}/pdf`)} download><Download size={15} /> Download PDF</a>
          <Link to="/tests" className="btn btn-primary btn-sm">Start another test <ArrowRight size={15} /></Link>
        </div>
      </div>

      {!data.answersRevealed && <div className="mb-2"><Notice kind="warning">The administrator has hidden answer keys for this test. Your score summary is shown, but correct answers and explanations are not revealed.</Notice></div>}
      {data.attempt.submitReason === 'expired' && <div className="mb-2"><Notice kind="info">The server deadline was reached, so this attempt was finalised automatically using the answers saved up to that point.</Notice></div>}

      <Card className="card-pad mb-3">
        <div className="row" style={{ gap: 24, alignItems: 'center' }}>
          <ProgressRing value={s.percentage} label="final %" color={s.percentage >= 60 ? 'var(--success)' : s.percentage >= 35 ? 'var(--warning)' : 'var(--danger)'} />
          <div className="grow">
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <Badge tone={s.percentage >= 60 ? 'green' : s.percentage >= 35 ? 'amber' : 'red'}>{s.marksObtained} / {s.marksPossible} marks</Badge>
              <Badge tone="blue">{s.accuracy}% accuracy</Badge>
            </div>
            <h3 style={{ fontSize: '1.2rem' }}>{s.correct} correct out of {s.attempted} attempted</h3>
            <p className="small muted mb-0">Calculated on the server from your stored answers and the configured marking scheme. Negative marks applied: {s.negativeMarks}.</p>
          </div>
        </div>
        <div className="stat-grid mt-3">
          <Stat label="Total questions" value={s.totalQuestions} icon={<FileQuestion size={17} />} />
          <Stat label="Attempted" value={s.attempted} icon={<Target size={17} />} />
          <Stat label="Correct" value={s.correct} icon={<CheckCircle2 size={17} />} tone="var(--success)" />
          <Stat label="Incorrect" value={s.incorrect} icon={<XCircle size={17} />} tone="var(--danger)" />
          <Stat label="Unanswered" value={s.unanswered} icon={<ListFilter size={17} />} tone="var(--muted)" />
          <Stat label="Marks obtained" value={`${s.marksObtained}/${s.marksPossible}`} icon={<Award size={17} />} />
          <Stat label="Accuracy" value={`${s.accuracy}%`} icon={<Target size={17} />} />
          <Stat label="Time taken" value={formatDuration(s.timeTakenSeconds)} icon={<Clock3 size={17} />} />
        </div>
        <p className="tiny muted mt-2 mb-0">Average time per question: {s.averageSecondsPerQuestion}s · Accuracy counts only attempted questions.</p>
      </Card>

      <div className="row-between mb-2">
        <h3 className="mb-0">Question-wise review</h3>
        <div className="row" style={{ gap: 7 }}>
          {(['all', 'incorrect', 'unanswered', 'correct'] as const).map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'incorrect' ? 'Incorrect' : f === 'unanswered' ? 'Unanswered' : 'Correct'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && <EmptyState title={`No ${filter} questions`} description="Try a different review filter." />}
      <div className="grid" style={{ gap: 12 }}>
        {filtered.map((item) => (
          <Card key={item.position} className={`review-item ${item.outcome}`}>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <strong>Question {String(item.position).padStart(2, '0')}</strong>
                <Badge tone={item.outcome === 'correct' ? 'green' : item.outcome === 'incorrect' ? 'red' : 'gray'}>
                  {item.outcome === 'correct' ? 'Correct' : item.outcome === 'incorrect' ? 'Incorrect' : 'Unanswered'}
                </Badge>
                {item.subjectName && <span className="tiny muted">{item.subjectName}{item.topicName ? ` · ${item.topicName}` : ''}</span>}
              </div>
              <div className="row tiny muted" style={{ gap: 10 }}><span>{item.marksAwarded >= 0 ? '+' : ''}{item.marksAwarded} marks</span><span>{item.timeSpentSeconds}s</span></div>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.text}</div>
            {item.imageUrl && <img src={item.imageUrl} alt="Question diagram" style={{ maxWidth: '100%', marginBottom: 8 }} />}
            {item.options.map((o) => {
              const isSelected = item.selectedOptionIds.includes(o.id);
              const isCorrect = data.answersRevealed && item.correctOptionIds?.includes(o.id);
              return (
                <div key={o.id} className={`review-option ${isCorrect ? 'is-correct' : ''} ${isSelected && item.outcome === 'incorrect' ? 'is-wrong' : ''} ${isSelected ? 'is-selected' : ''}`}>
                  <strong>{o.label}.</strong><span className="grow">{o.text}</span>
                  {isSelected && <span className="tiny muted">Your answer</span>}
                  {isCorrect && <span className="tiny" style={{ color: 'var(--success)', fontWeight: 700 }}>Correct answer</span>}
                </div>
              );
            })}
            {data.answersRevealed && item.explanation && <div className="alert alert-info mt-2" style={{ fontSize: '.82rem' }}><strong>Explanation:</strong> {item.explanation}</div>}
          </Card>
        ))}
      </div>

      <Card className="card-pad mt-3">
        <h3 className="mb-2">What next?</h3>
        <div className="btn-group">
          <Button variant="primary" loading={busy === 'incorrect'} disabled={!data.review.some((r) => r.outcome === 'incorrect')} onClick={() => retry('incorrect')}><RotateCcw size={16} /> Retry incorrect questions</Button>
          <Button variant="outline" loading={busy === 'unanswered'} disabled={!data.review.some((r) => r.outcome === 'unanswered')} onClick={() => retry('unanswered')}><FileQuestion size={16} /> Practise unanswered</Button>
          <Button variant="outline" loading={busy === 'bookmark'} disabled={!data.review.some((r) => r.outcome === 'incorrect')} onClick={saveAllIncorrect}><Bookmark size={16} /> Save incorrect to revision</Button>
          <Button variant="outline" loading={busy === 'test'} onClick={() => retry('test')}><RotateCcw size={16} /> Reattempt full test</Button>
          <Link to="/dashboard" className="btn btn-ghost"><Home size={16} /> Dashboard</Link>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <div className="row" style={{ gap: 7, color: tone || 'var(--secondary)', marginBottom: 4 }}>{icon}</div>
      <div className="value" style={{ color: tone || 'var(--text)' }}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
