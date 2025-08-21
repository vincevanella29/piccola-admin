// src/pages/analytics/components/ValuationTab.jsx
import React from 'react';
import { Box, Typography } from '@mui/material';

// Placeholder for the new Valorización de Compañía dashboard.
// We'll add: selector de locales/sucursales, unir locales, KPIs (EBITDA),
// proyección a 5 años con escenarios (pesimista/moderado/optimista),
// y widgets de: precio promedio por familia, personas por sección,
// capacidad (mesas/sillas) por sucursal, etc.

export default function ValuationTab({ appState }) {
  return (
    <Box className="bg-light-surface dark:bg-dark-surface rounded-3xl p-4 shadow-modal">
      <Typography variant="h6" gutterBottom>
        Valorización de Compañía (beta)
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Próximamente: configuración por sucursal/locale, consolidación de locales, métricas de capacidad y
        proyecciones a 5 años con escenarios. Este módulo usará ventas, gastos, personas y costos por familia para
        estimar EBITDA y valuación.
      </Typography>
    </Box>
  );
}
