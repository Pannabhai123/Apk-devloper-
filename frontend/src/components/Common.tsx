import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, FileQuestion, FileText, Presentation, Trash2 } from 'lucide-react';
import type { Project, ProjectStatus } from '../types';

export const formatDate = (value: string, includeTime = false) => new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
  ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
}).format(new Date(value));

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const labels: Record<ProjectStatus, string> = {
    uploaded: 'Uploaded', processing: 'Processing', ready: 'Ready', failed: 'Needs attention',
  };
  return <span className={`status-badge ${status}`}><i />{labels[status]}</span>;
}

export function Loading({ label = 'Loading your workspace…' }: { label?: string }) {
  return <div className="loading-state"><span className="loader" /><p>{label}</p></div>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span><FileQuestion size={28} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function ProjectCard({ project, onDelete }: { project: Project; onDelete?: (project: Project) => void }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <span className="file-icon"><FileText size={21} /></span>
        <StatusBadge status={project.status} />
      </div>
      <Link to={`/projects/${project.id}`} className="project-title-link">
        <h3>{project.title}</h3><ArrowUpRight size={17} />
      </Link>
      <p className="project-filename" title={project.original_filename}>{project.original_filename}</p>
      <div className="project-metrics">
        <span><strong>{project.question_count}</strong> questions</span>
        <span><strong>{project.total_pages || '—'}</strong> pages</span>
        <span><Presentation size={13} /><strong>{project.pptx_count}</strong></span>
      </div>
      <div className="project-card-footer">
        <span>{formatDate(project.created_at)}</span>
        {onDelete && <button className="icon-button subtle" aria-label={`Delete ${project.title}`} onClick={() => onDelete(project)}><Trash2 size={15} /></button>}
      </div>
    </article>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="alert error"><AlertCircle size={18} /><span>{message}</span></div>;
}
