import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart3, BookMarked, BookOpen, ClipboardList, FileQuestion, Flag, GraduationCap,
  Layers, LayoutDashboard, LockKeyhole, Settings as SettingsIcon, ShieldCheck, Tags, Users, ScrollText, Mail,
} from 'lucide-react';
import { api, formatError } from '../../api/client';
import { Badge, BarList, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, LineChart, Loading, Notice, PageMeta, Pagination } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { formatDateTime } from '../../lib/format';
import { AdminHeader, CrudPage, DataTable, ResourceFormModal, useResource, type Column, type FieldDef } from './shared';

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, perm: null, end: true },
  { to: '/admin/books', label: 'Books', icon: BookOpen, perm: 'catalog.manage' },
  { to: '/admin/categories', label: 'Categories', icon: Tags, perm: 'catalog.manage' },
  { to: '/admin/subjects', label: 'Subjects', icon: GraduationCap, perm: 'catalog.manage' },
  { to: '/admin/topics', label: 'Topics', icon: Layers, perm: 'catalog.manage' },
  { to: '/admin/questions', label: 'Questions', icon: FileQuestion, perm: 'questions.manage' },
  { to: '/admin/tests', label: 'Tests', icon: ClipboardList, perm: 'tests.manage' },
  { to: '/admin/attempts', label: 'Attempts', icon: Activity, perm: 'attempts.view' },
  { to: '/admin/students', label: 'Students', icon: Users, perm: 'users.manage' },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, perm: 'analytics.view' },
  { to: '/admin/reports', label: 'Reports & Messages', icon: Flag, perm: 'reports.manage' },
  { to: '/admin/settings', label: 'Site Settings', icon: SettingsIcon, perm: 'settings.manage' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, perm: 'analytics.view' },
];

export function AdminLayout() {
  const { user, ready } = useApp();
  const nav = useNavigate();
  const allowed = ADMIN_NAV.filter((n) => !n.perm || user?.permissions.includes(n.perm));
  useEffect(() => { if (ready && !user) nav('/login?next=/admin'); }, [ready, user, nav]);
  if (!ready) return <div className="container section"><Loading label="Checking permissions…" /></div>;
  if (!user) return <div className="container section"><PageMeta title="Admin" /><Notice kind="warning">Sign in to access the administration panel.</Notice><Link to="/login?next=/admin" className="btn btn-primary mt-2">Sign in</Link></div>;
  if (user.permissions.length === 0) return <div className="container section"><PageMeta title="Access denied" /><EmptyState title="Administrator access required" description="Your account does not have any administrative permissions." icon={<LockKeyhole size={34} />} action={<Link to="/" className="btn btn-primary">Go home</Link>} /></div>;
  return (
    <div className="admin-shell">
      <PageMeta title="Admin Panel" />
      <aside className="admin-sidebar">
        <div className="row" style={{ gap: 8, padding: '4px 10px 16px', color: '#fff' }}><ShieldCheck size={19} /><strong className="small">Administration</strong></div>
        <nav aria-label="Admin navigation">{allowed.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => isActive ? 'active' : ''}><n.icon size={17} /> {n.label}</NavLink>
        ))}</nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.12)', marginTop: 16, paddingTop: 12 }}>
          <Link to="/" className="" style={{ color: '#B7C8DF', fontSize: '.8rem', padding: '8px 12px', display: 'block' }}>← Back to website</Link>
          <div className="tiny" style={{ color: '#8FA8C7', padding: '8px 12px' }}>Signed in as {user.email}<br />Role: {user.role}</div>
        </div>
      </aside>
      <div>
        <div className="admin-mobile-nav">{allowed.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => isActive ? 'active' : ''}>{n.label}</NavLink>)}</div>
        <main className="admin-main"><Outlet /></main>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const { data, loading, error, reload } = useApi<any>('/admin/overview');
  return (
    <>
      <AdminHeader title="Admin overview" description="All figures below are counted from database records in real time." action={<Button size="sm" variant="outline" onClick={reload}>Refresh</Button>} />
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <div className="grid grid-2-sm grid-4-lg">
          {[
            ['Registered students', data.totalStudents], ['Guest attempts', data.guestAttempts],
            ['Question bank', data.totalQuestions], ['Published questions', data.publishedQuestions],
            ['Books', data.totalBooks], ['Subjects', data.totalSubjects], ['Topics', data.totalTopics],
            ['Published tests', data.publishedTests], ['Active sessions', data.activeSessions],
            ['Completed attempts', data.completedAttempts], ['Open reports', data.openReports], ['Audit events', data.recentActivity.length],
          ].map(([label, value]) => <Card className="stat-card" key={String(label)}><div className="k">{value as number}</div><div className="l">{label as string}</div></Card>)}
        </div>
        <div className="grid grid-2-sm mt-3" style={{ alignItems: 'start' }}>
          <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Attempts by day</h3>
            <LineChart points={[...data.attemptsByDay].reverse().map((d: any) => ({ label: d.day.slice(5), value: d.attempts }))} height={170} label="Attempts" />
          </Card>
          <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Recent administrative activity</h3>
            {data.recentActivity.length === 0 && <p className="small muted">No administrative actions have been recorded yet.</p>}
            {data.recentActivity.map((a: any) => (
              <div key={a.id} className="row-between" style={{ padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span className="small"><strong>{a.action}</strong><span className="tiny muted" style={{ display: 'block' }}>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''} · {a.actor_email || 'system'}</span></span>
                <span className="tiny muted">{formatDateTime(a.created_at)}</span>
              </div>
            ))}
          </Card>
        </div>
      </>}
    </>
  );
}

