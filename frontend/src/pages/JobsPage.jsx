import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listJobs, createJob, parseJob, getDashboardStats, updateJobStatus, deleteJob } from '../services/endpoints';

/* ── Palette for job icon accents ─────────────────── */
const ACCENTS = [
  { bg: 'linear-gradient(135deg,#7F77DD22,#534AB711)', color: '#7F77DD', dot: '#7F77DD' },
  { bg: 'linear-gradient(135deg,#1D9E7522,#0F6E5611)', color: '#1D9E75', dot: '#1D9E75' },
  { bg: 'linear-gradient(135deg,#D4890A22,#95510611)', color: '#D4890A', dot: '#D4890A' },
  { bg: 'linear-gradient(135deg,#D4537E22,#99355611)', color: '#D4537E', dot: '#D4537E' },
  { bg: 'linear-gradient(135deg,#378ADD22,#185FA511)', color: '#378ADD', dot: '#378ADD' },
];

const BriefcaseIcon = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12" y2="16"/>
  </svg>
);

const JobsPage = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ applicants: 0, shortlisted: 0, hired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [jdText, setJdText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingRef = useRef(null);

  const fetchAll = async () => {
    try {
      setLoading(true); setError(null);
      const [jobsRes, statsRes] = await Promise.allSettled([listJobs(), getDashboardStats()]);
      if (jobsRes.status === 'fulfilled' && jobsRes.value.success) setJobs(jobsRes.value.jobs || []);
      if (statsRes.status === 'fulfilled' && statsRes.value) {
        const s = statsRes.value;
        setStats({ applicants: s.applicants || 0, shortlisted: s.screening || 0, hired: s.offers || 0 });
      }
    } catch { setError('Failed to load jobs.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (parseLoading) {
      setLoadingStep(0);
      const t1 = setTimeout(() => setLoadingStep(1), 1400);
      const t2 = setTimeout(() => setLoadingStep(2), 2800);
      loadingRef.current = [t1, t2];
    } else { loadingRef.current?.forEach(clearTimeout); }
    return () => loadingRef.current?.forEach(clearTimeout);
  }, [parseLoading]);

  const loadingMessages = ['Analyzing job description…', 'Extracting skills & role…', 'Structuring details…'];

  const openModal = () => { setShowModal(true); setParsedData(null); setParseError(null); setPublishSuccess(false); setJdText(''); };
  const closeModal = () => { if (parseLoading || publishLoading) return; setShowModal(false); };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!jdText.trim()) return;
    setParseError(null); setParsedData(null); setParseLoading(true);
    try {
      const res = await parseJob({ jd_text: jdText });
      if (res.success && res.parsed) setParsedData(res.parsed);
      else setParseError(res.error || 'Could not extract job details.');
    } catch (err) { setParseError(err.response?.data?.error || 'Failed to analyze.'); }
    finally { setParseLoading(false); }
  };

  const handlePublish = async () => {
    if (!parsedData || !jdText.trim()) return;
    setPublishLoading(true); setParseError(null);
    try {
      const res = await createJob({ jd_text: jdText, parsed: parsedData });
      if (res.success) {
        setPublishSuccess(true);
        setJobs(prev => [{ job_id: res.job_id, job_title: res.parsed?.job_title || 'Untitled', status: 'active', created_at: new Date().toISOString(), seniority_level: res.parsed?.seniority_level, required_skills: res.parsed?.required_skills || [], funnel: { applied: 0 } }, ...prev]);
        setTimeout(() => { setShowModal(false); setParsedData(null); setJdText(''); setPublishSuccess(false); }, 1600);
      } else setParseError(res.error || 'Failed to publish.');
    } catch (err) { setParseError(err.response?.data?.error || 'Failed to save.'); }
    finally { setPublishLoading(false); }
  };

  const handlePauseToggle = async (e, job) => {
    e.stopPropagation();
    const ns = job.status === 'active' ? 'paused' : 'active';
    try {
      await updateJobStatus(job.job_id, ns);
      setJobs(prev => prev.map(j => j.job_id === job.job_id ? { ...j, status: ns } : j));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update job status.');
    }
  };


  const handleDeleteJob = async (e, job) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${job.job_title || 'this job'}" and all its candidates?`)) return;
    try {
      await deleteJob(job.job_id);
      setJobs(prev => prev.filter(j => j.job_id !== job.job_id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete job.');
    }
  };


  const getSkillTags = (job) => (job.parsed?.required_skills || job.required_skills || []).slice(0, 3);
  const getSeniority = (job) => {
    const sl = job.parsed?.seniority_level || job.seniority_level || '';
    return sl ? sl.charAt(0).toUpperCase() + sl.slice(1) : '';
  };
  const getExp = (job) => {
    const yr = job.parsed?.experience_years || job.experience_years;
    return yr ? `${yr}+ yrs` : '';
  };

  const activeCount = jobs.filter(j => j.status === 'active').length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', flexDirection: 'column', gap: 12 }}>
      <div className="spinner spinner-lg" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading jobs…</span>
    </div>
  );

  return (
    <div style={{ padding: '0 0 3rem' }}>
      {/* ── Page Header ── */}
      <div style={{ padding: '2rem 2rem 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: 4 }}>Job Postings</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {activeCount} active position{activeCount !== 1 ? 's' : ''} · {jobs.length} total
          </p>
        </div>
        <button
          onClick={openModal}
          id="post-job-btn"
          style={{
            background: 'var(--gradient-primary)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(127,119,221,0.35)',
            transition: 'opacity 0.15s, transform 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Post job
        </button>
      </div>

      {error && <div className="auth-error" style={{ margin: '0 2rem 1.25rem' }}>{error}</div>}

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '0 2rem', marginBottom: '1.75rem' }}>
        {[
          { label: 'Total Applicants', value: stats.applicants, icon: '👥', accent: 'var(--text-primary)' },
          { label: 'Shortlisted', value: stats.shortlisted, icon: '⭐', accent: 'var(--accent-600)' },
          { label: 'Hired', value: stats.hired, icon: '🎉', accent: 'var(--success-text)' },
        ].map(({ label, value, icon, accent }) => (
          <div key={label} style={{
            background: 'var(--surface)', border: '0.5px solid var(--border)',
            borderRadius: 14, padding: '18px 22px',
            display: 'flex', flexDirection: 'column', gap: 8,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ fontSize: 18 }}>{icon}</span>
            </div>
            <span style={{ fontSize: 30, fontWeight: 700, color: accent, letterSpacing: '-1px', lineHeight: 1 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Jobs List ── */}
      {jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>💼</div>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No jobs posted yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Post your first vacancy and start receiving AI-screened candidates.</p>
          <button onClick={openModal} style={{ background: 'var(--gradient-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Post your first job
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 2rem' }}>
          {jobs.map((job, idx) => {
            const acc = ACCENTS[idx % ACCENTS.length];
            const skills = getSkillTags(job);
            const seniority = getSeniority(job);
            const exp = getExp(job);
            const isActive = job.status === 'active';
            const isPaused = job.status === 'paused';

            return (
              <div
                key={job.job_id}
                id={`job-row-${job.job_id}`}
                onClick={() => navigate(`/dashboard/jobs/${job.job_id}`)}
                style={{
                  background: 'var(--surface)', border: '0.5px solid var(--border)',
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.15s',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--accent-200)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: acc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${acc.color}22` }}>
                  <BriefcaseIcon color={acc.color} />
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 5, letterSpacing: '-0.2px' }}>
                    {job.job_title || 'Untitled Position'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {seniority && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${acc.color}18`, color: acc.color }}>
                        {seniority}
                      </span>
                    )}
                    {exp && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp}</span>
                    )}
                    {seniority && skills.length > 0 && <span style={{ fontSize: 11, color: 'var(--border-strong)' }}>·</span>}
                    {skills.map((s, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'var(--surface-1)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)' }}>
                        {s}
                      </span>
                    ))}
                    {!seniority && !exp && skills.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No details extracted</span>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Applicants</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{job.funnel?.applied ?? 0}</div>
                  </div>

                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                    background: isActive ? 'var(--success-bg)' : isPaused ? 'var(--warning-bg)' : 'var(--surface-1)',
                    color: isActive ? 'var(--success-text)' : isPaused ? 'var(--warning-text)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {isActive ? 'Active' : isPaused ? 'Paused' : job.status || 'Inactive'}
                  </span>

                  {/* Pause / Resume */}
                  <button
                    id={`pause-job-${job.job_id}`}
                    onClick={e => handlePauseToggle(e, job)}
                    title={isActive ? 'Pause job' : 'Resume job'}
                    style={{ background: 'var(--surface-1)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', transition: 'background 0.15s, color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {isActive ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    id={`delete-job-${job.job_id}`}
                    onClick={e => handleDeleteJob(e, job)}
                    title="Delete job"
                    style={{ background: 'var(--surface-1)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', transition: 'background 0.15s, color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-text)'; e.currentTarget.style.borderColor = 'var(--danger-border)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-1)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Post Job Modal ── */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'hf-fade-in 0.15s ease' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            id="post-job-modal"
            style={{
              background: 'var(--surface)', border: '0.5px solid var(--border)',
              borderRadius: 18, padding: '1.75rem', width: '100%', maxWidth: 560,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
              animation: 'hf-scale-in 0.2s ease',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Post a new job</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Paste your JD and let AI do the rest</p>
              </div>
              <button
                onClick={closeModal}
                disabled={parseLoading || publishLoading}
                style={{ background: 'var(--surface-1)', border: '0.5px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}
              >✕</button>
            </div>

            {parseError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '0.5px solid var(--danger-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                {parseError}
              </div>
            )}

            {publishSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-text)', marginBottom: 6 }}>Job published!</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Returning to your jobs board…</p>
              </div>
            ) : parsedData ? (
              /* Preview */
              <div>
                <div style={{ background: 'var(--surface-1)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Extracted Role</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, letterSpacing: '-0.3px' }}>{parsedData.job_title || 'Untitled'}</div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {parsedData.experience_level && (
                      <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--accent-50)', color: 'var(--accent-800)', border: '0.5px solid var(--accent-100)', padding: '3px 10px', borderRadius: 20 }}>
                        {parsedData.experience_level.charAt(0).toUpperCase() + parsedData.experience_level.slice(1)}
                      </span>
                    )}
                    {(parsedData.required_skills || parsedData.skills || []).slice(0, 6).map((s, i) => (
                      <span key={i} style={{ fontSize: 11, fontWeight: 500, background: 'var(--surface)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)', padding: '3px 10px', borderRadius: 20 }}>
                        {s}
                      </span>
                    ))}
                  </div>

                  {(parsedData.responsibilities || []).length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Key Responsibilities</div>
                      <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {parsedData.responsibilities.slice(0, 4).map((r, i) => (
                          <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setParsedData(null)}
                    disabled={publishLoading}
                    style={{ flex: 1, background: 'var(--surface-1)', color: 'var(--text-primary)', border: '0.5px solid var(--border-strong)', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                  >
                    ← Edit description
                  </button>
                  <button
                    id="confirm-publish-btn"
                    onClick={handlePublish}
                    disabled={publishLoading}
                    style={{ flex: 1, background: 'var(--gradient-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(127,119,221,0.3)' }}
                  >
                    {publishLoading ? 'Publishing…' : 'Confirm & Publish ✓'}
                  </button>
                </div>
              </div>
            ) : (
              /* JD Input */
              <form onSubmit={handleGenerate}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  Paste your job description
                </label>
                <textarea
                  id="jd-textarea"
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  placeholder="We are looking for a Senior Product Designer with 5+ years of experience in Figma, design systems, and cross-functional collaboration…"
                  disabled={parseLoading}
                  required
                  style={{
                    width: '100%', height: 220, resize: 'vertical', lineHeight: 1.7,
                    background: 'var(--surface-1)', border: '0.5px solid var(--border-strong)',
                    borderRadius: 10, padding: '12px 14px', fontSize: 13,
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                    marginBottom: 14, transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-400)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
                />
                <button
                  type="submit"
                  id="analyze-jd-btn"
                  disabled={parseLoading || !jdText.trim()}
                  style={{
                    width: '100%', padding: '12px', background: 'var(--gradient-primary)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: parseLoading ? 'not-allowed' : 'pointer',
                    opacity: parseLoading ? 0.8 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(127,119,221,0.3)',
                  }}
                >
                  {parseLoading ? (
                    <><div className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> {loadingMessages[loadingStep]}</>
                  ) : (
                    <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze with AI</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobsPage;
