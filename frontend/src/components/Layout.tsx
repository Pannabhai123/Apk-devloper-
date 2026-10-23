import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpenText, FolderOpen, History, LayoutDashboard, MapPin,
  Presentation, Settings, SlidersHorizontal, Sparkles, ServerOff,
} from 'lucide-react';
import { api } from '../api';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'My Projects', icon: FolderOpen },
  { to: '/generate', label: 'Generate PPT', icon: Presentation },
  { to: '/history', label: 'Presentation History', shortLabel: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const pageTitles: Record<string, [string, string]> = {
  '/': ['Dashboard', 'Your classroom, ready to present.'],
  '/projects': ['My Projects', 'Every PDF and question set in one place.'],
  '/generate': ['Generate PPT', 'Turn reviewed questions into a blackboard presentation.'],
  '/history': ['Presentation History', 'Re-download your generated classroom materials.'],
  '/settings': ['Settings', 'Classroom defaults and server capabilities.'],
};

export default function Layout() {
  const location = useLocation();
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => api.health().then(() => setOnline(true)).catch(() => setOnline(false));
    check();
    window.addEventListener('dream-api-changed', check);
    return () => window.removeEventListener('dream-api-changed', check);
  }, []);
  const title = location.pathname.startsWith('/projects/')
    ? ['Project workspace', 'Review, design, and export your presentation.']
    : pageTitles[location.pathname] || pageTitles['/'];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Dream Classes home">
          <span className="brand-mark"><BookOpenText size={23} strokeWidth={2.2} /></span>
          <span><strong>Dream Classes</strong><small>PPT MAKER <b>AI</b></small></span>
        </NavLink>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="main-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <span className="tip-icon"><Sparkles size={17} /></span>
          <strong>Made for your classroom</strong>
          <p>From PDF to blackboard-ready slides in a few careful steps.</p>
        </div>
        <div className="teacher-card">
          <div className="avatar">DS</div>
          <div><strong>Dream Sir</strong><span><MapPin size={11} /> Gaya, Bihar</span></div>
          <NavLink to="/settings" aria-label="Teacher settings"><SlidersHorizontal size={16} /></NavLink>
        </div>
        <div className={`server-status ${online === false ? 'offline' : ''}`}>
          <i /> {online === null ? 'Checking backend…' : online ? 'Backend connected' : 'Backend unavailable'}
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <h1>{title[0]}</h1>
            <p>{title[1]}</p>
          </div>
          <div className="topbar-profile">
            <span className="location-pill"><MapPin size={14} /> Kothwara, Dobhi</span>
            <NavLink to="/settings" className="avatar small" aria-label="Open settings">DS</NavLink>
          </div>
        </header>
        {online === false && <div className="connection-banner"><ServerOff size={18} /><div><strong>Backend not connected</strong><span>Uploads and PPT generation need your Dream Classes server.</span></div><NavLink to="/settings" className="button primary small">Connect backend</NavLink></div>}
        <main className="page-content"><Outlet /></main>
      </div>

      <nav className="mobile-nav">
        {navigation.map(({ to, label, shortLabel, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={20} /><span>{shortLabel || label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
