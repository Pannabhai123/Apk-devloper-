export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds?: number | null): string {
  const s = Math.max(0, Math.round(Number(seconds || 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const COVERS: Record<string, string> = {
  'lucent-subject-wise': 'indigo', 'lucent-topic-wise': 'violet', 'lucent-objective-gk': 'blue',
  'speedy-current-affairs': 'teal', 'railway-previous-year': 'amber', 'bihar-special-gk': 'green',
  'computer-test-series': 'cyan', 'teaching-exam-practice': 'rose', 'general-knowledge': 'slate',
  'board-exam-practice': 'orange',
};
export function coverClass(slug: string): string {
  const palette = ['indigo', 'violet', 'blue', 'teal', 'amber', 'green', 'cyan', 'rose', 'slate', 'orange'];
  const known = COVERS[slug];
  if (known) return `cover-${known}`;
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return `cover-${palette[hash % palette.length]}`;
}

export function titleCase(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
