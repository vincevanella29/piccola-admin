import React from 'react';

const Pill = ({ children, active, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
      active
        ? 'bg-matrix-green/20 text-matrix-green border border-matrix-green/40'
        : 'bg-dark-surface text-dark-text-secondary border border-dark-border'
    } ${className}`}
  >
    {children}
  </button>
);

export default Pill;
