import { useEffect, useState } from 'react';
import { Copy, Download, Eye, FileQuestion, FileUp, Plus, Trash2, Upload } from 'lucide-react';
import { api, formatError } from '../../api/client';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal, Notice, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { AdminHeader, DataTable, type Column } from './shared';

interface QuestionRow {
  id: number; code: string; text_en: string; text_hi: string | null; difficulty: string; qtype: string;
  status: string; language: string; is_verified_pyq: number; marks: number; negative_marks: number;
  book_title: string; subject_name: string; topic_name: string | null; correct_count: number; updated_at: string;
}
interface QuestionDetail extends QuestionRow {
  book_id: number; category_id: number | null; subject_id: number; topic_id: number | null;
  explanation_en: string | null; explanation_hi: string | null; image_url: string | null; source: string | null; tags: string;
  options: { id: number; label: string; text_en: string; text_hi: string | null; image_url: string | null; is_correct: number }[];
}
interface OptionForm { label: string; textEn: string; textHi: string; imageUrl: string; isCorrect: boolean }

const EMPTY_FORM = {
  bookId: 0, categoryId: '', subjectId: 0, topicId: '', difficulty: 'medium', qtype: 'single',
  textEn: '', textHi: '', explanationEn: '', explanationHi: '', marks: 1, negativeMarks: 0,
  language: 'en', imageUrl: '', source: '', isVerifiedPyq: false, status: 'draft', tags: '',
  options: [
    { label: 'A', textEn: '', textHi: '', imageUrl: '', isCorrect: false },
    { label: 'B', textEn: '', textHi: '', imageUrl: '', isCorrect: false },
    { label: 'C', textEn: '', textHi: '', imageUrl: '', isCorrect: false },
    { label: 'D', textEn: '', textHi: '', imageUrl: '', isCorrect: false },
  ] as OptionForm[],
};

