import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EmployeeAvatar from './EmployeeAvatar';
import DeltaPill from '../../../../components/ui/DeltaPill';

// --- formato compacto ---
const fmtCLPFull = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
function compactNumber(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '')}b`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '')}m`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${sign}${Math.round(abs)}`;
}
function fmtCLPCompact(n = 0) {
  if (n == null || isNaN(n)) return '—';
  return `$${compactNumber(n)}`;
}

const Stat = ({ label, value }) => (
  <Box className="inline-flex items-baseline gap-1">
    <span className="text-light-text-secondary dark:text-dark-text-secondary text-[11px]">{label}:</span>
    <Tooltip title={fmtCLPFull.format(Number(value || 0))} arrow>
      <span className="text-[13px] font-semibold">{fmtCLPCompact(Number(value || 0))}</span>
    </Tooltip>
  </Box>
);

// DeltaPill now imported from shared UI

const MobileEmployeeCard = ({ emp, onClick, t }) => {
  const name =
    [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno].filter(Boolean).map((s) => String(s).trim()).join(' ') ||
    t('employees.table.unknown');

  const prevNet = Number(emp?.payroll?.previous?.net || 0);
  const anteNet = Number(emp?.payroll?.anteprevious?.net || 0);
  const totalPaid = Number(emp?.payroll?.totals?.total || 0);
  const delta = anteNet > 0 ? ((prevNet - anteNet) / anteNet) * 100 : (prevNet > 0 ? 100 : null);

  return (
    <button
      onClick={onClick}
      className="w-full text-left focus:outline-none group"
      aria-label={`${name} - ${t('employees.table.rut')}: ${emp?.rut ?? '-'}`}
    >
      <Box
        className="relative rounded-3xl border border-light-accent/25 dark:border-dark-accent/25 bg-light-surface/70 dark:bg-dark-surface/70 backdrop-blur-md shadow-neon hover:shadow-neon hover:bg-light-surface/80 dark:hover:bg-dark-surface/80 transition"
        sx={{ p: 1.0 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmployeeAvatar emp={emp} size={44} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* fila superior: nombre + delta */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" className="font-semibold truncate tracking-tight">
                {name}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <DeltaPill value={delta} t={t} />
            </Box>

            {/* subinfo: RUT y mini-stats en línea */}
            <Box className="mt-0.5 flex items-center justify-between gap-2">
              <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary truncate">
                {t('employees.table.rut')}: {emp?.rut ?? '—'}
              </Typography>
              <ChevronRightIcon className="opacity-70 group-hover:translate-x-[2px] transition" />
            </Box>

            {/* stats compactas */}
            <Box className="mt-1 flex items-center gap-3">
              <Stat label={t('employees.payroll.columns.total_paid') || 'Total sueldo'} value={totalPaid} />
              <span className="text-light-text-secondary dark:text-dark-text-secondary">•</span>
              <Stat label={t('employees.payroll.columns.net_previous') || 'Líquido (anterior)'} value={prevNet} />
            </Box>

            {/* meta chips ultra compactas (una línea como máximo) */}
            <Box className="mt-1 flex items-center gap-1 overflow-hidden">
              {emp?.cargo ? (
                <Chip
                  size="small"
                  label={emp.cargo}
                  className="text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30"
                  sx={{ height: 20, maxWidth: '40%', '& .MuiChip-label': { px: 1 } }}
                />
              ) : null}
              {emp?.sucursal ? (
                <Chip
                  size="small"
                  label={emp.sucursal}
                  variant="outlined"
                  className="text-light-text-secondary dark:text-dark-text-secondary"
                  sx={{ height: 20, maxWidth: '40%', '& .MuiChip-label': { px: 1 } }}
                />
              ) : null}
              {/* no mostramos ingreso para mantener altura ultra-compacta */}
            </Box>
          </Box>
        </Box>
      </Box>
    </button>
  );
};

export default MobileEmployeeCard;
