import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, ChevronLeft,
  ChevronRight, CircleAlert, Download, FileDown, FileJson, FileText, KeyRound,
  Layers3, LoaderCircle, Palette, Pencil, Presentation, RefreshCw, Save, ScanSearch,
  Search, Sparkles, Trash2, WandSparkles, XCircle,
} from 'lucide-react';
import { api, projectDownload } from '../api';
import type { ExportRecord, GenerateSettings, Project, Question, QuestionOption } from '../types';
import { EmptyState, ErrorMessage, formatDate, Loading, StatusBadge } from '../components/Common';

type Step = 'review' | 'design' | 'export';
const labels: QuestionOption['label'][] = ['A', 'B', 'C', 'D'];
const defaultDesign: GenerateSettings = {
  mode: 'C', question_color: '#73F59A', option_color: '#FFFFFF', highlight_color: '#FF9D4D',
  background_color: '#07110D', font_family: 'Nirmala UI', question_font_size: 28,
  option_font_size: 22, show_question_numbers: true, custom_answer_slide: true,
  custom_include_explanation: true, custom_show_options_on_answer: false,
};
const modeInfo = {
  A: ['Questions only', 'One slide per question'], B: ['Answer reveal', 'Question, then answer'],
  C: ['Teach & explain', 'Question, answer, explanation'], D: ['Custom layout', 'You choose the structure'],
};

