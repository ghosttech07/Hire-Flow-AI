import React from 'react';
import { Link, useParams } from 'react-router-dom';
import ScoreBadge from './ScoreBadge';

const CandidateCard = ({ candidate }) => {
  const { jobId } = useParams();
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'applied': return 'Applied';
      case 'screening_rejected': return 'Screened Out';
      case 'interview_invited': return 'Interview Invited';
      case 'interview_in_progress': return 'Interview In Progress';
      case 'interview_completed': return 'Interview Completed';
      case 'offer_sent': return 'Offer Sent';
      case 'rejected_final': return 'Rejected';
      default: return status || 'Pending';
    }
  };

  return (
    <div className="candidate-card glass-panel">
      <div className="candidate-card-header">
        <div>
          <h4 className="candidate-name">{candidate.name || 'Anonymous'}</h4>
          <p className="candidate-email">{candidate.email || 'No email provided'}</p>
        </div>
        <ScoreBadge score={candidate.match_score} />
      </div>
      <div className="candidate-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', flexGrow: 1 }}>
        <span className={`recommendation-pill ${candidate.status}`}>
          {getStatusLabel(candidate.status)}
        </span>
        {candidate.final_decision && (
          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
            Final Score: <strong style={{ color: 'var(--primary-color)' }}>{candidate.final_decision.final_score?.toFixed(1)}/100</strong>
          </div>
        )}
        {candidate.created_at && (
          <span className="candidate-date" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Applied {new Date(candidate.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="candidate-card-actions" style={{ marginTop: '12px' }}>
        <Link to={`/dashboard/jobs/${jobId}/candidates/${candidate.candidate_id}`} className="btn btn-sm btn-secondary">
          View Pipeline
        </Link>
      </div>
    </div>
  );
};

export default CandidateCard;
