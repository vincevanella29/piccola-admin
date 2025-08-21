import React from 'react';
import ResumenWidget from './resumen';

const GastosWidget = ({ data, comparisonData, comparisonType, nonce, loading = false }) => {
  const resumenes = [...new Set((data || []).map(d => d.series))];
  return (
    <ResumenWidget
      nonce={nonce}
      resumenes={resumenes}
      data={data}
      comparisonData={comparisonData}
      defaultGranularity="day"
      comparisonType={comparisonType}
      labelKey="label"
      valueKey="value"
      dateKey="date"
      alignByIndex={false}
      labelName="Gastos"
      loading={loading}
      valueData={(items, type) => {
        if (Array.isArray(items)) {
          return items.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
        } else if (items && typeof items === 'object') {
          return Object.values(items).flat().reduce((acc, r) => acc + (Number(r.value) || 0), 0);
        }
        return 0;
      }}
    />
  );
};

export default React.memo(GastosWidget);
