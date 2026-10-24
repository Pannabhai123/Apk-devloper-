import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronRight, Clock3, FileQuestion, Layers, Search, SlidersHorizontal, Target } from 'lucide-react';
import { Badge, Breadcrumbs, Button, Card, EmptyState, ErrorState, Icon, Loading, Notice, PageMeta, Pagination } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { coverClass, formatDate, titleCase } from '../lib/format';

interface Category { id: number; slug: string; name: string; description: string; icon: string; color: string; book_count: number; test_count: number }
interface BookListItem { id: number; slug: string; title: string; description: string; badge: string | null; test_count: number; question_count: number; subject_count: number; topic_count: number }
interface Subject { id: number; slug: string; name: string; name_hi: string; icon: string; question_count: number; hindi_question_count: number }
interface Topic { id: number; slug: string; name: string; subject_id: number; subject_slug: string; question_count: number; hindi_question_count: number }
interface BookTest { id: number; slug: string; title: string; description: string; mode: string; question_count: number; duration_minutes: number; negative_marks: number; languages: string[]; practice_feedback: number; published_at: string }
interface BookDetail extends BookListItem {
  hindi_question_count: number;
  categories: { slug: string; name: string }[];
  subjects: Subject[];
  topics: Topic[];
  tests: BookTest[];
  customTestSlug: string | null;
}

