// src/pages/merits/components/EmployeeDetailPanel/ui/KpiCard.jsx
import React from 'react';

export const KpiCard = ({ icon: Icon, title, value, subtitle }) => (
  <div className="bg-dark-surface-secondary p-4 rounded-lg">
    <div className="flex items-center gap-2 text-dark-text-secondary mb-1">
      {Icon ? <Icon size={14} /> : null}
      <h5 className="text-sm font-semibold">{title}</h5>
    </div>
    <p className="text-2xl font-bold text-dark-text-primary">{value}</p>
    {subtitle && <p className="text-xs text-dark-text-secondary mt-1">{subtitle}</p>}
  </div>
);