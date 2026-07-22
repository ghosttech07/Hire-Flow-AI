import React, { useState, useEffect } from 'react';
import { listJobs, listCandidates } from '../services/endpoints';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Briefcase, 
  Search, 
  Layers, 
  Inbox, 
  Sparkles, 
  Mic, 
  Award,
  MoreHorizontal,
  Plus,
  Filter
} from 'lucide-react';

const CandidatePipeline = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [columns, setColumns] = useState({
    applied: [],
    screening: [],
    interview: [],
    decision: []
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const res = await listJobs();
        if (res.success && res.jobs?.length > 0) {
          setJobs(res.jobs);
          setSelectedJobId(res.jobs[0].job_id);
        } else {
          setJobs([]);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch jobs listing.');
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;

    const fetchJobCandidates = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await listCandidates(selectedJobId);
        if (res.success) {
          const list = res.candidates || [];
          setCandidates(list);
          
          const colData = { applied: [], screening: [], interview: [], decision: [] };

          list.forEach(c => {
            if (['rejected_screening', 'screening_failed'].includes(c.status) || c.status === 'applied') {
              colData.applied.push(c);
            } else if (c.status === 'interview_invited') {
              colData.screening.push(c);
            } else if (['interview_in_progress', 'interview_completed'].includes(c.status)) {
              colData.interview.push(c);
            } else if (['offer_sent', 'rejected_final'].includes(c.status)) {
              colData.decision.push(c);
            }
          });

          setColumns(colData);
        } else {
          setError(res.error || 'Failed to fetch candidates.');
        }
      } catch (err) {
        console.error(err);
        setError('Error connecting to database.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobCandidates();
  }, [selectedJobId]);

  const toggleCompare = (id) => {
    setSelectedForCompare(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredColumns = Object.entries(columns).reduce((acc, [key, list]) => {
    acc[key] = list.filter(c => 
      c.candidate_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.screening?.extracted_skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return acc;
  }, {});

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--accent-600)';
    if (score >= 60) return 'var(--warning-text)';
    return 'var(--danger-text)';
  };

  const ColumnHeader = ({ icon: Icon, title, count, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '10px', 
          background: color || 'var(--accent-50)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: color ? '#fff' : 'var(--accent-600)',
          boxShadow: color ? '0 4px 12px rgba(83, 74, 183, 0.2)' : 'none'
        }}>
          <Icon size={18} />
        </div>
        <h2 className="label-text" style={{ color: 'var(--text-primary)', margin: 0, letterSpacing: '0.05em' }}>{title}</h2>
      </div>
      <span className="badge-count" style={{ fontSize: '9px' }}>{count}</span>
    </div>
  );

  const CandidateCard = ({ c, variant }) => {
    const isSelected = selectedForCompare.includes(c.candidate_id);
    const score = c.screening?.match_score || 0;
    const isTopTalent = score >= 85;

    return (
      <div 
        className={`candidate-card ${isSelected ? 'selected' : ''} ${isTopTalent && variant !== 'decision' ? 'star-glow' : ''}`}
        onClick={() => toggleCompare(c.candidate_id)}
        style={{ 
          position: 'relative',
          ...(variant === 'decision' && isTopTalent ? { borderLeft: '4px solid #fbbf24' } : {})
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <img 
                src={`https://i.pravatar.cc/100?u=${c.candidate_id}`} 
                alt="" 
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface-1)' }}
              />
              {isTopTalent && (
                <div style={{ 
                  position: 'absolute', 
                  bottom: '-2px', 
                  right: '-2px', 
                  background: '#fbbf24', 
                  borderRadius: '50%', 
                  width: '14px', 
                  height: '14px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '2px solid #fff'
                }}>
                  <Sparkles size={8} color="#fff" />
                </div>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{c.candidate_name}</h3>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
                {variant === 'interview' ? 'Interviewing' : variant === 'decision' ? 'Pending Verdict' : 'Applied Recent'}
              </p>
            </div>
          </div>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '900', 
            color: isTopTalent ? 'var(--accent-600)' : getScoreColor(score),
            background: isTopTalent ? 'var(--accent-50)' : 'transparent',
            padding: isTopTalent ? '2px 6px' : '0',
            borderRadius: '4px'
          }}>
            {score.toFixed(1)}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
          {(c.screening?.matched_skills || []).slice(0, 2).map((skill, idx) => (
            <span key={idx} style={{ 
              fontSize: '9px', 
              fontWeight: '700', 
              padding: '2px 8px', 
              background: 'var(--surface-1)', 
              color: 'var(--text-secondary)', 
              borderRadius: '4px',
              textTransform: 'uppercase'
            }}>
              {skill}
            </span>
          ))}
        </div>

        {variant === 'interview' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '4px', background: 'var(--surface-1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '50%', height: '100%', background: 'var(--accent-400)' }}></div>
            </div>
            <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--accent-600)' }}>50%</span>
          </div>
        )}

        {variant === 'decision' ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ 
              flex: 1, 
              padding: '8px 0', 
              fontSize: '11px', 
              fontWeight: '700', 
              color: 'var(--danger-text)', 
              border: '1px solid var(--danger-border)', 
              borderRadius: '8px', 
              background: 'none' 
            }}>
              Reject
            </button>
            <button className="btn-primary" style={{ flex: 1.5, padding: '8px 0', fontSize: '11px', borderRadius: '8px' }}>
              Send Offer
            </button>
          </div>
        ) : (
          <Link 
            to={`/dashboard/jobs/${selectedJobId}/candidates/${c.candidate_id}`} 
            className="btn-secondary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', fontSize: '11px', padding: '8px 0', borderRadius: '8px', fontWeight: '700' }}
            onClick={(e) => e.stopPropagation()}
          >
            {variant === 'screening' ? 'View AI Report' : 'Review Profile'}
          </Link>
        )}
      </div>
    );
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="pipeline-page" style={{ padding: '0 40px 60px 40px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Navbar Overlay */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        padding: '32px 0',
        marginBottom: '20px'
      }}>
        <div>
          <h1 className="title-text" style={{ color: 'var(--text-primary)', margin: 0 }}>Candidate Pipeline</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
              Live Screening
            </span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span style={{ fontWeight: '700', color: 'var(--accent-600)' }}>
              {jobs.find(j => j.job_id === selectedJobId)?.job_title || 'Select a Vacancy'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Filter by name or skill..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '280px', paddingLeft: '42px', borderRadius: '12px', border: '1px solid var(--border)' }}
            />
          </div>
          
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="input-field"
            style={{ width: '240px', margin: 0, borderRadius: '12px', fontWeight: '600' }}
          >
            {jobs.map(j => (
              <option key={j.job_id} value={j.job_id}>{j.job_title}</option>
            ))}
          </select>

          <button 
            className="btn-primary" 
            style={{ 
              padding: '12px 28px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              borderRadius: '12px',
              boxShadow: selectedForCompare.length >= 2 ? '0 8px 20px rgba(83, 74, 183, 0.25)' : 'none'
            }}
            disabled={selectedForCompare.length < 2}
          >
            <Layers size={18} />
            Compare {selectedForCompare.length > 0 && `(${selectedForCompare.length})`}
          </button>
        </div>
      </header>

      {/* Kanban Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '28px' }}>
        
        {/* Applied */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ColumnHeader icon={Inbox} title="Applied" count={filteredColumns.applied.length} />
          <div className="glass-panel" style={{ padding: '16px', minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredColumns.applied.map(c => <CandidateCard key={c.candidate_id} c={c} variant="applied" />)}
            <button style={{ 
              width: '100%', 
              padding: '14px', 
              borderRadius: '12px', 
              border: '1.5px dashed var(--border-strong)', 
              background: 'none', 
              color: 'var(--text-muted)', 
              fontSize: '12px', 
              fontWeight: '600', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px',
              marginTop: '4px'
            }}>
              <Plus size={16} /> Add Candidate
            </button>
          </div>
        </div>

        {/* Screening */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ColumnHeader icon={Search} title="Screening" count={filteredColumns.screening.length} />
          <div className="glass-panel" style={{ padding: '16px', minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredColumns.screening.map(c => <CandidateCard key={c.candidate_id} c={c} variant="screening" />)}
          </div>
        </div>

        {/* Interview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ColumnHeader icon={Mic} title="Interview" count={filteredColumns.interview.length} />
          <div className="glass-panel" style={{ padding: '16px', minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredColumns.interview.map(c => <CandidateCard key={c.candidate_id} c={c} variant="interview" />)}
          </div>
        </div>

        {/* Decision */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ColumnHeader icon={Award} title="Decision" count={filteredColumns.decision.length} color="var(--accent-600)" />
          <div className="glass-panel" style={{ padding: '16px', minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(83, 74, 183, 0.03)' }}>
            {filteredColumns.decision.map(c => <CandidateCard key={c.candidate_id} c={c} variant="decision" />)}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CandidatePipeline;
