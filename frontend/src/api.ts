import type {
  AppSettings, Capabilities, DashboardData, ExportRecord, GenerateSettings,
  Project, Question,
} from './types';

const DEFAULT_API_ROOT = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const API_STORAGE_KEY = 'dream_classes_api_root';

export function getApiRoot(): string {
  try {
    const saved = localStorage.getItem(API_STORAGE_KEY);
    // Older APKs used the WebView-local /api path. Migrate that stale value
    // when a real cloud default is present, including after an app upgrade.
    if (saved === '/api' && DEFAULT_API_ROOT !== '/api') {
      localStorage.setItem(API_STORAGE_KEY, DEFAULT_API_ROOT);
      return DEFAULT_API_ROOT;
    }
    return saved || DEFAULT_API_ROOT;
  } catch { return DEFAULT_API_ROOT; }
}

export function normalizeApiRoot(value: string): string {
  let root = value.trim().replace(/\/$/, '');
  if (!root) return DEFAULT_API_ROOT;
  if (!/^(https?:\/\/|\/)/i.test(root)) root = `https://${root}`;
  if (!root.endsWith('/api')) root += '/api';
  return root;
}

export function setApiRoot(value: string): string {
  const root = normalizeApiRoot(value);
  localStorage.setItem(API_STORAGE_KEY, root);
  window.dispatchEvent(new Event('dream-api-changed'));
  return root;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map((item: { msg?: string }) => item.msg || 'Invalid value').join(', ');
    return body.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status}). Check that the backend is running.`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiRoot()}${path}`, init);
  if (!response.ok) throw new ApiError(await errorMessage(response), response.status);
  if (response.status === 204) return undefined as T;
  return response.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<{ status: string; capabilities: Capabilities }>('/health'),
  dashboard: () => request<DashboardData>('/dashboard'),
  projects: () => request<Project[]>('/projects'),
  project: (id: string) => request<Project>(`/projects/${id}`),
  questions: (id: string) => request<Question[]>(`/projects/${id}/questions`),
  retry: (id: string) => request<Project>(`/projects/${id}/retry`, { method: 'POST' }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  updateQuestion: (id: string, values: Partial<Question>) =>
    request<Question>(`/questions/${id}`, json('PATCH', values)),
  deleteQuestion: (id: string) => request<void>(`/questions/${id}`, { method: 'DELETE' }),
  generateAnswers: (id: string) =>
    request<{ updated: number; not_answered?: number; questions: Question[]; message: string }>(
      `/projects/${id}/generate-answers`, { method: 'POST' },
    ),
  generate: (id: string, settings: GenerateSettings) =>
    request<{ slide_count: number; download_url: string; export: ExportRecord }>(
      `/projects/${id}/generate`, json('POST', settings),
    ),
  exports: (projectId?: string) =>
    request<ExportRecord[]>(`/exports${projectId ? `?project_id=${projectId}` : ''}`),
  settings: () => request<AppSettings>('/settings'),
  saveSettings: (settings: Partial<AppSettings>) => request<AppSettings>('/settings', json('PUT', settings)),
};

export function uploadPdf(file: File, onProgress: (percent: number) => void): Promise<Project> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiRoot()}/projects`);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    });
    xhr.addEventListener('load', () => {
      let body: any;
      try { body = JSON.parse(xhr.responseText); } catch { body = null; }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body as Project);
      else reject(new ApiError(body?.detail || `Upload failed (${xhr.status})`, xhr.status));
    });
    xhr.addEventListener('error', () => reject(new ApiError('Could not reach the backend. Check your connection and server.', 0)));
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

export function projectDownload(projectId: string, kind: 'pptx' | 'pdf' | 'questions' | 'answer-key') {
  return `${getApiRoot()}/projects/${projectId}/download/${kind}`;
}

export function exportDownload(exportId: string) {
  return `${getApiRoot()}/exports/${exportId}/download`;
}
