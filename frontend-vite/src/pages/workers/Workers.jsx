import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import { useWorkersApi } from '../../hooks/useWorkersApi';
import WorkersView from './components/WorkersView';

const Workers = ({ appState }) => {
  const { t } = useTranslation();
  const {
    workers,
    isLoading,
    error,
    executionResults,
    getWorkers,
    runWorkers,
  } = useWorkersApi(appState);

  useEffect(() => {
    getWorkers();
    // eslint-disable-next-line
  }, []);

  return (
    <Box
      sx={{ width: '100%', p: 2 }}
      className="text-light-text-primary dark:text-dark-text-primary min-h-[80vh] rounded-3xl shadow-neon"
    >
      <WorkersView
        t={t}
        workers={workers}
        isLoading={isLoading}
        error={error}
        runWorkers={runWorkers}
        executionResults={executionResults}
        isExecuteTab
      />
    </Box>
  );
};

export default Workers;

export const pageMetadata = {
  path: '/app/workers',
  label: 'workers.label',
  category: 'workers.Workers',
  minRoleLevel: 3,
  order: 2,
  locations: ['sidebar'],
  description: 'workers.description',
  icon: 'FaTools',
  isMainPage: true,
  isSearchable: true,
};
