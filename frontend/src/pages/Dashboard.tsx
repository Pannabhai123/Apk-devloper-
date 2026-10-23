import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, FileStack, FileText, FolderOpen, Layers3,
  Presentation, ScanText, Sparkles, Upload,
} from 'lucide-react';
import { api } from '../api';
import type { DashboardData } from '../types';
import { ErrorMessage, Loading, ProjectCard } from '../components/Common';
import { UploadDropzone } from '../components/Upload';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const load = () => api.dashboard().then(setData).catch((reason) => setError(reason.message));
  useEffect(() => { void load(); }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (!data && !error) return <Loading />;
  return (
    <div className="dashboard-page">
      {error && <ErrorMessage message={error} />}
      <section className="welcome-row">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> YOUR TEACHER WORKSPACE</span>
          <h2>{greeting}, Dream Sir <span>👋</span></h2>
          <p>Let’s turn today’s questions into a class worth remembering.</p>
        </div>
        <Link to="/projects" className="button secondary desktop-only"><FolderOpen size={17} /> View all projects</Link>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span className="stat-icon green"><FileStack size={20} /></span><div><strong>{data?.stats.projects || 0}</strong><p>Total projects</p></div><small>All time</small></div>
        <div className="stat-card"><span className="stat-icon orange"><ScanText size={20} /></span><div><strong>{data?.stats.questions || 0}</strong><p>Questions extracted</p></div><small>Editable</small></div>
        <div className="stat-card"><span className="stat-icon blue"><Presentation size={20} /></span><div><strong>{data?.stats.presentations || 0}</strong><p>Presentations</p></div><small>PPTX files</small></div>
        <div className="stat-card"><span className="stat-icon violet"><Layers3 size={20} /></span><div><strong>{data?.stats.pages_processed || 0}</strong><p>Pages processed</p></div><small>Verified</small></div>
      </section>

      <section className="dashboard-main-grid">
        <div className="panel upload-panel">
          <div className="panel-heading"><div><span className="section-kicker">START A NEW PROJECT</span><h3>Your PDF. Your next presentation.</h3></div><span className="ai-chip"><Sparkles size={12} /> AI-ready</span></div>
          <UploadDropzone />
        </div>
        <aside className="panel workflow-panel">
          <span className="section-kicker">HOW IT WORKS</span>
          <h3>Classroom-ready in 3 steps</h3>
          <div className="workflow-list">
            <div><span className="workflow-number">01</span><span className="workflow-icon"><Upload size={18} /></span><section><strong>Upload your PDF</strong><p>Hindi, English, or scanned question papers.</p></section></div>
            <div><span className="workflow-number">02</span><span className="workflow-icon"><CheckCircle2 size={18} /></span><section><strong>We read every page</strong><p>Questions are extracted automatically in original order.</p></section></div>
            <div><span className="workflow-number">03</span><span className="workflow-icon"><Presentation size={18} /></span><section><strong>Your PPT is ready</strong><p>Editable slides download automatically. Review is optional.</p></section></div>
          </div>
          <div className="workflow-note"><FileText size={16} /><span>No screenshots. Every slide stays editable.</span></div>
        </aside>
      </section>

      <section className="recent-section">
        <div className="section-heading"><div><span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h3>Recent projects</h3></div><Link to="/projects">View all <ArrowRight size={15} /></Link></div>
        {data && data.recent_projects.length > 0 ? (
          <div className="project-grid">{data.recent_projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
        ) : (
          <div className="recent-empty"><FileText size={22} /><span>Your uploaded PDFs will appear here.</span><Link to="/projects">Open projects <ArrowRight size={14} /></Link></div>
        )}
      </section>
    </div>
  );
}
