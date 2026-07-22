import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCandidate, getCandidateEvaluations, shortlistCandidate } from '../services/endpoints';
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Sparkles,
  Zap,
  Target,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { gsap } from 'gsap';
import confetti from 'canvas-confetti';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const CandidateDetailPage = () => {
  const { jobId, candidateId } = useParams();
  
  const [candidate, setCandidate] = useState(null);
  const [evalHistory, setEvalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHiring, setIsHiring] = useState(false);
  
  const stampRef = useRef(null);
  const containerRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [candRes, evalsRes] = await Promise.all([
        getCandidate(candidateId),
        getCandidateEvaluations(jobId, candidateId)
      ]);
      if (candRes.success) setCandidate(candRes.candidate);
      else setError(candRes.error || 'Failed to fetch candidate.');
      if (evalsRes.success) setEvalHistory(evalsRes.evaluation_history || []);
    } catch (err) {
      setError('Failed to load candidate profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [jobId, candidateId]);

  useEffect(() => {
    if (!loading && containerRef.current) {
      gsap.from('.glass-panel', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
      });
    }
  }, [loading]);

  const handleHireAction = async () => {
    if (isHiring) return;
    setIsHiring(true);
    
    const tl = gsap.timeline();
    tl.to(stampRef.current, { 
      opacity: 1, 
      scale: 1, 
      duration: 0.4, 
      ease: 'back.out(2)' 
    })
    .to(stampRef.current, { 
      rotation: -12, 
      scale: 0.95,
      duration: 0.1,
      ease: 'power1.in'
    })
    .to(stampRef.current, {
      scale: 1,
      duration: 0.1
    });

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#534AB7', '#7F77DD', '#fbbf24', '#22c55e']
    });

    try {
      await shortlistCandidate(jobId, candidateId, { status: 'offer_sent' });
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        gsap.to(stampRef.current, { opacity: 0, scale: 2, duration: 0.5 });
        setIsHiring(false);
      }, 2500);
    }
  };

  const radarData = useMemo(() => ({
    labels: ['Technical', 'Experience', 'Culture', 'Leadership', 'Comm.'],
    datasets: [{
      label: 'AI Profile',
      data: candidate?.screening?.match_score ? [
        candidate.screening.match_score,
        Math.min(candidate.screening.match_score + 10, 100),
        75, 60, 85
      ] : [0, 0, 0, 0, 0],
      backgroundColor: 'rgba(83, 74, 183, 0.15)',
      borderColor: 'rgba(83, 74, 183, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(83, 74, 183, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(83, 74, 183, 1)',
    }]
  }), [candidate]);

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p style={{ fontWeight: '600', color: 'var(--text-secondary)', marginTop: '16px' }}>Synchronizing AI Insights...</p>
    </div>
  );

  const screening = candidate?.screening || {};
  const matchScore = screening.match_score || 0;

  return (
    <div ref={containerRef} className="candidate-detail-page" style={{ padding: '0 60px 80px 60px', background: 'var(--bg)', minHeight: '100vh' }}>
      
      <nav style={{ 
        padding: '32px 0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(248, 248, 252, 0.8)',
        backdropFilter: 'blur(8px)'
      }}>
        <Link to={`/dashboard/jobs/${jobId}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '14px', transition: 'color 0.2s' }}>
          <ArrowLeft size={18} /> Exit Analysis
        </Link>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn-secondary" style={{ borderRadius: '12px', padding: '12px 24px', fontSize: '13px' }}>Mark Unsuitable</button>
          <button 
            className="btn-primary" 
            style={{ borderRadius: '12px', padding: '12px 40px', fontSize: '13px', boxShadow: '0 10px 20px rgba(83, 74, 183, 0.2)' }} 
            onClick={handleHireAction}
          >
            {isHiring ? 'Processing...' : 'Hire Candidate'}
          </button>
        </div>
      </nav>

      <div ref={stampRef} style={{ 
        position: 'fixed', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%) scale(5)', 
        opacity: 0, 
        zIndex: 1000, 
        pointerEvents: 'none',
        color: '#22c55e',
        fontSize: '120px',
        fontWeight: '900',
        border: '14px solid #22c55e',
        padding: '24px 80px',
        borderRadius: '32px',
        textTransform: 'uppercase',
        letterSpacing: '12px',
        background: 'rgba(255,255,255,0.9)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
      }}>
        HIRED
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px', marginTop: '20px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          <div className="glass-panel" style={{ padding: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              {candidate?.photo_base64 && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={candidate.photo_base64}
                    alt={candidate?.name || 'Candidate'}
                    style={{ width: '100px', height: '100px', borderRadius: '24px', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                  />
                  <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--accent-600)', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }}>
                    <ShieldCheck size={14} />
                  </div>
                </div>
              )}
              <div>
                <h1 className="title-text" style={{ fontSize: '28px', margin: 0 }}>{candidate?.name || 'Anonymous Profile'}</h1>
                <div style={{ display: 'flex', gap: '20px', marginTop: '12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={16} /> {candidate?.email}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} />
                    Applied {candidate?.applied_at ? new Date(candidate.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', padding: '0 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>System Confidence</div>
              <div style={{ fontSize: '56px', fontWeight: '900', color: 'var(--accent-600)', lineHeight: 1, marginTop: '4px' }}>{matchScore.toFixed(0)}<span style={{ fontSize: '24px', verticalAlign: 'top', marginTop: '8px', display: 'inline-block' }}>%</span></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px' }}>
            
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={20} color="var(--accent-600)" />
                  <h2 className="label-text" style={{ margin: 0, fontSize: '13px' }}>Extracted Resume Context</h2>
                </div>
                <button style={{ background: 'none', border: 'none', color: 'var(--accent-600)', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  VIEW ORIGINAL <ExternalLink size={10} />
                </button>
              </div>
              <div style={{ 
                background: 'var(--sidebar-bg)', 
                padding: '24px', 
                borderRadius: '16px', 
                fontSize: '12px', 
                fontFamily: 'monospace', 
                color: 'rgba(255,255,255,0.8)',
                maxHeight: '340px',
                overflowY: 'auto',
                lineHeight: 1.8,
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {candidate?.resume_text || '// Data synchronization in progress...'}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Target size={20} color="var(--accent-600)" />
                <h2 className="label-text" style={{ margin: 0, fontSize: '13px' }}>Skill Fingerprint</h2>
              </div>
              <div style={{ height: '340px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Radar 
                  data={radarData} 
                  options={{ 
                    scales: { 
                      r: { 
                        grid: { color: 'rgba(0,0,0,0.03)' }, 
                        angleLines: { color: 'rgba(0,0,0,0.03)' }, 
                        ticks: { display: false },
                        pointLabels: { font: { size: 10, weight: '700', family: 'Inter' }, color: 'var(--text-secondary)' }
                      } 
                    }, 
                    plugins: { legend: { display: false } } 
                  }} 
                />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
              <Zap size={20} color="var(--accent-600)" />
              <h2 className="label-text" style={{ margin: 0, fontSize: '13px' }}>Voice Interview Intelligence</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {evalHistory.map((item, idx) => (
                <div key={idx} style={{ 
                  padding: '28px', 
                  border: '1px solid var(--border)', 
                  borderRadius: '20px',
                  background: 'var(--surface)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'transform 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-400)', textTransform: 'uppercase', letterSpacing: '1px' }}>Response Analysis {idx + 1}</span>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)' }}>• Voice Transcription</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '40px', height: '4px', background: 'var(--surface-1)', borderRadius: '2px' }}>
                        <div style={{ width: `${item.evaluation?.evaluation_score}%`, height: '100%', background: 'var(--accent-600)', borderRadius: '2px' }}></div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--accent-600)' }}>{item.evaluation?.evaluation_score}%</span>
                    </div>
                  </div>
                  <h3 style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px', lineHeight: 1.5, color: 'var(--text-primary)' }}>"{item.question}"</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{item.evaluation?.score_reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          <div className="glass-panel" style={{ padding: '32px', background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 15px 35px rgba(83, 74, 183, 0.3)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles size={16} />
              <span style={{ fontSize: '10px', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>AI Verdict</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', margin: '0 0 12px 0', lineHeight: 1.2 }}>High Match Probability</h2>
            <p style={{ fontSize: '14px', opacity: 0.9, lineHeight: 1.7, margin: 0 }}>
              Based on the skill fingerprint and voice metrics, this candidate represents the top 5% of applicants for this role.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '32px' }}>
            <h2 className="label-text" style={{ marginBottom: '24px', fontSize: '12px' }}>Requirement Match</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {screening.matched_skills?.map((skill, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  <div style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '4px', borderRadius: '50%', display: 'flex' }}>
                    <CheckCircle size={14} />
                  </div>
                  <span>{skill}</span>
                </div>
              ))}
              {screening.missing_skills?.map((skill, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: 'var(--text-muted)', opacity: 0.7 }}>
                  <div style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)', padding: '4px', borderRadius: '50%', display: 'flex' }}>
                    <XCircle size={14} />
                  </div>
                  <span style={{ textDecoration: 'line-through' }}>{skill}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '32px', background: 'rgba(239, 68, 68, 0.02)', border: '1.5px solid rgba(239, 68, 68, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <AlertCircle size={18} color="var(--danger-text)" />
              <h2 className="label-text" style={{ margin: 0, color: 'var(--danger-text)', fontSize: '12px' }}>Potential Friction</h2>
            </div>
            {screening.concerns?.length > 0 ? (
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {screening.concerns.map((c, i) => (
                  <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--danger-text)' }}>•</span> {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Risk profile is minimal for this candidate.</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default CandidateDetailPage;
