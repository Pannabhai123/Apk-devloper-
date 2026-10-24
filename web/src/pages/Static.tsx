import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, Clock3, FileQuestion, HelpCircle, Layers, Mail, MapPin, MessageSquare, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { api, formatError } from '../api/client';
import { Button, Card, EmptyState, Field, Notice, PageMeta } from '../components/ui';
import { useApp } from '../context/AppContext';

function LegalPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="container section container-narrow">
      <PageMeta title={title} description={description} />
      <h2 className="mb-1">{title}</h2>
      <p className="tiny muted mb-3">Last updated: 24 October 2026</p>
      <div className="prose card card-pad">{children}</div>
    </div>
  );
}

export function About() {
  const { settings } = useApp();
  return (
    <LegalPage title="About VidyaPariksha" description="Learn about the VidyaPariksha online practice platform.">
      <p>VidyaPariksha is an independent, original online examination practice platform built for students preparing for competitive, board and computer examinations. It provides a realistic computer-based test (CBT) experience, a manageable question bank and honest analytics derived only from your own attempts.</p>
      <h2>What we focus on</h2>
      <ul>
        <li>Reliable timed examinations with server-authoritative deadlines and scoring.</li>
        <li>Clear separation between original practice content and verified external material.</li>
        <li>Mobile-first design that works on ordinary Android phones and slower connections.</li>
        <li>Transparent statistics — no fabricated success rates, visitor counts or score-improvement claims.</li>
      </ul>
      <h2>Content policy</h2>
      <p>The demonstration question bank included with a fresh installation consists of <strong>original practice questions written for this project</strong>. It is not copied from any publisher, and it is not presented as verified previous-year examination material. Administrators are responsible for ensuring that any content they import is properly licensed and accurately labelled.</p>
      <h2>Contact</h2>
      <p>{settings.contact_email || 'Use the contact page to reach the site administrator.'}{settings.address ? ` · ${settings.address}` : ''}</p>
      <Link to="/contact" className="btn btn-primary btn-sm">Contact us</Link>
    </LegalPage>
  );
}

