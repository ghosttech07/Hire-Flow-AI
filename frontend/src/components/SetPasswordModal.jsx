import React, { useState } from 'react';
import { setPassword } from '../services/endpoints';

/**
 * SetPasswordModal
 * Shown after a new Google sign-in so the user can also set a password
 * for email+password login. Can be dismissed (password set later in Settings).
 */
const SetPasswordModal = ({ onDone }) => {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [show, setShow] = useState(true);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (pw.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (pw !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setPassword(pw);
      setShow(false);
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setShow(false);
    onDone?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        animation: 'modalSlideIn 0.25s ease',
      }}>
        {/* Icon */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'var(--primary-bg)', border: '1px solid var(--primary-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Set a password
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: '1.5' }}>
          You signed in with Google. Optionally set a password so you can also log in with your email directly anytime.
        </p>

        {error && (
          <div className="auth-error" style={{ marginBottom: '14px' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Min. 8 characters"
              value={pw}
              onChange={e => setPw(e.target.value)}
              disabled={loading}
              autoFocus
              id="set-pw-field"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '22px' }}>
            <label className="form-label">Confirm password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Re-enter password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              disabled={loading}
              id="set-pw-confirm"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginBottom: '10px' }}
            disabled={loading || !pw || !confirm}
            id="set-pw-submit"
          >
            {loading ? 'Setting password...' : 'Set password & continue'}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            style={{
              width: '100%', padding: '10px', background: 'transparent',
              border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
            id="set-pw-skip"
          >
            Skip for now — I'll set it later in Settings
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetPasswordModal;
