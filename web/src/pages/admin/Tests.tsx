import { useEffect, useState } from 'react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import { api, formatError } from '../../api/client';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal, Notice, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { formatDateTime, titleCase } from '../../lib/format';
import { AdminHeader, DataTable, type Column } from './shared';

interface TestRow { id: number; slug: string; title: string; mode: string; selection_mode: string; question_count: number; duration_minutes: number; negative_marks: number; is_published: number; is_active: number; is_listed: number; book_title: string; rule_count: number; attempt_count: number; updated_at: string }
interface Rule { subjectId: string; topicId: string; questionCount: number; difficulty: string }

const blank = {
  title: '', slug: '', description: '', bookId: 0, categoryId: '', subjectId: '', topicId: '',
  mode: 'practice', selectionMode: 'random', instructions: '', durationMinutes: 20, questionCount: 10,
  customCountEnabled: false, customDurationEnabled: false, marksPerQuestion: 1, negativeMarks: 0,
  languages: ['en'] as string[], practiceFeedback: false, resultVisibility: 'after_submit',
  resumePolicy: 'resume', autoSubmit: true, isActive: true, isPublished: false, scheduledAt: '', seriesName: '',
  rules: [] as Rule[], fixedQuestionIds: [] as number[],
};

export function AdminTests() {
  const toast = useToast();
  const books = useApi<any[]>('/admin/books');
  const categories = useApi<any[]>('/admin/categories');
  const subjects = useApi<any[]>('/admin/subjects');
  const topics = useApi<any[]>('/admin/topics');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TestRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState({ ...blank, rules: [] as Rule[], fixedQuestionIds: [] as number[], languages: ['en'] });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<TestRow | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const load = async () => {
    setLoading(true); setError('');
    try { const r = await api.get<any>('/admin/tests'); const list = Array.isArray(r) ? r : r.data; setRows(list); setMeta({ page: 1, pages: 1, total: list.length }); }
    catch (err) { setError(formatError(err)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = async (id: number | 'new') => {
    setFormError('');
    if (id === 'new') { setForm({ ...blank, bookId: Number(books.data?.[0]?.id || 0), rules: [], fixedQuestionIds: [], languages: ['en'] }); setEditing('new'); return; }
    try {
      const t = await api.get<any>(`/admin/tests/${id}`);
      setForm({
        title: t.title, slug: t.slug, description: t.description || '', bookId: t.book_id,
        categoryId: t.category_id ? String(t.category_id) : '', subjectId: t.subject_id ? String(t.subject_id) : '',
        topicId: t.topic_id ? String(t.topic_id) : '', mode: t.mode, selectionMode: t.selection_mode,
        instructions: t.instructions || '', durationMinutes: t.duration_minutes, questionCount: t.question_count,
        customCountEnabled: Boolean(t.custom_count_enabled), customDurationEnabled: Boolean(t.custom_duration_enabled),
        marksPerQuestion: t.marks_per_question, negativeMarks: t.negative_marks, languages: t.languages || ['en'],
        practiceFeedback: Boolean(t.practice_feedback), resultVisibility: t.result_visibility,
        resumePolicy: t.resume_policy, autoSubmit: Boolean(t.auto_submit), isActive: Boolean(t.is_active),
        isPublished: Boolean(t.is_published), scheduledAt: t.scheduled_at ? String(t.scheduled_at).slice(0, 16) : '',
        seriesName: t.series_name || '',
        rules: (t.rules || []).map((r: any) => ({ subjectId: r.subject_id ? String(r.subject_id) : '', topicId: r.topic_id ? String(r.topic_id) : '', questionCount: r.question_count, difficulty: r.difficulty || '' })),
        fixedQuestionIds: t.fixedQuestionIds || [],
      });
      setEditing(id);
    } catch (err) { toast(formatError(err), 'error'); }
  };

  const ruleTotal = form.rules.reduce((a, r) => a + Number(r.questionCount || 0), 0);

  const save = async () => {
    setFormError('');
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.bookId) { setFormError('Select a book.'); return; }
    if (form.rules.length && ruleTotal !== form.questionCount) { setFormError(`Pattern sections total ${ruleTotal} but question count is ${form.questionCount}.`); return; }
    if (form.selectionMode === 'fixed' && form.fixedQuestionIds.length < form.questionCount) { setFormError(`Fixed tests require at least ${form.questionCount} selected questions.`); return; }
    setBusy(true);
    const payload = {
      ...form,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      subjectId: form.subjectId ? Number(form.subjectId) : null,
      topicId: form.topicId ? Number(form.topicId) : null,
      durationMinutes: Number(form.durationMinutes), questionCount: Number(form.questionCount),
      marksPerQuestion: Number(form.marksPerQuestion), negativeMarks: Number(form.negativeMarks),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      rules: form.rules.map((r) => ({ subjectId: r.subjectId ? Number(r.subjectId) : null, topicId: r.topicId ? Number(r.topicId) : null, questionCount: Number(r.questionCount), difficulty: r.difficulty || null })),
    };
    try {
      if (editing === 'new') await api.post('/admin/tests', payload);
      else await api.put(`/admin/tests/${editing}`, payload);
      toast('Test configuration saved.', 'success'); setEditing(null); setNonce((n) => n + 1);
    } catch (err) { setFormError(formatError(err)); } finally { setBusy(false); }
  };

  const confirmDelete = async () => { if (!deleting) return; try { await api.del(`/admin/tests/${deleting.id}`); toast('Test deleted.', 'success'); setDeleting(null); setNonce((n) => n + 1); } catch (err) { toast(formatError(err), 'error'); setDeleting(null); } };
  const showPreview = async (id: number) => { try { setPreview(await api.get<any>(`/admin/tests/${id}/preview`)); } catch (err) { toast(formatError(err), 'error'); } };

  const questionPool = useApi<{ data: any[] }>(form.bookId ? `/admin/questions?bookId=${form.bookId}&status=published&limit=200` : null, [form.bookId]);

  const columns: Column<TestRow>[] = [
    { key: 'title', label: 'Test', render: (r) => <span><strong>{r.title}</strong><span className="tiny muted" style={{ display: 'block' }}>/{r.slug}{!r.is_listed ? ' · hidden helper' : ''}</span></span> },
    { key: 'book_title', label: 'Book', render: (r) => <span className="small muted">{r.book_title || '—'}</span> },
    { key: 'mode', label: 'Mode', render: (r) => <Badge tone="blue">{titleCase(r.mode)}</Badge> },
    { key: 'question_count', label: 'Qs' }, { key: 'duration_minutes', label: 'Min' },
    { key: 'negative_marks', label: 'Negative' },
    { key: 'rule_count', label: 'Pattern', render: (r) => r.rule_count ? <Badge tone="gray">{r.rule_count} sections</Badge> : '—' },
    { key: 'attempt_count', label: 'Attempts' },
    { key: 'is_published', label: 'Status', render: (r) => <Badge tone={r.is_published && r.is_active ? 'green' : 'amber'}>{r.is_published ? (r.is_active ? 'Published' : 'Inactive') : 'Draft'}</Badge> },
    { key: 'updated_at', label: 'Updated', render: (r) => <span className="tiny">{formatDateTime(r.updated_at)}</span> },
  ];

  return <>
    <AdminHeader title="Test manager" description="Configure question selection, timing, marking, languages, feedback and publication."
      action={<Button size="sm" onClick={() => openEditor('new')}><Plus size={15} /> Create test</Button>} />
    {loading && <Loading />}{error && <ErrorState message={error} onRetry={load} />}
    {!loading && !error && <>
      {rows.length === 0 ? <EmptyState title="No tests configured" description="Create your first published test." /> : <DataTable columns={columns} rows={rows} actions={(r) => <>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => showPreview(r.id)} aria-label="Preview generated paper"><Eye size={15} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => openEditor(r.id)}>Edit</button>
        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleting(r)} aria-label="Delete"><Trash2 size={15} /></button>
      </>} />}
      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
    </>}

    <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Create test' : `Edit test #${editing}`} wide
      footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save test</Button></>}>
      {formError && <div className="mb-2"><ErrorState message={formError} /></div>}
      <div className="grid grid-2-sm">
        <Field label="Title" htmlFor="t-title" required><input id="t-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Slug (optional)" htmlFor="t-slug"><input id="t-slug" className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
        <Field label="Book / collection" htmlFor="t-book"><select id="t-book" className="select" value={form.bookId} onChange={(e) => setForm({ ...form, bookId: Number(e.target.value), fixedQuestionIds: [] })}>{books.data?.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></Field>
        <Field label="Category" htmlFor="t-cat"><select id="t-cat" className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">— None —</option>{categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Mode" htmlFor="t-mode"><select id="t-mode" className="select" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}><option value="full_mock">Full mock</option><option value="subject_wise">Subject-wise</option><option value="topic_wise">Topic-wise</option><option value="practice">Practice</option><option value="previous_year">Previous year (verified PYQ only)</option></select></Field>
        <Field label="Question selection" htmlFor="t-sel"><select id="t-sel" className="select" value={form.selectionMode} onChange={(e) => setForm({ ...form, selectionMode: e.target.value })}><option value="random">Random from eligible bank</option><option value="fixed">Fixed question set</option><option value="topic">Pattern / topic rules</option></select></Field>
        <Field label="Fixed subject (optional)" htmlFor="t-subj"><select id="t-subj" className="select" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicId: '' })}><option value="">All subjects</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Fixed topic (optional)" htmlFor="t-topic"><select id="t-topic" className="select" value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}><option value="">All topics</option>{topics.data?.filter((t) => !form.subjectId || t.subject_id === Number(form.subjectId)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Question count" htmlFor="t-count"><input id="t-count" className="input" type="number" min={1} max={200} value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })} /></Field>
        <Field label="Duration (minutes)" htmlFor="t-dur"><input id="t-dur" className="input" type="number" min={1} max={600} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></Field>
        <Field label="Marks per question" htmlFor="t-marks"><input id="t-marks" className="input" type="number" min={0} max={100} step={0.25} value={form.marksPerQuestion} onChange={(e) => setForm({ ...form, marksPerQuestion: Number(e.target.value) })} /></Field>
        <Field label="Negative marks" htmlFor="t-neg"><input id="t-neg" className="input" type="number" min={0} max={100} step={0.25} value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: Number(e.target.value) })} /></Field>
        <Field label="Result visibility" htmlFor="t-vis"><select id="t-vis" className="select" value={form.resultVisibility} onChange={(e) => setForm({ ...form, resultVisibility: e.target.value })}><option value="after_submit">Reveal answers after submit</option><option value="hidden">Hide answer keys</option></select></Field>
        <Field label="Resume policy" htmlFor="t-resume"><select id="t-resume" className="select" value={form.resumePolicy} onChange={(e) => setForm({ ...form, resumePolicy: e.target.value })}><option value="resume">Resume existing attempt</option><option value="restart">Finalise old and start new</option></select></Field>
        <Field label="Schedule (optional)" htmlFor="t-sched"><input id="t-sched" className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
        <Field label="Test series (optional)" htmlFor="t-series"><input id="t-series" className="input" value={form.seriesName} onChange={(e) => setForm({ ...form, seriesName: e.target.value })} /></Field>
      </div>
      <Field label="Description"><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Custom instructions (optional)" hint="Shown on the instruction page in addition to the standard rules."><textarea className="textarea" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>
      <div className="grid grid-2-sm">
        <div><strong className="small">Supported languages</strong><div className="row mt-1" style={{ gap: 10 }}>{['en', 'hi'].map((l) => <label className="checkbox" key={l}><input type="checkbox" checked={form.languages.includes(l)} onChange={(e) => setForm({ ...form, languages: e.target.checked ? [...form.languages, l] : form.languages.filter((x) => x !== l) })} /><span className="small">{l === 'en' ? 'English' : 'Hindi'}</span></label>)}</div><p className="field-hint">Hindi requires enough translated questions in the collection.</p></div>
        <div className="grid" style={{ gap: 4 }}>
          {([['customCountEnabled', 'Allow custom question counts'], ['customDurationEnabled', 'Allow custom duration'], ['practiceFeedback', 'Instant feedback in practice mode'], ['autoSubmit', 'Auto-submit at deadline'], ['isActive', 'Active'], ['isPublished', 'Published']] as const).map(([k, label]) => (
            <label className="checkbox" key={k}><input type="checkbox" checked={Boolean((form as any)[k])} onChange={(e) => setForm({ ...form, [k]: e.target.checked } as any)} /><span className="small">{label}</span></label>
          ))}
        </div>
      </div>

      <h3 style={{ fontSize: '.98rem', margin: '18px 0 8px' }}>Test pattern sections</h3>
      <p className="small muted">Optional. When sections exist, their counts must add up to the question count. Sections select from the eligible bank independently.</p>
      <div className="grid" style={{ gap: 8 }}>
        {form.rules.map((r, i) => (
          <div className="row card card-pad" key={i} style={{ gap: 8, flexWrap: 'nowrap', overflowX: 'auto' }}>
            <select className="select" style={{ minWidth: 130 }} value={r.subjectId} onChange={(e) => { const rules = [...form.rules]; rules[i] = { ...r, subjectId: e.target.value, topicId: '' }; setForm({ ...form, rules }); }} aria-label="Section subject"><option value="">Any subject</option>{subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="select" style={{ minWidth: 130 }} value={r.topicId} onChange={(e) => { const rules = [...form.rules]; rules[i] = { ...r, topicId: e.target.value }; setForm({ ...form, rules }); }} aria-label="Section topic"><option value="">Any topic</option>{topics.data?.filter((t) => !r.subjectId || t.subject_id === Number(r.subjectId)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="select" style={{ minWidth: 110 }} value={r.difficulty} onChange={(e) => { const rules = [...form.rules]; rules[i] = { ...r, difficulty: e.target.value }; setForm({ ...form, rules }); }} aria-label="Difficulty"><option value="">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
            <input className="input" style={{ width: 90 }} type="number" min={1} max={200} value={r.questionCount} onChange={(e) => { const rules = [...form.rules]; rules[i] = { ...r, questionCount: Number(e.target.value) }; setForm({ ...form, rules }); }} aria-label="Section count" />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setForm({ ...form, rules: form.rules.filter((_, j) => j !== i) })} aria-label="Remove section"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setForm({ ...form, rules: [...form.rules, { subjectId: '', topicId: '', questionCount: 5, difficulty: '' }] })}><Plus size={15} /> Add section</Button>
      {form.rules.length > 0 && <div className="mt-2"><Notice kind={ruleTotal === form.questionCount ? 'success' : 'warning'}>Sections total {ruleTotal} question(s); configured question count is {form.questionCount}.</Notice></div>}

      {form.selectionMode === 'fixed' && <div className="mt-3">
        <h3 style={{ fontSize: '.98rem', marginBottom: 8 }}>Fixed questions ({form.fixedQuestionIds.length} selected, need {form.questionCount})</h3>
        {questionPool.loading && <Loading />}
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
          {questionPool.data?.data.map((q) => (
            <label key={q.id} className="checkbox" style={{ display: 'flex', padding: '5px 0', borderBottom: '1px solid #F1F5F9' }}>
              <input type="checkbox" checked={form.fixedQuestionIds.includes(q.id)} onChange={(e) => setForm({ ...form, fixedQuestionIds: e.target.checked ? [...form.fixedQuestionIds, q.id] : form.fixedQuestionIds.filter((x) => x !== q.id) })} />
              <span className="small"><strong>{q.code}</strong> · {q.text_en}</span>
            </label>
          ))}
          {questionPool.data && questionPool.data.data.length === 0 && <p className="small muted">No published questions in this collection yet.</p>}
        </div>
      </div>}
    </Modal>

    <ConfirmDialog open={Boolean(deleting)} title="Delete this test?" danger confirmLabel="Delete test" onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
      message="Tests with recorded attempts cannot be deleted. Unpublish them instead." />

    <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Generated paper preview" wide>
      {preview && (preview.error ? <ErrorState message={preview.error} /> : <>
        <Notice kind={preview.count > 0 ? 'success' : 'warning'}>{preview.count} question(s) can be selected from the current eligible bank. This preview calls the same selection logic used when a student starts the test.</Notice>
        <div className="grid mt-2" style={{ gap: 7 }}>{preview.questions.map((q: any, i: number) => <div key={q.id} className="small" style={{ padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}><strong>{i + 1}.</strong> {q.text_en} <span className="tiny muted">({q.difficulty})</span></div>)}</div>
      </>)}
    </Modal>
  </>;
}
