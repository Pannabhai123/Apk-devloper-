import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileQuestion, Globe2, Info, Play, Target } from 'lucide-react';
import { api, formatError } from '../api/client';
import { Badge, Breadcrumbs, Button, Card, ErrorState, Loading, Notice, PageMeta } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { titleCase } from '../lib/format';
import { useApp } from '../context/AppContext';

interface TestConfig {
  id: number; slug: string; title: string; description: string; mode: string; hasPattern: boolean;
  instructions: string | null; durationMinutes: number; questionCount: number;
  customCountEnabled: boolean; customDurationEnabled: boolean; marksPerQuestion: number; negativeMarks: number;
  languages: string[]; practiceFeedback: boolean; resumePolicy: string; autoSubmit: boolean;
  book: { slug: string; title: string } | null; fixedSubject: { name: string } | null; fixedTopic: { name: string } | null;
  pattern: { subject: { name: string } | null; topic: { name: string } | null; count: number }[];
  subjectOptions: { id: number; name: string; question_count: number; hindi_question_count: number }[];
  topicOptions: { id: number; name: string; question_count: number; hindi_question_count: number }[];
}

export function Instructions() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user, settings } = useApp();
  const { data, loading, error, reload } = useApi<TestConfig>(`/tests/${slug}`);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [language, setLanguage] = useState(params.get('language') || 'en');
  const [fullscreen, setFullscreen] = useState(false);

  const subjectId = Number(params.get('subjectId')) || null;
  const topicId = Number(params.get('topicId')) || null;
  const overrideCount = Number(params.get('count')) || null;
  const overrideDuration = Number(params.get('duration')) || null;
  const overrideMode = params.get('mode');
  const subjectName = data?.subjectOptions.find((s) => s.id === subjectId)?.name || data?.fixedSubject?.name || 'All Subjects (Mix)';
  const topicName = data?.topicOptions.find((t) => t.id === topicId)?.name || data?.fixedTopic?.name || 'All Topics (Mix)';
  const count = overrideCount && data?.customCountEnabled ? overrideCount : data?.questionCount || 0;
  const duration = overrideDuration && data?.customDurationEnabled ? overrideDuration : data?.durationMinutes || 0;
  const modeLabel = titleCase(overrideMode || data?.mode || 'practice');
  const maxMarks = count * (data?.marksPerQuestion || 1);
  const languages = data?.languages || ['en'];

  const start = async () => {
    if (!data) return;
    setStarting(true); setStartError('');
    try {
      const result = await api.post<{ attemptId: number; resumed: boolean }>('/attempts', {
        testId: data.id,
        language,
        ...(subjectId ? { subjectId } : {}),
        ...(topicId ? { topicId } : {}),
        ...(overrideCount && data.customCountEnabled ? { questionCount: overrideCount } : {}),
        ...(overrideDuration && data.customDurationEnabled ? { durationMinutes: overrideDuration } : {}),
        ...(overrideMode ? { mode: overrideMode } : {}),
        clientRequestId: crypto.randomUUID(),
      });
      if (fullscreen) sessionStorage.setItem('vp_request_fullscreen', '1');
      nav(`/test/${result.attemptId}/attempt`, { replace: true });
    } catch (err) {
      setStartError(formatError(err));
    } finally { setStarting(false); }
  };

  return (
    <div className="container section container-narrow">
      <PageMeta title={`Instructions — ${data?.title || 'Test'}`} description={`Read the instructions before starting ${data?.title || 'this mock test'}.`} />
      <Breadcrumbs items={[{ label: 'Tests', to: '/tests' }, { label: data?.title || 'Instructions' }]} />
      {loading && <Loading label="Loading test configuration…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <div className="row-between mb-2" style={{ alignItems: 'flex-start' }}>
          <div><span className="eyebrow">Before you begin</span><h2>{data.title}</h2><p className="muted mb-0">{data.description}</p></div>
          <Badge tone="blue">{modeLabel}</Badge>
        </div>

        {!user && settings.guest_tests_enabled === false && (
          <div className="mb-2"><Notice kind="warning">Guest tests are disabled by the administrator. <Link to="/login">Sign in</Link> to start this test.</Notice></div>
        )}
        {startError && <div className="mb-2"><ErrorState message={startError} /></div>}

        <Card className="card-pad mb-2">
          <h3 className="mb-2"><Info size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />Test overview</h3>
          <div className="grid grid-2-sm">
            {[
              { icon: FileQuestion, label: 'Questions', value: String(count) },
              { icon: Clock3, label: 'Total duration', value: `${duration} minutes` },
              { icon: Target, label: 'Maximum marks', value: String(maxMarks) },
              { icon: CheckCircle2, label: 'Marks per correct answer', value: `+${data.marksPerQuestion}` },
              { icon: AlertTriangle, label: 'Negative marking', value: data.negativeMarks > 0 ? `−${data.negativeMarks} per incorrect answer` : 'No negative marking' },
              { icon: Globe2, label: 'Subject / Topic', value: `${subjectName} · ${topicName}` },
            ].map((r) => (
              <div className="row" key={r.label} style={{ gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <r.icon size={17} style={{ color: 'var(--secondary)', flex: 'none' }} />
                <span className="small muted grow">{r.label}</span><strong className="small">{r.value}</strong>
              </div>
            ))}
          </div>
          {data.hasPattern && (
            <div className="mt-2"><strong className="small">Section pattern</strong>
              <div className="row mt-1" style={{ gap: 7 }}>
                {data.pattern.map((p, i) => <Badge key={i} tone="gray">{p.subject?.name || p.topic?.name || 'Mixed'} · {p.count} Qs</Badge>)}
              </div>
            </div>
          )}
          {data.practiceFeedback && <div className="mt-2"><Notice kind="success">Instant feedback is enabled for this practice test. After saving an answer you will see whether it was correct and the explanation.</Notice></div>}
        </Card>

        <Card className="card-pad mb-2">
          <h3 className="mb-2">Language</h3>
          <p className="small muted">Choose how questions are displayed. Your choice is saved with this attempt.</p>
          <div className="row" style={{ gap: 8 }}>
            <button className={`option-card ${language === 'en' ? 'selected' : ''}`} style={{ minWidth: 130 }} onClick={() => setLanguage('en')} disabled={!languages.includes('en')}><strong>English</strong><span>{languages.includes('en') ? 'Available' : 'Not configured'}</span></button>
            <button className={`option-card ${language === 'hi' ? 'selected' : ''}`} style={{ minWidth: 130 }} onClick={() => setLanguage('hi')} disabled={!languages.includes('hi')}><strong>हिन्दी (Hindi)</strong><span>{languages.includes('hi') ? 'Available' : 'Not configured for this test'}</span></button>
          </div>
        </Card>

        <Card className="card-pad mb-2">
          <h3 className="mb-2">Instructions</h3>
          {data.instructions && <div className="alert alert-info mb-2" style={{ whiteSpace: 'pre-wrap' }}>{data.instructions}</div>}
          <ol className="instructions-list">
            <li>The examination has a fixed time limit of {duration} minutes. The countdown begins only when you press “Start Examination”.</li>
            <li>Select the most appropriate answer for each question. Use <strong>Save &amp; Next</strong> to save an answer and move forward.</li>
            <li>Use <strong>Mark for Review</strong> to flag a question you want to revisit later.</li>
            <li>Use the question palette to jump between questions. Its colours and legend describe each state.</li>
            <li>The test {data.autoSubmit ? 'will auto-submit' : 'will be locked'} when the timer expires, according to the server deadline.</li>
            <li>Refreshing or leaving the page {data.resumePolicy === 'resume' ? 'resumes the same attempt with its remaining time — the timer does not reset.' : 'may start a new attempt, as configured by the administrator.'}</li>
            <li>Answers are saved on the server. If the connection drops, the interface will warn you and retry synchronisation.</li>
            <li>Once submitted, answers cannot be changed. Review the confirmation dialog carefully.</li>
          </ol>
          <div className="alert alert-warning mt-2"><AlertTriangle size={17} style={{ flex: 'none' }} /><span>We cannot prevent tab switching, screen capture or closing the browser. Full-screen mode is optional and exiting it will not cancel your attempt.</span></div>
          <label className="checkbox mt-2"><input type="checkbox" checked={fullscreen} onChange={(e) => setFullscreen(e.target.checked)} /><span>Attempt in full-screen mode (requested only after you start; some browsers may block it).</span></label>
        </Card>

        <div className="row-between">
          <Link to={data.book ? `/books/${data.book.slug}` : '/tests'} className="btn btn-outline"><ArrowLeft size={16} /> Cancel</Link>
          <Button size="lg" loading={starting} disabled={!user && settings.guest_tests_enabled === false} onClick={start}><Play size={18} /> Start Examination</Button>
        </div>
        <p className="tiny muted mt-2">Starting the test creates a real server-side attempt with a stored deadline. No marks or answers are pre-filled.</p>
      </>}
    </div>
  );
}
