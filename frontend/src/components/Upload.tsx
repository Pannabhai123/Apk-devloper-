import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileUp, LoaderCircle, LockKeyhole, ScanLine, UploadCloud } from 'lucide-react';
import { uploadPdf } from '../api';
import type { Project } from '../types';

function useUpload(onComplete?: (project: Project) => void) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const navigate = useNavigate();
  const start = async (file?: File) => {
    if (!file) return;
    setError('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.'); return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('This PDF is larger than the 50 MB upload limit.'); return;
    }
    setFileName(file.name);
    setProgress(0);
    try {
      const project = await uploadPdf(file, setProgress);
      setProgress(100);
      if (onComplete) onComplete(project);
      else navigate(`/projects/${project.id}?quick=1`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed.');
      setProgress(null);
    }
  };
  return { progress, error, fileName, start, setError };
}

export function UploadButton({ children = 'Upload & Make PPT', className = 'button primary', onComplete }: {
  children?: React.ReactNode; className?: string; onComplete?: (project: Project) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { progress, error, start } = useUpload(onComplete);
  const busy = progress !== null;
  return (
    <span className="upload-button-wrap">
      <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={(event) => {
        start(event.target.files?.[0]); event.target.value = '';
      }} />
      <button className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle className="spin" size={17} /> : <FileUp size={17} />}
        {busy ? `Uploading ${progress}%` : children}
      </button>
      {error && <span className="inline-error">{error}</span>}
    </span>
  );
}

export function UploadDropzone() {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { progress, error, fileName, start } = useUpload();
  const busy = progress !== null;
  return (
    <div>
      <div
        className={`upload-dropzone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) start(event.dataTransfer.files[0]); }}
      >
        <input ref={input} type="file" accept=".pdf,application/pdf" hidden onChange={(event) => {
          start(event.target.files?.[0]); event.target.value = '';
        }} />
        <div className="upload-illustration">
          <span className="upload-ring" />
          {busy ? <LoaderCircle className="spin" size={30} /> : <UploadCloud size={30} />}
          <span className="mini-file"><FileText size={15} /></span>
        </div>
        {busy ? (
          <div className="upload-progress-content">
            <h3>Uploading your question paper</h3>
            <p>{fileName}</p>
            <div className="progress-track large"><i style={{ width: `${progress}%` }} /></div>
            <strong>{progress}%</strong>
          </div>
        ) : (
          <>
            <h3>Drop your PDF. Get your PPT.</h3>
            <p>Upload once—we’ll extract the questions and make your editable PPT automatically.</p>
            <button className="button primary" onClick={() => input.current?.click()}><FileUp size={17} /> Upload & Make PPT</button>
          </>
        )}
        <div className="upload-meta">
          <span><ScanLine size={13} /> Hindi + English</span>
          <span><LockKeyhole size={13} /> Private server upload</span>
          <span>PDF · up to 50 MB</span>
        </div>
      </div>
      {error && <div className="alert error compact">{error}</div>}
    </div>
  );
}
