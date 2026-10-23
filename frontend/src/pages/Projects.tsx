import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../api';
import type { Project } from '../types';
import { EmptyState, ErrorMessage, Loading, ProjectCard } from '../components/Common';
import { UploadButton } from '../components/Upload';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const load = () => api.projects().then((items) => { setProjects(items); setLoaded(true); }).catch((reason) => { setError(reason.message); setLoaded(true); });
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => projects.filter((project) => {
    const matchesQuery = `${project.title} ${project.original_filename}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'attention' ? project.status === 'failed' : project.status === filter);
    return matchesQuery && matchesFilter;
  }), [projects, query, filter]);
  const remove = async (project: Project) => {
    if (!window.confirm(`Delete “${project.title}” and all of its exports? This cannot be undone.`)) return;
    try { await api.deleteProject(project.id); setProjects((items) => items.filter((item) => item.id !== project.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete project.'); }
  };

  if (!loaded) return <Loading label="Loading your projects…" />;
  return (
    <div>
      <div className="page-action-row">
        <div><h2>Your question library</h2><p>{projects.length} project{projects.length === 1 ? '' : 's'}, safely stored on the backend.</p></div>
        <UploadButton />
      </div>
      {error && <ErrorMessage message={error} />}
      <div className="filter-bar">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or PDFs…" /></label>
        <div className="filter-tabs"><SlidersHorizontal size={15} />{['all', 'ready', 'processing', 'attention'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All projects' : item === 'attention' ? 'Needs attention' : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      </div>
      {filtered.length ? <div className="project-grid all-projects">{filtered.map((project) => <ProjectCard key={project.id} project={project} onDelete={remove} />)}</div> : (
        <EmptyState title={projects.length ? 'No matching projects' : 'Upload your first question paper'} text={projects.length ? 'Try a different search or filter.' : 'Your editable questions and presentations will live here.'} action={!projects.length ? <UploadButton /> : undefined} />
      )}
    </div>
  );
}
