import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, formatError } from '../../api/client';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Loading, Modal, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; width?: number }
export interface FieldDef {
  name: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'multiselect' | 'color';
  options?: { value: string | number; label: string }[]; required?: boolean; hint?: string; default?: any; min?: number; max?: number;
}

export function AdminHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="row-between mb-3" style={{ alignItems: 'flex-start' }}>
      <div><h2 style={{ fontSize: '1.45rem' }}>{title}</h2>{description && <p className="small muted mb-0" style={{ marginTop: 5 }}>{description}</p>}</div>
      {action}
    </div>
  );
}

export function DataTable<T extends { id: number }>({ columns, rows, actions, emptyLabel = 'No records yet' }: {
  columns: Column<T>[]; rows: T[]; actions?: (row: T) => ReactNode; emptyLabel?: string;
}) {
  if (!rows.length) return <EmptyState title={emptyLabel} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}{actions && <th style={{ width: 150 }}>Actions</th>}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}</td>)}
              {actions && <td><div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>{actions(row)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useResource<T>(endpoint: string, query = '') {
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const result = await api.get<any>(`${endpoint}${separator}page=${page}&limit=25${query}`);
      if (Array.isArray(result)) { setRows(result as T[]); setMeta({ page: 1, pages: 1, total: result.length }); }
      else { setRows(result.data as T[]); setMeta(result.meta || { page: 1, pages: 1, total: result.data?.length || 0 }); }
    } catch (err) { setError(formatError(err)); } finally { setLoading(false); }
  }, [endpoint, page, query]);

  useEffect(() => { void load(); }, [load, nonce]);

  const remove = async (id: number, label: string) => {
    try { await api.del(`${endpoint}/${id}`); toast(`${label} deleted.`, 'success'); load(); }
    catch (err) { toast(formatError(err), 'error'); }
  };

  return { rows, meta, page, setPage, loading, error, reload: load, refresh: () => setNonce((n) => n + 1), remove };
}