export function AdminCategories() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Category name', type: 'text', required: true },
    { name: 'slug', label: 'Slug (optional)', type: 'text', hint: 'Lowercase letters, numbers and hyphens. Generated automatically if blank.' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'icon', label: 'Icon key', type: 'text', default: 'book', hint: 'e.g. train, book, monitor, trophy, landmark' },
    { name: 'color', label: 'Colour', type: 'color', default: '#2563EB' },
    { name: 'sortOrder', label: 'Sort order', type: 'number', default: 0, min: 0 },
    { name: 'isActive', label: 'Active (visible on site)', type: 'checkbox', default: true },
  ];
  const columns: Column<any>[] = [
    { key: 'name', label: 'Category', render: (r) => <span><strong>{r.name}</strong><span className="tiny muted" style={{ display: 'block' }}>/{r.slug}</span></span> },
    { key: 'description', label: 'Description', render: (r) => <span className="small muted truncate" style={{ display: 'block', maxWidth: 260 }}>{r.description || '—'}</span> },
    { key: 'book_count', label: 'Books' }, { key: 'test_count', label: 'Tests' },
    { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Hidden'}</Badge> },
    { key: 'sort_order', label: 'Order' },
  ];
  return <CrudPage title="Categories" description="Create unlimited exam categories. Only active categories appear publicly." endpoint="/admin/categories"
    fields={fields} columns={columns}
    toForm={(v) => ({ ...v, isActive: Boolean(v.isActive) })}
    fromRow={(r) => ({ name: r.name, slug: r.slug, description: r.description, icon: r.icon, color: r.color, sortOrder: r.sort_order, isActive: Boolean(r.is_active) })} />;
}

export function AdminSubjects() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Subject name', type: 'text', required: true },
    { name: 'slug', label: 'Slug (optional)', type: 'text' },
    { name: 'nameHi', label: 'Hindi name', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'icon', label: 'Icon key', type: 'text', default: 'book-open' },
    { name: 'sortOrder', label: 'Sort order', type: 'number', default: 0 },
    { name: 'isActive', label: 'Active', type: 'checkbox', default: true },
  ];
  const columns: Column<any>[] = [
    { key: 'name', label: 'Subject', render: (r) => <span><strong>{r.name}</strong>{r.name_hi && <span className="tiny muted" style={{ display: 'block' }}>{r.name_hi}</span>}</span> },
    { key: 'slug', label: 'Slug' }, { key: 'topic_count', label: 'Topics' }, { key: 'question_count', label: 'Questions' },
    { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Hidden'}</Badge> },
  ];
  return <CrudPage title="Subjects" description="Subjects are shared database records used by books, questions and tests." endpoint="/admin/subjects"
    fields={fields} columns={columns} toForm={(v) => v}
    fromRow={(r) => ({ name: r.name, slug: r.slug, nameHi: r.name_hi, description: r.description, icon: r.icon, sortOrder: r.sort_order, isActive: Boolean(r.is_active) })} />;
}

