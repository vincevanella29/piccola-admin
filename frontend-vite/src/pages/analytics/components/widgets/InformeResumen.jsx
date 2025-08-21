import React from 'react';
import { Box, Typography } from '@mui/material';

const InformeResumen = ({ t, ventaTotal, ventaPrevTotal, gastoTotal, gastoPrevTotal, showComparison }) => {
  return (
    <Box className="mt-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-2xl p-3">
      <Typography variant="subtitle2" className="mb-1">{t('analytics.Informe')}</Typography>
      <Typography variant="body2" className="text-light-text-secondary dark:text-dark-text-secondary">
        {showComparison
          ? t('analytics.Resumen comparación', {
              defaultValue: 'Ventas {venta} vs {ventaPrev} / Gastos {gasto} vs {gastoPrev}',
              venta: ventaTotal,
              ventaPrev: ventaPrevTotal,
              gasto: gastoTotal,
              gastoPrev: gastoPrevTotal,
            })
          : t('analytics.Selecciona comparación para ver variaciones')
        }
      </Typography>
    </Box>
  );
};

export default InformeResumen;
