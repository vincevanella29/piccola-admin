// src/pages/employees_register/components/ui/KpiCard.jsx

import React from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function KpiCard({ title, value, unit, icon: Icon, small = false, rankLocal, rankEmpresa }) {
  const { t } = useTranslation();
  const displayValue = Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-CL') : (value ?? '-');

  return (
    <div className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/20 dark:border-dark-border/20 rounded-xl p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between text-light-text-secondary dark:text-dark-text-secondary">
        <span className="text-sm font-semibold">{title}</span>
        {Icon ? <Icon size={20} /> : null}
      </div>
      <div className="mt-2">
        <span className={`${small ? 'text-xl' : 'text-3xl'} font-bold text-light-text-primary dark:text-dark-text-primary`}>{displayValue}</span>
        <span className={`${small ? 'text-sm' : 'text-lg'} ml-1 text-light-text-secondary dark:text-dark-text-secondary`}>{unit}</span>
      </div>
      {(rankLocal || rankEmpresa) && (
        <div className="flex items-center gap-4 text-xs font-mono mt-2 pt-2 border-t border-light-border/10 dark:border-dark-border/10">
          {rankLocal && (
            <span className="flex items-center gap-1 text-yellow-400" data-tooltip-id="dashboard-tooltip" data-tooltip-content={t('mificha.puesto_local', 'Puesto Local')}>
              <Award size={14} /> L#{rankLocal}
            </span>
          )}
          {rankEmpresa && (
            <span className="flex items-center gap-1 text-cyan-400" data-tooltip-id="dashboard-tooltip" data-tooltip-content={t('mificha.puesto_empresa', 'Puesto Empresa')}>
              <TrendingUp size={14} /> E#{rankEmpresa}
            </span>
          )}
        </div>
      )}
    </div>
  );
};