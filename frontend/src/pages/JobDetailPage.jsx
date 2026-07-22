import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getJob, listCandidates } from '../services/endpoints';
import CandidateCard from '../components/CandidateCard';

/* ── Icon helpers ─────────────────────────────────── */
const IconArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const ACCENT_COLORS = [
  '#7F77DD', '#1D9E75', '#D4890A', '#D4537E', '#378ADD',
];

const JobDetailPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true); setError(null);
        const [jobRes, candRes] = await Promise.all([getJob(jobId), listCandidates(jobId)]);
        if (jobRes.success) setJob(jobRes.job);
        else setError(jobRes.error || 'Failed to fetch job details.');
        if (candRes.success) setCandidates(candRes.candidates || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load job details.');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [jobId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/${jobId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', flexDirection: 'column', gap: 12 }}>
      <div className="spinner spinner-lg" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading job details…</span>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{error}</p>
      <Link to="/dashboard/jobs" style={{ color: 'var(--accent-600)', fontSize: 14, fontWeight: 500 }}>← Back to Jobs</Link>
    </div>
  );

  const parsed = job?.parsed || {};
  const skills = parsed.required_skills || [];
  const responsibilities = parsed.responsibilities || [];
  const seniority = parsed.seniority_level ? parsed.seniority_level.charAt(0).toUpperCase() + parsed.seniority_level.slice(1) : null;
  const exp = parsed.experience_years ? `${parsed.experience_years}+ years` : null;
  const applyLink = `${window.location.origin}/apply/${jobId}`;

  return (
    <div style={{ padding: '0 0 4rem', animation: 'hf-fade-in 0.25s ease' }}>

      {/* ── Top Bar ── */}
      <div style={{ padding: '1.5rem 2rem 0', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate('/dashboard/jobs')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, padding: '6px 0', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <IconArrowLeft /> Back to Jobs
        </button>

        {/* Copy apply link */}
        <button
          onClick={handleCopyLink}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: copied ? 'var(--success-bg)' : 'var(--surface)',
            color: copied ? 'var(--success-text)' : 'var(--text-primary)',
            border: `0.5px solid ${copied ? 'var(--success-border)' : 'var(--border-strong)'}`,
            borderRadius: 9, padding: '8px 16px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? 'Link copied!' : 'Copy apply link'}
        </button>
      </div>

      {/* ── Hero Header ── */}
      <div style={{ margin: '0 2rem 1.75rem', background: 'var(--gradient-header)', borderRadius: 18, padding: '2rem 2.25rem', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative blob */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: '40%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 10 }}>
            {parsed.job_title || 'Untitled Position'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {seniority && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                {seniority}
              </span>
            )}
            {exp && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.9)' }}>
                {exp} exp.
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.13)', color: 'rgba(255,255,255,0.9)' }}>
              {candidates.length} applicant{candidates.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Apply Link Box ── */}
      <div style={{ margin: '0 2rem 1.75rem', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>Candidate Apply Link</div>
          <div style={{ fontSize: 12, color: 'var(--accent-600)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{applyLink}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleCopyLink}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? 'var(--success-bg)' : 'var(--accent-50)', color: copied ? 'var(--success-text)' : 'var(--accent-800)', border: `0.5px solid ${copied ? 'var(--success-border)' : 'var(--accent-100)'}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {copied ? <IconCheck /> : <IconShare />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16, padding: '0 2rem' }}>

        {/* LEFT: Job Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Required Skills */}
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 14 }}>Required Skills</h3>
            {skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {skills.map((skill, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 500,
                    padding: '5px 12px', borderRadius: 8,
                    background: `${ACCENT_COLORS[i % ACCENT_COLORS.length]}14`,
                    color: ACCENT_COLORS[i % ACCENT_COLORS.length],
                    border: `0.5px solid ${ACCENT_COLORS[i % ACCENT_COLORS.length]}30`,
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No specific skills listed.</p>
            )}
          </div>

          {/* Responsibilities */}
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 14 }}>Responsibilities</h3>
            {responsibilities.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {responsibilities.map((r, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-400)', marginTop: 6, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No responsibilities listed.</p>
            )}
          </div>

          {/* Education */}
          {parsed.education_required && (
            <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '18px 22px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 8 }}>Education</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{parsed.education_required}</p>
            </div>
          )}
        </div>

        {/* RIGHT: Candidates */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: 'var(--accent-600)', display: 'flex' }}><IconUsers /></div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                Screened Candidates
              </h2>
              <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--surface-1)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '2px 10px' }}>
                {candidates.length}
              </span>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '0.5px dashed var(--border-strong)', borderRadius: 14, padding: '3.5rem 2rem', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                👤
              </div>
              <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No applicants yet</h4>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Share the apply link to start receiving AI-screened candidates.
              </p>
              <button
                onClick={handleCopyLink}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--gradient-primary)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(127,119,221,0.3)' }}
              >
                <IconShare /> Copy apply link
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {candidates.map(cand => (
                <CandidateCard key={cand.candidate_id} candidate={cand} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;
