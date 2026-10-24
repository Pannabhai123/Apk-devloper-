import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, UserRound, LogOut, LayoutDashboard, ShieldCheck, ChevronRight, Mail, MapPin, Phone } from 'lucide-react';
import { Brand, BrandMark } from './Brand';
import { SearchBox } from './SearchBox';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/exams/competitive-exams', label: 'Competitive Exams' },
  { to: '/exams/railway-exams', label: 'Railway Exams' },
  { to: '/exams/ssc-exams', label: 'SSC Exams' },
  { to: '/exams/lucent-books', label: 'Lucent GK' },
  { to: '/exams/current-affairs', label: 'Current Affairs' },
  { to: '/exams/bihar-board', label: 'Board Exams' },
  { to: '/exams/computer-tests', label: 'Computer Tests' },
  { to: '/tests', label: 'Practice Tests' },
  { to: '/my-progress', label: 'My Progress' },
  { to: '/contact', label: 'Contact' },
];

function Header() {
  const [drawer, setDrawer] = useState(false);
  const { user, setUser, settings } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const location = useLocation();

  const logout = async () => {
    try { await api.post('/auth/logout'); setUser(null); toast('Signed out successfully.', 'success'); nav('/'); }
    catch (err) { toast((err as Error).message, 'error'); }
    finally { setDrawer(false); }
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {NAV.slice(0, 9).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}>{item.label}</NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <div style={{ width: 'min(230px, 22vw)', display: location.pathname === '/' ? 'none' : undefined }} className="hide-mobile">
            <SearchBox placeholder="Search…" />
          </div>
          {user ? (
            <>
              <Link to="/dashboard" className="btn btn-ghost btn-sm hide-mobile"><LayoutDashboard size={16} /> Dashboard</Link>
              {user.permissions.length > 0 && <Link to="/admin" className="btn btn-ghost btn-sm hide-mobile"><ShieldCheck size={16} /> Admin</Link>}
              <button className="btn btn-ghost btn-icon btn-sm hide-mobile" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
              <Link to="/profile" className="btn btn-outline btn-sm" style={{ maxWidth: 150 }}><UserRound size={15} /><span className="truncate">{user.name}</span></Link>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">Sign in</Link>
          )}
          <button className="btn btn-outline btn-icon menu-toggle" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}><Menu size={20} /></button>
        </div>
      </div>
      {drawer && (
        <div className="mobile-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
          <div className="drawer-panel">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <Brand /><button className="btn btn-ghost btn-icon" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 12 }}><SearchBox onNavigate={() => setDrawer(false)} /></div>
            <nav aria-label="Mobile navigation">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setDrawer(false)} className={({ isActive }) => isActive ? 'active' : ''}>
                  <ChevronRight size={16} /> {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="drawer-divider" />
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setDrawer(false)}><LayoutDashboard size={17} /> My Dashboard</Link>
                <Link to="/my-results" onClick={() => setDrawer(false)}>My Results</Link>
                <Link to="/bookmarks" onClick={() => setDrawer(false)}>Bookmarks</Link>
                <Link to="/profile" onClick={() => setDrawer(false)}><UserRound size={17} /> Profile</Link>
                {user.permissions.length > 0 && <Link to="/admin" onClick={() => setDrawer(false)}><ShieldCheck size={17} /> Admin Panel</Link>}
                <button className="btn btn-outline btn-block mt-2" onClick={logout}><LogOut size={16} /> Sign out</button>
              </>
            ) : (
              <div className="grid grid-2" style={{ gap: 8 }}>
                <Link to="/login" className="btn btn-primary btn-block" onClick={() => setDrawer(false)}>Sign in</Link>
                {settings.allow_registration !== false && <Link to="/register" className="btn btn-outline btn-block" onClick={() => setDrawer(false)}>Register</Link>}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { settings } = useApp();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="row" style={{ gap: 9, marginBottom: 10 }}>
            <BrandMark size={34} />
            <strong style={{ color: '#fff', fontSize: '1.02rem' }}>VidyaPariksha</strong>
          </div>
          <p className="small" style={{ maxWidth: 330, color: '#A9BBD3' }}>
            {settings.footer_about || 'An independent online practice platform for realistic computer-based tests and honest performance analytics.'}
          </p>
          <div className="small" style={{ color: '#A9BBD3', marginTop: 12 }}>
            {settings.contact_email && <div className="row" style={{ gap: 7, marginBottom: 4 }}><Mail size={14} /> {settings.contact_email}</div>}
            {settings.contact_phone && <div className="row" style={{ gap: 7, marginBottom: 4 }}><Phone size={14} /> {settings.contact_phone}</div>}
            {settings.address && <div className="row" style={{ gap: 7 }}><MapPin size={14} /> {settings.address}</div>}
          </div>
        </div>
        <div>
          <h3>Practice</h3>
          <Link to="/exams">Exam Categories</Link>
          <Link to="/books">Books &amp; Collections</Link>
          <Link to="/tests">All Tests</Link>
          <Link to="/dashboard">My Dashboard</Link>
          <Link to="/my-progress">My Progress</Link>
        </div>
        <div>
          <h3>Company</h3>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact Us</Link>
          <Link to="/help">Help Center</Link>
          <Link to="/sitemap">Sitemap</Link>
          <Link to="/disclaimer">Disclaimer</Link>
        </div>
        <div>
          <h3>Legal</h3>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/cookie-policy">Cookie Policy</Link>
          <Link to="/profile">Account &amp; Data</Link>
        </div>
      </div>
      <div className="container footer-bottom row-between">
        <span>© {new Date().getFullYear()} {settings.site_name || 'VidyaPariksha'}. All rights reserved.</span>
        <span>{settings.disclaimer ? 'Independent practice platform · ' : ''}Made for learners in India.</span>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Header />
      <main id="main-content" tabIndex={-1} style={{ flex: 1 }}><Outlet /></main>
      <Footer />
    </div>
  );
}

export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="card card-pad center" style={{ maxWidth: 480, margin: '40px auto' }}>
      <h3>{message}</h3>
      <p className="small muted">Create a free account to save your progress across devices.</p>
      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <Link to="/login" className="btn btn-primary">Sign in</Link>
        <Link to="/register" className="btn btn-outline">Register</Link>
      </div>
    </div>
  );
}
