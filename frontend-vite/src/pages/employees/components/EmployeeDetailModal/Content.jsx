import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';

import ControlsBar from '../../../../components/widgets/ControlsBar';

import ProfileTab from './ProfileTab';
import PayrollTab from './PayrollTab';
import AttendanceTab from './AttendanceTab';

const EmployeeDetailContent = ({
  t,
  emp,
  // asistencia
  attData, attPrev, comparisonWindow,
  // sueldos
  sueldosCurr, sueldosPrev, sueldosList, sueldosCount, payrollWindows,
  // estado
  loading, error,
  // controles
  quickRange, setQuickRange,
  pendingDateRange, handlePendingDateRangeChange,
  pendingConfig, handlePendingConfigChange, handleApply,
  // flags
  comparisonEnabled,
}) => {
  const [tab, setTab] = React.useState(0);

  return (
    <>
      {/* Controles arriba, aplican a todas las vistas */}
      <Box mb={2} sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
        <ControlsBar
          t={t}
          ventaMinDate={null}
          ventaMaxDate={null}
          gastoMinDate={null}
          gastoMaxDate={null}
          quickRange={quickRange}
          setQuickRange={setQuickRange}
          pendingDateRange={pendingDateRange}
          handlePendingDateRangeChange={handlePendingDateRangeChange}
          pendingConfig={pendingConfig}
          handlePendingConfigChange={handlePendingConfigChange}
          handleApply={handleApply}
          isLoading={loading}
          error={error}
        />
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab className="text-light-text-primary dark:text-dark-text-primary" label={t('employees.tabs.profile')} />
          <Tab className="text-light-text-primary dark:text-dark-text-primary" label={t('employees.tabs.payroll')} />
          <Tab className="text-light-text-primary dark:text-dark-text-primary" label={t('employees.tabs.attendance')} />
        </Tabs>
      </Box>

      {tab === 0 && (
        <ProfileTab t={t} emp={emp} />
      )}

      {tab === 1 && (
        <PayrollTab
          t={t}
          currItems={sueldosCurr}
          prevItems={sueldosPrev}
          fallbackList={sueldosList}
          count={sueldosCount}
          windows={payrollWindows}
          comparisonEnabled={comparisonEnabled}
        />
      )}

      {tab === 2 && (
        <AttendanceTab
          t={t}
          attData={attData}
          attPrev={attPrev}
          comparisonWindow={comparisonWindow}
        />
      )}
    </>
  );
};

export default EmployeeDetailContent;
