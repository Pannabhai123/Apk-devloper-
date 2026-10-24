import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, FileQuestion, Layers, X } from 'lucide-react';
import { api, formatError } from '../api/client';

interface Results { books: any[]; tests: any[]; subjects: any[]; topics: any[] }

export function SearchBox({ autoFocus = false, placeholder = 'Search books, subjects, topics or tests…', onNavigate }: {
  autoFocus?: boolean; placeholder?: string; onNavigate?: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); setError(''); setLoading(false); return; }
    setLoading(true); setError('');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<Results>(`/search?q=${encodeURIComponent(q.trim())}`, controller.signal);
        setResults(data); setOpen(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError(formatError(err));
      } finally { setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (path: string) => { setOpen(false); setQ(''); onNavigate?.(); nav(path); };
  const total = results ? results.books.length + results.tests.length + results.subjects.length + results.topics.length : 0;

  return (
    <div className="search-wrap" ref={boxRef}>
      <div className="search-box">
        <Search size={18} />
        <input className="input" type="search" value={q} autoFocus={autoFocus} placeholder={placeholder}
          aria-label="Search the platform" onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { if (results) setOpen(true); }} />
      </div>
      {open && q.trim().length >= 2 && (
        <div className="search-dropdown" role="listbox" aria-label="Search results">
          <div className="row-between" style={{ padding: '10px 14px 4px' }}>
            <span className="tiny muted">{loading ? 'Searching…' : `${total} result(s) for “${q.trim()}”`}</span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Close search"><X size={15} /></button>
          </div>
          {error && <div className="alert alert-danger" style={{ margin: 8 }}>{error}</div>}
          {!loading && !error && total === 0 && (
            <div style={{ padding: 22, textAlign: 'center' }} className="small muted">
              No matching books, tests, subjects or topics yet. Try a different keyword such as “Physics” or “Bihar”.
            </div>
          )}
          {results?.books.length ? <><div className="search-group-title">Books</div>{results.books.map((b) => (
            <button key={b.slug} className="search-item" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => go(`/books/${b.slug}`)}>
              <BookOpen size={17} /><span className="grow"><strong className="small">{b.title}</strong><span className="tiny muted" style={{ display: 'block' }}>{b.question_count} questions</span></span>
            </button>))}</> : null}
          {results?.tests.length ? <><div className="search-group-title">Tests</div>{results.tests.map((t) => (
            <button key={t.slug} className="search-item" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => go(`/test/${t.slug}/instructions`)}>
              <FileQuestion size={17} /><span className="grow"><strong className="small">{t.title}</strong><span className="tiny muted" style={{ display: 'block' }}>{t.question_count} questions · {t.duration_minutes} min</span></span>
            </button>))}</> : null}
          {results?.subjects.length ? <><div className="search-group-title">Subjects</div>{results.subjects.map((s) => (
            <button key={s.slug} className="search-item" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => go(`/subjects/${s.slug}`)}>
              <Layers size={17} /><span className="grow"><strong className="small">{s.name}</strong><span className="tiny muted" style={{ display: 'block' }}>{s.question_count} questions</span></span>
            </button>))}</> : null}
          {results?.topics.length ? <><div className="search-group-title">Topics</div>{results.topics.map((t) => (
            <button key={`${t.subject_slug}-${t.slug}`} className="search-item" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => go(`/topics/${t.subject_slug}/${t.slug}`)}>
              <Layers size={17} /><span className="grow"><strong className="small">{t.name}</strong><span className="tiny muted" style={{ display: 'block' }}>{t.subject_name} · {t.question_count} questions</span></span>
            </button>))}</> : null}
        </div>
      )}
    </div>
  );
}