export function Contact() {
  const { settings } = useApp();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/contact', form); setDone(true); }
    catch (err) { setError(formatError(err)); } finally { setBusy(false); }
  };

  return (
    <div className="container section container-narrow">
      <PageMeta title="Contact Us" description="Contact the VidyaPariksha team with questions, feedback or support requests." />
      <h2 className="mb-1">Contact us</h2>
      <p className="muted mb-3">Send a message and it will be stored for the support team. We do not display a success message unless your message has actually been saved.</p>
      <div className="grid grid-2-sm" style={{ alignItems: 'start' }}>
        <Card className="card-pad">
          {done ? <div className="center" style={{ padding: 20 }}><CheckCircle2 size={36} style={{ color: 'var(--success)' }} /><h3 className="mt-2">Message received</h3><p className="small muted">Your message has been saved and queued for review. Thank you for contacting us.</p><Button variant="outline" onClick={() => { setDone(false); setForm({ name: '', email: '', subject: '', message: '' }); }}>Send another message</Button></div> : (
            <form onSubmit={submit}>
              {error && <div className="mb-2"><Notice kind="danger">{error}</Notice></div>}
              <Field label="Your name" htmlFor="c-name"><input id="c-name" className="input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email address" htmlFor="c-email"><input id="c-email" className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Subject" htmlFor="c-subject"><input id="c-subject" className="input" required minLength={3} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
              <Field label="Message" htmlFor="c-message"><textarea id="c-message" className="textarea" required minLength={10} rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
              <Button type="submit" loading={busy}><Send size={16} /> Send message</Button>
            </form>
          )}
        </Card>
        <Card className="card-pad">
          <h3 style={{ fontSize: '1rem' }}>Other ways to reach us</h3>
          <div className="grid" style={{ gap: 12, marginTop: 12 }}>
            {settings.contact_email && <div className="row" style={{ gap: 10 }}><Mail size={18} style={{ color: 'var(--secondary)' }} /><span className="small">{settings.contact_email}</span></div>}
            {settings.contact_phone && <div className="row" style={{ gap: 10 }}><MessageSquare size={18} style={{ color: 'var(--secondary)' }} /><span className="small">{settings.contact_phone}</span></div>}
            {settings.address && <div className="row" style={{ gap: 10 }}><MapPin size={18} style={{ color: 'var(--secondary)' }} /><span className="small">{settings.address}</span></div>}
          </div>
          <div className="mt-3"><Link to="/help" className="btn btn-outline btn-sm"><HelpCircle size={15} /> Visit Help Center</Link></div>
          <p className="tiny muted mt-3 mb-0">Please do not send passwords or sensitive personal information by email.</p>
        </Card>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" description="How VidyaPariksha collects, uses and protects your data.">
      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> name, email address and optionally a mobile number. Passwords are stored only as salted scrypt hashes.</li>
        <li><strong>Learning data:</strong> test attempts, selected answers, timing, results, bookmarks and questions you report.</li>
        <li><strong>Technical data:</strong> a session cookie, IP address and user agent for security, rate limiting and audit logs. We do not use third-party advertising trackers.</li>
      </ul>
      <h2>Guest sessions</h2>
      <p>If guest testing is enabled, a server-side guest session is created and linked to a session cookie. Attempts taken as a guest are stored on the server and can be claimed when you register or sign in on the same device. Guest data is not accessible from other devices.</p>
      <h2>How we use information</h2>
      <p>We use your data to deliver examinations, calculate results, produce analytics you can see, prevent abuse and improve the platform. Administrative audit logs record actions such as content edits and do not contain passwords or tokens.</p>
      <h2>Your choices</h2>
      <p>You can review your results and bookmarks in your account, update your profile, or delete your account from the Profile page. Deleting an account removes personal data and anonymises submitted attempt records so aggregate statistics remain consistent.</p>
      <h2>Data retention and security</h2>
      <p>Sessions expire automatically. Access to administrative functions is protected by server-side role checks. We recommend HTTPS in production, strong administrator credentials and regular database backups. No online service can guarantee absolute security.</p>
      <h2>Contact</h2>
      <p>For privacy requests, use the <Link to="/contact">contact page</Link>. You can also read our <Link to="/cookie-policy">Cookie Policy</Link>.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms and Conditions" description="Terms of use for the VidyaPariksha practice platform.">
      <h2>Using the platform</h2>
      <p>VidyaPariksha is a practice tool, not an official examination portal. It is not affiliated with any government examination authority, board, publisher or coaching organisation unless explicitly stated by the site administrator.</p>
      <h2>Practice content</h2>
      <p>Demo questions installed with the software are original practice content. Questions marked “verified previous year” are only those explicitly reviewed and labelled as such by an administrator. You should always verify important information against official sources.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to gain unauthorised access to administrative functions or other users’ data.</li>
        <li>Do not upload content you do not have the right to use.</li>
        <li>Do not interfere with the examination infrastructure or automated scoring.</li>
      </ul>
      <h2>Accounts</h2>
      <p>You are responsible for keeping your credentials secure. Administrators may suspend accounts that violate these terms. Password resets invalidate existing sessions.</p>
      <h2>Disclaimer of warranties</h2>
      <p>The platform is provided for practice purposes. While scoring, timers and analytics are computed from stored data, we do not warrant that practice performance predicts results in any actual examination. See the <Link to="/disclaimer">Disclaimer</Link>.</p>
      <h2>Changes</h2>
      <p>These terms may be updated as the platform evolves. The date at the top of this page indicates the latest revision.</p>
    </LegalPage>
  );
}

