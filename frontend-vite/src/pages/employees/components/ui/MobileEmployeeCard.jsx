import React from 'react';
import { ChevronRight } from 'lucide-react';
import EmployeeAvatar from './EmployeeAvatar';
import DeltaPill from '../../../../components/ui/DeltaPill';

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

const MobileEmployeeCard = ({ emp, onClick, t }) => {
  const name =
    [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno].filter(Boolean).map(s => String(s).trim()).join(' ') ||
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
      <div className="relative rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition p-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar emp={emp} size={44} />
          <div className="flex-1 min-w-0">
            {/* Name + delta */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary truncate">
                {name}
              </span>
              <div className="flex-1" />
              <DeltaPill value={delta} t={t} />
            </div>

            {/* RUT + chevron */}
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                {t('employees.table.rut')}: {emp?.rut ?? '—'}
              </span>
              <ChevronRight className="w-4 h-4 text-light-text-secondary/60 dark:text-dark-text-secondary/60 group-hover:translate-x-0.5 transition" />
            </div>

            {/* Stats */}
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                {t('employees.payroll.columns.total_paid')}:{' '}
                <span className="font-semibold text-light-text-primary dark:text-dark-text-primary" title={fmtCLPFull.format(totalPaid)}>
                  {fmtCLPCompact(totalPaid)}
                </span>
              </span>
              <span className="text-light-border dark:text-dark-border">·</span>
              <span className="text-light-text-secondary dark:text-dark-text-secondary">
                {t('employees.payroll.columns.net_previous')}:{' '}
                <span className="font-semibold text-light-text-primary dark:text-dark-text-primary" title={fmtCLPFull.format(prevNet)}>
                  {fmtCLPCompact(prevNet)}
                </span>
              </span>
            </div>

            {/* Meta chips */}
            <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden">
              {emp?.cargo && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[40%]">
                  {emp.cargo}
                </span>
              )}
              {emp?.sucursal && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[40%]">
                  {emp.sucursal}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default MobileEmployeeCard;