export function AdminTopics() {
  const subjects = useApi<any[]>('/admin/subjects');
  const fields: FieldDef[] = [
    { name: 'subjectId', label: 'Subject', type: 'select', required: true, options: (subjects.data || []).map((s) => ({ value: s.id, label: s.name })) },
    { name: 'name', label: 'Topic name', type: 'text', required: true },
    { name: 'slug', label: 'Slug (optional)', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'sortOrder', label: 'Sort order', type: 'number', default: 0 },
    { name: 'isActive', label: 'Active', type: 'checkbox', default: true },
  ];
  const columns: Column<any>[] = [
    { key: 'name', label: 'Topic' }, { key: 'subject_name', label: 'Subject' }, { key: 'question_count', label: 'Questions' },
    { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Hidden'}</Badge> },
    { key: 'sort_order', label: 'Order' },
  ];
  return <CrudPage title="Topics" description="Assign topics to subjects. Question counts come from the database." endpoint="/admin/topics"
    fields={fields} columns={columns} toForm={(v) => ({ ...v, subjectId: Number(v.subjectId) })}
    fromRow={(r) => ({ subjectId: r.subject_id, name: r.name, slug: r.slug, description: r.description, sortOrder: r.sort_order, isActive: Boolean(r.is_active) })} />;
}

export function AdminBooks() {
  const categories = useApi<any[]>('/admin/categories');
  const subjects = useApi<any[]>('/admin/subjects');
  const topics = useApi<any[]>('/admin/topics');
  const fields: FieldDef[] = [
    { name: 'title', label: 'Book title', type: 'text', required: true },
    { name: 'slug', label: 'Slug (optional)', type: 'text' },
    { name: 'description', label: 'Short description', type: 'textarea' },
    { name: 'coverUrl', label: 'Cover image URL', type: 'text', hint: 'Upload an image below or paste a URL. Generated covers are used when blank.' },
    { name: 'badge', label: 'Badge', type: 'select', options: [{ value: 'new', label: 'New' }, { value: 'popular', label: 'Popular' }] },
    { name: 'sortOrder', label: 'Sort order', type: 'number', default: 0 },
    { name: 'isActive', label: 'Available', type: 'checkbox', default: true },
    { name: 'categoryIds', label: 'Exam categories', type: 'multiselect', options: (categories.data || []).map((c) => ({ value: c.id, label: c.name })) },
    { name: 'subjectIds', label: 'Subjects', type: 'multiselect', options: (subjects.data || []).map((s) => ({ value: s.id, label: s.name })) },
    { name: 'topicIds', label: 'Topics', type: 'multiselect', options: (topics.data || []).map((t) => ({ value: t.id, label: `${t.name} (${t.subject_name})` })) },
  ];
  const columns: Column<any>[] = [
    { key: 'title', label: 'Book', render: (r) => <span><strong>{r.title}</strong><span className="tiny muted" style={{ display: 'block' }}>/{r.slug}</span></span> },
    { key: 'category_slugs', label: 'Categories', render: (r) => <span className="small muted">{r.category_slugs || '—'}</span> },
    { key: 'question_count', label: 'Questions' }, { key: 'test_count', label: 'Tests' },
    { key: 'badge', label: 'Badge', render: (r) => r.badge ? <Badge tone={r.badge === 'new' ? 'new' : 'popular'}>{r.badge}</Badge> : '—' },
    { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Hidden'}</Badge> },
  ];
  return <CrudPage title="Books" description="Manage collections, covers, badges, availability and category/subject/topic assignments." endpoint="/admin/books"
    fields={fields} columns={columns}
    toForm={(v) => ({ ...v, badge: v.badge || null, categoryIds: v.categoryIds || [], subjectIds: v.subjectIds || [], topicIds: v.topicIds || [] })}
    fromRow={async (r) => {
      const detail = await api.get<any>(`/books/${r.slug}`);
      return { title: r.title, slug: r.slug, description: r.description, coverUrl: r.cover_url, badge: r.badge || '',
        sortOrder: r.sort_order, isActive: Boolean(r.is_active),
        categoryIds: (categories.data || []).filter((c) => detail.categories?.some((d: any) => d.slug === c.slug)).map((c) => c.id),
        subjectIds: (detail.subjects || []).map((s: any) => s.id), topicIds: (detail.topics || []).map((t: any) => t.id) };
    }} />;
}

export function AdminAttempts() {
  const { rows, meta, page, setPage, loading, error, reload } = useResource<any>('/admin/attempts');
  const [status, setStatus] = useState('');
  const columns: Column<any>[] = [
    { key: 'id', label: '#' }, { key: 'test_title', label: 'Test' },
    { key: 'user_email', label: 'Student', render: (r) => r.user_email || 'Guest' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'submitted' ? 'green' : r.status === 'expired' ? 'amber' : 'blue'}>{r.status}</Badge> },
    { key: 'marks', label: 'Score', render: (r) => r.marks_obtained === null ? '—' : `${r.marks_obtained}/${r.marks_possible}` },
    { key: 'accuracy', label: 'Accuracy', render: (r) => r.accuracy === null ? '—' : `${r.accuracy}%` },
    { key: 'started_at', label: 'Started', render: (r) => <span className="tiny">{formatDateTime(r.started_at)}</span> },
  ];
  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  return <>
    <AdminHeader title="Test attempts" description="Live attempt records including guest sessions and auto-submitted tests."
      action={<div className="row" style={{ gap: 8 }}><select className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status"><option value="">All statuses</option><option value="in_progress">In progress</option><option value="submitted">Submitted</option><option value="expired">Expired</option></select><Button size="sm" variant="outline" onClick={reload}>Refresh</Button></div>} />
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && <><DataTable columns={columns} rows={filtered} actions={(r) => r.status !== 'in_progress' ? <Link className="btn btn-ghost btn-sm" to={`/test/result/${r.id}`}>View</Link> : null} /><Pagination page={page} pages={meta.pages} onChange={setPage} /><p className="tiny muted mt-2">{meta.total} attempt(s) recorded.</p></>}
  </>;
}

export function AdminStudents() {
  const roles = useApi<{ roles: any[] }>('/admin/roles');
  const { rows, meta, page, setPage, loading, error, reload } = useResource<any>('/admin/students');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const toast = useToast();
  const [editing, setEditing] = useState<any | null>(null);
  const [values, setValues] = useState<any>({});
  const [busy, setBusy] = useState(false);

  const filtered = q ? rows.filter((r) => [r.name, r.email, r.phone].some((v) => String(v || '').toLowerCase().includes(q.toLowerCase()))) : rows;
  const columns: Column<any>[] = [
    { key: 'name', label: 'Student', render: (r) => <span><strong>{r.name}</strong><span className="tiny muted" style={{ display: 'block' }}>{r.email}</span></span> },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'role_name', label: 'Role' }, { key: 'attempt_count', label: 'Attempts' },
    { key: 'best_score', label: 'Best', render: (r) => r.best_score === null ? '—' : `${r.best_score}%` },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'green' : 'red'}>{r.status}</Badge> },
    { key: 'created_at', label: 'Joined', render: (r) => <span className="tiny">{formatDateTime(r.created_at)}</span> },
  ];
  return <>
    <AdminHeader title="Students" description="Search accounts, review permitted history, change status and assign authorised roles."
      action={<div className="row" style={{ gap: 8 }}><input className="input" style={{ width: 200 }} placeholder="Search name or email" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setQ(draft); }} /><Button size="sm" variant="outline" onClick={() => setQ(draft)}>Search</Button></div>} />
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && <><DataTable columns={columns} rows={filtered} actions={(r) => <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(r); setValues({ status: r.status, roleId: r.role_id }); }}>Manage</button>} /><Pagination page={page} pages={meta.pages} onChange={setPage} /><p className="tiny muted mt-2">{meta.total} account(s).</p></>}
    <ResourceFormModal open={Boolean(editing)} title="Manage account" onClose={() => setEditing(null)} onSave={async (v) => { setValues(v); await saveWith(v); }}
      initial={editing ? { status: editing.status, roleId: editing.role_id } : null}
      fields={[
        { name: 'status', label: 'Account status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }], required: true },
        { name: 'roleId', label: 'Role', type: 'select', required: true, options: (roles.data?.roles || []).map((r) => ({ value: r.id, label: r.name })) },
      ]} />
    {busy && <Loading label="Saving…" />}
  </>;
  async function saveWith(v: any) { setBusy(true); try { await api.patch(`/admin/students/${editing.id}`, { status: v.status, roleId: Number(v.roleId) }); toast('Account updated.', 'success'); reload(); setEditing(null); } catch (err) { toast(formatError(err), 'error'); throw err; } finally { setBusy(false); } }
}

