export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

function readCookie(name: string): string {
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  raw?: boolean;
}

async function request<T = any>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
  if (!['GET', 'HEAD'].includes(method)) headers['x-csrf-token'] = readCookie('vp_csrf');
  if (options.body !== undefined && !options.raw) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers,
      body: options.body === undefined ? undefined : options.raw ? (options.body as BodyInit) : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    throw new ApiError(0, 'Network unavailable. Check your connection and try again.', err);
  }
  if (response.status === 403 && retry) {
    const text = await response.clone().text();
    if (text.includes('CSRF')) {
      await request('/auth/me', {}, false).catch(() => null);
      return request<T>(path, options, false);
    }
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as any).error)
      : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload && typeof payload === 'object' ? (payload as any).details : undefined);
  }
  if (payload && typeof payload === 'object' && 'ok' in payload && 'data' in payload) return (payload as any).data as T;
  return payload as T;
}

/** Like `get`, but keeps the response envelope so paginated endpoints can read `meta`. */
async function requestEnvelope<T = any>(path: string, signal?: AbortSignal): Promise<{ data: T; meta?: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method: 'GET', credentials: 'same-origin', signal, headers: {} });
  } catch (err) {
    throw new ApiError(0, 'Network unavailable. Check your connection and try again.', err);
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as any).error) : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload && typeof payload === 'object' ? (payload as any).details : undefined);
  }
  if (payload && typeof payload === 'object' && 'ok' in payload && 'data' in payload) {
    return { data: (payload as any).data as T, meta: (payload as any).meta };
  }
  return { data: payload as T };
}

export const api = {
  get: <T = any>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  getEnvelope: <T = any>(path: string, signal?: AbortSignal) => requestEnvelope<T>(path, signal),
  post: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }),
  patch: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ?? {} }),
  del: <T = any>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T = any>(path: string, file: File) => request<T>(path, { method: 'POST', body: file, raw: true, headers: { 'Content-Type': file.type } }),
};

export function downloadUrl(path: string) {
  return `/api${path}`;
}

export function formatError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