export function Exams() {
  const { data, loading, error, reload } = useApi<Category[]>('/categories');
  return (
    <div className="container section">
      <PageMeta title="Exam Categories" description="Browse all configured competitive exam categories on VidyaPariksha." />
      <Breadcrumbs items={[{ label: 'Exam Categories' }]} />
      <div className="section-head"><span className="eyebrow">Explore</span><h2>Examination categories</h2><p>Every category below has configured collections or tests. Categories with nothing available are hidden automatically.</p></div>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      <div className="grid grid-2-sm grid-3-lg">
        {data?.map((c) => (
          <Link to={`/exams/${c.slug}`} className="card card-pad card-hover" key={c.slug} style={{ display: 'block' }}>
            <span className="cat-icon" style={{ background: c.color, marginBottom: 12 }}><Icon name={c.icon} size={22} /></span>
            <h3>{c.name}</h3>
            <p className="small muted" style={{ margin: '6px 0 12px' }}>{c.description}</p>
            <div className="row small muted" style={{ gap: 14 }}><span><BookOpen size={14} /> {c.book_count} collections</span><span><FileQuestion size={14} /> {c.test_count} tests</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ExamCategory() {
  const { slug = '' } = useParams();
  const { data, loading, error, reload } = useApi<{
    name: string; description: string; icon: string; color: string;
    books: (BookListItem & { cover_url?: string })[];
    tests: { id: number; slug: string; title: string; mode: string; question_count: number; duration_minutes: number; published_at: string }[];
  }>(`/exams/${slug}`);
  return (
    <div className="container section">
      <PageMeta title={data?.name || 'Exam Category'} description={data?.description} />
      <Breadcrumbs items={[{ label: 'Exam Categories', to: '/exams' }, { label: data?.name || slug }]} />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <div className="row" style={{ gap: 14, marginBottom: 22 }}>
          <span className="cat-icon" style={{ background: data.color, width: 54, height: 54 }}><Icon name={data.icon} size={26} /></span>
          <div><h2>{data.name}</h2><p className="muted mb-0">{data.description}</p></div>
        </div>
        <h3 className="mb-2">Collections in this category</h3>
        {data.books.length === 0 && <EmptyState title="No collections configured" description="An administrator can assign books to this category." />}
        <div className="grid grid-2-sm grid-3-lg">
          {data.books.map((b) => (
            <Link to={`/books/${b.slug}`} className="card card-pad card-hover" key={b.slug} style={{ display: 'block' }}>
              <div className={`book-cover ${coverClass(b.slug)}`} style={{ height: 96, margin: '-18px -18px 14px', borderRadius: '14px 14px 0 0' }}><h3>{b.title}</h3></div>
              <p className="small muted">{b.description}</p>
              <div className="row-between"><span className="small muted">{b.question_count} questions · {b.test_count} tests</span><ChevronRight size={17} /></div>
            </Link>
          ))}
        </div>
        <h3 className="mt-4 mb-2">Published tests</h3>
        {data.tests.length === 0 && <EmptyState title="No published tests" description="Published tests for this category will appear here." />}
        <div className="grid grid-2-sm grid-3-lg">
          {data.tests.map((t) => (
            <Link to={`/test/${t.slug}/instructions`} className="card card-pad card-hover" key={t.id} style={{ display: 'block' }}>
              <Badge tone="blue">{titleCase(t.mode)}</Badge>
              <h3 style={{ margin: '9px 0 6px', fontSize: '1rem' }}>{t.title}</h3>
              <div className="row small muted" style={{ gap: 14 }}><span><Layers size={14} /> {t.question_count} Qs</span><span><Clock3 size={14} /> {t.duration_minutes} min</span></div>
            </Link>
          ))}
        </div>
      </>}
    </div>
  );
}

export function Books() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi<{ data: BookListItem[]; meta: { total: number; page: number; pages: number } }>(`/books?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`, [q]);
  return (
    <div className="container section">
      <PageMeta title="Books & Collections" description="Browse question collections available for practice on VidyaPariksha." />
      <Breadcrumbs items={[{ label: 'Books & Collections' }]} />
      <div className="section-head row-between">
        <div><span className="eyebrow">Question bank</span><h2>Books &amp; collections</h2><p>Counts reflect published questions stored in the database.</p></div>
        <div style={{ width: 240 }}><div className="search-box"><Search size={17} /><input className="input" placeholder="Filter books…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter books" /></div></div>
      </div>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.data.length === 0 && <EmptyState title="No matching books" description="Try a different keyword or explore all exam categories." action={<Link to="/exams" className="btn btn-primary btn-sm">Browse categories</Link>} />}
      <div className="grid grid-2-sm grid-3-lg">
        {data?.data.map((b) => (
          <Card className="card-hover book-card" key={b.id}>
            <div className={`book-cover ${coverClass(b.slug)}`}>
              <div className="book-badges">{b.badge && <Badge tone={b.badge === 'new' ? 'new' : 'popular'}>{b.badge.toUpperCase()}</Badge>}</div>
              <h3>{b.title}</h3>
            </div>
            <div className="book-body">
              <p className="small muted" style={{ margin: 0, minHeight: 40 }}>{b.description}</p>
              <div className="book-meta"><span><FileQuestion size={13} /> {b.test_count} tests</span><span><Target size={13} /> {b.question_count} questions</span><span><BookOpen size={13} /> {b.subject_count} subjects</span></div>
              <Link to={`/books/${b.slug}`} className="btn btn-primary btn-sm btn-block">Select &amp; Practise <ArrowRight size={15} /></Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const MODES = [
  { value: 'full_mock', label: 'Full Mock Test', hint: 'Mixed subjects with timer' },
  { value: 'subject_wise', label: 'Subject-Wise Test', hint: 'Focus on one subject' },
  { value: 'topic_wise', label: 'Topic-Wise Test', hint: 'Focus on one topic' },
  { value: 'practice', label: 'Practice Mode', hint: 'Flexible practice set' },
  { value: 'previous_year', label: 'Previous Year Questions', hint: 'Requires verified PYQ content' },
];

export function BookDetail() {
  const { slug = '' } = useParams();
  const { data, loading, error, reload } = useApi<BookDetail>(`/books/${slug}`);
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [topicId, setTopicId] = useState<number | ''>('');
  const [mode, setMode] = useState('practice');
  const [count, setCount] = useState(10);
  const [customCount, setCustomCount] = useState(false);
  const [duration, setDuration] = useState(15);
  const [customDuration, setCustomDuration] = useState(false);
  const [language, setLanguage] = useState('en');

  useEffect(() => { setSubjectId(''); setTopicId(''); setMode('practice'); setCount(10); setDuration(15); setLanguage('en'); setCustomCount(false); setCustomDuration(false); }, [slug]);

  const subject = data?.subjects.find((s) => s.id === subjectId);
  const topics = useMemo(() => {
    if (!data) return [];
    return subjectId ? data.topics.filter((t) => t.subject_id === subjectId && t.question_count > 0) : data.topics.filter((t) => t.question_count > 0);
  }, [data, subjectId]);
  const topic = data?.topics.find((t) => t.id === topicId);
  const available = topic ? topic.question_count : subject ? subject.question_count : (data?.question_count || 0);
  const hiCount = topic ? topic.hindi_question_count : subject ? subject.hindi_question_count : (data?.hindi_question_count || 0);
  const countOptions = [10, 25, 50, 100].filter((n) => n <= available);
  const canStart = Boolean(data?.customTestSlug) && available > 0 && count > 0 && count <= available && (language === 'en' || hiCount >= count);
  const query = new URLSearchParams({ mode, language, count: String(count), duration: String(duration) });
  if (subjectId) query.set('subjectId', String(subjectId));
  if (topicId) query.set('topicId', String(topicId));

  return (
    <div className="container section">
      <PageMeta title={data?.title || 'Book'} description={data?.description} />
      <Breadcrumbs items={[{ label: 'Books', to: '/books' }, { label: data?.title || slug }]} />
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <div className="row" style={{ gap: 16, alignItems: 'flex-start', marginBottom: 22 }}>
          <div className={`book-cover ${coverClass(data.slug)}`} style={{ width: 120, height: 150, flex: 'none', borderRadius: 12 }}><h3 style={{ fontSize: '1rem' }}>{data.title}</h3></div>
          <div>
            <div className="row" style={{ gap: 7, marginBottom: 6 }}>
              {data.badge && <Badge tone={data.badge === 'new' ? 'new' : 'popular'}>{data.badge.toUpperCase()}</Badge>}
              {data.categories.map((c) => <Link key={c.slug} to={`/exams/${c.slug}`}><Badge tone="blue">{c.name}</Badge></Link>)}
            </div>
            <h2>{data.title}</h2>
            <p className="muted mb-1" style={{ maxWidth: 620 }}>{data.description}</p>
            <div className="row small muted" style={{ gap: 16 }}><span><Target size={14} /> {data.question_count} published questions</span><span><FileQuestion size={14} /> {data.tests.length} published tests</span><span><Layers size={14} /> {data.subjects.length} subjects</span></div>
          </div>
        </div>

        <div className="wizard">
          <Card className="wizard-step">
            <div className="wizard-step-head"><span className="n">1</span><div><h3>Choose a subject</h3><p className="small muted mb-0">Changing the subject resets any incompatible topic.</p></div></div>
            <div className="option-grid">
              <button className={`option-card ${subjectId === '' ? 'selected' : ''}`} onClick={() => { setSubjectId(''); setTopicId(''); }}>
                <strong>All Subjects (Mix)</strong><span>{data.question_count} questions available</span>
              </button>
              {data.subjects.map((s) => (
                <button key={s.id} className={`option-card ${subjectId === s.id ? 'selected' : ''}`} disabled={s.question_count === 0}
                  onClick={() => { setSubjectId(s.id); setTopicId(''); if (mode === 'full_mock') setMode('subject_wise'); }}>
                  <strong>{s.name}</strong><span>{s.question_count} questions · {s.hindi_question_count} Hindi</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="wizard-step">
            <div className="wizard-step-head"><span className="n">2</span><div><h3>Choose a topic</h3><p className="small muted mb-0">Options depend on the selected subject and are filtered by real question counts.</p></div></div>
            {topics.length === 0 ? <Notice kind="warning">No topics with published questions for this selection yet. Choose “All Topics (Mix)” to continue, or ask an administrator to add questions.</Notice> : (
              <div className="option-grid">
                <button className={`option-card ${topicId === '' ? 'selected' : ''}`} onClick={() => setTopicId('')}>
                  <strong>All Topics (Mix)</strong><span>{available} questions available</span>
                </button>
                {topics.map((t) => (
                  <button key={t.id} className={`option-card ${topicId === t.id ? 'selected' : ''}`} onClick={() => { setTopicId(t.id); if (mode === 'full_mock') setMode('topic_wise'); }}>
                    <strong>{t.name}</strong><span>{t.question_count} questions · {t.hindi_question_count} Hindi</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="wizard-step">
            <div className="wizard-step-head"><span className="n">3</span><div><h3>Test mode</h3><p className="small muted mb-0">Unsupported modes are disabled rather than silently falling back.</p></div></div>
            <div className="option-grid">
              {MODES.map((m) => {
                const disabled = m.value === 'previous_year' || (m.value === 'topic_wise' && !topicId) || (m.value === 'subject_wise' && !subjectId) || (m.value === 'full_mock' && (Boolean(subjectId) || Boolean(topicId)));
                return (
                  <button key={m.value} className={`option-card ${mode === m.value ? 'selected' : ''}`} disabled={disabled} onClick={() => setMode(m.value)} title={m.value === 'previous_year' ? 'No verified previous-year questions have been configured for this collection.' : undefined}>
                    <strong>{m.label}</strong><span>{m.value === 'previous_year' ? 'Not available — no verified PYQ' : m.hint}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-2-sm">
            <Card className="wizard-step">
              <div className="wizard-step-head"><span className="n">4</span><div><h3>Number of questions</h3><p className="small muted mb-0">{available} eligible question(s) in this selection.</p></div></div>
              <div className="row" style={{ gap: 8 }}>
                {[10, 25, 50, 100].map((n) => (
                  <button key={n} className={`option-card ${!customCount && count === n ? 'selected' : ''}`} style={{ minWidth: 62, minHeight: 54, alignItems: 'center' }} disabled={n > available} onClick={() => { setCount(n); setCustomCount(false); }}><strong>{n}</strong></button>
                ))}
                <button className={`option-card ${customCount ? 'selected' : ''}`} style={{ minWidth: 82, alignItems: 'center' }} onClick={() => setCustomCount(true)}><strong>Custom</strong></button>
              </div>
              {customCount && <div className="mt-2"><label className="field-label" htmlFor="custom-count">Custom count (1–{Math.min(200, available)})</label><input id="custom-count" className="input" type="number" min={1} max={Math.min(200, available)} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>}
              {countOptions.length === 0 && <Notice kind="warning">Fewer than 10 questions are available here. Use a custom count.</Notice>}
            </Card>

            <Card className="wizard-step">
              <div className="wizard-step-head"><span className="n">5</span><div><h3>Duration</h3><p className="small muted mb-0">The timer starts only after you confirm on the instruction screen.</p></div></div>
              <div className="row" style={{ gap: 8 }}>
                {[10, 15, 30, 60].map((n) => (
                  <button key={n} className={`option-card ${!customDuration && duration === n ? 'selected' : ''}`} style={{ minWidth: 68, minHeight: 54, alignItems: 'center' }} onClick={() => { setDuration(n); setCustomDuration(false); }}><strong>{n} min</strong></button>
                ))}
                <button className={`option-card ${customDuration ? 'selected' : ''}`} style={{ minWidth: 82, alignItems: 'center' }} onClick={() => setCustomDuration(true)}><strong>Custom</strong></button>
              </div>
              {customDuration && <div className="mt-2"><label className="field-label" htmlFor="custom-duration">Duration in minutes (1–600)</label><input id="custom-duration" className="input" type="number" min={1} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>}
            </Card>
          </div>

          <Card className="wizard-step">
            <div className="wizard-step-head"><span className="n">6</span><div><h3>Language</h3><p className="small muted mb-0">Hindi appears only when enough translated questions exist for the chosen selection.</p></div></div>
            <div className="row" style={{ gap: 8 }}>
              <button className={`option-card ${language === 'en' ? 'selected' : ''}`} style={{ minWidth: 120 }} onClick={() => setLanguage('en')}><strong>English</strong><span>{available} question(s)</span></button>
              <button className={`option-card ${language === 'hi' ? 'selected' : ''}`} style={{ minWidth: 120 }} disabled={hiCount < count} onClick={() => setLanguage('hi')}><strong>हिन्दी (Hindi)</strong><span>{hiCount} translated question(s)</span></button>
            </div>
            {language === 'hi' && hiCount < count && <div className="field-error">This selection only has {hiCount} Hindi question(s). Reduce the count or choose a different subject.</div>}
          </Card>

          <Card className="wizard-step">
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="summary-box grow">
                <div className="summary-row"><span className="muted">Collection</span><strong>{data.title}</strong></div>
                <div className="summary-row"><span className="muted">Subject</span><strong>{subject?.name || 'All subjects (mix)'}</strong></div>
                <div className="summary-row"><span className="muted">Topic</span><strong>{topic?.name || 'All topics (mix)'}</strong></div>
                <div className="summary-row"><span className="muted">Mode / Language</span><strong>{titleCase(mode)} · {language === 'hi' ? 'Hindi' : 'English'}</strong></div>
                <div className="summary-row"><span className="muted">Questions / Duration</span><strong>{count} questions · {duration} minutes</strong></div>
              </div>
              <div style={{ minWidth: 190 }}>
                {!canStart && <Notice kind="warning">{available === 0 ? 'No questions available for this selection.' : language === 'hi' && hiCount < count ? 'Not enough Hindi questions. Switch language or lower the count.' : 'Adjust the settings above to continue.'}</Notice>}
                {canStart && <Link to={`/test/${data.customTestSlug}/instructions?${query.toString()}`} className="btn btn-primary btn-lg btn-block"><SlidersHorizontal size={17} /> Continue to instructions</Link>}
                <p className="tiny muted mt-2 mb-0">The timer will not begin until you press “Start Examination”.</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-4">
          <h3 className="mb-2">Published tests in this collection</h3>
          {data.tests.length === 0 && <EmptyState title="No published tests" description="Use the selection above to build a custom practice set." />}
          <div className="grid grid-2-sm grid-3-lg">
            {data.tests.map((t) => (
              <Link to={`/test/${t.slug}/instructions`} className="card card-pad card-hover" key={t.id} style={{ display: 'block' }}>
                <div className="row-between"><Badge tone="blue">{titleCase(t.mode)}</Badge>{t.practice_feedback ? <Badge tone="green">Instant feedback</Badge> : null}</div>
                <h3 style={{ margin: '9px 0 6px', fontSize: '1rem' }}>{t.title}</h3>
                <p className="small muted">{t.description}</p>
                <div className="row small muted" style={{ gap: 14 }}><span><Layers size={14} /> {t.question_count} Qs</span><span><Clock3 size={14} /> {t.duration_minutes} min</span><span><Target size={14} /> −{t.negative_marks}</span></div>
                <span className="btn btn-outline btn-sm btn-block mt-2">Start test <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}

export function SubjectDetail() {
  const { slug = '' } = useParams();
  const { data, loading, error, reload } = useApi<{
    id: number; name: string; name_hi: string; description: string; icon: string;
    topics: { id: number; slug: string; name: string; description: string; question_count: number }[];
    books: { slug: string; title: string; question_count: number; badge: string | null }[];
  }>(`/subjects/${slug}`);
  return (
    <div className="container section">
      <PageMeta title={data?.name || 'Subject'} description={`Practise ${data?.name || 'this subject'} topic-wise on VidyaPariksha.`} />
      <Breadcrumbs items={[{ label: 'Books', to: '/books' }, { label: data?.name || slug }]} />
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <div className="row" style={{ gap: 14, marginBottom: 22 }}><span className="cat-icon" style={{ background: 'var(--secondary)', width: 52, height: 52 }}><Icon name={data.icon} size={25} /></span><div><h2>{data.name} <span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}>/ {data.name_hi}</span></h2><p className="muted mb-0">{data.description || 'Topic-wise practice collections for this subject.'}</p></div></div>
        <div className="grid grid-2-sm" style={{ alignItems: 'start' }}>
          <div><h3 className="mb-2">Topics</h3>
            {data.topics.length === 0 && <EmptyState title="No topics configured" />}
            <div className="grid">
              {data.topics.map((t) => (
                <Link to={`/topics/${slug}/${t.slug}`} className="card card-pad card-hover row-between" key={t.id}>
                  <span><strong>{t.name}</strong><span className="small muted" style={{ display: 'block' }}>{t.description || 'Topic-wise practice'}</span></span>
                  <span className="row" style={{ gap: 8 }}><Badge tone={t.question_count ? 'blue' : 'gray'}>{t.question_count} Qs</Badge><ChevronRight size={17} /></span>
                </Link>
              ))}
            </div>
          </div>
          <div><h3 className="mb-2">Collections covering this subject</h3>
            <div className="grid">
              {data.books.map((b) => (
                <Link to={`/books/${b.slug}`} className="card card-pad card-hover row-between" key={b.slug}>
                  <span><strong>{b.title}</strong><span className="small muted" style={{ display: 'block' }}>{b.question_count} questions in this subject</span></span><ChevronRight size={17} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}

export function TopicDetail() {
  const { subjectSlug = '', topicSlug = '' } = useParams();
  const { data, loading, error, reload } = useApi<{
    name: string; description: string; subject_slug: string; subject_name: string; question_count: number;
    books: { slug: string; title: string; question_count: number }[];
  }>(`/topics/${subjectSlug}/${topicSlug}`);
  return (
    <div className="container section">
      <PageMeta title={data?.name || 'Topic'} description={`Topic-wise practice for ${data?.name || 'this topic'}.`} />
      <Breadcrumbs items={[{ label: data?.subject_name || subjectSlug, to: `/subjects/${subjectSlug}` }, { label: data?.name || topicSlug }]} />
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && <>
        <h2>{data.name}</h2>
        <p className="muted">{data.description || `Practise ${data.name} questions from the available collections.`}</p>
        <Notice kind="info">{data.question_count} published question(s) are available across all collections for this topic.</Notice>
        <h3 className="mt-3 mb-2">Start from a collection</h3>
        {data.books.length === 0 && <EmptyState title="No questions in this topic yet" description="An administrator can add questions to this topic." />}
        <div className="grid grid-2-sm grid-3-lg">
          {data.books.map((b) => (
            <Link to={`/books/${b.slug}`} className="card card-pad card-hover" key={b.slug}><h3 style={{ fontSize: '1rem' }}>{b.title}</h3><p className="small muted">{b.question_count} question(s) in this topic</p><span className="btn btn-primary btn-sm btn-block">Configure practice</span></Link>
          ))}
        </div>
      </>}
    </div>
  );
}

export function TestsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 1);
  const category = params.get('category') || '';
  const mode = params.get('mode') || '';
  const q = params.get('q') || '';
  const path = `/tests?page=${page}&limit=12${category ? `&category=${encodeURIComponent(category)}` : ''}${mode ? `&mode=${mode}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, loading, error, reload } = useApi<{ data: any[]; meta: { total: number; page: number; pages: number } }>(path, [page, category, mode, q]);
  const cats = useApi<Category[]>('/categories');
  const [draftQ, setDraftQ] = useState(q);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };

  return (
    <div className="container section">
      <PageMeta title="Practice Tests" description="Browse all published mock tests and practice sets on VidyaPariksha." />
      <Breadcrumbs items={[{ label: 'Practice Tests' }]} />
      <div className="section-head"><span className="eyebrow">Test library</span><h2>All published tests</h2><p>Every test below has eligible published questions. Counts and durations come from the test configuration.</p></div>
      <div className="grid grid-2-sm" style={{ gap: 10, marginBottom: 18 }}>
        <div className="search-box"><Search size={17} /><input className="input" placeholder="Search tests…" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') update('q', draftQ); }} aria-label="Search tests" /></div>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" value={category} onChange={(e) => update('category', e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {cats.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select className="select" value={mode} onChange={(e) => update('mode', e.target.value)} aria-label="Filter by mode">
            <option value="">All modes</option>
            <option value="full_mock">Full mock</option><option value="subject_wise">Subject-wise</option>
            <option value="topic_wise">Topic-wise</option><option value="practice">Practice</option>
          </select>
          <Button variant="outline" onClick={() => update('q', draftQ)}>Search</Button>
        </div>
      </div>
      {loading && <Loading />}{error && <ErrorState message={error} onRetry={reload} />}
      {data && data.data.length === 0 && <EmptyState title="No tests match these filters" description="Try clearing the filters or choose a category." action={<Button variant="outline" onClick={() => setParams({})}>Clear filters</Button>} />}
      <div className="grid grid-2-sm grid-3-lg">
        {data?.data.map((t) => (
          <Link to={`/test/${t.slug}/instructions`} className="card card-pad card-hover" key={t.id} style={{ display: 'block' }}>
            <div className="row-between"><Badge tone="blue">{titleCase(t.mode)}</Badge>{t.practice_feedback ? <Badge tone="green">Feedback</Badge> : null}</div>
            <h3 style={{ margin: '10px 0 6px', fontSize: '1.02rem' }}>{t.title}</h3>
            <p className="small muted">{t.book_title || 'Practice collection'}</p>
            <div className="row small muted" style={{ gap: 14 }}><span><Layers size={14} /> {t.question_count} Qs</span><span><Clock3 size={14} /> {t.duration_minutes} min</span></div>
            <div className="tiny muted mt-1">Published {formatDate(t.published_at)}</div>
          </Link>
        ))}
      </div>
      {data && <Pagination page={data.meta.page} pages={data.meta.pages} onChange={(p) => update('page', String(p))} />}
    </div>
  );
}
