// src/pages/merits/components/EmployeeDetailPanel/ui/TabButton.jsx
import React from 'react';

export const TabButton = ({ label, icon: Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
      isActive
        ? 'border-matrix-green text-matrix-green'
        : 'border-transparent text-dark-text-secondary hover:text-dark-text-primary'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);