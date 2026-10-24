import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Bookmark, BookOpen, Brain, CalendarDays, ChevronRight, Clock3, Flame, Play,
  RotateCcw, Target, Trash2, TrendingUp, Trophy, UserRound,
} from 'lucide-react';
import { api, formatError } from '../api/client';
import { Badge, BarList, Breadcrumbs, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, LineChart, Loading, Notice, PageMeta, Pagination } from '../components/ui';
import { useApi, usePagedApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime, formatDuration } from '../lib/format';

interface Analytics {
  summary: { totalAttempts: number; totalQuestions: number; totalCorrect: number; totalIncorrect: number; totalAnswered: number;
    totalUnanswered: number; bestScore: number; averageScore: number; overallAccuracy: number; totalPracticeMinutes: number;
    streakDays: number; todayQuestions: number };
  progression: { label: string; score: number; accuracy: number; timeTaken: number; attemptId: number; testTitle: string }[];
  subjectPerformance: { name: string; slug: string; questions: number; correct: number; attempted: number; incorrect: number; accuracy: number }[];
  topicPerformance: { name: string; slug: string; questions: number; correct: number; attempted: number; incorrect: number; accuracy: number }[];
  repeatedMistakes: { questionId: number; count: number; text: string; topic: string | null }[];
  recentResults: any[];
  recommendations: string[];
  hasEnoughData: boolean;
}

