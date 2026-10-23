import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileClock, FileText, Presentation } from 'lucide-react';
import { api, exportDownload } from '../api';
import type { ExportRecord } from '../types';
import { EmptyState, ErrorMessage, formatDate, Loading } from '../components/Common';

export default function History() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => { api.exports().then((items) => { setExports(items); setLoaded(true); }).catch((reason) => { setError(reason.message); setLoaded(true); }); }, []);
  const filtered = useMemo(() => exports.filter((item) => filter === 'all' || item.kind === filter), [exports, filter]);
  if (!loaded) return <Loading label="Loading presentation history…" />;
  return (
    <div>
      <div className="page-action-row"><div><h2>Your classroom exports</h2><p>Files are stored on the server and can be downloaded again.</p></div><Link to="/generate" className="button primary"><Presentation size={17} /> New presentation</Link></div>
      {error && <ErrorMessage message={error} />}
      <div className="filter-tabs history-filter">{['all', 'pptx', 'pdf'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All exports' : item.toUpperCase()}</button>)}</div>
      {filtered.length ? <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Presentation</th><th>Format</th><th>Mode</th><th>Slides</th><th>Created</th><th><span className="sr-only">Download</span></th></tr></thead><tbody>{filtered.map((item) => (
        <tr key={item.id}><td><Link to={`/projects/${item.project_id}`} className="history-name"><span className={`file-icon ${item.kind}`}>{item.kind === 'pptx' ? <Presentation size={19} /> : <FileText size={19} />}</span><span><strong>{item.project_title}</strong><small>{item.original_filename}</small></span></Link></td><td><span className={`format-badge ${item.kind}`}>{item.kind.toUpperCase()}</span></td><td>Mode {item.mode}</td><td>{item.slide_count}</td><td>{formatDate(item.created_at, true)}</td><td><a className="button icon-only secondary" href={exportDownload(item.id)} download aria-label={`Download ${item.project_title}`}><Download size={17} /></a></td></tr>
      ))}</tbody></table></div> : <EmptyState title="No exports here yet" text="Generate a presentation from any reviewed project and it will appear in this history." action={<Link to="/generate" className="button primary"><FileClock size={17} /> Generate a PPT</Link>} />}
    </div>
  );
}
