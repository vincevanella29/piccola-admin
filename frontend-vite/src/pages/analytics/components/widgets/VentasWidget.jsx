import React from 'react';
import ResumenWidget from './resumen';

const VentasWidget = ({ data, comparisonData, comparisonType, nonce }) => {
  const resumenes = [...new Set((data || []).map(d => d.series))];
  console.log('data', data);
  console.log('comparisonData', comparisonData);
  return (
    <ResumenWidget
      nonce={nonce}
      resumenes={resumenes}
      data={data}
      comparisonData={comparisonData}
      defaultResumen=""
      defaultGranularity="day"
      comparisonType={comparisonType}
      labelKey="label"
      valueKey="value"
      dateKey="date"
      alignByIndex={false}
      labelName="Ventas"
      valueData={(items, type) => {
        // items can be array or object depending on mode
        if (Array.isArray(items)) {
          return items.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
        } else if (items && typeof items === 'object') {
          // compare mode: sum all arrays
          return Object.values(items).flat().reduce((acc, r) => acc + (Number(r.value) || 0), 0);
        }
        return 0;
      }}
    />
  );
};

export default React.memo(VentasWidget);
