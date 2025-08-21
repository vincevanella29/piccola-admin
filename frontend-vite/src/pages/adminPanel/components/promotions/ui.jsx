// src/components/ui.jsx (enhanced styles)
import React from 'react';

export const Input = ({ name, value, onChange, type = 'text', placeholder, ...props }) => (
  <input
    name={name}
    value={value}
    onChange={onChange}
    type={type}
    placeholder={placeholder}
    className="w-full p-3 rounded-lg bg-light-surface/50 dark:bg-dark-surface/50 text-light-text-primary dark:text-dark-text-primary border border-light-border/30 dark:border-dark-border/30 focus:border-matrix-green focus:outline-none transition-all shadow-inner"
    {...props}
  />
);

export const Select = ({ name, value, onChange, children, multiple, ...props }) => (
  <select
    name={name}
    value={value}
    onChange={onChange}
    multiple={multiple}
    className="w-full p-3 rounded-lg bg-light-surface/50 dark:bg-dark-surface/50 text-light-text-primary dark:text-dark-text-primary border border-light-border/30 dark:border-dark-border/30 focus:border-matrix-green focus:outline-none transition-all shadow-inner"
    {...props}
  >
    {children}
  </select>
);

export const Button = ({ children, onClick, disabled, variant = 'primary', size = 'md', ...props }) => {
  const base = 'px-4 py-2 rounded-lg font-semibold transition-all shadow-neon hover:shadow-neon-lg disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white',
    secondary: 'bg-light-accent dark:bg-dark-accent text-white',
  };
  const sizes = {
    sm: 'text-sm px-3 py-1',
    md: 'text-base px-4 py-2',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Label = ({ children }) => (
  <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
    {children}
  </label>
);

export const Table = ({ children }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse bg-light-surface/20 dark:bg-dark-surface/20 rounded-lg shadow-neon">{children}</table>
  </div>
);

export const TableHead = ({ children }) => (
  <thead className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">{children}</thead>
);

export const TableBody = ({ children }) => <tbody>{children}</tbody>;

export const TableRow = ({ children }) => (
  <tr className="border-b border-light-border/20 dark:border-dark-border/20 hover:bg-light-surface/10 dark:hover:bg-dark-surface/10 transition-colors">{children}</tr>
);

export const TableCell = ({ children }) => (
  <td className="p-3 text-light-text-primary dark:text-dark-text-primary">{children}</td>
);