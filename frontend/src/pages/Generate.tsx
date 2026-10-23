import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, Presentation, Rows3, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { Project } from '../types';
import { EmptyState, ErrorMessage, Loading } from '../components/Common';
import { UploadButton } from '../components/Upload';

const modes = [
  { mode: 'A', title: 'Questions only', text: 'Question and options on each slide.' },
  { mode: 'B', title: 'Question + answer', text: 'A separate answer reveal follows each question.' },
  { mode: 'C', title: 'Answer + explanation', text: 'Teach the answer and the reasoning behind it.' },
  { mode: 'D', title: 'Custom layout', text: 'Choose answer and explanation placement.' },
];

export default function Generate() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.projects().then(setProjects).catch((reason) => setError(reason.message)); }, []);
  if (!projects && !error) return <Loading label="Finding presentation-ready projects…" />;
  const ready = (projects || []).filter((project) => project.status === 'ready' && project.question_count > 0);
  return (
    <div className="generate-page">
      {error && <ErrorMessage message={error} />}
      <section className="generate-hero">
        <span className="generate-hero-icon"><Presentation size={30} /></span>
        <div><span className="eyebrow"><Sparkles size={13} /> BLACKBOARD STUDIO</span><h2>Choose a project. Make it teachable.</h2><p>Every presentation uses your latest reviewed questions and stays fully editable in PowerPoint.</p></div>
      </section>
      <section className="mode-overview">{modes.map((mode) => <div key={mode.mode}><span>{mode.mode}</span><section><strong>{mode.title}</strong><p>{mode.text}</p></section></div>)}</section>
      <div className="section-heading"><div><span className="section-kicker">READY TO DESIGN</span><h3>Select a project</h3></div><UploadButton className="button secondary" /></div>
      {ready.length ? <div className="ready-project-list">{ready.map((project) => (
        <Link to={`/projects/${project.id}?step=design`} className="ready-project" key={project.id}>
          <span className="file-icon"><FileText size={21} /></span>
          <div><strong>{project.title}</strong><p>{project.question_count} reviewed questions · {project.total_pages} PDF pages</p></div>
          <span className="ready-label"><CheckCircle2 size={14} /> Ready</span>
          <span className="button primary small">Design & generate <ArrowRight size={15} /></span>
        </Link>
      ))}</div> : <EmptyState title="No reviewed projects yet" text="Upload a PDF and finish question review before generating your presentation." action={<UploadButton />} />}
      <div className="quality-note"><Rows3 size={19} /><div><strong>Built for the classroom, not just the screen</strong><p>16:9 widescreen · Hindi-compatible fonts · automatic text fitting · answer-source labels</p></div></div>
    </div>
  );
}
