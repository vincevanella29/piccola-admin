import React from 'react';

const ResumenTotals = ({ t, mode, aggregatedData, selectedResumen, comparisonType, labelName = '', valueData = null }) => {
  const fmt = (n) => (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'CLP' });

  if (mode === 'aggregate') {
    let totalC = (aggregatedData.current || []).reduce((a, b) => a + (b?.value || 0), 0);
    let totalP = (aggregatedData.previous || []).reduce((a, b) => a + (b?.value || 0), 0);
    if (typeof valueData === 'function') {
      totalC = valueData(aggregatedData.current, 'current');
      totalP = valueData(aggregatedData.previous, 'previous');
    }

    return (
      <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
        <span className="font-bold">{labelName && `${labelName} `}</span>
        <span className="text-light-accent dark:text-dark-accent font-semibold">{t('analytics.Total mostrado (Actual)')}: {fmt(totalC)}</span>
        {comparisonType !== 'none' && (
          <span> · {t('analytics.Total mostrado (Comparación)')}: {fmt(totalP)}</span>
        )}
      </p>
    );
  }

  // compare
  let totalC = (selectedResumen || []).reduce((acc, res) => acc + (aggregatedData.current?.[res] || []).reduce((a, b) => a + (b?.value || 0), 0), 0);
  let totalP = (selectedResumen || []).reduce((acc, res) => acc + (aggregatedData.previous?.[res] || []).reduce((a, b) => a + (b?.value || 0), 0), 0);
  if (typeof valueData === 'function') {
    totalC = valueData(aggregatedData.current, 'current');
    totalP = valueData(aggregatedData.previous, 'previous');
  }

  return (
    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
      <span className="font-bold">{labelName && `${labelName} `}</span>
      <span className="text-light-accent dark:text-dark-accent font-semibold">{t('analytics.Actual')}: {fmt(totalC)}</span>
      {comparisonType !== 'none' && (
        <span> · {t('analytics.Comparación')}: {fmt(totalP)}</span>
      )}
    </p>
  );
};

export default ResumenTotals;