export function AdminQuestions() {
  const toast = useToast();
  const books = useApi<any[]>('/admin/books');
  const subjects = useApi<any[]>('/admin/subjects');
  const topics = useApi<any[]>('/admin/topics');
  const [filters, setFilters] = useState({ bookId: '', subjectId: '', topicId: '', difficulty: '', status: '', q: '' });
  const [draftQ, setDraftQ] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM, options: EMPTY_FORM.options.map((o) => ({ ...o })) });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<QuestionRow | null>(null);
  const [preview, setPreview] = useState<QuestionDetail | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importBusy, setImportBusy] = useState(false);

  const query = new URLSearchParams({ page: String(page), limit: '20' });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await api.get<{ data: QuestionRow[]; meta: any }>(`/admin/questions?${query.toString()}`);
      setRows(result.data); setMeta(result.meta);
    } catch (err) { setError(formatError(err)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [page, filters, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = async (id: number | 'new') => {
    setFormError('');
    if (id === 'new') {
      setForm({ ...EMPTY_FORM, bookId: Number(books.data?.[0]?.id || 0), subjectId: Number(subjects.data?.[0]?.id || 0), options: EMPTY_FORM.options.map((o) => ({ ...o })) });
      setEditing('new'); return;
    }
    try {
      const q = await api.get<QuestionDetail>(`/admin/questions/${id}`);
      setForm({
        bookId: q.book_id, categoryId: q.category_id ? String(q.category_id) : '', subjectId: q.subject_id,
        topicId: q.topic_id ? String(q.topic_id) : '', difficulty: q.difficulty, qtype: q.qtype,
        textEn: q.text_en, textHi: q.text_hi || '', explanationEn: q.explanation_en || '', explanationHi: q.explanation_hi || '',
        marks: q.marks, negativeMarks: q.negative_marks, language: q.language, imageUrl: q.image_url || '',
        source: q.source || '', isVerifiedPyq: Boolean(q.is_verified_pyq), status: q.status, tags: q.tags || '',
        options: q.options.map((o) => ({ label: o.label, textEn: o.text_en, textHi: o.text_hi || '', imageUrl: o.image_url || '', isCorrect: Boolean(o.is_correct) })),
      });
      setEditing(id);
    } catch (err) { toast(formatError(err), 'error'); }
  };

  const save = async () => {
    if (!form.textEn.trim() || form.textEn.trim().length < 4) { setFormError('Question text must be at least 4 characters.'); return; }
    if (!form.bookId || !form.subjectId) { setFormError('Select a book and subject.'); return; }
    const filled = form.options.filter((o) => o.textEn.trim());
    if (filled.length < 2) { setFormError('Provide at least two answer options.'); return; }
    if (!filled.some((o) => o.isCorrect)) { setFormError('Mark at least one correct option.'); return; }
    if (form.qtype === 'single' && filled.filter((o) => o.isCorrect).length > 1) { setFormError('Single-answer questions may only have one correct option.'); return; }
    setBusy(true); setFormError('');
    const payload = {
      ...form, bookId: Number(form.bookId), subjectId: Number(form.subjectId),
      categoryId: form.categoryId ? Number(form.categoryId) : null, topicId: form.topicId ? Number(form.topicId) : null,
      options: filled, marks: Number(form.marks), negativeMarks: Number(form.negativeMarks),
    };
    try {
      if (editing === 'new') await api.post('/admin/questions', payload);
      else await api.put(`/admin/questions/${editing}`, payload);
      toast('Question saved.', 'success'); setEditing(null); setNonce((n) => n + 1);
    } catch (err) { setFormError(formatError(err)); } finally { setBusy(false); }
  };

  const duplicate = async (id: number) => { try { await api.post(`/admin/questions/${id}/duplicate`); toast('Question duplicated as a draft.', 'success'); setNonce((n) => n + 1); } catch (err) { toast(formatError(err), 'error'); } };
  const confirmDelete = async () => { if (!deleting) return; try { await api.del(`/admin/questions/${deleting.id}`); toast('Question deleted.', 'success'); setDeleting(null); setNonce((n) => n + 1); } catch (err) { toast(formatError(err), 'error'); setDeleting(null); } };
  const bulkStatus = async (status: string) => { if (!selected.length) return; try { const r = await api.post<{ updated: number }>('/admin/questions/bulk-status', { ids: selected, status }); toast(`${r.updated} question(s) updated.`, 'success'); setSelected([]); setNonce((n) => n + 1); } catch (err) { toast(formatError(err), 'error'); } };
  const showPreview = async (id: number) => { try { setPreview(await api.get<QuestionDetail>(`/admin/questions/${id}`)); } catch (err) { toast(formatError(err), 'error'); } };

  const previewImport = async () => { setImportBusy(true); try { setImportPreview(await api.post('/admin/questions/import/preview', { csv, defaultBookId: filters.bookId ? Number(filters.bookId) : undefined })); } catch (err) { toast(formatError(err), 'error'); setImportPreview(null); } finally { setImportBusy(false); } };
  const commitImport = async () => { setImportBusy(true); try { const r = await api.post<any>('/admin/questions/import', { csv, defaultBookId: filters.bookId ? Number(filters.bookId) : undefined }); toast(`${r.imported} question(s) imported, ${r.rejected} rejected.`, 'success'); setImportOpen(false); setImportPreview(null); setCsv(''); setNonce((n) => n + 1); } catch (err) { toast(formatError(err), 'error'); } finally { setImportBusy(false); } };
  const onFile = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => setCsv(String(reader.result || '')); reader.readAsText(file); };

  const columns: Column<QuestionRow>[] = [
    { key: 'pick', label: '', width: 34, render: (r) => <input type="checkbox" aria-label={`Select question ${r.id}`} checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} /> },
    { key: 'text_en', label: 'Question', render: (r) => <span className="small"><strong className="truncate" style={{ display: 'block', maxWidth: 330 }}>{r.text_en}</strong><span className="tiny muted">{r.code} · {r.subject_name}{r.topic_name ? ` / ${r.topic_name}` : ''}</span></span> },
    { key: 'book_title', label: 'Book', render: (r) => <span className="small muted">{r.book_title}</span> },
    { key: 'difficulty', label: 'Difficulty', render: (r) => <Badge tone={r.difficulty === 'easy' ? 'green' : r.difficulty === 'hard' ? 'red' : 'amber'}>{r.difficulty}</Badge> },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'published' ? 'green' : r.status === 'archived' ? 'gray' : 'amber'}>{r.status}</Badge> },
    { key: 'correct_count', label: 'Key', render: (r) => r.correct_count > 0 ? <Badge tone="green">{r.correct_count} correct</Badge> : <Badge tone="red">Missing</Badge> },
    { key: 'is_verified_pyq', label: 'PYQ', render: (r) => r.is_verified_pyq ? <Badge tone="blue">Verified</Badge> : <span className="tiny muted">Practice</span> },
  ];

  return <>
    <AdminHeader title="Question bank" description="Create, edit, preview, duplicate, import and publish questions. Answer keys are never sent to students before submission."
      action={<div className="btn-group"><a className="btn btn-outline btn-sm" href="/api/admin/questions-export" download><Download size={15} /> Export CSV</a><Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><FileUp size={15} /> Import CSV</Button><Button size="sm" onClick={() => openEditor('new')}><Plus size={15} /> Add question</Button></div>} />
    <Card className="card-pad mb-2">
      <div className="grid grid-2-sm" style={{ gap: 10 }}>
        <div className="search-box"><input className="input" placeholder="Search text, code or tag" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setFilters({ ...filters, q: draftQ }); setPage(1); } }} /></div>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" value={filters.bookId} onChange={(e) => { setFilters({ ...filters, bookId: e.target.value }); setPage(1); }} aria-label="Filter by book"><option value="">All books</option>{books.data?.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>
          <select className="select" value={filters.subjectId} onChange={(e) => { setFilters({ ...filters, subjectId: e.target.value }); setPage(1); }} aria-label="Filter by subject"><option value="">All subjects</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="select" value={filters.difficulty} onChange={(e) => { setFilters({ ...filters, difficulty: e.target.value }); setPage(1); }} aria-label="Filter by difficulty"><option value="">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
          <select className="select" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }} aria-label="Filter by status"><option value="">Any status</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
          <Button size="sm" variant="outline" onClick={() => { setFilters({ ...filters, q: draftQ }); setPage(1); }}>Apply</Button>
        </div>
      </div>
      {selected.length > 0 && <div className="row mt-2" style={{ gap: 8 }}><span className="small muted">{selected.length} selected</span><Button size="sm" variant="success" onClick={() => bulkStatus('published')}>Publish</Button><Button size="sm" variant="outline" onClick={() => bulkStatus('draft')}>Move to draft</Button><Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button></div>}
    </Card>
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={load} />}
    {!loading && !error && <>
      {rows.length === 0 ? <EmptyState title="No questions match" description="Adjust filters or add a new question." icon={<FileQuestion size={34} />} /> : (
        <DataTable columns={columns} rows={rows} actions={(r) => <>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => showPreview(r.id)} aria-label="Preview"><Eye size={15} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => duplicate(r.id)} aria-label="Duplicate"><Copy size={15} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditor(r.id)} aria-label="Edit question">Edit</button>
          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(r)} aria-label="Delete"><Trash2 size={15} /></button>
        </>} />
      )}
      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
      <p className="tiny muted mt-2">{meta.total} question(s). Only published questions with a correct option are eligible for tests.</p>
    </>}

    <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add question' : `Edit question #${editing}`} wide
      footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save question</Button></>}>
      {formError && <div className="mb-2"><ErrorState message={formError} /></div>}
      <div className="grid grid-2-sm">
        <Field label="Book / collection" htmlFor="q-book"><select id="q-book" className="select" value={form.bookId} onChange={(e) => setForm({ ...form, bookId: Number(e.target.value) })}>{books.data?.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></Field>
        <Field label="Subject" htmlFor="q-subject"><select id="q-subject" className="select" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: Number(e.target.value), topicId: '' })}>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Topic" htmlFor="q-topic"><select id="q-topic" className="select" value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}><option value="">— No topic —</option>{topics.data?.filter((t) => t.subject_id === form.subjectId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Difficulty" htmlFor="q-diff"><select id="q-diff" className="select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Field>
        <Field label="Question type" htmlFor="q-type"><select id="q-type" className="select" value={form.qtype} onChange={(e) => setForm({ ...form, qtype: e.target.value })}><option value="single">Single correct answer</option><option value="multiple">Multiple correct answers</option></select></Field>
        <Field label="Language" htmlFor="q-lang"><select id="q-lang" className="select" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English only</option><option value="hi">Hindi only</option><option value="bilingual">Bilingual</option></select></Field>
      </div>
      <Field label="Question text (English)" htmlFor="q-text" required><textarea id="q-text" className="textarea" value={form.textEn} onChange={(e) => setForm({ ...form, textEn: e.target.value })} /></Field>
      <Field label="Question text (Hindi, optional)" htmlFor="q-text-hi"><textarea id="q-text-hi" className="textarea" value={form.textHi} onChange={(e) => setForm({ ...form, textHi: e.target.value })} lang="hi" /></Field>
      <Field label="Question image URL (optional)" htmlFor="q-image"><input id="q-image" className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="/uploads/diagram.png" /></Field>
      <h3 style={{ fontSize: '.95rem', margin: '8px 0' }}>Answer options</h3>
      <div className="grid" style={{ gap: 10 }}>
        {form.options.map((o, i) => (
          <div className="card card-pad" key={i} style={{ borderColor: o.isCorrect ? 'var(--success)' : undefined }}>
            <div className="row" style={{ gap: 9 }}>
              <strong className="option-letter" style={{ flex: 'none' }}>{o.label}</strong>
              <input className="input grow" placeholder={`Option ${o.label} (English)`} value={o.textEn} onChange={(e) => { const opts = [...form.options]; opts[i] = { ...o, textEn: e.target.value }; setForm({ ...form, options: opts }); }} />
              <label className="checkbox nowrap"><input type="checkbox" checked={o.isCorrect} onChange={(e) => { let opts = [...form.options]; opts[i] = { ...o, isCorrect: e.target.checked }; if (form.qtype === 'single' && e.target.checked) opts = opts.map((x, j) => j === i ? x : { ...x, isCorrect: false }); setForm({ ...form, options: opts }); }} /><span className="small">Correct</span></label>
              {form.options.length > 2 && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })} aria-label="Remove option"><Trash2 size={15} /></button>}
            </div>
            <input className="input mt-1" placeholder="Hindi translation (optional)" value={o.textHi} onChange={(e) => { const opts = [...form.options]; opts[i] = { ...o, textHi: e.target.value }; setForm({ ...form, options: opts }); }} lang="hi" />
          </div>
        ))}
      </div>
      {form.options.length < 8 && <Button size="sm" variant="outline" className="mt-2" onClick={() => setForm({ ...form, options: [...form.options, { label: 'ABCDEFGH'[form.options.length], textEn: '', textHi: '', imageUrl: '', isCorrect: false }] })}><Plus size={15} /> Add option</Button>}
      <div className="grid grid-2-sm mt-2">
        <Field label="Explanation (English)" htmlFor="q-exp"><textarea id="q-exp" className="textarea" value={form.explanationEn} onChange={(e) => setForm({ ...form, explanationEn: e.target.value })} /></Field>
        <Field label="Explanation (Hindi, optional)" htmlFor="q-exp-hi"><textarea id="q-exp-hi" className="textarea" value={form.explanationHi} onChange={(e) => setForm({ ...form, explanationHi: e.target.value })} /></Field>
        <Field label="Marks"><input className="input" type="number" min={0} max={100} step={0.25} value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} /></Field>
        <Field label="Negative marks"><input className="input" type="number" min={0} max={100} step={0.25} value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: Number(e.target.value) })} /></Field>
        <Field label="Source / attribution"><input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Original practice content" /></Field>
        <Field label="Tags (comma separated)"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
        <Field label="Publication status"><select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></Field>
      </div>
      <label className="checkbox"><input type="checkbox" checked={form.isVerifiedPyq} onChange={(e) => setForm({ ...form, isVerifiedPyq: e.target.checked })} /><span className="small">Mark as <strong>verified previous-year question</strong>. Only tick this when you have actually verified the source and have permission to use it.</span></label>
    </Modal>

    <ConfirmDialog open={Boolean(deleting)} title="Delete question?" danger confirmLabel="Delete question" onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
      message="This is permanent. Questions that appear in stored attempts cannot be deleted; archive them instead." />

    <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Question preview">
      {preview && <>
        <div className="row" style={{ gap: 6, marginBottom: 10 }}><Badge tone="blue">{preview.subject_name}</Badge>{preview.topic_name && <Badge tone="gray">{preview.topic_name}</Badge>}<Badge tone={preview.status === 'published' ? 'green' : 'amber'}>{preview.status}</Badge></div>
        <strong style={{ whiteSpace: 'pre-wrap' }}>{preview.text_en}</strong>
        {preview.text_hi && <p className="mt-1" lang="hi">{preview.text_hi}</p>}
        {preview.image_url && <img src={preview.image_url} alt="Question" style={{ maxWidth: '100%', margin: '10px 0' }} />}
        <div className="mt-2">{preview.options.map((o) => <div key={o.id} className={`review-option ${o.is_correct ? 'is-correct' : ''}`}><strong>{o.label}.</strong><span className="grow">{o.text_en}</span>{o.is_correct ? <span className="tiny" style={{ color: 'var(--success)' }}>Correct</span> : null}</div>)}</div>
        {preview.explanation_en && <div className="alert alert-info mt-2"><strong>Explanation:</strong> {preview.explanation_en}</div>}
        <p className="tiny muted mt-2 mb-0">{preview.code} · {preview.source || 'No source recorded'} · {preview.is_verified_pyq ? 'Verified PYQ' : 'Original practice content'}</p>
      </>}
    </Modal>

    <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import questions from CSV" wide
      footer={<><Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>{importPreview?.validCount > 0 && <Button loading={importBusy} onClick={commitImport}>Import {importPreview.validCount} valid row(s)</Button>}</>}>
      <Notice kind="info">Columns: <code>book_slug, subject_slug, topic_slug, difficulty, qtype, text_en, text_hi, explanation_en, marks, negative_marks, language, status, tags, source, options, correct_labels</code>. Options use <code>A:Text||B:Text</code>. Duplicates are rejected.</Notice>
      <div className="row mt-2" style={{ gap: 8 }}><label className="btn btn-outline btn-sm"><Upload size={15} /> Choose CSV file<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} /></label><a className="btn btn-ghost btn-sm" href="/api/admin/questions-export" download>Download an example export</a></div>
      <Field label="CSV content" htmlFor="q-csv"><textarea id="q-csv" className="textarea" style={{ minHeight: 170, fontFamily: 'monospace', fontSize: '.78rem' }} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="book_slug,subject_slug,..." /></Field>
      <Button variant="outline" loading={importBusy} onClick={previewImport}>Validate &amp; preview</Button>
      {importPreview && <div className="mt-2">
        <Notice kind={importPreview.errorCount ? 'warning' : 'success'}>{importPreview.validCount} valid row(s), {importPreview.errorCount} rejected. Nothing is saved until you confirm the import.</Notice>
        {importPreview.errors?.length > 0 && <Card className="card-pad mt-2"><strong className="small">Row errors</strong>{importPreview.errors.slice(0, 20).map((e: any) => <div key={e.row} className="small" style={{ padding: '4px 0', borderBottom: '1px solid #F1F5F9' }}><strong>Row {e.row}:</strong> <span style={{ color: 'var(--danger)' }}>{e.errors.join('; ')}</span></div>)}</Card>}
        {importPreview.preview?.length > 0 && <Card className="card-pad mt-2"><strong className="small">Preview of valid rows</strong>{importPreview.preview.map((p: any) => <div key={p.row} className="small" style={{ padding: '4px 0' }}>Row {p.row}: {p.text}</div>)}</Card>}
      </div>}
    </Modal>
  </>;
}
