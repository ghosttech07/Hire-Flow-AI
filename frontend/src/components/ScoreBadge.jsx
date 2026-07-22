import React from 'react';

const ScoreBadge = ({ score }) => {
  const val = Number(score) || 0;
  let colorClass = 'badge-red';
  if (val >= 75) {
    colorClass = 'badge-green';
  } else if (val >= 60) {
    colorClass = 'badge-yellow';
  }

  return (
    <span className={`score-badge ${colorClass}`}>
      {val}% Match
    </span>
  );
};

export default ScoreBadge;
