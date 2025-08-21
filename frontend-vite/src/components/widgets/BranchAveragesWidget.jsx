import React from 'react';
import { Box } from '@mui/material';

/**
 * BranchAveragesWidget
 * Displays number of branches, avg employees/branch, and avg salary/branch.
 * Props:
 * - title: string (e.g., translated 'Sucursal')
 * - branchesCount: number
 * - totalLabel: string (e.g., translated 'Total')
 * - avgEmployeesLabel: string
 * - avgSalaryLabel: string
 * - avgEmpPerBranch: number
 * - avgSalaryPerBranch: number
 * - formatCurrency: fn(number) => string (optional)
 */
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
  const fmtCurrency = formatCurrency || ((n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n));

  return (
    <Box className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-3">
      {title && (
        <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{title}</div>
      )}
      <div className="text-lg font-semibold">{branchesCount} {totalLabel}</div>
      <div className="mt-1 text-xs grid grid-cols-1 gap-1">
        <span>{avgEmployeesLabel}: <b>{Number(avgEmpPerBranch).toFixed(1)}</b></span>
        <span>{avgSalaryLabel}: <b>{fmtCurrency(avgSalaryPerBranch)}</b></span>
      </div>
    </Box>
  );
};

export default BranchAveragesWidget;
