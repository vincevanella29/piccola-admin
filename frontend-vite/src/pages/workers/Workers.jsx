import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkersApi } from '../../hooks/useWorkersApi';
import WorkersView from './components/WorkersView';

const Workers = ({ appState }) => {
  const { t } = useTranslation();
  const {
    workers,
    workersMeta,
    isLoading,
    error,
    executionResults,
    executionSummary,
    getWorkers,
    runWorkers,
  } = useWorkersApi(appState);

  useEffect(() => {
    getWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full text-light-text-primary dark:text-dark-text-primary">
      <WorkersView
        t={t}
        workers={workers}
        workersMeta={workersMeta}
        isLoading={isLoading}
        error={error}
        runWorkers={runWorkers}
        executionResults={executionResults}
        executionSummary={executionSummary}
      />
    </div>
  );
};

export default Workers;

export const pageMetadata = {
  path: '/app/workers',
  label: 'workers.label',
  category: 'admin.tools.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 1,
  locations: ['sidebar'],
  description: 'workers.description',
  icon: 'FaCogs',
  isMainPage: true,
  isSearchable: true,
};
