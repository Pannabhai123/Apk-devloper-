import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { api, formatError } from '../api/client';
import { Brand } from '../components/Brand';
import { Button, Card, Field, Notice, PageMeta } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <PageMeta title={title} />
      <div className="center mb-3"><Brand /></div>
      <Card className="card-pad">
        <h2 className="center" style={{ fontSize: '1.35rem' }}>{title}</h2>
        <p className="small muted center mb-3">{subtitle}</p>
        {children}
      </Card>
      <div className="center small muted mt-3">{footer}</div>
      <p className="tiny muted center mt-3"><ShieldCheck size={13} style={{ verticalAlign: '-2px' }} /> Passwords are hashed with scrypt. Sessions use HTTP-only cookies and CSRF protection.</p>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { refresh, settings } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/auth/login', { email, password });
      await refresh();
      toast('Signed in successfully.', 'success');
      nav(params.get('next') || '/dashboard');
    } catch (err) { setError(formatError(err)); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to keep your results, bookmarks and progress across devices."
      footer={<>{settings.allow_registration !== false ? <>New here? <Link to="/register">Create an account</Link></> : 'Registration is currently closed.'}</>}>
      {error && <div className="mb-2"><Notice kind="danger">{error}</Notice></div>}
      <form onSubmit={submit}>
        <Field label="Email address" htmlFor="login-email"><div className="search-box"><Mail size={17} /><input id="login-email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div></Field>
        <Field label="Password" htmlFor="login-password"><div className="search-box"><LockKeyhole size={17} /><input id="login-password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /><button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', left: 'auto', right: 5, top: '50%', transform: 'translateY(-50%)' }} onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></Field>
        <div className="row-between mb-2"><span /><Link to="/forgot-password" className="small">Forgot password?</Link></div>
        <Button type="submit" block size="lg" loading={busy}>Sign in <ArrowRight size={17} /></Button>
      </form>
      <div className="mt-3"><Notice kind="info">Guest practice is available without an account when enabled. Your guest attempts are claimed automatically when you sign in on this device.</Notice></div>
    </AuthShell>
  );
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { refresh, settings } = useApp();
  const nav = useNavigate();
  const toast = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters long.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/register', { name: form.name, email: form.email, phone: form.phone, password: form.password });
      await refresh(); toast('Account created. Welcome to VidyaPariksha!', 'success'); nav('/dashboard');
    } catch (err) { setError(formatError(err)); } finally { setBusy(false); }
  };

  if (settings.allow_registration === false) {
    return <AuthShell title="Registration closed" subtitle="The administrator has disabled new registrations." footer={<Link to="/login">Back to sign in</Link>}><Notice kind="warning">You can still practise as a guest if guest tests are enabled.</Notice></AuthShell>;
  }
  return (
    <AuthShell title="Create your free account" subtitle="Save results across devices and build a personal revision list."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
      {error && <div className="mb-2"><Notice kind="danger">{error}</Notice></div>}
      <form onSubmit={submit}>
        <Field label="Full name" htmlFor="reg-name"><div className="search-box"><UserRound size={17} /><input id="reg-name" className="input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div></Field>
        <Field label="Email address" htmlFor="reg-email"><div className="search-box"><Mail size={17} /><input id="reg-email" className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div></Field>
        <Field label="Mobile number (optional)" htmlFor="reg-phone"><input id="reg-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></Field>
        <Field label="Password" htmlFor="reg-password" hint="At least 8 characters."><div className="search-box"><LockKeyhole size={17} /><input id="reg-password" className="input" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div></Field>
        <Field label="Confirm password" htmlFor="reg-confirm"><input id="reg-confirm" className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
        <Button type="submit" block size="lg" loading={busy}>Create account <ArrowRight size={17} /></Button>
      </form>
      <p className="tiny muted mt-2 mb-0">By registering you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy-policy">Privacy Policy</Link>.</p>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const res = await api.post<{ message: string; devResetToken?: string }>('/auth/password/forgot', { email });
      setMessage(res.message);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } catch (err) { setError(formatError(err)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email. If it exists, a reset token is issued." footer={<Link to="/login">Back to sign in</Link>}>
      {error && <div className="mb-2"><Notice kind="danger">{error}</Notice></div>}
      {message && <div className="mb-2"><Notice kind="success">{message}</Notice></div>}
      {devToken && <div className="mb-2"><Notice kind="warning"><strong>Development mode:</strong> no email service is configured, so the reset token is shown here. <Link to={`/reset-password?token=${encodeURIComponent(devToken)}`}>Continue to reset</Link><br /><code style={{ fontSize: '.72rem', wordBreak: 'break-all' }}>{devToken}</code></Notice></div>}
      <form onSubmit={submit}>
        <Field label="Email address" htmlFor="forgot-email"><div className="search-box"><Mail size={17} /><input id="forgot-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div></Field>
        <Button type="submit" block loading={busy}><KeyRound size={16} /> Request reset</Button>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();
  const toast = useToast();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters long.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await api.post('/auth/password/reset', { token, password }); toast('Password updated. Please sign in.', 'success'); nav('/login'); }
    catch (err) { setError(formatError(err)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Choose a new password" subtitle="Reset links are single-use and expire after one hour." footer={<Link to="/login">Back to sign in</Link>}>
      {error && <div className="mb-2"><Notice kind="danger">{error}</Notice></div>}
      <form onSubmit={submit}>
        <Field label="Reset token" htmlFor="reset-token"><input id="reset-token" className="input" required value={token} onChange={(e) => setToken(e.target.value)} /></Field>
        <Field label="New password" htmlFor="reset-password"><input id="reset-password" className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirm new password" htmlFor="reset-confirm"><input id="reset-confirm" className="input" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Button type="submit" block loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
