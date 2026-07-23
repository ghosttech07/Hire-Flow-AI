import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { registerCompany, verifyOtp, resendOtp, googleAuth } from '../services/endpoints';
import { useAuth } from '../context/AuthContext';
import SetPasswordModal from '../components/SetPasswordModal';

const Register = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('register'); // 'register' | 'otp'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    company_name: '',
    full_name: '',
    otp: ''
  });

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true);
    setError(null);
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
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled. Please try again.');
    setGoogleLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerCompany({
        email: formData.email,
        password: formData.password,
        company_name: formData.company_name,
        full_name: formData.full_name
      });
      setStep('otp');
    } catch (err) {
      const msg = err.response?.data?.error || (err.message === 'Network Error' ? 'Network error: Unable to connect to backend server. Check VITE_API_URL in Vercel settings.' : err.message) || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await verifyOtp({ email: formData.email, otp: formData.otp });
      login(res.token, res.company_id, res.company_name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      await resendOtp({ email: formData.email });
      setSuccessMsg('OTP resent to your email.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP.');
    }
  };

  return (
    <div className="auth-page">
      {showSetPassword && (
        <SetPasswordModal onDone={() => { setShowSetPassword(false); navigate('/dashboard'); }} />
      )}
      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo-row">
          <div className="hf-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
            </svg>
          </div>
          <span className="hf-logo-text">HireFlow AI</span>
        </div>

        {/* Welcome */}
        <div className="auth-welcome">
          <h1>{step === 'register' ? 'Create account' : 'Verify email'}</h1>
          <p>
            {step === 'register'
              ? 'Set up your recruiter workspace in seconds'
              : `Enter the 6-digit code sent to ${formData.email}`}
          </p>
        </div>

        <div className="auth-card">
          {/* Step indicator */}
          <div className="step-indicator" style={{ marginBottom: '24px' }}>
            <div className={`step-indicator-dot ${step === 'register' ? 'active' : 'completed'}`}>1</div>
            <div className={`step-indicator-dot ${step === 'otp' ? 'active' : ''}`}>2</div>
          </div>

          {error && <div className="auth-error">{error}</div>}
          {successMsg && <div className="auth-success">{successMsg}</div>}

          {step === 'register' ? (
            <>
              {/* ── Google Sign-In ── */}
              <div className="google-btn-wrapper" style={{ marginBottom: '18px' }}>
                {googleLoading ? (
                  <div className="google-btn-loading">
                    <span className="google-btn-spinner" />
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
                    text="signup_with"
                    shape="rectangular"
                    logo_alignment="left"
                  />
                )}
              </div>

              <div className="auth-divider" style={{ margin: '0 0 18px' }}>
                <div className="auth-divider-line" />
                <span className="auth-divider-text">or register with email</span>
                <div className="auth-divider-line" />
              </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label className="form-label">Company name</label>
                <input
                  type="text"
                  name="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Acme Corp"
                  disabled={loading}
                  id="reg-company"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Full name</label>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Alice Admin"
                  disabled={loading}
                  id="reg-fullname"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Work email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="alice@acme.com"
                  disabled={loading}
                  id="reg-email"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="••••••••"
                  disabled={loading}
                  id="reg-password"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }}
                disabled={loading}
                id="reg-submit"
              >
                {loading ? 'Sending OTP...' : 'Create account'}
              </button>
            </form>
            </>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Verification code</label>
                <input
                  type="text"
                  name="otp"
                  required
                  maxLength={6}
                  value={formData.otp}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="123456"
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '10px', fontWeight: '700' }}
                  disabled={loading}
                  id="otp-input"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px', marginBottom: '12px' }}
                disabled={loading}
                id="otp-verify"
              >
                {loading ? 'Verifying...' : 'Verify code'}
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setStep('register')}
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={handleResend}
                  disabled={loading}
                  id="resend-otp"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          <p className="auth-link-text" style={{ marginTop: '20px' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