export function ResourceFormModal({ open, title, fields, initial, onClose, onSave }: {
  open: boolean; title: string; fields: FieldDef[]; initial?: Record<string, any> | null;
  onClose: () => void; onSave: (values: Record<string, any>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Keep the latest props without re-running the reset effect on every keystroke.
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    if (!open) return;
    const next: Record<string, any> = {};
    for (const f of fieldsRef.current) next[f.name] = (initialRef.current as any)?.[f.name] ?? f.default ?? (f.type === 'checkbox' ? false : f.type === 'multiselect' ? [] : '');
    setValues(next); setError('');
  }, [open]);

  const set = (name: string, value: any) => setValues((v) => ({ ...v, [name]: value }));
  const submit = async () => {
    for (const f of fields) {
      if (f.required && (values[f.name] === '' || values[f.name] === undefined || values[f.name] === null)) { setError(`${f.label} is required.`); return; }
    }
    setBusy(true); setError('');
    try { await onSave(values); onClose(); }
    catch (err) { setError(formatError(err)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={submit}>Save</Button></>}>
      {error && <div className="mb-2"><ErrorState message={error} /></div>}
      <div className="grid grid-2-sm">
        {fields.map((f) => (
          <div key={f.name} style={{ gridColumn: f.type === 'textarea' || f.type === 'multiselect' ? '1 / -1' : undefined }}>
            {f.type === 'checkbox' ? (
              <label className="checkbox"><input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} /><span><strong className="small">{f.label}</strong>{f.hint && <span className="tiny muted" style={{ display: 'block' }}>{f.hint}</span>}</span></label>
            ) : (
              <Field label={f.label} hint={f.hint} htmlFor={`fld-${f.name}`}>
                {f.type === 'textarea' ? <textarea id={`fld-${f.name}`} className="textarea" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                  : f.type === 'select' ? <select id={`fld-${f.name}`} className="select" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                    <option value="">— Select —</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                    : f.type === 'multiselect' ? (
                      <div className="row" style={{ gap: 8, padding: '8px 0' }}>
                        {f.options?.length ? f.options.map((o) => {
                          const checked = (values[f.name] || []).map(String).includes(String(o.value));
                          return <label key={o.value} className="badge badge-gray checkbox" style={{ cursor: 'pointer', padding: '6px 10px' }}>
                            <input type="checkbox" checked={checked} onChange={(e) => {
                              const current: any[] = values[f.name] || [];
                              set(f.name, e.target.checked ? [...current, o.value] : current.filter((x) => String(x) !== String(o.value)));
                            }} /><span className="small">{o.label}</span>
                          </label>;
                        }) : <span className="small muted">No options available.</span>}
                      </div>
                    ) : <input id={`fld-${f.name}`} className="input" type={f.type === 'number' ? 'number' : f.type === 'color' ? 'color' : 'text'}
                      min={f.min} max={f.max} value={values[f.name] ?? ''} onChange={(e) => set(f.name, f.type === 'number' ? Number(e.target.value) : e.target.value)} />}
              </Field>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function CrudActions({ onEdit, onDelete, extra }: { onEdit: () => void; onDelete?: () => void; extra?: ReactNode }) {
  return <>{extra}<button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} aria-label="Edit"><Pencil size={15} /></button>{onDelete && <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={onDelete} aria-label="Delete"><Trash2 size={15} /></button>}</>;
}

export function CrudPage<T extends { id: number }>({ title, description, endpoint, fields, columns, toForm, fromRow, extraActions, query = '' }: {
  title: string; description: string; endpoint: string; fields: FieldDef[]; columns: Column<T>[];
  toForm: (values: Record<string, any>) => any; fromRow: (row: T) => Record<string, any> | Promise<Record<string, any>>;
  extraActions?: (row: T) => ReactNode; query?: string;
}) {
  const toast = useToast();
  const resource = useResource<T>(endpoint, query);
  const [editing, setEditing] = useState<T | null | 'new'>(null);
  const [initialValues, setInitialValues] = useState<Record<string, any> | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (editing && editing !== 'new') {
      setInitialValues(null);
      Promise.resolve(fromRow(editing)).then((v) => { if (!cancelled) setInitialValues(v); }).catch(() => { if (!cancelled) setInitialValues({}); });
    } else setInitialValues(null);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = async (values: Record<string, any>) => {
    const payload = toForm(values);
    if (editing && editing !== 'new') await api.put(`${endpoint}/${editing.id}`, payload);
    else await api.post(endpoint, payload);
    toast(editing && editing !== 'new' ? 'Record updated.' : 'Record created.', 'success');
    resource.reload();
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try { await api.del(`${endpoint}/${deleting.id}`); toast('Record deleted.', 'success'); resource.reload(); setDeleting(null); }
    catch (err) { toast(formatError(err), 'error'); } finally { setDeleteBusy(false); }
  };

  return (
    <>
      <AdminHeader title={title} description={description} action={<div className="btn-group"><Button size="sm" variant="outline" onClick={resource.reload}><RefreshCw size={15} /> Refresh</Button><Button size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Add new</Button></div>} />
      {resource.loading && <Loading />}
      {resource.error && <ErrorState message={resource.error} onRetry={resource.reload} />}
      {!resource.loading && !resource.error && <>
        <DataTable columns={columns} rows={resource.rows} emptyLabel={`No ${title.toLowerCase()} yet`}
          actions={(row) => <CrudActions onEdit={() => setEditing(row)} onDelete={() => setDeleting(row)} extra={extraActions?.(row)} />} />
        <Pagination page={resource.meta.page} pages={resource.meta.pages} onChange={resource.setPage} />
        <p className="tiny muted mt-2">{resource.meta.total} record(s) in total.</p>
      </>}
      <ResourceFormModal open={Boolean(editing) && (editing === 'new' || initialValues !== null)}
        title={editing === 'new' ? `Add ${title.replace(/s$/, '')}` : `Edit ${title.replace(/s$/, '')}`}
        fields={fields} initial={initialValues}
        onClose={() => setEditing(null)} onSave={save} />
      <ConfirmDialog open={Boolean(deleting)} title="Delete this record?" danger confirmLabel="Delete" loading={deleteBusy}
        onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
        message="This action is permanent. Records that still have dependent questions, tests or attempts cannot be deleted and the server will explain why." />
    </>
  );
}
