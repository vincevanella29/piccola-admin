// src/pages/merits/components/EmployeeDetailPanel/ui/MeritSegmentRow.jsx
import React from 'react';

export const MeritSegmentRow = ({ icon: Icon, symbol, points }) => {
  if (points === 0) return null; // No renderizar si no hay puntos

  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-dark-surface-secondary">
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-matrix-green" />
        <span className="font-semibold text-dark-text-primary">{symbol}</span>
      </div>
      <span className="font-mono text-lg text-dark-text-primary">{points.toFixed(0)}</span>
    </div>
  );
};