function AnalyticsPanel({ data, dailyGoal, goalProgress }: { data: Analytics; dailyGoal: number; goalProgress: number | null }) {
  const s = data.summary;
  return (
    <>
      <div className="stat-grid">
        <Stat label="Tests attempted" value={s.totalAttempts} icon={<Activity size={17} />} />
        <Stat label="Best score" value={`${s.bestScore}%`} icon={<Trophy size={17} />} tone="var(--success)" />
        <Stat label="Average score" value={`${s.averageScore}%`} icon={<TrendingUp size={17} />} />
        <Stat label="Overall accuracy" value={`${s.overallAccuracy}%`} icon={<Target size={17} />} tone="var(--secondary)" />
        <Stat label="Questions answered" value={s.totalAnswered} icon={<BookOpen size={17} />} />
        <Stat label="Practice time" value={`${s.totalPracticeMinutes} min`} icon={<Clock3 size={17} />} />
        <Stat label="Current streak" value={`${s.streakDays} day${s.streakDays === 1 ? '' : 's'}`} icon={<Flame size={17} />} tone="var(--warning)" />
        <Stat label="Today's questions" value={s.todayQuestions} icon={<CalendarDays size={17} />} />
      </div>
      {dailyGoal > 0 && (
        <Card className="card-pad mt-2">
          <div className="row-between"><strong className="small">Daily goal: {dailyGoal} questions</strong><span className="small muted">{goalProgress}% complete</span></div>
          <div className="bar-track mt-1" style={{ height: 12 }}><div className="bar-fill" style={{ width: `${goalProgress || 0}%`, background: 'var(--accent)' }} /></div>
        </Card>
      )}
      {data.recommendations.length > 0 && (
        <Card className="card-pad mt-2">
          <h3 style={{ fontSize: '1rem', marginBottom: 8 }}><Brain size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />Based on your attempts</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="small">{data.recommendations.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}</ul>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: string }) {
  return <div className="stat"><div style={{ color: tone || 'var(--secondary)', marginBottom: 4 }}>{icon}</div><div className="value">{value}</div><div className="label">{label}</div></div>;
}

export function Dashboard() {
  const { user } = useApp();
  const { data, loading, error, reload } = useApi<Analytics & { dailyGoal: number; goalProgress: number | null }>('/analytics/overview');
  return (
    <div className="container section">
      <PageMeta title="My Dashboard" />
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      <div className="row-between mb-3">
        <div><span className="eyebrow">Student area</span><h2>{user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Your practice dashboard'}</h2><p className="muted mb-0">{user ? 'All statistics below come from your stored attempts.' : 'Guest progress is stored in this browser session. Sign in to keep it across devices.'}</p></div>
        <Link to="/exams" className="btn btn-primary"><Play size={16} /> Start a mock test</Link>
      </div>
      {!user && <div className="mb-2"><Notice kind="info"><Link to="/register">Create a free account</Link> to sync your results, bookmarks and revision list across devices. Your current guest attempts will be claimed when you sign in.</Notice></div>}
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.summary.totalAttempts === 0 ? (
        <EmptyState title="No attempts yet" description="Your dashboard will fill with real statistics after your first submitted test. Nothing is simulated." icon={<Activity size={34} />}
          action={<Link to="/exams" className="btn btn-primary">Start your first mock test</Link>} />
      ) : (
        <>
          <AnalyticsPanel data={data} dailyGoal={data.dailyGoal} goalProgress={data.goalProgress} />
          <div className="grid grid-2-sm mt-3" style={{ alignItems: 'start' }}>
            <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Recent results</h3>
              {data.recentResults.map((r) => (
                <Link to={`/test/result/${r.id}`} className="row-between" key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9', color: 'var(--text)' }}>
                  <span style={{ minWidth: 0 }}><strong className="small truncate" style={{ display: 'block' }}>{r.test_title}</strong><span className="tiny muted">{formatDateTime(r.submitted_at)}</span></span>
                  <span className="row" style={{ gap: 8 }}><Badge tone={r.percentage >= 60 ? 'green' : 'blue'}>{r.percentage}%</Badge><ChevronRight size={16} /></span>
                </Link>
              ))}
              <Link to="/my-results" className="btn btn-outline btn-sm btn-block mt-2">View all results</Link>
            </Card>
            <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Score progression</h3>
              <LineChart points={data.progression.map((p) => ({ label: p.label, value: p.score, secondary: p.accuracy }))} />
              <Link to="/my-progress" className="btn btn-outline btn-sm btn-block mt-2">Detailed analytics</Link>
            </Card>
          </div>
        </>
      ))}
    </div>
  );
}

export function MyResults() {
  const [page, setPage] = useState(1);
  const { data: list, meta, loading, error, reload } = usePagedApi<any>(`/results?page=${page}&limit=15`, [page]);
  return (
    <div className="container section">
      <PageMeta title="My Results" />
      <Breadcrumbs items={[{ label: 'My Results' }]} />
      <div className="row-between mb-3"><div><h2>My results</h2><p className="muted mb-0">{meta ? `${meta.total} submitted attempt(s)` : 'Your submitted attempts'}</p></div><Link to="/exams" className="btn btn-primary btn-sm">New test</Link></div>
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {list && list.length === 0 && <EmptyState title="No results yet" description="Submit a mock test to see your genuine result report here." action={<Link to="/exams" className="btn btn-primary">Start a test</Link>} />}
      {list && list.length > 0 && (
        <div className="grid" style={{ gap: 10 }}>
          {list.map((r) => (
            <Link to={`/test/result/${r.id}`} className="card card-pad card-hover" key={r.id} style={{ display: 'block' }}>
              <div className="row-between">
                <div style={{ minWidth: 0 }}><strong>{r.test_title}</strong><div className="tiny muted mt-1">{formatDateTime(r.submitted_at)} · {r.submit_reason === 'expired' ? 'auto-submitted' : 'submitted'} · {r.language === 'hi' ? 'Hindi' : 'English'}</div></div>
                <div className="row" style={{ gap: 8 }}><Badge tone={r.percentage >= 60 ? 'green' : r.percentage >= 35 ? 'amber' : 'red'}>{r.percentage}%</Badge><ChevronRight size={17} /></div>
              </div>
              <div className="row small muted mt-2" style={{ gap: 16 }}>
                <span>{r.marks_obtained}/{r.marks_possible} marks</span><span>{r.correct_count} correct</span><span>{r.incorrect_count} incorrect</span><span>{r.unanswered_count} unanswered</span><span>{formatDuration(r.time_taken_seconds)}</span>
              </div>
            </Link>
          ))}
          {meta && <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />}
        </div>
      )}
    </div>
  );
}

export function MyProgress() {
  const { data, loading, error, reload } = useApi<Analytics>('/analytics/overview');
  return (
    <div className="container section">
      <PageMeta title="My Progress" description="Score progression, accuracy and topic analysis from your own test attempts." />
      <Breadcrumbs items={[{ label: 'My Progress' }]} />
      <h2 className="mb-1">Performance analytics</h2>
      <p className="muted">Every chart below is computed from your stored answers. Recommendations appear only after three completed attempts.</p>
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && (data.summary.totalAttempts === 0 ? <EmptyState title="No analytics yet" description="Complete at least one test to generate your first real analytics." action={<Link to="/exams" className="btn btn-primary">Start a test</Link>} /> : <>
        {!data.hasEnoughData && <div className="mb-2"><Notice kind="info">Complete {3 - data.summary.totalAttempts} more attempt(s) to unlock personalised recommendations. Trends shown now are based on the data available.</Notice></div>}
        <div className="stat-grid">
          <Stat label="Attempts" value={data.summary.totalAttempts} icon={<Activity size={17} />} />
          <Stat label="Accuracy" value={`${data.summary.overallAccuracy}%`} icon={<Target size={17} />} />
          <Stat label="Correct / incorrect" value={`${data.summary.totalCorrect}/${data.summary.totalIncorrect}`} icon={<Brain size={17} />} />
          <Stat label="Practice time" value={`${data.summary.totalPracticeMinutes} min`} icon={<Clock3 size={17} />} />
        </div>
        <div className="grid grid-2-sm mt-3" style={{ alignItems: 'start' }}>
          <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Score &amp; accuracy over time</h3><LineChart points={data.progression.map((p) => ({ label: p.label, value: p.score, secondary: p.accuracy }))} /></Card>
          <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Time management</h3><LineChart points={data.progression.map((p) => ({ label: p.label, value: Math.round(p.timeTaken / 60) }))} height={170} label="Minutes" /></Card>
          <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Subject accuracy</h3><BarList items={data.subjectPerformance.filter((s) => s.attempted > 0).map((s) => ({ name: s.name, value: s.accuracy, detail: `${s.correct}/${s.attempted}` }))} /></Card>
          <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Topic accuracy</h3><BarList items={data.topicPerformance.filter((t) => t.attempted > 0).slice(0, 12).map((t) => ({ name: t.name, value: t.accuracy }))} color="var(--accent)" /></Card>
        </div>
        <Card className="card-pad mt-3"><h3 style={{ fontSize: '1rem' }}>Repeated mistakes</h3>
          {data.repeatedMistakes.length === 0 ? <p className="small muted mb-0">No question has been answered incorrectly more than once yet.</p> : (
            <div className="grid" style={{ gap: 8 }}>{data.repeatedMistakes.map((m) => (
              <div className="row-between" key={m.questionId} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="small grow"><strong>{m.text}</strong><span className="tiny muted" style={{ display: 'block' }}>{m.topic || 'General'}</span></span>
                <Badge tone="red">Wrong {m.count}×</Badge>
              </div>
            ))}</div>
          )}
          <Link to="/revision" className="btn btn-outline btn-sm mt-2">Open revision list</Link>
        </Card>
      </>)}
    </div>
  );
}

