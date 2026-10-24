import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BarChart3, BookOpen, CheckCircle2, Clock3, GraduationCap,
  Layers, Play, ShieldCheck, Smartphone, Sparkles, Target, TimerReset, TrendingUp,
} from 'lucide-react';
import { HeroVisual } from '../components/Brand';
import { SearchBox } from '../components/SearchBox';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Loading, Notice, PageMeta } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { coverClass, formatDate } from '../lib/format';

interface Book { id: number; slug: string; title: string; description: string; badge: string | null; test_count: number; question_count: number; subject_count: number; topic_count: number }
interface Category { slug: string; name: string; description: string; icon: string; color: string; book_count: number; test_count: number }
interface RecentTest { id: number; slug: string; title: string; mode: string; question_count: number; duration_minutes: number; published_at: string; book_title: string }

export function Home() {
  const { settings } = useApp();
  // `/books` is paginated: the API wrapper already unwraps `data`, so the
  // payload here is the rows array itself (meta is not needed on the homepage).
  const books = useApi<Book[]>('/books?limit=12');
  const categories = useApi<Category[]>('/categories');
  const recent = useApi<RecentTest[]>('/tests/recent');
  const countdowns = useApi<{ id: number; title: string; exam_date: string }[]>('/countdowns');

  return (
    <>
      <PageMeta title="Practice Smarter. Prepare Better." description="Attempt realistic online mock tests, improve your speed, analyse your performance, and prepare confidently for your exams." />
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="pill"><Sparkles size={14} /> {settings.hero_badge || 'Free online CBT practice'}</span>
            <h1>Practice Smarter.<br /><em>Prepare Better.</em> Achieve More.</h1>
            <p className="lead">Attempt realistic online mock tests, improve your speed, analyse your performance, and prepare confidently for your exams.</p>
            <div className="btn-group mt-2">
              <Link to="/exams" className="btn btn-primary btn-lg"><Play size={18} /> Start Free Mock Test</Link>
              <Link to="/tests" className="btn btn-outline btn-lg">Explore Test Categories</Link>
            </div>
            <div className="hero-benefits">
              {[
                { icon: TimerReset, text: 'Exam-like CBT experience' },
                { icon: BarChart3, text: 'Instant result analysis' },
                { icon: Layers, text: 'Topic-wise practice' },
                { icon: Smartphone, text: 'Mobile-friendly testing' },
              ].map((b) => (
                <div className="hero-benefit" key={b.text}><b.icon size={17} /> {b.text}</div>
              ))}
            </div>
            <div style={{ marginTop: 20, maxWidth: 520 }}><SearchBox placeholder="Try “Physics”, “Bihar GK” or “Computer”…" /></div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {settings.demo_mode !== false && (
        <div className="container" style={{ marginTop: 18 }}>
          <Notice kind="info">
            <strong>Demo dataset:</strong> This installation ships with original practice questions written for the project. They are not copied from any publisher and are not verified previous-year papers. Administrators can import their own licensed question bank from the Admin Panel.
          </Notice>
        </div>
      )}

      <section className="section" id="categories">
        <div className="container">
          <div className="section-head row-between">
            <div><span className="eyebrow">Quick access</span><h2>Choose your exam category</h2><p>Only configured categories with available collections are shown.</p></div>
            <Link to="/exams" className="btn btn-outline btn-sm">View all <ArrowRight size={15} /></Link>
          </div>
          {categories.loading && <Loading label="Loading categories…" />}
          {categories.error && <ErrorState message={categories.error} onRetry={categories.reload} />}
          <div className="grid grid-2 grid-3-lg grid-4-lg">
            {categories.data?.map((c) => (
              <Link to={`/exams/${c.slug}`} className="card cat-card card-hover" key={c.slug}>
                <span className="cat-icon" style={{ background: c.color }}><Icon name={c.icon} size={21} /></span>
                <span style={{ minWidth: 0 }}>
                  <h3 className="truncate">{c.name}</h3>
                  <span className="small muted">{c.book_count} collection{c.book_count === 1 ? '' : 's'} · {c.test_count} test{c.test_count === 1 ? '' : 's'}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div className="section-head row-between">
            <div><span className="eyebrow">Question collections</span><h2>Select a book to begin</h2><p>Real availability counts come from the database — no inflated numbers.</p></div>
            <Link to="/books" className="btn btn-outline btn-sm">All books <ArrowRight size={15} /></Link>
          </div>
          {books.loading && <Loading label="Loading books…" />}
          {books.error && <ErrorState message={books.error} onRetry={books.reload} />}
          {books.data && books.data.length === 0 && <EmptyState title="No books configured yet" description="An administrator can add collections from the Admin Panel." />}
          <div className="grid grid-2-sm grid-3-lg grid-4-lg">
            {books.data?.map((b) => (
              <Card className="card-hover book-card" key={b.id}>
                <div className={`book-cover ${coverClass(b.slug)}`}>
                  <div className="book-badges">
                    {b.badge === 'new' && <Badge tone="new">NEW</Badge>}
                    {b.badge === 'popular' && <Badge tone="popular">POPULAR</Badge>}
                  </div>
                  <h3>{b.title}</h3>
                </div>
                <div className="book-body">
                  <p className="small muted" style={{ margin: 0, minHeight: 40 }}>{b.description}</p>
                  <div className="book-meta">
                    <span><BookOpen size={13} /> {b.test_count} tests</span>
                    <span><Layers size={13} /> {b.subject_count} subjects</span>
                    <span><Target size={13} /> {b.question_count} Qs</span>
                  </div>
                  <Link to={`/books/${b.slug}`} className="btn btn-primary btn-sm btn-block">Start Practice <ArrowRight size={15} /></Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head row-between">
            <div><span className="eyebrow">Recently published</span><h2>Fresh tests to attempt</h2><p>Sorted by actual publication date.</p></div>
            <Link to="/tests" className="btn btn-outline btn-sm">Browse tests <ArrowRight size={15} /></Link>
          </div>
          {recent.loading && <Loading label="Loading recent tests…" />}
          {recent.error && <ErrorState message={recent.error} onRetry={recent.reload} />}
          {recent.data && recent.data.length === 0 && <EmptyState title="No published tests yet" description="Published tests will appear here." />}
          <div className="grid grid-2-sm grid-3-lg">
            {recent.data?.slice(0, 6).map((t) => (
              <Link to={`/test/${t.slug}/instructions`} className="card card-pad card-hover" key={t.id} style={{ display: 'block' }}>
                <div className="row-between" style={{ marginBottom: 8 }}>
                  <Badge tone="blue">{t.mode.replace(/_/g, ' ')}</Badge>
                  <span className="tiny muted">{t.published_at ? formatDate(t.published_at) : ''}</span>
                </div>
                <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>{t.title}</h3>
                <p className="small muted" style={{ marginBottom: 10 }}>{t.book_title || 'Practice collection'}</p>
                <div className="row small muted" style={{ gap: 14 }}><span><Layers size={14} /> {t.question_count} questions</span><span><Clock3 size={14} /> {t.duration_minutes} min</span></div>
              </Link>
            ))}
          </div>
          {countdowns.data && countdowns.data.length > 0 && (
            <div className="card card-pad mt-3 row-between" style={{ background: '#EEF4FF' }}>
              <div><span className="eyebrow">Upcoming milestone</span><h3 style={{ marginTop: 4 }}>{countdowns.data[0].title}</h3><p className="small muted mb-0">Configured by the administrator for {formatDate(countdowns.data[0].exam_date)}.</p></div>
              <Badge tone="blue">{countdowns.data[0].exam_date}</Badge>
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ background: '#fff' }}>
        <div className="container">
          <div className="section-head"><span className="eyebrow">How it works</span><h2>Four steps to a better attempt</h2></div>
          <div className="grid grid-2-sm grid-4-lg">
            {[
              { n: 1, title: 'Select a book or exam', text: 'Choose from the configured categories and collections.', icon: BookOpen },
              { n: 2, title: 'Choose subject & topic', text: 'Options update based on the questions actually available.', icon: Layers },
              { n: 3, title: 'Start your mock test', text: 'Read the instructions, pick a language and begin the timed CBT.', icon: TimerReset },
              { n: 4, title: 'Review your analysis', text: 'See genuine scoring, explanations and weak topics after submission.', icon: BarChart3 },
            ].map((s) => (
              <Card className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <s.icon size={22} style={{ color: 'var(--secondary)', marginBottom: 8 }} />
                <h3 style={{ fontSize: '.98rem' }}>{s.title}</h3>
                <p className="small muted mb-0" style={{ marginTop: 6 }}>{s.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head"><span className="eyebrow">Why practise here</span><h2>Built for steady improvement</h2><p>We do not publish unsupported success-rate or score-improvement claims. These are the tools you actually get.</p></div>
          <div className="grid grid-2-sm grid-3-lg">
            {[
              { icon: TimerReset, title: 'Timed practice', text: 'A real countdown derived from the server deadline, so refreshing does not reset your time.' },
              { icon: Layers, title: 'Topic-wise revision', text: 'Narrow practice to a single topic when a full mock is more than you need.' },
              { icon: GraduationCap, title: 'Previous-question practice', text: 'Exam-style sets are clearly labelled; original practice content is never passed off as a verified paper.' },
              { icon: CheckCircle2, title: 'Answer explanations', text: 'After submission (or instantly in practice mode), see the correct option and reasoning.' },
              { icon: TrendingUp, title: 'Performance tracking', text: 'Score and accuracy progression are computed from your own submitted attempts.' },
              { icon: Target, title: 'Weak-topic identification', text: 'Subject and topic accuracy highlight areas worth revisiting once enough data exists.' },
            ].map((f) => (
              <Card className="card-pad" key={f.title}>
                <div className="feature-icon"><f.icon size={20} /></div>
                <h3 style={{ fontSize: '1rem' }}>{f.title}</h3>
                <p className="small muted mb-0" style={{ marginTop: 6 }}>{f.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'linear-gradient(135deg, #0B4FA8, #2563EB)', color: '#fff' }}>
        <div className="container row-between" style={{ gap: 20 }}>
          <div><h2 style={{ color: '#fff' }}>Ready to attempt your first mock test?</h2><p style={{ color: '#D6E6FF', marginBottom: 0 }}>No payment required. Guest practice is available when enabled by the administrator.</p></div>
          <div className="btn-group"><Link to="/exams" className="btn btn-lg" style={{ background: '#fff', color: 'var(--primary)' }}><BadgeCheck size={18} /> Start now</Link><Link to="/help" className="btn btn-outline btn-lg" style={{ borderColor: 'rgba(255,255,255,.5)', color: '#fff', background: 'transparent' }}><ShieldCheck size={18} /> Read the guide</Link></div>
        </div>
      </section>
    </>
  );
}
