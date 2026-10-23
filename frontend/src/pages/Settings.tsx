import { useEffect, useState } from 'react';
import {
  Bot, Check, CheckCircle2, FileText, KeyRound, Languages, Link2, LoaderCircle,
  MapPin, RefreshCw, Save, ScanLine, Server, Settings2, Wifi, XCircle,
} from 'lucide-react';
import { api, getApiRoot, normalizeApiRoot, setApiRoot } from '../api';
import type { AppSettings, Capabilities } from '../types';
import { ErrorMessage, Loading } from '../components/Common';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState(getApiRoot());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionOk, setConnectionOk] = useState(false);
  const load = () => Promise.all([api.settings(), api.health()])
    .then(([saved, health]) => { setSettings(saved); setCapabilities(health.capabilities); setError(''); })
    .catch((reason) => setError(reason.message));
  useEffect(() => { void load(); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true); setNotice(''); setError('');
    try { setSettings(await api.saveSettings(settings)); setNotice('Classroom settings saved.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save settings.'); }
    finally { setSaving(false); }
  };
  const testAndSaveConnection = async () => {
    const root = normalizeApiRoot(connectionUrl);
    setTestingConnection(true); setConnectionMessage(''); setConnectionOk(false);
    try {
      const response = await fetch(`${root}/health`);
      if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`);
      const health = await response.json();
      if (health.status !== 'ok') throw new Error('This URL is not a Dream Classes backend.');
      setApiRoot(root); setConnectionUrl(root); setCapabilities(health.capabilities);
      setConnectionOk(true); setConnectionMessage('Connection verified and saved on this device.');
      await load();
    } catch (reason) {
      setConnectionMessage(reason instanceof Error ? `${reason.message} Check the URL, server, and network.` : 'Connection failed.');
    } finally { setTestingConnection(false); }
  };
  if (!settings && !error) return <Loading label="Loading settings…" />;
  return (
    <form onSubmit={save} className="settings-page">
      <section className="panel settings-section connection-settings">
        <div className="settings-section-heading"><span><Wifi size={20} /></span><div><h3>Backend connection</h3><p>Required for PDF upload, OCR, AI processing, and PPT generation on Android.</p></div><span className="connection-current"><Link2 size={12} /> Device-specific</span></div>
        <label className="connection-label">Dream Classes server URL<div className="connection-input-row"><input value={connectionUrl} onChange={(event) => { setConnectionUrl(event.target.value); setConnectionMessage(''); }} placeholder="https://your-server.com or http://192.168.1.10:8000" inputMode="url" /><button type="button" className="button primary" onClick={testAndSaveConnection} disabled={testingConnection}>{testingConnection ? <LoaderCircle className="spin" size={16} /> : <Wifi size={16} />}{testingConnection ? 'Testing…' : 'Test & save'}</button></div></label>
        <p className="connection-help">Use an HTTPS public server for everyday use. On the same Wi-Fi, you can use your computer’s LAN IP with port 8000. `/api` is added automatically.</p>
        {connectionMessage && <div className={`alert compact ${connectionOk ? 'success' : 'error'}`}>{connectionOk ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{connectionMessage}</div>}
      </section>
      {error && <ErrorMessage message={error} />}
      {notice && <div className="alert success"><CheckCircle2 size={18} />{notice}</div>}
      {settings && <>
        <section className="panel settings-section">
          <div className="settings-section-heading"><span><Settings2 size={20} /></span><div><h3>Classroom profile</h3><p>Used for your workspace and presentation identity.</p></div></div>
          <div className="form-grid two">
            <label>Institute name<input value={settings.institute_name} onChange={(e) => setSettings({ ...settings, institute_name: e.target.value })} /></label>
            <label>Teacher name<input value={settings.teacher_name} onChange={(e) => setSettings({ ...settings, teacher_name: e.target.value })} /></label>
            <label className="full">Address<div className="input-with-icon"><MapPin size={16} /><input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></div></label>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-section-heading"><span><FileText size={20} /></span><div><h3>Presentation defaults</h3><p>Starting options for each new blackboard design.</p></div></div>
          <div className="form-grid two">
            <label>Default presentation mode<select value={settings.default_mode} onChange={(e) => setSettings({ ...settings, default_mode: e.target.value as AppSettings['default_mode'] })}><option value="A">Mode A · Questions only</option><option value="B">Mode B · Question + answer</option><option value="C">Mode C · Answer + explanation</option><option value="D">Mode D · Custom layout</option></select></label>
            <label>Hindi-compatible font<select value={settings.default_font} onChange={(e) => setSettings({ ...settings, default_font: e.target.value })}><option>Nirmala UI</option><option>Noto Sans Devanagari</option><option>Mangal</option><option>Arial Unicode MS</option></select></label>
          </div>
          <label className="toggle-row"><div><strong>Automatically OCR scanned pages</strong><p>Runs only when a page has little or no embedded text. Requires Tesseract on the server.</p></div><input type="checkbox" checked={settings.auto_ocr} onChange={(e) => setSettings({ ...settings, auto_ocr: e.target.checked })} /><span className="toggle" /></label>
        </section>
      </>}
      <div className="settings-save-row"><button className="button primary" disabled={saving || !settings}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? 'Saving…' : 'Save settings'}</button></div>

      <section className="panel settings-section capabilities-section">
        <div className="settings-section-heading"><span><Server size={20} /></span><div><h3>Server capabilities</h3><p>Live checks from your backend—never simulated.</p></div><button type="button" className="icon-button" onClick={load} title="Re-check capabilities"><RefreshCw size={17} /></button></div>
        <div className="capability-grid">
          <Capability icon={<FileText size={18} />} title="PDF text extraction" ok={!!capabilities?.pdf_text} detail="PyMuPDF · ready" />
          <Capability icon={<ScanLine size={18} />} title="Scanned PDF OCR" ok={!!capabilities?.ocr.available} detail={capabilities?.ocr.available ? `Tesseract ${capabilities.ocr.version || ''} · ${capabilities.ocr.hindi ? 'Hindi + ' : ''}${capabilities.ocr.english ? 'English' : ''}` : 'Requires server setup'} />
          <Capability icon={<Bot size={18} />} title="AI processing" ok={!!capabilities?.ai_configured} detail={capabilities?.ai_configured ? `${capabilities.ai_model} · key secured on server` : 'API key not configured'} />
          <Capability icon={<Languages size={18} />} title="Hindi PDF & PPTX export" ok={!!capabilities?.pdf_export} detail="Noto Devanagari · shaped Unicode" />
        </div>
      </section>
      <div className="setup-grid">
        <section className="panel setup-card"><span className="setup-icon"><ScanLine size={20} /></span><h3>Enable scanned PDF OCR</h3><p>Install the engine and both language packs on the backend host, then restart it.</p><code>sudo apt install tesseract-ocr<br />tesseract-ocr-hin tesseract-ocr-eng</code><small>No API key is needed for OCR.</small></section>
        <section className="panel setup-card"><span className="setup-icon"><KeyRound size={20} /></span><h3>Enable AI answers</h3><p>Set provider credentials only in <b>backend/.env</b>. Never put them in Vite variables or the APK.</p><code>AI_API_KEY=your_server_key<br />AI_MODEL=gpt-4o-mini</code><small><XCircle size={12} /> AI requests fail clearly until configured.</small></section>
      </div>
    </form>
  );
}

function Capability({ icon, title, ok, detail }: { icon: React.ReactNode; title: string; ok: boolean; detail: string }) {
  return <div className="capability"><span className="capability-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div><span className={ok ? 'capability-status ok' : 'capability-status'}>{ok ? <Check size={14} /> : <XCircle size={14} />}{ok ? 'Ready' : 'Setup'}</span></div>;
}
