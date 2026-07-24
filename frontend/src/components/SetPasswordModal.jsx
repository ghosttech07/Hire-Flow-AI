import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { setPassword } from '../services/endpoints';

/**
 * SetPasswordModal
 * Rendered via createPortal at body root for pristine modal stacking,
 * high-contrast readability, interactive password visibility toggles,
 * and modern dark glassmorphism aesthetic.
 */
const SetPasswordModal = ({ onDone }) => {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [show, setShow] = useState(true);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (pw.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (pw !== confirm) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await setPassword(pw);
      setShow(false);
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setShow(false);
    onDone?.();
  };

  /* Eye & Eye-Off SVGs */
  const EyeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
      background: 'rgba(5, 7, 15, 0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#121422',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '36px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15)',
        color: '#FFFFFF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}>
        {/* Header Icon */}
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.3))',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Titles */}
        <h2 style={{
          fontSize: '22px',
          fontWeight: '700',
          color: '#FFFFFF',
          margin: '0 0 8px 0',
          letterSpacing: '-0.3px'
        }}>
          Set a password
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.7)',
          margin: '0 0 24px 0',
          lineHeight: '1.5'
        }}>
          You signed in with Google. Optionally set a password so you can also log in with your email directly anytime.
        </p>

        {/* Error Banner */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            lineHeight: '1.4',
            marginBottom: '18px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* New Password Field */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '6px'
            }}>
              New password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={pw}
                onChange={e => setPw(e.target.value)}
                disabled={loading}
                autoFocus
                id="set-pw-field"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 14px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#818cf8'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: showPw ? '#818cf8' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s',
                }}
                title={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '6px'
            }}>
              Confirm password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPw ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                disabled={loading}
                id="set-pw-confirm"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 14px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = '#818cf8'}
                onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: showConfirmPw ? '#818cf8' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s',
                }}
                title={showConfirmPw ? 'Hide password' : 'Show password'}
              >
                {showConfirmPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !pw || !confirm}
            id="set-pw-submit"
            style={{
              width: '100%',
              padding: '13px',
              marginTop: '6px',
              background: loading || !pw || !confirm
                ? 'rgba(99, 102, 241, 0.35)'
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || !pw || !confirm ? 'not-allowed' : 'pointer',
              boxShadow: loading || !pw || !confirm ? 'none' : '0 4px 14px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? 'Setting password...' : 'Set password & continue →'}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            id="set-pw-skip"
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
          >
            Skip for now — I'll set it later in Settings
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SetPasswordModal;