export function AdminAnalytics() {
  const { data, loading, error, reload } = useApi<any>('/admin/analytics');
  return <>
    <AdminHeader title="Platform analytics" description="Aggregated from real submitted attempts across all students and guests." />
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
    {data && <>
      <div className="stat-grid">
        {[['Attempts', data.summary.totalAttempts], ['Questions answered', data.summary.totalAnswered], ['Correct', data.summary.totalCorrect], ['Incorrect', data.summary.totalIncorrect], ['Average score', `${data.summary.averageScore}%`], ['Overall accuracy', `${data.summary.overallAccuracy}%`], ['Practice minutes', data.summary.totalPracticeMinutes], ['Unanswered', data.summary.totalUnanswered]].map(([l, v]) => <Card className="stat-card" key={String(l)}><div className="k">{v as any}</div><div className="l">{l as string}</div></Card>)}
      </div>
      <div className="grid grid-2-sm mt-3" style={{ alignItems: 'start' }}>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Score &amp; accuracy trend</h3><LineChart points={data.progression.map((p: any) => ({ label: p.label, value: p.score, secondary: p.accuracy }))} /></Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Subject accuracy</h3><BarList items={data.subjectPerformance.filter((s: any) => s.attempted > 0).map((s: any) => ({ name: s.name, value: s.accuracy }))} /></Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Topic accuracy</h3><BarList items={data.topicPerformance.filter((t: any) => t.attempted > 0).slice(0, 15).map((t: any) => ({ name: t.name, value: t.accuracy }))} color="var(--accent)" /></Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Frequently missed questions</h3>{data.repeatedMistakes.length === 0 ? <p className="small muted">No repeated mistakes recorded yet.</p> : data.repeatedMistakes.map((m: any) => <div key={m.questionId} className="row-between small" style={{ padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}><span className="truncate grow">{m.text}</span><Badge tone="red">{m.count}×</Badge></div>)}</Card>
      </div>
      <Card className="card-pad mt-3"><h3 style={{ fontSize: '1rem' }}>Exports</h3><p className="small muted">Exports contain permitted business data only — never passwords, session tokens or answer keys of in-progress attempts.</p>
        <div className="btn-group">{['questions', 'books', 'subjects', 'topics', 'tests', 'results'].map((r) => <a key={r} className="btn btn-outline btn-sm" href={`/api/admin/export/${r}`} download>{r}.csv</a>)}<a className="btn btn-outline btn-sm" href="/api/admin/questions-export" download>full question bank.csv</a></div>
      </Card>
    </>}
  </>;
}

export function AdminSettings() {
  const { data, loading, error, reload } = useApi<Record<string, any>>('/admin/settings');
  const toast = useToast();
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setValues(data as any); }, [data]);
  const [countdown, setCountdown] = useState({ title: '', examDate: '' });
  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));
  const save = async () => { setBusy(true); try { await api.put('/admin/settings', { values }); toast('Settings saved.', 'success'); reload(); } catch (err) { toast(formatError(err), 'error'); } finally { setBusy(false); } };
  const addCountdown = async () => { try { await api.post('/admin/countdowns', countdown); toast('Countdown created.', 'success'); setCountdown({ title: '', examDate: '' }); } catch (err) { toast(formatError(err), 'error'); } };
  return <>
    <AdminHeader title="Site settings" description="Control branding, access policies, legal text and maintenance mode." action={<Button loading={busy} onClick={save}>Save settings</Button>} />
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
    {data && <div className="grid grid-2-sm" style={{ alignItems: 'start' }}>
      <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Branding &amp; content</h3>
        <Field label="Website name" htmlFor="s-name"><input id="s-name" className="input" value={values.site_name || ''} onChange={(e) => set('site_name', e.target.value)} /></Field>
        <Field label="Tagline"><input className="input" value={values.site_tagline || ''} onChange={(e) => set('site_tagline', e.target.value)} /></Field>
        <Field label="Homepage description"><textarea className="textarea" value={values.site_description || ''} onChange={(e) => set('site_description', e.target.value)} /></Field>
        <Field label="Hero badge"><input className="input" value={values.hero_badge || ''} onChange={(e) => set('hero_badge', e.target.value)} /></Field>
        <Field label="Logo URL"><input className="input" value={values.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="Leave blank for the built-in logo" /></Field>
        <div className="grid grid-2-sm"><Field label="Primary colour"><input className="input" type="color" value={values.primary_color || '#0B4FA8'} onChange={(e) => set('primary_color', e.target.value)} /></Field><Field label="Accent colour"><input className="input" type="color" value={values.accent_color || '#14B8A6'} onChange={(e) => set('accent_color', e.target.value)} /></Field></div>
        <Field label="Footer about text"><textarea className="textarea" value={values.footer_about || ''} onChange={(e) => set('footer_about', e.target.value)} /></Field>
        <Field label="Disclaimer"><textarea className="textarea" value={values.disclaimer || ''} onChange={(e) => set('disclaimer', e.target.value)} /></Field>
      </Card>
      <div className="grid" style={{ gap: 14 }}>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Contact information</h3>
          <Field label="Contact email"><input className="input" value={values.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} /></Field>
          <Field label="Contact phone"><input className="input" value={values.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} /></Field>
          <Field label="Address"><input className="input" value={values.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        </Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Access &amp; policies</h3>
          {([['allow_registration', 'Allow new registrations'], ['guest_tests_enabled', 'Allow guest tests'], ['maintenance_mode', 'Maintenance mode (blocks writes)'], ['demo_mode', 'Show demo-content notice']] as const).map(([key, label]) => (
            <label className="checkbox" key={key} style={{ marginBottom: 10 }}><input type="checkbox" checked={Boolean(values[key])} onChange={(e) => set(key, e.target.checked)} /><span className="small"><strong>{label}</strong></span></label>
          ))}
          <Field label="Default language"><select className="select" value={values.default_language || 'en'} onChange={(e) => set('default_language', e.target.value)}><option value="en">English</option><option value="hi">Hindi</option></select></Field>
          <Field label="Default result visibility" hint="Individual tests can override this."><select className="select" value={values.result_visibility || 'after_submit'} onChange={(e) => set('result_visibility', e.target.value)}><option value="after_submit">Reveal answers after submit</option><option value="hidden">Hide answer keys by default</option></select></Field>
        </Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Exam countdown</h3><div className="row" style={{ gap: 8 }}><input className="input" placeholder="Title" value={countdown.title} onChange={(e) => setCountdown({ ...countdown, title: e.target.value })} /><input className="input" type="date" value={countdown.examDate} onChange={(e) => setCountdown({ ...countdown, examDate: e.target.value })} /><Button variant="outline" onClick={addCountdown}>Add</Button></div></Card>
        <Card className="card-pad"><h3 style={{ fontSize: '1rem' }}>Roles &amp; permissions</h3><p className="small muted">Roles are seeded with sensible defaults. Super Admin always retains every permission.</p>
          <RoleEditor />
        </Card>
      </div>
    </div>}
  </>;
}

function RoleEditor() {
  const { data, loading, reload } = useApi<{ roles: any[]; permissions: any[] }>('/admin/roles');
  const toast = useToast();
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const save = async (role: any) => {
    try { await api.put(`/admin/roles/${role.id}/permissions`, { permissions: selected[role.id] || [] }); toast(`${role.name} permissions updated.`, 'success'); reload(); }
    catch (err) { toast(formatError(err), 'error'); }
  };
  if (loading) return <Loading />;
  return <div className="grid" style={{ gap: 12 }}>{data?.roles.filter((r) => r.key !== 'super_admin').map((role) => {
    const initial = String(role.permission_keys || '').split(',').filter(Boolean);
    const current = selected[role.id] || initial;
    return <div key={role.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div className="row-between"><strong className="small">{role.name}</strong><Button size="sm" variant="outline" onClick={() => save(role)}>Save</Button></div>
      <div className="row mt-1" style={{ gap: 8 }}>{data.permissions.map((p) => {
        const checked = current.includes(p.key);
        return <label key={p.key} className="badge badge-gray checkbox" style={{ cursor: 'pointer', padding: '5px 9px' }} title={p.description}>
          <input type="checkbox" checked={checked} onChange={(e) => setSelected((s) => ({ ...s, [role.id]: e.target.checked ? [...current, p.key] : current.filter((k) => k !== p.key) }))} />
          <span className="tiny">{p.key}</span>
        </label>;
      })}</div>
    </div>;
  })}</div>;
}

export function AdminAuditLogs() {
  const { rows, meta, page, setPage, loading, error, reload } = useResource<any>('/admin/audit-logs');
  return <>
    <AdminHeader title="Audit logs" description="Administrative actions with actor, record and timestamp. Passwords and tokens are never logged." />
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
    {!loading && !error && <>
      <DataTable columns={[
        { key: 'created_at', label: 'Time', render: (r) => <span className="tiny">{formatDateTime(r.created_at)}</span> },
        { key: 'actor_email', label: 'Actor', render: (r) => r.actor_email || 'system' },
        { key: 'action', label: 'Action' }, { key: 'entity', label: 'Record', render: (r) => `${r.entity}${r.entity_id ? ` #${r.entity_id}` : ''}` },
        { key: 'metadata', label: 'Details', render: (r) => <span className="tiny muted truncate" style={{ display: 'block', maxWidth: 260 }}>{r.metadata || '—'}</span> },
      ]} rows={rows} /><Pagination page={page} pages={meta.pages} onChange={setPage} />
    </>}
  </>;
}

export function AdminReports() {
  const reports = useResource<any>('/admin/reports');
  const messages = useResource<any>('/admin/contact-messages');
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const resolve = async (id: number, status: string) => { setBusy(true); try { await api.patch(`/admin/reports/${id}`, { status, resolutionNote: 'Reviewed by administrator' }); toast('Report updated.', 'success'); reports.reload(); } catch (err) { toast(formatError(err), 'error'); } finally { setBusy(false); } };
  const resolveMessage = async (id: number) => { try { await api.patch(`/admin/contact-messages/${id}`, { status: 'resolved' }); toast('Message marked resolved.', 'success'); messages.reload(); } catch (err) { toast(formatError(err), 'error'); } };
  return <>
    <AdminHeader title="Question reports &amp; messages" description="Student-submitted content issues and contact messages." />
    <h3 className="mb-2">Question reports</h3>
    {reports.loading ? <Loading /> : <DataTable columns={[
      { key: 'reason', label: 'Reason', render: (r) => <Badge tone={r.status === 'open' ? 'amber' : 'green'}>{r.reason}</Badge> },
      { key: 'text_en', label: 'Question', render: (r) => <span className="small truncate" style={{ display: 'block', maxWidth: 240 }}>{r.text_en}</span> },
      { key: 'details', label: 'Details', render: (r) => <span className="small muted">{r.details}</span> },
      { key: 'user_email', label: 'From', render: (r) => r.user_email || 'Guest' },
      { key: 'status', label: 'Status' },
    ]} rows={reports.rows} actions={(r) => r.status === 'open' ? <Button size="sm" variant="outline" loading={busy} onClick={() => resolve(r.id, 'resolved')}>Resolve</Button> : null} />}
    <h3 className="mt-4 mb-2">Contact messages</h3>
    {messages.loading ? <Loading /> : <DataTable columns={[
      { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'subject', label: 'Subject' },
      { key: 'message', label: 'Message', render: (r) => <span className="small truncate" style={{ display: 'block', maxWidth: 300 }}>{r.message}</span> },
      { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'open' ? 'amber' : 'green'}>{r.status}</Badge> },
      { key: 'created_at', label: 'Received', render: (r) => <span className="tiny">{formatDateTime(r.created_at)}</span> },
    ]} rows={messages.rows} actions={(r) => r.status === 'open' ? <Button size="sm" variant="outline" onClick={() => resolveMessage(r.id)}>Resolve</Button> : null} />}
  </>;
}
