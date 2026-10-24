import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flag,
  List, Maximize2, Minimize2, Save, Send, WifiOff, X, XCircle, MessageSquareWarning,
} from 'lucide-react';
import { api, ApiError, formatError } from '../api/client';
import { Brand } from '../components/Brand';
import { QuestionPalette } from '../components/QuestionPalette';
import { Button, Card, ConfirmDialog, ErrorState, Loading, Modal, Notice, PageMeta } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { deadlineRemaining, formatClock } from '../lib/exam';

interface Option { id: number; label: string; text: string; textEn: string; textHi: string | null; imageUrl: string | null }
interface ExamQuestion {
  id: number; position: number; text: string; textEn: string; textHi: string | null; imageUrl: string | null;
  qtype: 'single' | 'multiple'; marks: number; negativeMarks: number; difficulty: string;
  subjectName: string | null; topicName: string | null; options: Option[];
  selectedOptionIds: number[]; markedForReview: boolean; visited: boolean; timeSpentSeconds: number;
}
interface Counts { total: number; answered: number; unanswered: number; marked: number; visited: number; notAnswered: number }
interface AttemptPayload {
  attempt: {
    id: number; testId: number; testTitle: string; testSlug: string; status: string; submitReason: string | null;
    language: string; mode: string; questionCount: number; marksPerQuestion: number; negativeMarks: number;
    startedAt: string; deadlineAt: string; submittedAt: string | null; practiceFeedback: boolean; resultVisibility: string; expired: boolean;
  };
  serverNow: string; remainingSeconds: number; statusCounts: Counts; questions: ExamQuestion[];
}
interface Pending { questionId: number; selectedOptionIds?: number[]; markedForReview?: boolean; previousQuestionId?: number; viewing?: boolean; clear?: boolean }
interface Feedback { correct: boolean; correctOptionIds: number[]; explanation: string | null }

