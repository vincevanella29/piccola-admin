import React from 'react';

const InformeResumen = ({ t, ventaTotal, ventaPrevTotal, gastoTotal, gastoPrevTotal, showComparison }) => {
  const fmt = (n) => (n ?? 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-2">
        {t('analytics.Informe')}
      </p>
      {showComparison ? (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">{t('analytics.Ventas', 'Ventas')}</p>
            <p className="font-bold text-light-text-primary dark:text-dark-text-primary">{fmt(ventaTotal)}</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">vs {fmt(ventaPrevTotal)}</p>
          </div>
          <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">{t('analytics.Gastos', 'Gastos')}</p>
            <p className="font-bold text-light-text-primary dark:text-dark-text-primary">{fmt(gastoTotal)}</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">vs {fmt(gastoPrevTotal)}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
          {t('analytics.Selecciona comparación para ver variaciones')}
        </p>
      )}
    </div>
  );
};

export default InformeResumen;
