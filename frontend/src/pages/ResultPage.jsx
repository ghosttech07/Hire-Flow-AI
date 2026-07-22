import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getInterviewResult } from '../services/endpoints';
import CandidateShell from '../components/CandidateShell';

const ResultPage = () => {
  const { token }  = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await getInterviewResult(token);
        setResult(res);
      } catch (err) {
        setError(err.response?.data?.error || 'Invalid or expired result link.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: '12px' }}>
        <div className="spinner spinner-lg" />
        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading your results…</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    const notReady = error.toLowerCase().includes('not finished') || error.toLowerCase().includes('ready');
    return (
      <CandidateShell header={
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>
          {notReady ? '⏳ Results Not Ready Yet' : '⚠️ Access Restricted'}
        </div>
      }>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
          {notReady ? 'Our AI is still processing your interview. Please check back in a moment.' : error}
        </p>
      </CandidateShell>
    );
  }

  const { candidate_name, job_title, final_decision, question_breakdown } = result || {};
  const isOffer = final_decision?.outcome === 'offer';

  /* Scores */
  const resumeScore    = Math.round(final_decision?.resume_score || final_decision?.match_score || 0);
  const interviewScore = Math.round(final_decision?.interview_score || 0);
  const overallScore   = Math.round(final_decision?.final_score || Math.round((resumeScore + interviewScore) / 2) || 0);

  /* Outcome-specific gradients */
  const outcomeGradient = isOffer
    ? 'linear-gradient(135deg, #1D9E75, #0F6E56)'
    : 'linear-gradient(135deg, #E24B4A, #A32D2D)';

  const scoreColor = (s) => {
    if (s >= 70) return { color: 'var(--success-text)', bg: 'var(--success-bg)' };
    if (s >= 45) return { color: 'var(--warning-text)', bg: 'var(--warning-bg)' };
    return { color: 'var(--danger-text)', bg: 'var(--danger-bg)' };
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem 1rem 3rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>

        {/* Outcome banner (overrides CandidateShell gradient with outcome colour) */}
        <div style={{
          background: outcomeGradient,
          borderRadius: '16px 16px 0 0',
          padding: '1.75rem',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px', position: 'relative' }}>
            Powered by HireFlow AI
          </div>
          <div style={{ position: 'relative' }}>
            {isOffer ? (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🎉</div>
                <div style={{ color: '#fff', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>Congratulations!</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>You've been offered the position of <strong>{job_title}</strong></div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📋</div>
                <div style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Application Complete</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>Thank you for your time, {candidate_name}</div>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderTop: 'none', borderRadius: '0 0 16px 16px',
          padding: '1.75rem', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}>

          {/* Score cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Resume',    value: resumeScore },
              { label: 'Interview', value: interviewScore },
              { label: 'Overall',   value: overallScore, highlighted: true },
            ].map(({ label, value, highlighted }) => {
              const s = scoreColor(value);
              return (
                <div key={label} style={{
                  background: highlighted ? s.bg : 'var(--surface-1)',
                  border: `0.5px solid ${highlighted ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '12px',
                  textAlign: 'center',
                  ...(highlighted ? { boxShadow: 'var(--shadow-sm)' } : {}),
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '700', color: highlighted ? s.color : 'var(--text-primary)' }}>
                    {value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>/100</div>
                </div>
              );
            })}
          </div>

          {/* AI feedback */}
          {final_decision?.feedback && (
            <div style={{
              background: 'var(--surface-1)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7,
            }}>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                AI Feedback
              </div>
              {final_decision.feedback}
            </div>
          )}

          {/* Question breakdown */}
          {question_breakdown && question_breakdown.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Answer Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {question_breakdown.map((item, idx) => {
                  const s = item.evaluation_score ?? null;
                  const sc = s !== null ? scoreColor(s) : null;
                  return (
                    <div key={idx} id={`breakdown-q${idx + 1}`} style={{
                      background: 'var(--surface)',
                      border: '0.5px solid var(--border)',
                      borderLeft: '3px solid var(--accent-200)',
                      borderRadius: 'var(--radius)',
                      padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Q{idx + 1}: {item.question?.length > 50 ? item.question.slice(0, 50) + '…' : item.question || `Question ${idx + 1}`}
                      </span>
                      {s !== null && (
                        <span style={{
                          fontSize: '13px', fontWeight: '700', padding: '3px 10px', borderRadius: '6px',
                          background: sc.bg, color: sc.color, flexShrink: 0,
                        }}>
                          {s}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          {isOffer ? (
            <button className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '15px', background: 'linear-gradient(135deg, #1D9E75, #0F6E56)' }}
              id="view-offer-btn">
              View offer letter →
            </button>
          ) : (
            <div style={{
              background: 'var(--surface-1)', border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, textAlign: 'center',
            }}>
              We appreciate your efforts. While we won't be moving forward at this time,
              we encourage you to apply for future opportunities.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
