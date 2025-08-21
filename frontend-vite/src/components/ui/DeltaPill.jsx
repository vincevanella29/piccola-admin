import React from 'react';
import { Chip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// Format percentage with 1 decimal (strip .0)
const pct1 = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const v = Math.abs(n).toFixed(1).replace(/\.0$/, '');
  return `${v}%`;
};

/**
 * DeltaPill
 * Reusable pill to display percentage deltas with color and arrow direction.
 * Props:
 * - value: number | null
 * - goodWhenUp: boolean (default true) -> controls green/purple semantics
 * - size: 'small' | 'medium' (default 'small')
 * - className: string (optional)
 * - sx: system style overrides (optional)
 * - t: i18n function (optional) used for aria-label
 */
const DeltaPill = ({ value, goodWhenUp = true, size = 'small', className = '', sx = {}, t }) => {
  if (value == null || !isFinite(value)) {
    return (
      <Chip
        size={size}
        label="—"
        className={`bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary ${className}`}
        sx={{ height: 22, borderRadius: '9999px', ...sx }}
      />
    );
  }

  const up = value >= 0;
  // Use CSS vars if present; fallback to hex.
  const positive = 'var(--matrix-green, #10b981)';
  const negative = 'var(--vanellix-purple, #7c3aed)';
  const tone = up ? (goodWhenUp ? positive : negative) : (goodWhenUp ? negative : positive);

  return (
    <Chip
      size={size}
      className={`bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 ${className}`}
      icon={up ? <ArrowUpwardIcon fontSize="small" htmlColor={tone} /> : <ArrowDownwardIcon fontSize="small" htmlColor={tone} />}
      label={pct1(value)}
      sx={{ height: 22, borderRadius: '9999px', fontWeight: 700, color: `${tone} !important`, '& .MuiChip-icon': { marginLeft: '4px', color: 'inherit' }, ...sx }}
      aria-label={`${t ? (t('employees.common.change_pct') || '% cambio') : '% cambio'} ${pct1(value)}`}
    />
  );
};

export default DeltaPill;
