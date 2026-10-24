import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Atom, BookOpen, Book, Brain, Briefcase, ChevronLeft, ChevronRight, CircleHelp, Clock,
  FileQuestion, FlaskConical, Globe2, GraduationCap, History, Inbox, Landmark, Languages,
  Layers, Leaf, Lightbulb, MapPin, Monitor, Newspaper, Presentation, Scale, Search, Sigma,
  TrainFront, Trophy, X, BookMarked, ChartNoAxesCombined, Target, Sparkles, ShieldCheck,
  RefreshCw, AlertCircle, CheckCircle2, Info, Timer, Award, TrendingUp,
} from 'lucide-react';

export const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  atom: Atom, book: Book, 'book-open': BookOpen, brain: Brain, briefcase: Briefcase,
  'file-question': FileQuestion, flask: FlaskConical, globe: Globe2, 'graduation-cap': GraduationCap,
  history: History, landmark: Landmark, languages: Languages, layers: Layers, leaf: Leaf,
  lightbulb: Lightbulb, 'map-pin': MapPin, monitor: Monitor, newspaper: Newspaper,
  presentation: Presentation, scale: Scale, sigma: Sigma, train: TrainFront, trophy: Trophy,
  inbox: Inbox, help: CircleHelp, clock: Clock, search: Search, bookmark: BookMarked,
  chart: ChartNoAxesCombined, target: Target, sparkles: Sparkles, shield: ShieldCheck,
};

export function Icon({ name, size = 20, className, style }: { name?: string | null; size?: number; className?: string; style?: React.CSSProperties }) {
  const Cmp = (name && iconMap[name]) || BookOpen;
  return <Cmp size={size} className={className} style={style} aria-hidden="true" />;
}

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'success';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; block?: boolean; loading?: boolean;
}
export function Button({ variant = 'primary', size = 'md', block, loading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled || loading} {...rest}
    >
      {loading && <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'new' | 'popular' | 'blue' | 'gray' | 'green' | 'red' | 'amber' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading-block"><span className="spinner" /><span className="small">{label}</span></div>;
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty-state card card-pad">
      <div>{icon || <Inbox size={34} />}</div>
      <h3 style={{ color: 'var(--text)', marginTop: 6 }}>{title}</h3>
      {description && <p className="small" style={{ maxWidth: 420, margin: '6px auto 14px' }}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger" role="alert" style={{ alignItems: 'center' }}>
      <AlertCircle size={18} style={{ flex: 'none' }} />
      <span className="grow">{message}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw size={14} /> Retry</Button>}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  const IconCmp = { info: Info, success: CheckCircle2, warning: AlertCircle, danger: AlertCircle }[kind];
  return <div className={`alert alert-${kind}`} role={kind === 'danger' ? 'alert' : 'status'}><IconCmp size={17} style={{ flex: 'none', marginTop: 1 }} /><span>{children}</span></div>;
}

export function Modal({ open, onClose, title, children, footer, wide, dismissible = true }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; dismissible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissible) onClose(); };
    document.addEventListener('keydown', handler);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button, a, input, select, textarea')?.focus(), 30);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handler); previous?.focus?.(); };
  }, [open, onClose, dismissible]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'} ref={ref}>
        <div className="modal-head">
          <h3 style={{ fontSize: '1.05rem' }}>{title}</h3>
          {dismissible && <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onCancel, onConfirm, loading }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean;
  onCancel: () => void; onConfirm: () => void; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={<><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="small" style={{ lineHeight: 1.7 }}>{message}</div>
    </Modal>
  );
}

export function Field({ label, hint, error, children, htmlFor, required }: { label: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>{label}{required && <span style={{ color: "var(--danger)" }}> *</span>}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error" role="alert">{error}</div>}
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={15} /> Prev</Button>
      <span className="small muted">Page {page} of {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next <ChevronRight size={15} /></Button>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
          <span>/</span>{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ProgressRing({ value, label, color = 'var(--secondary)' }: { value: number; label?: string; color?: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="score-ring" style={{ position: 'relative' }}>
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#E8EEF7" strokeWidth="12" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform="rotate(-90 64 64)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
        <strong style={{ fontSize: '1.35rem', lineHeight: 1 }}>{pct.toFixed(0)}%</strong>
        {label && <span className="tiny muted">{label}</span>}
      </div>
    </div>
  );
}

export function PageMeta({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    document.title = `${title} | VidyaPariksha`;
    const set = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    if (description) { set('description', description); set('og:description', description, 'property'); }
    set('og:title', `${title} | VidyaPariksha`, 'property');
    set('og:type', 'website', 'property');
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = window.location.origin + window.location.pathname;
  }, [title, description]);
  return null;
}

export function LineChart({ points, height = 190, label = 'Score %' }: { points: { label: string; value: number; secondary?: number }[]; height?: number; label?: string }) {
  if (!points.length) return <EmptyState title="No chart data yet" description="Complete a few tests to see your progress." icon={<ChartNoAxesCombined size={32} />} />;
  const w = Math.max(300, points.length * 48), pad = 30, h = height;
  const max = Math.max(100, ...points.map((p) => p.value), ...points.map((p) => p.secondary || 0));
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = (key: 'value' | 'secondary') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key] ?? 0)}`).join(' ');
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad} x2={w - pad} y1={y(tick)} y2={y(tick)} stroke="#E8EEF7" strokeDasharray="3 4" />
            <text x={4} y={y(tick) + 4} fontSize="10" fill="#94A3B8">{tick}</text>
          </g>
        ))}
        <path d={line('value')} fill="none" stroke="var(--secondary)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.some((p) => p.secondary !== undefined) && <path d={line('secondary')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" />}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="4" fill="var(--secondary)"><title>{`${p.label}: ${p.value}${label}`}</title></circle>
            <text x={x(i)} y={h - 8} fontSize="10" fill="#64748B" textAnchor="middle">{p.label}</text>
          </g>
        ))}
      </svg>
      <div className="chart-legend"><span><span className="dot" style={{ background: 'var(--secondary)' }} /> Score %</span>{points.some((p) => p.secondary !== undefined) && <span><span className="dot" style={{ background: 'var(--accent)' }} /> Accuracy %</span>}</div>
    </div>
  );
}

export function BarList({ items, suffix = '%', color = 'var(--secondary)' }: { items: { name: string; value: number; detail?: string }[]; suffix?: string; color?: string }) {
  if (!items.length) return <p className="small muted">No data yet.</p>;
  return (
    <div>
      {items.map((it) => (
        <div className="bar-row" key={it.name}>
          <span className="truncate" title={it.name}>{it.name}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, it.value))}%`, background: color }} /></div>
          <span className="strong" style={{ textAlign: 'right' }}>{it.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

export { Timer as TimerIcon, Award, TrendingUp };
