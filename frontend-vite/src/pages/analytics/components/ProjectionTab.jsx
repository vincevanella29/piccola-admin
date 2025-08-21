// src/pages/analytics/ProjectionTab.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, TextField } from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import ProjectionWidget from './widgets/ProjectionWidget';
import dayjs from 'dayjs';

const ProjectionTab = ({ appState }) => {
  const { t } = useTranslation();
  const [pendingDateRange, setPendingDateRange] = useState({ start: null, end: null });
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [shouldFetch, setShouldFetch] = useState(false);

  // Siempre proyecta comparando año actual vs año pasado
  // Aquí puedes agregar tu lógica de proyección personalizada si lo deseas.

  const handlePendingDateRangeChange = (field) => (date) => {
    setPendingDateRange((prev) => ({ ...prev, [field]: date }));
  };

  const handleApply = () => {
    setDateRange(pendingDateRange);
    setShouldFetch(true);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%', p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('Proyección de Gastos')}
        </Typography>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <DatePicker
            label={t('Fecha Inicio')}
            value={pendingDateRange.start}
            onChange={handlePendingDateRangeChange('start')}
            renderInput={(params) => <TextField {...params} size="small" />}
          />
          <DatePicker
            label={t('Fecha Fin')}
            value={pendingDateRange.end}
            onChange={handlePendingDateRangeChange('end')}
            renderInput={(params) => <TextField {...params} size="small" />}
          />
          <Button onClick={handleApply} disabled={!pendingDateRange.start || !pendingDateRange.end}>
            {t('Proyectar')}
          </Button>
        </Box>
        {/*
        {isLoading && <Typography>{t('Cargando proyección...')}</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        {projection?.warning && (
          <Typography color="warning.main">{projection.warning}</Typography>
        )}
        <ProjectionWidget projection={projection} />
        */}
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectionTab;