export default function ProjectWorkspace() {
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const quickMode = searchParams.get('quick') === '1';
  const autoGenerateStarted = useRef(false);
  const autoDownloadStarted = useRef(false);
  const initialStep = searchParams.get('step');
  const [step, setStep] = useState<Step>(initialStep === 'design' ? 'design' : initialStep === 'export' ? 'export' : 'review');
  const [project, setProject] = useState<Project | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [design, setDesign] = useState<GenerateSettings>(defaultDesign);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Question | null>(null);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [previewKind, setPreviewKind] = useState<'question' | 'answer'>('question');
  const [changedSinceExport, setChangedSinceExport] = useState(false);

  const loadQuestions = async () => {
    const items = await api.questions(projectId);
    setQuestions(items);
    if (items.length && !selectedId) {
      setSelectedId(items[0].id);
      setDraft(items[0]);
    }
    return items;
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.project(projectId), api.questions(projectId), api.exports(projectId), api.settings()])
      .then(([item, items, history, appSettings]) => {
        if (!active) return;
        setProject(item); setQuestions(items); setExports(history);
        setDesign({ ...defaultDesign, mode: appSettings.default_mode, font_family: appSettings.default_font, ...(item.generation_settings || {}) });
        if (items.length) { setSelectedId(items[0].id); setDraft(items[0]); }
        setLoaded(true);
      })
      .catch((reason) => { if (active) { setError(reason.message); setLoaded(true); } });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!project || !['uploaded', 'processing'].includes(project.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const updated = await api.project(projectId);
        setProject(updated);
        if (updated.status === 'ready' || updated.status === 'failed') {
          window.clearInterval(timer);
          await loadQuestions();
        }
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not refresh processing status.'); }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [project?.status, projectId]);

  useEffect(() => { setPreviewKind('question'); }, [design.mode, design.custom_answer_slide]);

  const selected = questions.find((question) => question.id === selectedId) || null;
  const missingAnswers = questions.filter((question) => !question.correct_answer).length;
  const flagged = questions.filter((question) => question.flags.length > 0).length;
  const filteredQuestions = useMemo(() => questions.filter((question) =>
    `${question.number} ${question.text}`.toLowerCase().includes(query.toLowerCase())), [questions, query]);
  const latestPptx = exports.find((item) => item.kind === 'pptx');

  const changeStep = (next: Step) => {
    if (dirty && !window.confirm('Discard unsaved changes to this question?')) return;
    setDirty(false); setStep(next); setSearchParams(next === 'review' ? {} : { step: next });
    setError(''); setNotice('');
  };
  const chooseQuestion = (question: Question) => {
    if (dirty && !window.confirm('Discard unsaved changes to this question?')) return;
    setSelectedId(question.id); setDraft(question); setDirty(false); setError('');
  };
  const editDraft = (values: Partial<Question>) => { setDraft((current) => current ? { ...current, ...values } : current); setDirty(true); };
  const saveQuestion = async () => {
    if (!draft) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const updated = await api.updateQuestion(draft.id, {
        number: draft.number, text: draft.text,
        options: draft.options.filter((option) => option.text.trim()),
        correct_answer: draft.correct_answer || null, explanation: draft.explanation || null,
        answer_source: draft.correct_answer ? draft.answer_source : 'none',
        answer_confidence: draft.correct_answer ? draft.answer_confidence : 'none',
      });
      setQuestions((items) => items.map((item) => item.id === updated.id ? updated : item));
      setDraft(updated); setDirty(false); setChangedSinceExport(true); setNotice('Question changes saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save question.'); }
    finally { setSaving(false); }
  };
  const removeQuestion = async () => {
    if (!draft || !window.confirm('Delete this extracted question? This does not change the original PDF.')) return;
    try {
      await api.deleteQuestion(draft.id);
      const remaining = questions.filter((item) => item.id !== draft.id);
      setQuestions(remaining); setDraft(remaining[0] || null); setSelectedId(remaining[0]?.id || '');
      setDirty(false); setChangedSinceExport(true); setNotice('Question removed from this project.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete question.'); }
  };
  const generateAnswers = async () => {
    setAiBusy(true); setError(''); setNotice('');
    try {
      const result = await api.generateAnswers(projectId);
      setQuestions(result.questions);
      const current = result.questions.find((item) => item.id === selectedId);
      if (current) setDraft(current);
      setChangedSinceExport(result.updated > 0);
      setNotice(`${result.updated} AI answer${result.updated === 1 ? '' : 's'} added. ${result.not_answered ? `${result.not_answered} could not be answered. ` : ''}Please verify them before teaching.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'AI answer generation failed.'); }
    finally { setAiBusy(false); }
  };
  const retry = async () => {
    setRetrying(true); setError('');
    try { await api.retry(projectId); setProject((item) => item ? { ...item, status: 'processing', progress: 0 } : item); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not retry processing.'); }
    finally { setRetrying(false); }
  };
  const generate = async () => {
    setGenerating(true); setError(''); setNotice('');
    try {
      const result = await api.generate(projectId, design);
      const history = await api.exports(projectId);
      setExports(history); setChangedSinceExport(false); setStep('export');
      setSearchParams(quickMode ? { quick: '1', step: 'export' } : { step: 'export' });
      setNotice(`${result.slide_count} editable slides generated and verified successfully.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not generate presentation.'); }
    finally { setGenerating(false); }
  };

  useEffect(() => {
    if (!quickMode || !loaded || !project || project.status !== 'ready' || step === 'export' || questions.length === 0 || autoGenerateStarted.current) return;
    autoGenerateStarted.current = true;
    void generate();
  }, [quickMode, loaded, project?.status, questions.length, step]);

  useEffect(() => {
    if (!quickMode || step !== 'export' || !latestPptx || autoDownloadStarted.current) return;
    autoDownloadStarted.current = true;
    const anchor = document.createElement('a');
    anchor.href = projectDownload(projectId, 'pptx');
    anchor.download = '';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [quickMode, step, latestPptx?.id, projectId]);

  if (!loaded) return <Loading label="Opening your project…" />;
  if (!project) return <ErrorMessage message={error || 'Project not found.'} />;
  const processing = ['uploaded', 'processing'].includes(project.status);

  if (quickMode) {
    return <div className="workspace-page quick-workspace">
      <div className="workspace-back"><Link to="/"><ArrowLeft size={15} /> Dashboard</Link><span>/</span><span>Automatic PPT</span></div>
      <section className="workspace-project-header">
        <span className="file-icon large"><FileText size={25} /></span>
        <div><div className="title-with-status"><h2>{project.title}</h2><StatusBadge status={project.status} /></div><p>{project.original_filename} · {project.total_pages || 0} pages · {project.question_count || questions.length} questions</p></div>
      </section>
      {error && <ErrorMessage message={error} />}
      {notice && <div className="alert success"><CheckCircle2 size={18} /><span>{notice}</span></div>}
      {processing && <ProcessingView project={project} />}
      {project.status === 'failed' && <section className="panel processing-panel failed-processing"><span className="processing-symbol"><XCircle size={32} /></span><h2>This PDF needs attention</h2><p>{project.error || 'The PDF could not be processed.'}</p><button className="button primary" onClick={retry} disabled={retrying}>{retrying ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Retry processing</button><IssueDetails project={project} /></section>}
      {project.status === 'ready' && <>
        {(project.unreadable_pages.length > 0 || project.warnings.length > 0) && <IssueDetails project={project} />}
        {step === 'export' && latestPptx ? <>
          <section className="quick-success-card">
            <span className="quick-success-icon"><CheckCircle2 size={34} /></span>
            <span className="eyebrow"><Sparkles size={13} /> YOUR PPT IS READY</span>
            <h2>Your class presentation is done.</h2>
            <p>{latestPptx.slide_count} editable slides created from {questions.length} questions. Your PPTX download should start automatically.</p>
            <a className="button primary quick-download" href={projectDownload(projectId, 'pptx')} download><Download size={20} /> Download PPTX again</a>
            <div className="quick-secondary-actions"><Link to={`/projects/${projectId}`} className="button secondary"><Pencil size={15} /> Review or edit questions</Link><button className="button secondary" onClick={() => { setSearchParams({ step: 'design' }); setStep('design'); }}><Palette size={15} /> Change design</button></div>
            <div className="quick-other-downloads"><span>Other files:</span><a href={projectDownload(projectId, 'pdf')} download>Presentation PDF</a><a href={projectDownload(projectId, 'questions')} download>Questions JSON</a><a href={projectDownload(projectId, 'answer-key')} download>Answer key</a></div>
          </section>
        </> : questions.length === 0 ? <EmptyState title="No supported questions found" text="No PPT was generated because no numbered MCQs were detected. Check the page warnings or review the project." action={<Link className="button secondary" to={`/projects/${projectId}`}>Open project details</Link>} /> : <section className="panel processing-panel"><div className="processing-orbit"><Presentation size={30} /><span /><span /></div><span className="eyebrow">AUTOMATIC PPT GENERATION</span><h2>Making your editable PowerPoint</h2><p>{questions.length} questions have been extracted. We’re building and verifying your slides now—no more steps needed.</p><div className="quick-building-line"><LoaderCircle className="spin" size={16} /> Creating blackboard slides in Mode {design.mode}</div>{error && <button className="button primary quick-retry" onClick={generate} disabled={generating}>{generating ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Try PPT generation again</button>}</section>}
      </>}
    </div>;
  }

  const hasAnswerSlide = design.mode === 'B' || design.mode === 'C' || (design.mode === 'D' && design.custom_answer_slide);

  return (
    <div className="workspace-page">
      <div className="workspace-back"><Link to="/projects"><ArrowLeft size={15} /> All projects</Link><span>/</span><span>{project.original_filename}</span></div>
      <section className="workspace-project-header">
        <span className="file-icon large"><FileText size={25} /></span>
        <div><div className="title-with-status"><h2>{project.title}</h2><StatusBadge status={project.status} /></div><p>{project.original_filename} · {project.total_pages || 0} pages · {project.question_count || questions.length} questions</p></div>
        {!processing && project.status === 'ready' && <button className="button secondary desktop-only" onClick={() => changeStep('design')}><WandSparkles size={17} /> Design presentation</button>}
      </section>

      {!processing && project.status === 'ready' && <nav className="workspace-steps">
        <button className={step === 'review' ? 'active' : ''} onClick={() => changeStep('review')}><span>{step !== 'review' ? <Check size={14} /> : '1'}</span><div><strong>Review questions</strong><small>Edit and verify extracted content</small></div></button>
        <i />
        <button className={step === 'design' ? 'active' : ''} onClick={() => changeStep('design')}><span>2</span><div><strong>Design slides</strong><small>Choose a mode and blackboard theme</small></div></button>
        <i />
        <button className={step === 'export' ? 'active' : ''} onClick={() => changeStep('export')}><span>3</span><div><strong>Download</strong><small>PPTX, PDF, questions, answer key</small></div></button>
      </nav>}

      {error && <ErrorMessage message={error} />}
      {notice && <div className="alert success"><CheckCircle2 size={18} /><span>{notice}</span></div>}
      {processing && <ProcessingView project={project} />}
      {project.status === 'failed' && <section className="panel processing-panel failed-processing"><span className="processing-symbol"><XCircle size={32} /></span><h2>This PDF needs attention</h2><p>{project.error || 'The PDF could not be processed.'}</p><button className="button primary" onClick={retry} disabled={retrying}>{retrying ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />} Retry processing</button><IssueDetails project={project} /></section>}
      {project.status === 'ready' && <>
        {(project.unreadable_pages.length > 0 || project.warnings.length > 0) && <IssueDetails project={project} />}
        {step === 'review' && <section className="review-section">
          <div className="workspace-section-heading"><div><span className="section-kicker">SOURCE-ORDERED EXTRACTION</span><h3>Review every question</h3><p>{questions.length} questions · {flagged} need a quick check · {missingAnswers} missing answers</p></div><div className="heading-actions"><a className="button secondary small" href={projectDownload(projectId, 'questions')} download><FileJson size={15} /> Extracted JSON</a><button className="button ai-button" onClick={generateAnswers} disabled={aiBusy || !missingAnswers || !questions.length} title={!missingAnswers ? 'All questions already have answers' : 'Requires AI_API_KEY on the backend'}>{aiBusy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{aiBusy ? 'Generating…' : missingAnswers ? `AI answers for ${missingAnswers} missing` : 'All answers present'}</button></div></div>
          {project.error && <div className="alert warning"><AlertTriangle size={18} />{project.error}</div>}
          {questions.length && draft ? <div className="review-layout">
            <aside className="question-list-panel">
              <label className="search-box"><Search size={16} /><input placeholder="Find a question…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <div className="question-list">{filteredQuestions.map((question, index) => <button key={question.id} className={selectedId === question.id ? 'active' : ''} onClick={() => chooseQuestion(question)}><span className="question-list-number">{question.number || index + 1}</span><span><strong>{question.text}</strong><small>Page {question.page_number} · {question.options.length}/4 options</small></span>{question.flags.length > 0 && <CircleAlert size={14} className="flag-icon" />}</button>)}</div>
              <div className="question-list-footer"><span><CircleAlert size={13} /> Flagged items need review</span></div>
            </aside>
            <QuestionEditor draft={draft} saving={saving} dirty={dirty} onEdit={editDraft} onSave={saveQuestion} onDelete={removeQuestion} />
          </div> : <EmptyState title="No supported questions were extracted" text="No placeholder questions were invented. Check page warnings, install OCR for scanned pages, or configure AI extraction for unusual layouts." action={<button className="button secondary" onClick={retry}><RefreshCw size={16} /> Retry PDF processing</button>} />}
        </section>}

        {step === 'design' && <section className="design-section">
          <div className="workspace-section-heading"><div><span className="section-kicker">BLACKBOARD STUDIO</span><h3>Make it ready for your classroom</h3><p>Live preview uses the first reviewed question. Exports include all {questions.length}.</p></div><span className="widescreen-badge">16:9 WIDESCREEN</span></div>
          <div className="design-layout">
            <div className="design-controls">
              <section className="panel control-section"><div className="control-heading"><Layers3 size={17} /><h4>Presentation mode</h4></div><div className="mode-selector">{(Object.keys(modeInfo) as Array<keyof typeof modeInfo>).map((mode) => <button key={mode} className={design.mode === mode ? 'active' : ''} onClick={() => setDesign({ ...design, mode })}><span>{mode}</span><div><strong>{modeInfo[mode][0]}</strong><small>{modeInfo[mode][1]}</small></div>{design.mode === mode && <Check size={14} />}</button>)}</div></section>
              {design.mode === 'D' && <section className="panel control-section"><div className="control-heading"><Pencil size={17} /><h4>Custom layout</h4></div><DesignToggle label="Separate answer slide" checked={design.custom_answer_slide} onChange={(value) => setDesign({ ...design, custom_answer_slide: value })} /><DesignToggle label="Include explanation" checked={design.custom_include_explanation} onChange={(value) => setDesign({ ...design, custom_include_explanation: value })} /><DesignToggle label="Options on answer slide" checked={design.custom_show_options_on_answer} onChange={(value) => setDesign({ ...design, custom_show_options_on_answer: value })} disabled={!design.custom_answer_slide} /></section>}
              <section className="panel control-section"><div className="control-heading"><Palette size={17} /><h4>Blackboard theme</h4></div><div className="color-controls"><ColorInput label="Background" value={design.background_color} onChange={(value) => setDesign({ ...design, background_color: value })} /><ColorInput label="Questions" value={design.question_color} onChange={(value) => setDesign({ ...design, question_color: value })} /><ColorInput label="Options" value={design.option_color} onChange={(value) => setDesign({ ...design, option_color: value })} /><ColorInput label="Highlights" value={design.highlight_color} onChange={(value) => setDesign({ ...design, highlight_color: value })} /></div><label className="control-label">Presentation font<select value={design.font_family} onChange={(event) => setDesign({ ...design, font_family: event.target.value })}><option>Nirmala UI</option><option>Noto Sans Devanagari</option><option>Mangal</option><option>Arial Unicode MS</option></select></label><RangeControl label="Question size" value={design.question_font_size} min={18} max={44} onChange={(value) => setDesign({ ...design, question_font_size: value })} /><RangeControl label="Option size" value={design.option_font_size} min={16} max={34} onChange={(value) => setDesign({ ...design, option_font_size: value })} /><DesignToggle label="Show question numbers" checked={design.show_question_numbers} onChange={(value) => setDesign({ ...design, show_question_numbers: value })} /></section>
              <button className="button primary generate-button" onClick={generate} disabled={generating || !questions.length}>{generating ? <LoaderCircle className="spin" size={18} /> : <Presentation size={18} />}{generating ? 'Building editable slides…' : 'Generate editable PPTX'}<ArrowRight size={17} /></button>
              <p className="generate-caption"><CheckCircle2 size={13} /> File integrity is checked after generation.</p>
            </div>
            <div className="preview-column"><div className="preview-toolbar"><span>LIVE PREVIEW</span>{hasAnswerSlide && <div><button className={previewKind === 'question' ? 'active' : ''} onClick={() => setPreviewKind('question')}>Question</button><button className={previewKind === 'answer' ? 'active' : ''} onClick={() => setPreviewKind('answer')}>Answer</button></div>}</div>{selected ? <SlidePreview question={selected} settings={design} kind={previewKind} /> : <EmptyState title="Nothing to preview" text="Extract a question first." />}<div className="preview-note"><ScanSearch size={16} /><span>Export automatically shrinks text and continues very long questions to prevent clipping.</span></div>{missingAnswers > 0 && <div className="alert warning compact"><AlertTriangle size={16} />{missingAnswers} answers are missing. You can still export; those slides will say “Answer not provided”.</div>}</div>
          </div>
        </section>}

        {step === 'export' && <ExportPanel project={project} latestPptx={latestPptx} exports={exports} changed={changedSinceExport} onDesign={() => changeStep('design')} />}
      </>}
    </div>
  );
}

function ProcessingView({ project }: { project: Project }) {
  return <section className="panel processing-panel"><div className="processing-orbit"><FileText size={30} /><span /><span /></div><span className="eyebrow">PROCESSING YOUR PDF</span><h2>Reading every page carefully</h2><p>Extraction is running on the server. You can watch the actual page progress here.</p><div className="processing-progress"><div><span>{project.processed_pages} of {project.total_pages || '…'} pages processed</span><strong>{project.progress}%</strong></div><div className="progress-track large"><i style={{ width: `${project.progress}%` }} /></div></div><div className="processing-stats"><div><strong>{project.total_pages || '—'}</strong><span>Total pages</span></div><div><strong>{project.readable_pages}</strong><span>Readable pages</span></div><div><strong>{project.unreadable_pages.length}</strong><span>Needs attention</span></div></div><small><LoaderCircle className="spin" size={13} /> Text extraction, OCR when available, then question parsing</small></section>;
}

function IssueDetails({ project }: { project: Project }) {
  const count = project.unreadable_pages.length + project.warnings.length;
  if (!count) return null;
  return <details className="issue-details"><summary><span><AlertTriangle size={17} /> {project.unreadable_pages.length} unreadable page{project.unreadable_pages.length === 1 ? '' : 's'} · {project.warnings.length} processing note{project.warnings.length === 1 ? '' : 's'}</span><ChevronRight size={16} /></summary><div>{project.unreadable_pages.map((issue, index) => <p key={`u${index}`}><b>Page {issue.page}:</b> {issue.reason}</p>)}{project.warnings.map((issue, index) => <p key={`w${index}`}><b>Page {issue.page}:</b> {issue.message}</p>)}</div></details>;
}

function QuestionEditor({ draft, saving, dirty, onEdit, onSave, onDelete }: {
  draft: Question; saving: boolean; dirty: boolean; onEdit: (values: Partial<Question>) => void;
  onSave: () => void; onDelete: () => void;
}) {
  const updateOption = (label: QuestionOption['label'], text: string) => {
    const exists = draft.options.some((option) => option.label === label);
    onEdit({ options: exists ? draft.options.map((option) => option.label === label ? { ...option, text } : option) : [...draft.options, { label, text }] });
  };
  return <div className="question-editor panel"><div className="editor-heading"><div><span className="editor-label"><Pencil size={14} /> EDITING QUESTION</span><span className={`source-badge ${draft.answer_source}`}>{draft.answer_source === 'ai' ? <Bot size={12} /> : <FileText size={12} />}{draft.answer_source === 'ai' ? 'AI answer · verify' : draft.answer_source === 'manual' ? 'Manually reviewed' : 'PDF source'} · Page {draft.page_number}</span></div><button className="icon-button subtle danger" onClick={onDelete} title="Delete question"><Trash2 size={16} /></button></div>
    {draft.flags.length > 0 && <div className="question-flags">{draft.flags.includes('missing_options') && <span><CircleAlert size={13} /> Fewer than 4 complete options</span>}{draft.flags.includes('missing_answer') && <span><CircleAlert size={13} /> Answer missing</span>}{draft.flags.includes('uncertain_answer') && <span><AlertTriangle size={13} /> Uncertain answer</span>}</div>}
    <div className="question-number-row"><label>Question number<input value={draft.number} onChange={(event) => onEdit({ number: event.target.value })} /></label><span>Extracted in original PDF order</span></div>
    <label className="editor-field">Question text<textarea rows={4} value={draft.text} onChange={(event) => onEdit({ text: event.target.value })} placeholder="Question text" /></label>
    <fieldset className="option-fields"><legend>Options <span>A–D</span></legend>{labels.map((label) => <label key={label}><span>{label}</span><input value={draft.options.find((option) => option.label === label)?.text || ''} onChange={(event) => updateOption(label, event.target.value)} placeholder={`Option ${label}${draft.options.some((option) => option.label === label) ? '' : ' (not detected)'}`} /></label>)}</fieldset>
    <div className="form-grid answer-edit-grid"><label>Correct answer<select value={draft.correct_answer || ''} onChange={(event) => onEdit({ correct_answer: event.target.value || null, answer_source: event.target.value ? 'manual' : 'none', answer_confidence: event.target.value ? 'certain' : 'none' })}><option value="">Not provided</option>{draft.correct_answer && !labels.includes(draft.correct_answer as QuestionOption['label']) && <option value={draft.correct_answer}>Source: {draft.correct_answer}</option>}{labels.map((label) => <option key={label} value={label}>Option {label}</option>)}</select></label><label>Answer confidence<select value={draft.answer_confidence} onChange={(event) => onEdit({ answer_confidence: event.target.value as Question['answer_confidence'] })} disabled={!draft.correct_answer}><option value="certain">Reviewed / certain</option><option value="uncertain">Uncertain · flag it</option><option value="none">No answer</option></select></label></div>
    <label className="editor-field">Explanation <span>(optional)</span><textarea rows={3} value={draft.explanation || ''} onChange={(event) => onEdit({ explanation: event.target.value })} placeholder="Add a helpful explanation for the answer slide…" /></label>
    <div className="editor-footer"><span>{dirty ? <><CircleAlert size={13} /> Unsaved changes</> : <><Check size={13} /> All changes saved</>}</span><button className="button primary" onClick={onSave} disabled={saving || !draft.text.trim()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? 'Saving…' : 'Save question'}</button></div>
  </div>;
}

function DesignToggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={`toggle-row compact-toggle ${disabled ? 'disabled' : ''}`}><strong>{label}</strong><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="toggle" /></label>;
}
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><span>{label}</span></label>;
}
function RangeControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="range-control"><span>{label}<b>{value} pt</b></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function SlidePreview({ question, settings, kind }: { question: Question; settings: GenerateSettings; kind: 'question' | 'answer' }) {
  const answer = kind === 'answer';
  const showExplanation = settings.mode === 'C' || (settings.mode === 'D' && settings.custom_include_explanation);
  return <div className="slide-preview" style={{ background: settings.background_color, fontFamily: `'${settings.font_family}', 'Noto Sans Devanagari', sans-serif` }}><div className="slide-brand" style={{ color: settings.highlight_color }}>DREAM CLASSES</div><span className="slide-brand-right">PPT MAKER AI</span><div className="slide-rule" />{!answer || settings.mode === 'A' ? <><div className="slide-q-label" style={{ color: settings.highlight_color }}>{settings.show_question_numbers ? `Q${question.number}` : 'QUESTION'}</div><div className="slide-question-text" style={{ color: settings.question_color, fontSize: `${Math.max(12, settings.question_font_size * 0.56)}px` }}>{question.text}</div><div className="slide-options">{question.options.map((option) => <div key={option.label} style={{ color: settings.option_color, fontSize: `${Math.max(10, settings.option_font_size * 0.52)}px` }}><b>{option.label}.</b> {option.text}</div>)}</div>{settings.mode === 'D' && !settings.custom_answer_slide && <div className="slide-inline-answer" style={{ color: settings.highlight_color }}>Answer: {question.correct_answer || 'Not provided'}{settings.custom_include_explanation && question.explanation ? ` · ${question.explanation}` : ''}</div>}</> : <><div className="slide-q-label" style={{ color: settings.highlight_color }}>Q{question.number} / ANSWER REVEAL</div>{question.answer_source === 'ai' && <span className="slide-ai-badge">AI-GENERATED · {question.answer_confidence === 'uncertain' ? 'UNCERTAIN · ' : ''}VERIFY</span>}<div className="slide-answer-content"><span style={{ color: settings.highlight_color }}>{question.correct_answer || '—'}</span><div><small>CORRECT OPTION</small><strong style={{ color: settings.question_color }}>{question.correct_answer ? question.options.find((option) => option.label === question.correct_answer)?.text || `Option ${question.correct_answer}` : 'Answer not provided'}</strong></div></div>{showExplanation && question.explanation && <div className="slide-explanation"><small style={{ color: settings.highlight_color }}>EXPLANATION</small><p>{question.explanation}</p></div>}</>}<div className="slide-footer">DREAM SIR · KOTHWARA, DOBHI, GAYA <span>01 / {settings.mode === 'A' ? '01' : '02'}</span></div></div>;
}

function ExportPanel({ project, latestPptx, exports, changed, onDesign }: { project: Project; latestPptx?: ExportRecord; exports: ExportRecord[]; changed: boolean; onDesign: () => void }) {
  return <section className="export-section"><div className="export-success"><span><CheckCircle2 size={30} /></span><div><span className="section-kicker">{latestPptx ? 'PRESENTATION VERIFIED' : 'EXPORT YOUR QUESTIONS'}</span><h3>{latestPptx ? 'Your classroom materials are ready.' : 'Your questions are ready to design.'}</h3><p>{latestPptx ? `${latestPptx.slide_count} slides · Mode ${latestPptx.mode} · Created ${formatDate(latestPptx.created_at, true)}` : 'Generate a PowerPoint, or download the extracted data now.'}</p></div>{latestPptx && <span className="verified-pill"><Check size={13} /> PPTX reopened successfully</span>}</div>{changed && latestPptx && <div className="alert warning"><AlertTriangle size={17} /> Questions changed after this PPTX was generated. Regenerate it to include your latest edits.</div>}<div className="download-grid"><DownloadCard icon={<Presentation size={24} />} title="Editable PowerPoint" detail={latestPptx ? 'PPTX · editable text & shapes' : 'Generate the presentation first'} href={latestPptx ? projectDownload(project.id, 'pptx') : undefined} className="pptx" /><DownloadCard icon={<FileDown size={24} />} title="Presentation PDF" detail="PDF · Hindi font embedded" href={projectDownload(project.id, 'pdf')} className="pdf" /><DownloadCard icon={<FileJson size={24} />} title="Extracted questions" detail="JSON · all editable fields" href={projectDownload(project.id, 'questions')} className="json" /><DownloadCard icon={<KeyRound size={24} />} title="Answer key" detail="TXT · answers & explanations" href={projectDownload(project.id, 'answer-key')} className="key" /></div><div className="export-bottom"><button className="button secondary" onClick={onDesign}><Palette size={16} /> {latestPptx ? 'Regenerate with latest changes' : 'Design presentation'}</button><span>Downloads are generated from your saved project on the server.</span></div>{exports.length > 0 && <div className="project-export-history"><div className="section-heading"><h3>Project export history</h3><Link to="/history">Full history <ArrowRight size={14} /></Link></div>{exports.slice(0, 4).map((item) => <div key={item.id}><span className={`format-badge ${item.kind}`}>{item.kind.toUpperCase()}</span><strong>Mode {item.mode} · {item.slide_count} slides</strong><span>{formatDate(item.created_at, true)}</span></div>)}</div>}</section>;
}
function DownloadCard({ icon, title, detail, href, className }: { icon: React.ReactNode; title: string; detail: string; href?: string; className: string }) {
  const content = <><span className={`download-icon ${className}`}>{icon}</span><div><strong>{title}</strong><p>{detail}</p></div>{href ? <Download size={19} /> : <ChevronRight size={18} />}</>;
  return href ? <a className="download-card" href={href} download>{content}</a> : <div className="download-card disabled">{content}</div>;
}