export function CookiePolicy() {
  return (
    <LegalPage title="Cookie Policy" description="The cookies and local storage used by VidyaPariksha.">
      <h2>Essential cookies</h2>
      <ul>
        <li><code>vp_session</code> — an HTTP-only session cookie used to authenticate you or link your guest attempts. Expires automatically.</li>
        <li><code>vp_csrf</code> — a readable token used for the double-submit CSRF check on state-changing requests.</li>
      </ul>
      <p>These cookies are required for the service to work and cannot be disabled from within the application.</p>
      <h2>Local storage &amp; service worker cache</h2>
      <p>The Progressive Web App caches static assets for faster loading. Private API responses are not cached by the service worker. A small amount of pending answer state is held in memory while you answer questions so it can be retried if the connection drops; the server remains the source of truth.</p>
      <h2>What we do not use</h2>
      <p>We do not use advertising cookies, cross-site tracking pixels or third-party analytics scripts in the base installation.</p>
    </LegalPage>
  );
}

export function Disclaimer() {
  const { settings } = useApp();
  return (
    <LegalPage title="Disclaimer" description="Important limitations of the VidyaPariksha practice platform.">
      <p>{settings.disclaimer || 'Demo content on this site consists of original practice questions. It is not affiliated with any examination authority or publisher.'}</p>
      <h2>Not an official examination</h2>
      <p>Tests on this platform are practice simulations. They are not conducted by, endorsed by, or connected to any official examining body. Always rely on official notifications for exam dates, patterns, syllabi and results.</p>
      <h2>Content accuracy</h2>
      <p>Question authors and administrators are responsible for the accuracy of imported content. Students can report suspected errors through the “Report issue” control inside a test. Reports are reviewed but do not change past scores automatically.</p>
      <h2>Technical limitations</h2>
      <p>We cannot completely prevent tab switching, screen capture, browser closure or device shutdown. Full-screen mode is optional and supported only where the browser permits it. Examinations require a server connection for authoritative scoring; extended disconnection may cause answers saved only locally to be lost if they cannot be synchronised before the deadline.</p>
      <h2>No performance guarantees</h2>
      <p>We do not publish unsupported claims about selection rates or guaranteed score improvements. Analytics describe your past attempts only.</p>
    </LegalPage>
  );
}

export function Help() {
  const faqs = [
    { q: 'Do I need an account to take a test?', a: 'When guest testing is enabled by the administrator, you can start permitted tests without registering. Signing in claims your guest attempts and keeps progress across devices.' },
    { q: 'What happens if I refresh the page during an exam?', a: 'With the default resume policy the same attempt continues with its original server deadline. The timer never restarts on refresh. Your saved answers are restored from the server.' },
    { q: 'What happens when the timer ends?', a: 'The server stores a deadline when the test starts. At expiry the attempt is finalised automatically using the answers that were successfully saved. Repeated submissions do not create extra results.' },
    { q: 'Can I change my answers after submitting?', a: 'No. Once an attempt is submitted or expired, answer modification is blocked and the result is calculated on the server.' },
    { q: 'Why is Hindi not offered for some tests?', a: 'A language is offered only when enough translated questions exist for that selection. Untranslated questions are never silently substituted.' },
    { q: 'How is my score calculated?', a: 'Correct answers earn the configured marks, incorrect answers lose the configured negative marks, and unanswered questions score zero. Accuracy is correct answers divided by attempted questions. All of this is computed on the server.' },
    { q: 'Is the exam fully offline?', a: 'No. Static assets may be cached, but question delivery, answer saving and scoring require the server. If the connection drops, the interface warns you and retries synchronisation.' },
    { q: 'How do I report a wrong answer key?', a: 'Use the “Report issue” button under a question during a test. Content managers review reports in the Admin Panel.' },
  ];
  return (
    <div className="container section container-narrow">
      <PageMeta title="Help Center" description="Answers to common questions about taking mock tests on VidyaPariksha." />
      <h2 className="mb-1">Help Center</h2>
      <p className="muted mb-3">A practical guide to the examination workflow and account features.</p>
      <div className="grid grid-2-sm mb-3">
        {[
          { icon: BookOpen, title: '1. Choose a collection', text: 'Open Exam Categories or Books, then pick a collection with published questions.' },
          { icon: Layers, title: '2. Select subject & topic', text: 'Options update from the database. Incompatible topic selections reset automatically.' },
          { icon: Clock3, title: '3. Configure & start', text: 'Choose mode, question count, duration and language. The timer starts only after confirmation.' },
          { icon: FileQuestion, title: '4. Attempt & review', text: 'Use Save & Next, Mark for Review and the palette. Submit to see your server-calculated result.' },
        ].map((s) => <Card className="card-pad" key={s.title}><s.icon size={20} style={{ color: 'var(--secondary)' }} /><h3 style={{ fontSize: '.98rem', marginTop: 8 }}>{s.title}</h3><p className="small muted mb-0">{s.text}</p></Card>)}
      </div>
      <h3 className="mb-2">Frequently asked questions</h3>
      <div className="grid" style={{ gap: 10 }}>
        {faqs.map((f) => <Card className="card-pad" key={f.q}><strong className="small">{f.q}</strong><p className="small muted mb-0" style={{ marginTop: 6 }}>{f.a}</p></Card>)}
      </div>
      <Card className="card-pad mt-3"><div className="row" style={{ gap: 12 }}><ShieldCheck size={22} style={{ color: 'var(--accent)' }} /><div><strong>Still need help?</strong><p className="small muted mb-0">Use the <Link to="/contact">contact page</Link> to send a message to the support team.</p></div></div></Card>
      <Card className="card-pad mt-2"><div className="row" style={{ gap: 12 }}><Smartphone size={22} style={{ color: 'var(--secondary)' }} /><div><strong>Mobile tip</strong><p className="small muted mb-0">On phones, tap the palette icon in the exam header to open the question navigator. All exam controls stay visible at the bottom of the screen.</p></div></div></Card>
    </div>
  );
}

