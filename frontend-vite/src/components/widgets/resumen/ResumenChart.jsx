import React from 'react';
import { Line } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';

const ResumenChart = ({ mode, aggregatedData, chartData, chartOptions, height = 180, t }) => {
  const hasData =
    (mode === 'aggregate' && ((aggregatedData.current || []).length > 0 || (aggregatedData.previous || []).length > 0)) ||
    (mode === 'compare' && Object.keys(aggregatedData.current || {}).length > 0);

  return (
    <div className="relative" style={{ height }}>
      {hasData ? (
        <Line data={chartData} options={chartOptions} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-light-text-secondary dark:text-dark-text-secondary">
          <BarChart3 size={24} className="opacity-20" />
          <p className="text-xs">
            {t('analytics.No hay datos para graficar este resumen.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default ResumenChart;
