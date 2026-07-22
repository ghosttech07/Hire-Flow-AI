import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import {
  loginCompany,
  registerCompany,
  verifyOtp,
  resendOtp,
  googleAuth,
} from '../services/endpoints';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SetPasswordModal from '../components/SetPasswordModal';

/* ── Small shared sub-components ────────────────────────────── */
const Label = ({ children }) => (
  <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
    {children}
  </label>
);

const Field = ({ label, ...props }) => (
  <div>
    <Label>{label}</Label>
    <input className="input-field" {...props} />
  </div>
);

const ErrorBanner = ({ msg }) => msg ? (
  <div style={{
    background: 'var(--danger-bg)', color: 'var(--danger-text)',
    border: '0.5px solid var(--danger-border)',
    padding: '10px 14px', borderRadius: 'var(--radius)',
    fontSize: '13px', lineHeight: '1.5',
  }}>
    {msg}
  </div>
) : null;

const SuccessBanner = ({ msg }) => msg ? (
  <div style={{
    background: 'var(--success-bg)', color: 'var(--success-text)',
    border: '0.5px solid var(--success-border)',
    padding: '10px 14px', borderRadius: 'var(--radius)',
    fontSize: '13px',
  }}>
    {msg}
  </div>
) : null;

const Divider = ({ text = 'or' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
    <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{text}</span>
    <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
  </div>
);

/* ── Left-panel feature bullets ─────────────────────────────── */
const FEATURES = [
  'Resume screening in under 20 seconds',
  'Personalised AI voice interviews',
  'Automatic offer & rejection emails',
];

/* ═══════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════ */
const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accentObj } = useTheme();

  const accent = accentObj || {
    gradient: 'linear-gradient(135deg,#7F77DD,#534AB7)',
    50: '#EEEDFE', 100: '#CECBF6', 600: '#534AB7', 800: '#3C3489',
  };

  // mode: 'login' | 'register' | 'otp'
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', company_name: '', full_name: '', otp: '' });
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'google_cancelled') setError('Google sign-in was cancelled.');
    if (err === 'google_failed')    setError('Google sign-in failed. Please try again.');
    if (err === 'no_email')         setError('No email was returned by Google.');
  }, [searchParams]);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));
  const switchMode = (m) => { setMode(m); setError(''); setSuccess(''); };

  /* Google popup flow */
  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true); setError('');
    try {
      const res = await googleAuth(credentialResponse.credential);
      login(res.token, res.company_id, res.company_name);
      if (res.is_new_user || res.has_password === false) {
        setShowSetPassword(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed. Please try again.');
    } finally { setGoogleLoading(false); }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed. Please try again.');
    setGoogleLoading(false);
  };

  /* Email login */
  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await loginCompany({ email: form.email, password: form.password });
      login(res.token, res.company_id, res.company_name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    } finally { setLoading(false); }
  };

  /* Registration */
  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await registerCompany({ email: form.email, password: form.password, company_name: form.company_name, full_name: form.full_name });
      switchMode('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  /* OTP */
  const handleOtp = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await verifyOtp({ email: form.email, otp: form.otp });
      login(res.token, res.company_id, res.company_name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setError(''); setSuccess('');
    try {
      await resendOtp({ email: form.email });
      setSuccess('A new code has been sent to your email.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP.');
    }
  };

  /* Google button block */
  const GoogleBlock = ({ text }) => (
    <>
      <div style={{ width: '100%' }}>
        {googleLoading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', padding: '11px', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: '14px',
          }}>
            <div className="spinner spinner-sm" />
            Connecting to Google...
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            theme="filled_black"
            size="large"
            width="100%"
            text={text}
            shape="rectangular"
            logo_alignment="left"
          />
        )}
      </div>
      <Divider text={`or ${mode === 'register' ? 'register' : 'sign in'} with email`} />
    </>
  );

  const headings = {
    login:    { h: 'Welcome back',    sub: 'Sign in to your recruiter account' },
    register: { h: 'Create account',  sub: 'Start automating your recruitment' },
    otp:      { h: 'Check your inbox', sub: `Enter the 6-digit code sent to ${form.email}` },
  };
  const { h: heading, sub } = headings[mode];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      {/* ── Left decorative panel (hidden on mobile) ── */}
      <div style={{
        display: 'none',
        background: accent.gradient,
        width: '45%',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left">
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-100px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '3.5rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '22px', fontWeight: '700' }}>H</span>
            </div>
            <span style={{ color: '#fff', fontSize: '20px', fontWeight: '600', letterSpacing: '-0.2px' }}>HireFlow AI</span>
          </div>

          <h1 style={{ color: '#fff', fontSize: '34px', fontWeight: '700', lineHeight: 1.2, marginBottom: '16px', letterSpacing: '-0.5px' }}>
            Hire smarter.<br />Move faster.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '15px', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '320px' }}>
            AI-powered recruitment that screens resumes, conducts voice interviews, and makes hiring decisions — automatically.
          </p>

          {/* Feature list */}
          {FEATURES.map((text) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
        {/* Set-password modal for new Google users */}
        {showSetPassword && (
          <SetPasswordModal onDone={() => { setShowSetPassword(false); navigate('/dashboard'); }} />
        )}

        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Logo mark (visible on mobile / right panel always) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: accent.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: '700', color: '#fff', fontSize: '18px',
            }}>H</div>
            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>HireFlow AI</span>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.4px' }}>
            {heading}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {sub}
          </p>

          {/* Card */}
          <div style={{
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            borderRadius: '16px',
            padding: '1.75rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            <ErrorBanner msg={error} />
            <SuccessBanner msg={success} />

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <>
                <GoogleBlock text="continue_with" />
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Field label="Email address" type="email" placeholder="you@company.com"
                    value={form.email} onChange={set('email')} required
                    disabled={loading || googleLoading} id="login-email" />
                  <Field label="Password" type="password" placeholder="••••••••"
                    value={form.password} onChange={set('password')} required
                    disabled={loading || googleLoading} id="login-password" />
                  <button type="submit" className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
                    disabled={loading || googleLoading} id="login-submit">
                    {loading ? 'Signing in…' : 'Sign in →'}
                  </button>
                </form>
                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  No account?{' '}
                  <span onClick={() => switchMode('register')}
                    style={{ color: 'var(--accent-600)', cursor: 'pointer', fontWeight: '600' }}>
                    Create one
                  </span>
                </p>
              </>
            )}

            {/* ── REGISTER ── */}
            {mode === 'register' && (
              <>
                <GoogleBlock text="signup_with" />
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="Full name" placeholder="Jane Smith"
                      value={form.full_name} onChange={set('full_name')} required
                      disabled={loading} id="reg-fullname" />
                    <Field label="Company" placeholder="Acme Corp"
                      value={form.company_name} onChange={set('company_name')} required
                      disabled={loading} id="reg-company" />
                  </div>
                  <Field label="Work email" type="email" placeholder="jane@acme.com"
                    value={form.email} onChange={set('email')} required
                    disabled={loading} id="reg-email" />
                  <Field label="Password" type="password" placeholder="Min 8 characters"
                    value={form.password} onChange={set('password')} required minLength={8}
                    disabled={loading} id="reg-password" />
                  <button type="submit" className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
                    disabled={loading || googleLoading} id="reg-submit">
                    {loading ? 'Creating account…' : 'Create account →'}
                  </button>
                </form>
                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Already registered?{' '}
                  <span onClick={() => switchMode('login')}
                    style={{ color: 'var(--accent-600)', cursor: 'pointer', fontWeight: '600' }}>
                    Sign in
                  </span>
                </p>
              </>
            )}

            {/* ── OTP ── */}
            {mode === 'otp' && (
              <>
                <div style={{
                  background: 'var(--accent-50)',
                  border: `0.5px solid var(--accent-100)`,
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px', fontSize: '13px',
                  color: 'var(--accent-800)', lineHeight: '1.6',
                }}>
                  We sent a 6-digit code to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>.{' '}
                  Check your inbox (and spam folder).
                </div>
                <form onSubmit={handleOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <Label>Verification code</Label>
                    <input
                      className="input-field"
                      placeholder="000000"
                      value={form.otp}
                      onChange={set('otp')}
                      maxLength={6} required
                      disabled={loading} id="otp-input"
                      style={{ textAlign: 'center', letterSpacing: '10px', fontSize: '22px', fontWeight: '600' }}
                    />
                  </div>
                  <button type="submit" className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
                    disabled={loading} id="otp-verify">
                    {loading ? 'Verifying…' : 'Verify and sign in →'}
                  </button>
                </form>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" style={{ flex: 1, padding: '10px' }}
                    onClick={() => switchMode('register')} disabled={loading}>
                    ← Back
                  </button>
                  <button className="btn-secondary" style={{ flex: 1, padding: '10px' }}
                    onClick={handleResend} disabled={loading} id="resend-otp">
                    Resend code
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Show left panel on wider screens */}
      <style>{`@media (min-width: 900px) { .login-left { display: flex !important; } }`}</style>
    </div>
  );
};

export default Login;
