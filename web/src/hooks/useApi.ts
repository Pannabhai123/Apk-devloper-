import { useCallback, useEffect, useRef, useState } from 'react';
import { api, formatError } from '../api/client';

export interface PageMeta { page: number; pages: number; total: number; limit: number }

/**
 * For paginated collections. The API wrapper normally unwraps `data`, which
 * discards `meta`; this hook keeps both so paging is driven by real totals.
 */
export function usePagedApi<T>(path: string | null, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!path) { setLoading(false); setRows(null); setMeta(null); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    api.getEnvelope<T[]>(path, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(result.data) ? result.data : [];
        setRows(list);
        setMeta({
          page: Number(result.meta?.page ?? 1),
          pages: Number(result.meta?.pages ?? 1),
          total: Number(result.meta?.total ?? list.length),
          limit: Number(result.meta?.limit ?? list.length),
        });
      })
      .catch((err) => { if (!controller.signal.aborted) setError(formatError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data: rows, meta, loading, error, reload };
}

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const pathRef = useRef(path);
  pathRef.current = path;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) { setLoading(false); setData(null); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get<T>(path, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((err) => { if (!controller.signal.aborted) setError(formatError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, loading, error, reload, setData };
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
