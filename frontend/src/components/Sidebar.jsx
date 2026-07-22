import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SettingsPanel from './SettingsPanel';

/* ── Icon set ───────────────────────────────────────────────── */
const IconJobs = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);
const IconCandidates = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconAnalytics = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconAppearance = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/* ── Nav items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { to: '/dashboard/jobs',       label: 'Jobs',       Icon: IconJobs,       id: 'nav-jobs' },
  { to: '/dashboard/candidates', label: 'Candidates', Icon: IconCandidates, id: 'nav-candidates' },
  { to: '/dashboard/analytics',  label: 'Analytics',  Icon: IconAnalytics,  id: 'nav-analytics' },
  { to: '/dashboard/settings',   label: 'Settings',   Icon: IconSettings,   id: 'nav-settings' },
];

const Sidebar = () => {
  const { companyName, companyProfile, logout } = useAuth();
  const { accentObj } = useTheme();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  const fullName = companyProfile?.full_name || companyName || 'Recruiter';
  const company  = companyProfile?.company_name || companyName || '';
  const initials = fullName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="hf-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="hf-logo-text">HireFlow AI</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, Icon, id }) => (
            <NavLink
              key={to}
              to={to}
              id={id}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon"><Icon /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer area */}
        <div className="sidebar-footer">
          {/* Appearance button */}
          <button
            id="open-appearance-btn"
            onClick={() => setShowSettings(true)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px',
              borderRadius: 'var(--radius)',
              background: 'transparent',
              color: 'var(--sidebar-text)',
              fontSize: '13px', fontWeight: '400', border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: '4px',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--sidebar-text)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ opacity: 0.7, display: 'flex' }}><IconAppearance /></span>
            Appearance
          </button>

          {/* User row */}
          <div
            className="user-info"
            title="Click to sign out"
            style={{ cursor: 'default' }}
          >
            <div className="user-avatar"
              style={{ background: accentObj ? accentObj.gradient : 'var(--gradient-primary)' }}
            >
              {initials}
            </div>
            <div className="user-details">
              <div className="user-name">{fullName}</div>
              {company && <div className="user-company">{company}</div>}
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--sidebar-text)', padding: '4px',
                borderRadius: '4px', display: 'flex', alignItems: 'center',
                marginLeft: 'auto', flexShrink: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#FF6B6B'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--sidebar-text)'; }}
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  );
};

export default Sidebar;
