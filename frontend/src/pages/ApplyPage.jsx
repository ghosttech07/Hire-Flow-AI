import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicJobInfo, submitApplication } from '../services/endpoints';
import CandidateShell from '../components/CandidateShell';

/* ── Upload icon ───────────────────────────── */
const IconUpload = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

const ApplyPage = () => {
  const { jobId } = useParams();

  const [job, setJob]           = useState(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [jobError, setJobError] = useState(null);

  const [formData, setFormData] = useState({ name: '', email: '' });
  const [resumeFile, setResumeFile]   = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [fileError, setFileError]     = useState(null);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess]         = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoadingJob(true);
        const data = await getPublicJobInfo(jobId);
        setJob(data);
      } catch (err) {
        console.error(err);
        setJobError('This job posting is no longer available.');
      } finally {
        setLoadingJob(false);
      }
    };
    fetchJob();
  }, [jobId]);

  const validateFile = (file) => {
    if (!file) return 'Please upload a resume.';
    const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    if (!isPdf && !isDocx) return 'Only PDF or DOCX files are supported.';
    if (file.size > 10 * 1024 * 1024) return 'File size must be under 10 MB.';
    return null;
  };

  const handleFileSelect = (file) => {
    const err = validateFile(file);
    if (err) { setFileError(err); setResumeFile(null); return; }
    setFileError(null);
    setResumeFile(file);
  };

  const handleFileInputChange = (e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); };
  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop      = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const err = validateFile(resumeFile);
    if (err) { setFileError(err); return; }

    const payload = new FormData();
    payload.append('name', formData.name.trim());
    payload.append('email', formData.email.trim());
    payload.append('resume', resumeFile);

    try {
      setSubmitting(true);
      await submitApplication(jobId, payload);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setSubmitError(err.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (loadingJob) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: '12px' }}>
        <div className="spinner spinner-lg" />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading job details…</span>
      </div>
    );
  }

  /* ── Job not found ── */
  if (jobError) {
    return (
      <CandidateShell header={
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: '600' }}>Job Not Found</div>
      }>
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>{jobError}</p>
        </div>
      </CandidateShell>
    );
  }

  const skills    = job?.required_skills || job?.parsed?.required_skills || [];
  const seniority = job?.seniority_level || job?.parsed?.seniority_level || '';
  const expYears  = job?.experience_years || job?.parsed?.experience_years || '';
  const title     = job?.job_title || job?.parsed?.job_title || 'Open Position';

  /* ── Success ── */
  if (success) {
    return (
      <CandidateShell header={
        <>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>✉️</div>
          <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>Application Submitted!</div>
        </>
      }>
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
            Thanks for applying for <strong style={{ color: 'var(--text-primary)' }}>{title}</strong>.{' '}
            Our AI is screening your resume now. Shortlisted candidates receive an interview link by email within minutes.
          </p>
        </div>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell header={
      <>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '600', margin: '0 0 10px' }}>{title}</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {seniority && (
            <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '500' }}>
              {seniority.charAt(0).toUpperCase() + seniority.slice(1)}
            </span>
          )}
          {expYears && (
            <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '500' }}>
              {expYears}+ years
            </span>
          )}
          {skills.slice(0, 3).map((s, i) => (
            <span key={i} style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: '11px', padding: '3px 10px', borderRadius: '20px' }}>
              {s}
            </span>
          ))}
        </div>
      </>
    }>

      {submitError && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '0.5px solid var(--danger-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} id="apply-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Name + email row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Full name</label>
            <input className="input-field" type="text" required value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your full name" disabled={submitting} id="apply-name" />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Email address</label>
            <input className="input-field" type="email" required value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@example.com" disabled={submitting} id="apply-email" />
          </div>
        </div>

        {/* Resume drop zone */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>Resume</label>
          <div
            id="resume-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1.5px dashed ${dragOver ? 'var(--accent-400)' : resumeFile ? 'var(--success-border)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-lg)',
              background: dragOver ? 'var(--accent-50)' : resumeFile ? 'var(--success-bg)' : 'var(--surface-1)',
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <input type="file" accept=".pdf,.docx" ref={fileInputRef}
              onChange={handleFileInputChange} disabled={submitting} id="resume-file-input"
              style={{ display: 'none' }} />

            {resumeFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--success-text)', display: 'flex' }}><IconFile /></span>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--success-text)' }}>
                  ✓ {resumeFile.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {(resumeFile.size / 1024).toFixed(0)} KB · Click to replace
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex' }}><IconUpload /></span>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  Drop your resume here
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PDF or DOCX · max 10 MB</div>
                <div style={{ fontSize: '12px', color: 'var(--accent-600)', fontWeight: '500', marginTop: '4px', border: '0.5px solid var(--border)', padding: '5px 14px', borderRadius: '6px', background: 'var(--surface)' }}>
                  Browse files
                </div>
              </div>
            )}
          </div>
          {fileError && (
            <p style={{ color: 'var(--danger-text)', fontSize: '12px', marginTop: '6px' }}>{fileError}</p>
          )}
        </div>

        <button type="submit" className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '15px' }}
          disabled={submitting} id="submit-application-btn">
          {submitting ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              Screening your resume with AI…
            </span>
          ) : 'Submit application →'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.5 }}>
        Your resume is screened by AI in under 20 seconds. Shortlisted candidates receive an interview link by email.
      </p>
    </CandidateShell>
  );
};

export default ApplyPage;
