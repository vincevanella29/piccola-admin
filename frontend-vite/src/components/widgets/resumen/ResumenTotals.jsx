import React from 'react';
import { Typography } from '@mui/material';

const ResumenTotals = ({ t, mode, aggregatedData, selectedResumen, comparisonType, labelName = '', valueData = null }) => {
  if (mode === 'aggregate') {
    let totalC = (aggregatedData.current || []).reduce((a, b) => a + (b?.value || 0), 0);
    let totalP = (aggregatedData.previous || []).reduce((a, b) => a + (b?.value || 0), 0);
    if (typeof valueData === 'function') {
      totalC = valueData(aggregatedData.current, 'current');
      totalP = valueData(aggregatedData.previous, 'previous');
    }
    let str = `${labelName ? labelName + ': ' : ''}${t('analytics.Total mostrado (Actual)')}: ${totalC.toLocaleString(undefined, { style: 'currency', currency: 'CLP' })}`;
    if (comparisonType !== 'none') {
      str += ` | ${t('analytics.Total mostrado (Comparación)')}: ${totalP.toLocaleString(undefined, { style: 'currency', currency: 'CLP' })}`;
    }
    return <Typography className="text-light-text-primary dark:text-dark-text-primary" variant="caption">{str}</Typography>;
  }

  // compare (sum all selectedResumen, do not show names)
  let totalC = (selectedResumen || []).reduce((acc, res) => acc + (aggregatedData.current?.[res] || []).reduce((a, b) => a + (b?.value || 0), 0), 0);
  let totalP = (selectedResumen || []).reduce((acc, res) => acc + (aggregatedData.previous?.[res] || []).reduce((a, b) => a + (b?.value || 0), 0), 0);
  if (typeof valueData === 'function') {
    totalC = valueData(aggregatedData.current, 'current');
    totalP = valueData(aggregatedData.previous, 'previous');
  }
  let str = `${labelName ? labelName + ': ' : ''}${t('analytics.Actual')}: ${totalC.toLocaleString(undefined, { style: 'currency', currency: 'CLP' })}`;
  if (comparisonType !== 'none') {
    str += ` | ${t('analytics.Comparación')}: ${totalP.toLocaleString(undefined, { style: 'currency', currency: 'CLP' })}`;
  }
  return <Typography variant="caption" className="text-light-text-primary dark:text-dark-text-primary">{str}</Typography>;
};

export default ResumenTotals;