export function Attempt() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<AttemptPayload | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offsetMs, setOffsetMs] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [sync, setSync] = useState<'synced' | 'pending' | 'offline'>('synced');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [displayLang, setDisplayLang] = useState<'en' | 'hi'>('en');
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('wrong_key');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(!navigator.onLine);

  const pending = useRef<Map<number, Pending>>(new Map());
  const sending = useRef(false);
  const submitGuard = useRef(false);
  const deadlineRef = useRef('');
  const currentRef = useRef(0);
  currentRef.current = currentIndex;

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const result = await api.get<AttemptPayload>(`/attempts/${id}`);
      setOffsetMs(Date.parse(result.serverNow) - Date.now());
      deadlineRef.current = result.attempt.deadlineAt;
      setData(result);
      setQuestions(result.questions);
      setCounts(result.statusCounts);
      setDisplayLang(result.attempt.language === 'hi' ? 'hi' : 'en');
      setRemaining(deadlineRemaining(result.attempt.deadlineAt, Date.parse(result.serverNow) - Date.now()));
      if (result.attempt.status !== 'in_progress') {
        nav(`/test/result/${result.attempt.id}`, { replace: true });
      }
    } catch (err) {
      setError(formatError(err));
    } finally { setLoading(false); }
  }, [id, nav]);

  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (sending.current || pending.current.size === 0) return pending.current.size === 0;
    sending.current = true;
    try {
      while (pending.current.size > 0) {
        const [key, payload] = pending.current.entries().next().value as [number, Pending];
        try {
          const result = await api.put<{ statusCounts: Counts; feedback?: Feedback }>(`/attempts/${id}/answers`, payload);
          pending.current.delete(key);
          setCounts(result.statusCounts);
          if (result.feedback) setFeedback((f) => ({ ...f, [payload.questionId]: result.feedback! }));
          setSync('pending');
        } catch (err) {
          if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
            pending.current.delete(key);
            toast(formatError(err), 'error');
            continue;
          }
          setSync('offline');
          setOfflineBanner(true);
          return false;
        }
      }
      setSync('synced');
      setOfflineBanner(false);
      return true;
    } finally { sending.current = false; }
  }, [id, toast]);

  useEffect(() => {
    const onOnline = () => { setOfflineBanner(false); void flush(); };
    const onOffline = () => { setOfflineBanner(true); setSync('offline'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const timer = setInterval(() => { if (pending.current.size) void flush(); }, 8000);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); clearInterval(timer); };
  }, [flush]);

  const queue = useCallback((payload: Pending) => {
    const existing = pending.current.get(payload.questionId) || { questionId: payload.questionId };
    pending.current.set(payload.questionId, { ...existing, ...payload });
    setSync('pending');
    void flush();
  }, [flush]);

  // Mark the first question visited once after the attempt loads.
  const visitedInit = useRef(false);
  useEffect(() => {
    if (visitedInit.current || !questions.length) return;
    visitedInit.current = true;
    queue({ questionId: questions[0].id, viewing: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = useCallback((questionId: number, selectedOptionIds: number[]) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => queue({ questionId, selectedOptionIds }), 700);
  }, [queue]);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= questions.length || index === currentRef.current) { setPaletteOpen(false); return; }
    const previousQuestionId = questions[currentRef.current].id;
    queue({ questionId: questions[index].id, previousQuestionId, viewing: true });
    setCurrentIndex(index);
    setPaletteOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [questions, queue]);

  const selectOption = (optionId: number) => {
    if (!questions[currentIndex]) return;
    const q = questions[currentIndex];
    let next: number[];
    if (q.qtype === 'multiple') next = q.selectedOptionIds.includes(optionId) ? q.selectedOptionIds.filter((x) => x !== optionId) : [...q.selectedOptionIds, optionId];
    else next = [optionId];
    setQuestions((prev) => prev.map((item, i) => i === currentIndex ? { ...item, selectedOptionIds: next, visited: true } : item));
    setFeedback((f) => { const copy = { ...f }; delete copy[q.id]; return copy; });
    scheduleAutoSave(q.id, next);
  };

  const clearResponse = () => {
    const q = questions[currentIndex];
    if (!q) return;
    setQuestions((prev) => prev.map((item, i) => i === currentIndex ? { ...item, selectedOptionIds: [] } : item));
    setFeedback((f) => { const copy = { ...f }; delete copy[q.id]; return copy; });
    queue({ questionId: q.id, selectedOptionIds: [], clear: true });
  };

  const markForReview = (alsoSave: boolean) => {
    const q = questions[currentIndex];
    if (!q) return;
    const marked = !q.markedForReview;
    setQuestions((prev) => prev.map((item, i) => i === currentIndex ? { ...item, markedForReview: marked } : item));
    queue({ questionId: q.id, markedForReview: marked, ...(alsoSave ? { selectedOptionIds: q.selectedOptionIds } : {}) });
    toast(marked ? 'Question marked for review.' : 'Review mark removed.', 'info');
  };

  const saveAndNext = () => {
    const q = questions[currentIndex];
    if (!q) return;
    queue({ questionId: q.id, selectedOptionIds: q.selectedOptionIds });
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
    else setSubmitOpen(true);
  };

  const submit = useCallback(async (expired = false) => {
    if (submitGuard.current || !data) return;
    submitGuard.current = true;
    setSubmitting(true);
    try {
      await flush();
      const result = await api.post(`/attempts/${id}/submit`, { clientSubmissionId: crypto.randomUUID() });
      void result;
      toast(expired ? 'Time expired. Your test was submitted automatically.' : 'Test submitted successfully.', expired ? 'warning' : 'success');
      nav(`/test/result/${id}`, { replace: true });
    } catch (err) {
      submitGuard.current = false;
      const message = formatError(err);
      if (message.includes('expired') || message.includes('already been submitted')) {
        toast(message, 'warning');
        nav(`/test/result/${id}`, { replace: true });
      } else { toast(message, 'error'); setSubmitOpen(false); }
    } finally { setSubmitting(false); }
  }, [data, flush, id, nav, toast]);

  // Timer derived from the authoritative stored deadline (not a decrementing counter).
  useEffect(() => {
    if (!data) return;
    const tick = () => {
      const left = deadlineRemaining(data.attempt.deadlineAt, offsetMs);
      setRemaining(left);
      if (left <= 0 && !submitGuard.current) void submit(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data, offsetMs, submit]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (data?.attempt.status === 'in_progress') { e.preventDefault(); e.returnValue = ''; } };
    const onVisible = () => { if (document.visibilityState === 'visible' && data?.attempt.status === 'in_progress') toast('Welcome back. Your timer kept running on the server.', 'info'); };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('visibilitychange', onVisible); };
  }, [data, toast]);

  useEffect(() => {
    if (!sessionStorage.getItem('vp_request_fullscreen')) return;
    sessionStorage.removeItem('vp_request_fullscreen');
    document.documentElement.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {
      toast('Full-screen was blocked by the browser. The test remains fully usable.', 'info');
    });
  }, [toast]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreen(false); }
      else { await document.documentElement.requestFullscreen(); setFullscreen(true); }
    } catch { toast('Full-screen is not supported or was blocked by this browser.', 'warning'); }
  };

  const bookmark = async () => {
    const q = questions[currentIndex];
    try { await api.post('/bookmarks', { questionId: q.id, attemptId: Number(id) }); toast('Question added to your revision list.', 'success'); }
    catch (err) { if ((err as ApiError).status === 401) toast('Sign in to keep bookmarks across devices.', 'warning'); else toast(formatError(err), 'error'); }
  };

  const sendReport = async () => {
    if (reportDetails.trim().length < 5) { toast('Please describe the issue (at least 5 characters).', 'warning'); return; }
    setReportBusy(true);
    try {
      await api.post('/question-reports', { questionId: questions[currentIndex].id, reason: reportReason, details: reportDetails, attemptId: Number(id) });
      toast('Report submitted for administrative review.', 'success');
      setReportOpen(false); setReportDetails('');
    } catch (err) { toast(formatError(err), 'error'); } finally { setReportBusy(false); }
  };

  const q = questions[currentIndex];
  const timerTone = remaining <= 60 ? 'danger' : remaining <= 180 ? 'warning' : '';
  const hasHindi = useMemo(() => Boolean(q?.textHi), [q]);

  if (loading) return <div className="container section"><PageMeta title="Examination" /><Loading label="Loading your examination…" /></div>;
  if (error) return <div className="container section"><PageMeta title="Examination" /><ErrorState message={error} onRetry={load} /><div className="mt-2"><Button variant="outline" onClick={() => nav('/tests')}>Back to tests</Button></div></div>;
  if (!data || !q) return null;

  const text = displayLang === 'hi' && q.textHi ? q.textHi : q.textEn;

  return (
    <div className="exam-page">
      <PageMeta title={`Exam — ${data.attempt.testTitle}`} />
      {offlineBanner && <div className="connection-bar" role="alert"><WifiOff size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Connection lost. Your answers are kept on this device and will be retried automatically. The server deadline still applies.</div>}
      <header className="exam-header">
        <div className="container exam-header-inner">
          <Brand compact />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="exam-title truncate">{data.attempt.testTitle}</div>
            <div className="tiny muted">Question {currentIndex + 1} of {questions.length} · {sync === 'offline' ? 'Unsynced changes' : sync === 'pending' ? 'Saving…' : 'All answers saved'}</div>
          </div>
          {hasHindi && <button className="btn btn-outline btn-sm" onClick={() => setDisplayLang(displayLang === 'en' ? 'hi' : 'en')} aria-label="Toggle question language">{displayLang === 'en' ? 'हिं' : 'EN'}</button>}
          <button className="btn btn-ghost btn-icon btn-sm palette-drawer-toggle" onClick={() => setPaletteOpen((v) => !v)} aria-label="Toggle question palette"><List size={19} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full-screen' : 'Enter full-screen'}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <span className={`timer ${timerTone}`} role="timer" aria-label={`Time remaining ${formatClock(remaining)}`}><Clock3 size={16} /> {formatClock(remaining)}</span>
          <Button size="sm" variant="danger" onClick={() => setSubmitOpen(true)} className="hide-mobile">Submit Test</Button>
        </div>
      </header>

      <div className={`palette-mobile ${paletteOpen ? 'is-open' : ''}`}>
        <div className="container" style={{ paddingTop: 14 }}>
          <QuestionPalette questions={questions} currentIndex={currentIndex} onJump={goTo} />
        </div>
      </div>

      <div className="container exam-layout">
        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <Card className="question-card">
            <div className="question-top">
              <div className="row" style={{ gap: 8 }}>
                <strong>Question {String(currentIndex + 1).padStart(2, '0')} / {questions.length}</strong>
                <BadgeInline>{q.subjectName || 'General'}{q.topicName ? ` · ${q.topicName}` : ''}</BadgeInline>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="tiny muted">+{q.marks} mark{q.marks === 1 ? '' : 's'}{q.negativeMarks > 0 ? ` · −${q.negativeMarks}` : ''}</span>
                {q.markedForReview && <span className="badge" style={{ background: '#F3E8FF', color: '#7E22CE' }}><Flag size={12} /> Marked</span>}
              </div>
            </div>
            <div className="question-text" lang={displayLang === 'hi' ? 'hi' : 'en'}>{text}</div>
            {q.imageUrl && <img src={q.imageUrl} alt="Question diagram" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 14 }} loading="lazy" />}
            <div className="options-list" role={q.qtype === 'multiple' ? 'group' : 'radiogroup'} aria-label="Answer options">
              {q.options.map((o) => {
                const selected = q.selectedOptionIds.includes(o.id);
                const isCorrect = feedback[q.id]?.correctOptionIds.includes(o.id);
                const isWrongSelected = selected && feedback[q.id] && !feedback[q.id]?.correct;
                return (
                  <button key={o.id} className={`option-btn ${selected ? 'selected' : ''}`} onClick={() => selectOption(o.id)}
                    role={q.qtype === 'multiple' ? 'checkbox' : 'radio'} aria-checked={selected}
                    aria-label={`Option ${o.label}: ${displayLang === 'hi' && o.textHi ? o.textHi : o.textEn}`}
                    style={isCorrect ? { borderColor: 'var(--success)', background: '#F0FDF4' } : isWrongSelected ? { borderColor: 'var(--danger)' } : undefined}>
                    <span className="option-letter">{o.label}</span>
                    <span className="option-label-text" lang={displayLang === 'hi' && o.textHi ? 'hi' : 'en'}>{displayLang === 'hi' && o.textHi ? o.textHi : o.textEn}</span>
                    {isCorrect && <CheckCircle2 size={17} style={{ color: 'var(--success)', flex: 'none' }} aria-label="Correct answer" />}
                  </button>
                );
              })}
            </div>
            {feedback[q.id] && (
              <div className={`feedback-box alert ${feedback[q.id].correct ? 'alert-success' : 'alert-danger'}`}>
                {feedback[q.id].correct ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                <span><strong>{feedback[q.id].correct ? 'Correct!' : 'Not quite.'}</strong>{feedback[q.id].explanation ? ` ${feedback[q.id].explanation}` : ''}</span>
              </div>
            )}
            <div className="row mt-3" style={{ gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={bookmark}><Bookmark size={15} /> Save question</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}><MessageSquareWarning size={15} /> Report issue</button>
              {q.qtype === 'multiple' && <span className="tiny muted">Multiple answers may be selected.</span>}
            </div>
          </Card>

          <div className="palette-desktop"><QuestionPalette questions={questions} currentIndex={currentIndex} onJump={goTo} /></div>
        </div>

        <Card className="card-pad palette-desktop">
          <h3 style={{ fontSize: '.95rem' }}>Attempt overview</h3>
          <div className="mt-2">
            <OverviewRow label="Answered" value={counts?.answered ?? 0} tone="var(--success)" />
            <OverviewRow label="Not answered" value={(counts?.total ?? 0) - (counts?.answered ?? 0)} tone="var(--danger)" />
            <OverviewRow label="Marked for review" value={counts?.marked ?? 0} tone="#9333EA" />
            <OverviewRow label="Visited" value={counts?.visited ?? 0} tone="var(--secondary)" />
          </div>
          <div className="alert alert-info mt-2" style={{ fontSize: '.78rem' }}><AlertTriangle size={15} style={{ flex: 'none' }} /><span>Answers are saved to the server. Refreshing resumes the same attempt with the remaining time.</span></div>
          <Button variant="danger" block className="mt-2" onClick={() => setSubmitOpen(true)}><Send size={16} /> Submit Test</Button>
        </Card>
      </div>

      <div className="exam-controls">
        <div className="container exam-controls-inner">
          <Button variant="outline" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}><ChevronLeft size={16} /> Previous</Button>
          <Button variant="outline" onClick={clearResponse} disabled={q.selectedOptionIds.length === 0}><X size={16} /> Clear</Button>
          <Button variant="outline" onClick={() => markForReview(false)}><Flag size={16} /> {q.markedForReview ? 'Unmark' : 'Mark'}</Button>
          <Button variant="outline" className="hide-mobile" onClick={() => markForReview(true)}><Save size={16} /> Save &amp; Mark</Button>
          <Button variant="danger" className="palette-drawer-toggle" onClick={() => setSubmitOpen(true)}><Send size={16} /> Submit</Button>
          <Button variant="primary" className="grow" onClick={saveAndNext}>{currentIndex === questions.length - 1 ? 'Save & Finish' : 'Save & Next'} <ChevronRight size={16} /></Button>
        </div>
      </div>

      <ConfirmDialog
        open={submitOpen} title="Submit this examination?" confirmLabel="Confirm Submission" danger loading={submitting}
        onCancel={() => setSubmitOpen(false)} onConfirm={() => void submit(false)}
        message={
          <div>
            <div className="summary-box">
              <div className="summary-row"><span>Total questions</span><strong>{counts?.total ?? questions.length}</strong></div>
              <div className="summary-row"><span>Answered</span><strong>{counts?.answered ?? 0}</strong></div>
              <div className="summary-row"><span>Unanswered</span><strong>{(counts?.total ?? questions.length) - (counts?.answered ?? 0)}</strong></div>
              <div className="summary-row"><span>Marked for review</span><strong>{counts?.marked ?? 0}</strong></div>
              <div className="summary-row"><span>Time remaining</span><strong>{formatClock(remaining)}</strong></div>
            </div>
            {(counts?.answered ?? 0) < (counts?.total ?? questions.length) && <div className="alert alert-warning mt-2"><AlertTriangle size={16} /><span>You still have unanswered questions. You can return to the test or submit now.</span></div>}
            <p className="small muted mt-2 mb-0">After confirmation your answers cannot be changed and the result is calculated on the server.</p>
          </div>
        }
      />

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report a question issue"
        footer={<><Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button loading={reportBusy} onClick={sendReport}>Submit report</Button></>}>
        <Notice kind="info">Reports are reviewed by content managers. They do not change your answer or score.</Notice>
        <div className="field mt-2"><label className="field-label" htmlFor="report-reason">Reason</label>
          <select id="report-reason" className="select" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            <option value="wrong_key">Incorrect answer key</option><option value="typo">Typographical error</option>
            <option value="broken_image">Broken image</option><option value="ambiguous">Ambiguous question</option><option value="other">Other</option>
          </select>
        </div>
        <div className="field"><label className="field-label" htmlFor="report-details">Details</label>
          <textarea id="report-details" className="textarea" value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Describe the issue so the content team can verify it." />
        </div>
      </Modal>
    </div>
  );
}

function BadgeInline({ children }: { children: ReactNode }) {
  return <span className="badge badge-gray">{children}</span>;
}

function OverviewRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="row-between" style={{ padding: '7px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span className="row small" style={{ gap: 8 }}><span className="dot" style={{ background: tone }} /> {label}</span><strong>{value}</strong>
    </div>
  );
}