export function BookmarksPage() {
  const { data, loading, error, reload } = useApi<any[]>('/bookmarks');
  const toast = useToast();
  const remove = async (id: number) => {
    try { await api.del(`/bookmarks/${id}`); reload(); toast('Bookmark removed.', 'success'); }
    catch (err) { toast(formatError(err), 'error'); }
  };
  return (
    <div className="container section">
      <PageMeta title="Bookmarks" />
      <Breadcrumbs items={[{ label: 'Bookmarks' }]} />
      <div className="row-between mb-3"><div><h2>Bookmarked questions</h2><p className="muted mb-0">Saved questions for quick revision. Guest bookmarks live in this browser session.</p></div><Link to="/revision" className="btn btn-outline btn-sm">Revision list</Link></div>
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No bookmarks yet" description="Use “Save question” during a test or from a result review to build your list." icon={<Bookmark size={34} />} action={<Link to="/tests" className="btn btn-primary">Browse tests</Link>} />}
      <div className="grid" style={{ gap: 10 }}>
        {data?.map((b) => (
          <Card className="card-pad row-between" key={b.id}>
            <div style={{ minWidth: 0 }}><strong className="small">{b.text_en}</strong><div className="tiny muted mt-1">{b.subject_name || 'General'}{b.topic_name ? ` · ${b.topic_name}` : ''} · {formatDateTime(b.created_at)}</div>{b.note && <div className="small muted mt-1">Note: {b.note}</div>}</div>
            <Button size="sm" variant="ghost" onClick={() => remove(b.id)} aria-label="Remove bookmark"><Trash2 size={16} /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Revision() {
  const { data, loading, error, reload } = useApi<{ incorrectCount: number; saved: any[]; questions: any[] }>('/revision');
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const retry = async (filter: 'incorrect' | 'unanswered' | 'bookmarked') => {
    try {
      setBusy(filter);
      const first = await api.get<any[]>('/results?page=1&limit=1');
      if (!first.length) { toast('Complete a test first to build a revision set.', 'info'); return; }
      const result = await api.post<{ attemptId: number }>('/attempts/retry', { attemptId: first[0].id, filter });
      nav(`/test/${result.attemptId}/attempt`);
    } catch (err) { toast(formatError(err), 'error'); } finally { setBusy(''); }
  };
  return (
    <div className="container section">
      <PageMeta title="Revision List" />
      <Breadcrumbs items={[{ label: 'Revision' }]} />
      <div className="row-between mb-3"><div><h2>Revision list</h2><p className="muted mb-0">Questions you answered incorrectly, left unanswered, or bookmarked — grouped from real attempts.</p></div>
        <div className="btn-group"><Button size="sm" loading={busy === 'incorrect'} onClick={() => retry('incorrect')}><RotateCcw size={15} /> Retry incorrect</Button><Button size="sm" variant="outline" loading={busy === 'unanswered'} onClick={() => retry('unanswered')}>Practise unanswered</Button></div>
      </div>
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && data.questions.length === 0 && data.saved.length === 0 && <EmptyState title="Nothing to revise yet" description="After a test, incorrect and unanswered questions appear here automatically." action={<Link to="/exams" className="btn btn-primary">Start a test</Link>} />}
      {data && data.questions.length > 0 && <>
        <h3 className="mb-2">From your attempts ({data.questions.length})</h3>
        <div className="grid" style={{ gap: 10 }}>
          {data.questions.map((q) => (
            <Card className="card-pad" key={q.questionId}>
              <div className="row-between" style={{ marginBottom: 6 }}><strong className="small">{q.textEn}</strong><Badge tone={q.wrongCount ? 'red' : 'gray'}>{q.wrongCount ? `Wrong ${q.wrongCount}×` : `Unanswered ${q.unansweredCount}×`}</Badge></div>
              <div className="tiny muted">{q.subjectName || 'General'}{q.topicName ? ` · ${q.topicName}` : ''}</div>
              {q.explanation && <div className="alert alert-info mt-2" style={{ fontSize: '.8rem' }}>{q.explanation}</div>}
            </Card>
          ))}
        </div>
      </>}
      {data && data.saved.length > 0 && <><h3 className="mt-4 mb-2">Saved questions ({data.saved.length})</h3><div className="grid" style={{ gap: 10 }}>{data.saved.map((q) => (
        <Card className="card-pad" key={q.bookmark_id}><strong className="small">{q.text_en}</strong><div className="tiny muted mt-1">{q.subject_name || 'General'}{q.topic_name ? ` · ${q.topic_name}` : ''}</div></Card>
      ))}</div></>}
    </div>
  );
}

export function Profile() {
  const { user, settings, refresh, setUser } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [dailyGoal, setDailyGoal] = useState(user?.dailyGoal || 0);
  const [locale, setLocale] = useState(user?.locale || 'en');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/profile', { name, phone, dailyGoalQuestions: dailyGoal, locale });
      await refresh(); toast('Profile updated.', 'success');
    } catch (err) { toast(formatError(err), 'error'); } finally { setSaving(false); }
  };
  const remove = async () => {
    setDeleting(true);
    try { await api.del('/auth/account', { password: deletePassword }); setUser(null); toast('Your account has been deleted.', 'success'); nav('/'); }
    catch (err) { toast(formatError(err), 'error'); } finally { setDeleting(false); }
  };

  return (
    <div className="container section container-narrow">
      <PageMeta title="My Profile" />
      <Breadcrumbs items={[{ label: 'Profile' }]} />
      <h2 className="mb-3">Profile &amp; privacy</h2>
      {!user ? <EmptyState title="Sign in to manage your account" description="Guest attempts stay in this browser session. An account keeps them across devices." action={<Link to="/login" className="btn btn-primary">Sign in</Link>} /> : <>
        <Card className="card-pad mb-2">
          <h3 style={{ fontSize: '1rem' }}><UserRound size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />Account details</h3>
          <div className="grid grid-2-sm mt-2">
            <Field label="Full name" htmlFor="p-name"><input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email (read-only)"><input className="input" value={user.email} disabled /></Field>
            <Field label="Mobile number" htmlFor="p-phone" hint="Optional. Used only for account-related communication if enabled."><input id="p-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" /></Field>
            <Field label="Preferred language" htmlFor="p-locale"><select id="p-locale" className="select" value={locale} onChange={(e) => setLocale(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></Field>
            <Field label="Daily question goal" htmlFor="p-goal" hint="Set 0 to disable the goal tracker."><input id="p-goal" className="input" type="number" min={0} max={1000} value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} /></Field>
          </div>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </Card>
        <Card className="card-pad mb-2">
          <h3 style={{ fontSize: '1rem' }}>Your data</h3>
          <p className="small muted">We store your account email, optional phone number, test attempts, answers, bookmarks and question reports. Passwords are hashed with scrypt and are never exported or logged.</p>
          <div className="btn-group"><Link to="/my-results" className="btn btn-outline btn-sm">View my results</Link><Link to="/bookmarks" className="btn btn-outline btn-sm">My bookmarks</Link><Link to="/privacy-policy" className="btn btn-ghost btn-sm">Privacy policy</Link></div>
        </Card>
        <Card className="card-pad">
          <h3 style={{ fontSize: '1rem', color: 'var(--danger)' }}>Delete account</h3>
          <p className="small muted">This removes your account, sessions and bookmarks. Submitted attempt records are anonymised so platform statistics remain accurate. This cannot be undone.</p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> Delete my account</Button>
        </Card>
      </>}
      <ConfirmDialog open={deleteOpen} title="Delete your account?" danger confirmLabel="Delete permanently" loading={deleting}
        onCancel={() => setDeleteOpen(false)} onConfirm={remove}
        message={<><p>Enter your password to confirm. Your personal data will be removed and attempts anonymised.</p><input className="input" type="password" placeholder="Your password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /></>} />
      {settings.contact_email && <p className="tiny muted mt-3">Questions about your data? Contact {settings.contact_email}.</p>}
    </div>
  );
}

export function StudentSettings() {
  const { settings } = useApp();
  return (
    <div className="container section container-narrow">
      <PageMeta title="Settings" />
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      <h2 className="mb-3">Settings</h2>
      <div className="grid" style={{ gap: 12 }}>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Practice</h3><p className="small muted">Daily goals and preferred language are managed in your <Link to="/profile">profile</Link>. Test language is chosen on the instruction screen.</p></Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Platform configuration</h3>
          <div className="summary-box">
            <div className="summary-row"><span>Guest tests</span><strong>{settings.guest_tests_enabled === false ? 'Disabled' : 'Enabled'}</strong></div>
            <div className="summary-row"><span>Registration</span><strong>{settings.allow_registration === false ? 'Closed' : 'Open'}</strong></div>
            <div className="summary-row"><span>Default language</span><strong>{settings.default_language || 'English'}</strong></div>
            <div className="summary-row"><span>Result visibility</span><strong>{settings.result_visibility === 'hidden' ? 'Score only' : 'Answers after submit'}</strong></div>
            <div className="summary-row"><span>Maintenance mode</span><strong>{settings.maintenance_mode ? 'On' : 'Off'}</strong></div>
          </div>
          <p className="tiny muted mt-2 mb-0">These settings are controlled by authorised administrators.</p>
        </Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Install the app</h3><p className="small muted">VidyaPariksha is installable as a Progressive Web App on supported browsers. Static assets are cached, but examinations still require a server connection for saving answers and scoring.</p><Link to="/help" className="btn btn-outline btn-sm">Read the help guide</Link></Card>
      </div>
    </div>
  );
}
