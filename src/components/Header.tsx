import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { SITE } from '../data/app';
import { getTheme, setTheme } from '../lib/storage';

export default function Header() {
  const [theme, setThemeState] = useState(getTheme());
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    setThemeState(next);
  };
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="होम पेज / Home">
            <span className="brand-logo" aria-hidden="true">ALP</span>
            <span className="brand-text">
              <span className="brand-title">{SITE.title}</span>
              <span className="brand-sub">{SITE.subtitle}</span>
            </span>
          </Link>
          <button className="theme-toggle" onClick={toggle} aria-label="थीम बदलें / Toggle dark mode" title="Light / Dark">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label="मुख्य मेनू / Main menu">
        <div className="nav-inner">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>होम / Home</NavLink>
          <NavLink to="/tests" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>सभी मॉक टेस्ट / All Tests</NavLink>
          <NavLink to="/progress" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>मेरे परिणाम / My Results</NavLink>
          <NavLink to="/practice" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>गणित अभ्यास / Practice</NavLink>
          <NavLink to="/formulas" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>फॉर्मूला / Formulas</NavLink>
          <NavLink to="/bookmarks" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>बुकमार्क</NavLink>
          <NavLink to="/revision" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>रिवीज़न</NavLink>
        </div>
      </nav>
    </>
  );
}