export function SitemapPage() {
  const groups = [
    { title: 'Practice', links: [{ to: '/exams', label: 'Exam Categories' }, { to: '/books', label: 'Books & Collections' }, { to: '/tests', label: 'All Tests' }, { to: '/help', label: 'Help Center' }] },
    { title: 'Account', links: [{ to: '/dashboard', label: 'Dashboard' }, { to: '/my-results', label: 'My Results' }, { to: '/my-progress', label: 'My Progress' }, { to: '/bookmarks', label: 'Bookmarks' }, { to: '/revision', label: 'Revision List' }, { to: '/profile', label: 'Profile' }, { to: '/settings', label: 'Settings' }] },
    { title: 'Information', links: [{ to: '/about', label: 'About Us' }, { to: '/contact', label: 'Contact Us' }, { to: '/privacy-policy', label: 'Privacy Policy' }, { to: '/terms', label: 'Terms & Conditions' }, { to: '/cookie-policy', label: 'Cookie Policy' }, { to: '/disclaimer', label: 'Disclaimer' }] },
  ];
  return (
    <div className="container section container-narrow">
      <PageMeta title="Sitemap" description="All public pages on VidyaPariksha." />
      <h2 className="mb-3">Sitemap</h2>
      <div className="grid grid-2-sm">
        {groups.map((g) => <Card className="card-pad" key={g.title}><h3 style={{ fontSize: '1rem', marginBottom: 10 }}>{g.title}</h3>{g.links.map((l) => <Link key={l.to} to={l.to} className="small" style={{ display: 'block', padding: '5px 0' }}>{l.label}</Link>)}</Card>)}
      </div>
      <p className="tiny muted mt-3">A machine-readable <a href="/sitemap.xml">XML sitemap</a> is also generated from actual published records.</p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container section">
      <PageMeta title="Page Not Found" />
      <EmptyState title="404 — Page not found" description="The page you requested does not exist or may have been moved." icon={<HelpCircle size={36} />}
        action={<div className="btn-group" style={{ justifyContent: 'center' }}><Link to="/" className="btn btn-primary">Go home</Link><Link to="/tests" className="btn btn-outline">Browse tests</Link></div>} />
    </div>
  );
}
