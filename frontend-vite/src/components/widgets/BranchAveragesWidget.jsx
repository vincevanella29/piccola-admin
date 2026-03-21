import React from 'react';

const BranchAveragesWidget = ({
  title,
  branchesCount = 0,
  totalLabel = 'Total',
  avgEmployeesLabel = 'Avg employees/branch',
  avgSalaryLabel = 'Avg salary/branch',
  avgEmpPerBranch = 0,
  avgSalaryPerBranch = 0,
  formatCurrency,
}) => {
  const fmtCurrency = formatCurrency || ((n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  );

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-0.5">{title}</p>
      )}
      <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
        {branchesCount} <span className="text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">{totalLabel}</span>
      </p>
      <div className="mt-2 space-y-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <p>{avgEmployeesLabel}: <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{Number(avgEmpPerBranch).toFixed(1)}</span></p>
        <p>{avgSalaryLabel}: <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{fmtCurrency(avgSalaryPerBranch)}</span></p>
      </div>
    </div>
  );
};

export default BranchAveragesWidget;
