import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, setPassword, changePassword } from '../services/endpoints';
import { useNavigate } from 'react-router-dom';





const Settings = () => {
  const { companyProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();



  /* Profile */
  const [formData, setFormData] = useState({ company_name: '', full_name: '', industry: 'Technology', team_size: '11-50' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  /* Screening */
  const [screeningThreshold, setScreeningThreshold] = useState(
    parseInt(localStorage.getItem('screeningThreshold') || '50', 10)
  );

  /* Password */
  const [pwData, setPwData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  // has_password is detected from profile or localStorage
  const hasPassword = companyProfile?.has_password ?? false;

  useEffect(() => {
    if (companyProfile) {
      setFormData({
        company_name: companyProfile.company_name || '',
        full_name: companyProfile.full_name || '',
        industry: companyProfile.industry || 'Technology',
        team_size: companyProfile.team_size || '11-50',
      });
    }
  }, [companyProfile]);



  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError(null);
    setProfileLoading(true);
    setProfileSuccess(false);
    try {
      await updateProfile({
        company_name: formData.company_name.trim(),
        full_name: formData.full_name.trim(),
        industry: formData.industry,
        team_size: formData.team_size,
      });
      await refreshProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveScreening = () => {
    localStorage.setItem('screeningThreshold', screeningThreshold);
    alert(`Screening threshold saved: ${screeningThreshold}%\n\nNote: This is a frontend preference. To change the backend threshold, edit apply.py.`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your workspace, appearance, and preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>


        {/* ─── Workspace Profile ─── */}
        <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>Workspace Profile</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Update your company info and recruiter details</p>
          </div>

          {profileError && <div className="auth-error" style={{ marginBottom: '16px' }}>{profileError}</div>}
          {profileSuccess && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '0.85rem', marginBottom: '16px' }}>
              ✓ Profile saved successfully
            </div>
          )}

          <form onSubmit={handleProfileSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Company Name</label>
                <input type="text" className="form-input" value={formData.company_name}
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  disabled={profileLoading} required id="settings-company-name" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Your Full Name</label>
                <input type="text" className="form-input" value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  disabled={profileLoading} id="settings-full-name" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Industry</label>
                <select className="form-input" value={formData.industry}
                  onChange={e => setFormData({ ...formData, industry: e.target.value })}
                  disabled={profileLoading} id="settings-industry"
                  style={{ background: 'var(--bg-input)' }}>
                  <option value="Technology">Technology & Software</option>
                  <option value="Finance">Finance & Banking</option>
                  <option value="Health Care">Healthcare & Biotech</option>
                  <option value="Education">Education & E-learning</option>
                  <option value="Professional Services">Professional Services</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Team Size</label>
                <select className="form-input" value={formData.team_size}
                  onChange={e => setFormData({ ...formData, team_size: e.target.value })}
                  disabled={profileLoading} id="settings-team-size"
                  style={{ background: 'var(--bg-input)' }}>
                  <option value="1-10">1–10 employees</option>
                  <option value="11-50">11–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-500">201–500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={profileLoading} id="settings-save-profile">
              {profileLoading ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </section>

        {/* ─── Recruitment Preferences ─── */}
        <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>Recruitment Preferences</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tune AI screening and interview behaviour</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ marginBottom: '4px' }}>
              Resume screening threshold — <strong style={{ color: 'var(--primary-light)' }}>{screeningThreshold}%</strong>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Candidates scoring at or above this threshold are shortlisted for an interview.
            </p>
            <input
              type="range" min="30" max="90" step="5"
              value={screeningThreshold}
              onChange={e => setScreeningThreshold(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
              id="screening-threshold-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>30% (lenient)</span><span>90% (strict)</span>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={handleSaveScreening} id="save-screening-btn">
            Save preference
          </button>
        </section>

        {/* ─── Password & Security ─── */}
        <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '3px' }}>Password &amp; Security</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {hasPassword ? 'Change your existing password.' : 'Set a password so you can also sign in with email.'}
            </p>
          </div>

          {pwError && <div className="auth-error" style={{ marginBottom: '14px' }}>{pwError}</div>}
          {pwSuccess && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '0.85rem', marginBottom: '16px' }}>
              ✓ Password saved successfully
            </div>
          )}

          <form onSubmit={async (e) => {
            e.preventDefault();
            setPwError(null);
            setPwSuccess(false);
            if (pwData.new_password.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
            if (pwData.new_password !== pwData.confirm_password) { setPwError('Passwords do not match.'); return; }
            setPwLoading(true);
            try {
              if (hasPassword) {
                await changePassword({ current_password: pwData.current_password, new_password: pwData.new_password });
              } else {
                await setPassword(pwData.new_password);
              }
              setPwSuccess(true);
              setPwData({ current_password: '', new_password: '', confirm_password: '' });
              await refreshProfile();
              setTimeout(() => setPwSuccess(false), 3000);
            } catch (err) {
              setPwError(err.response?.data?.error || 'Failed to save password.');
            } finally {
              setPwLoading(false);
            }
          }}>
            {hasPassword && (
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input
                  type="password" className="form-input"
                  placeholder="Your current password"
                  value={pwData.current_password}
                  onChange={e => setPwData({ ...pwData, current_password: e.target.value })}
                  disabled={pwLoading}
                  id="settings-current-pw"
                />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{hasPassword ? 'New password' : 'Password'}</label>
                <input
                  type="password" className="form-input"
                  placeholder="Min. 8 characters"
                  value={pwData.new_password}
                  onChange={e => setPwData({ ...pwData, new_password: e.target.value })}
                  disabled={pwLoading}
                  id="settings-new-pw"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Confirm password</label>
                <input
                  type="password" className="form-input"
                  placeholder="Re-enter password"
                  value={pwData.confirm_password}
                  onChange={e => setPwData({ ...pwData, confirm_password: e.target.value })}
                  disabled={pwLoading}
                  id="settings-confirm-pw"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={pwLoading || !pwData.new_password} id="settings-save-pw">
              {pwLoading ? 'Saving...' : hasPassword ? 'Change password' : 'Set password'}
            </button>
          </form>
        </section>

        {/* ─── Danger Zone ─── */}
        <section style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ borderBottom: '1px solid rgba(239,68,68,0.15)', paddingBottom: '14px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--danger)', marginBottom: '3px' }}>Account</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Session and account management</p>
          </div>
          <button
            className="btn"
            style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
            onClick={handleLogout}
            id="settings-logout-btn"
          >
            Sign out of workspace
          </button>
        </section>

      </div>
    </div>
  );
};

/* Reusable toggle row */
const ToggleRow = ({ label, description, checked, onChange, id }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
    <div>
      <div style={{ fontSize: '0.88rem', fontWeight: '500', color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>
    </div>
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
        background: checked ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: checked ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  </div>
);

export default Settings;
