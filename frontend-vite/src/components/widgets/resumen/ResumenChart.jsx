import React from 'react';
import { Box, Typography } from '@mui/material';
import { Line } from 'react-chartjs-2';

const ResumenChart = ({ mode, aggregatedData, chartData, chartOptions, height = 180, t }) => {
  const hasData =
    (mode === 'aggregate' && ((aggregatedData.current || []).length > 0 || (aggregatedData.previous || []).length > 0)) ||
    (mode === 'compare' && Object.keys(aggregatedData.current || {}).length > 0);

  return (
    <Box sx={{ height }}>
      {hasData ? (
        <Line data={chartData} options={chartOptions} />
      ) : (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 6 }}>
          {t('analytics.No hay datos para graficar este resumen.')}
        </Typography>
      )}
    </Box>
  );
};

export default ResumenChart;
