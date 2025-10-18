import React from 'react';

const ConfidenceBar = ({ value }) => {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  return (
    <div className="w-full h-2 rounded bg-dark-border overflow-hidden">
      <div className="h-full rounded bg-matrix-green transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
};

export default ConfidenceBar;
