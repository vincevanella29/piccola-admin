import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import useEmpleadosCache from '../../../hooks/useEmpleadosCache';

import EmployeeDetailHeader from './EmployeeDetailModal/Header';
import EmployeeDetailContent from './EmployeeDetailModal/Content';
import EmployeeDetailFooter from './EmployeeDetailModal/Footer';

const EmployeeDetailModal = ({ open, onClose, emp, appState }) => {
  const { t } = useTranslation();
  const {
    loadAsistenciaDiaria,
    loadAsistenciaDiariaWithComparison,
    loadSueldos,
    sueldosList,
    sueldosCount,
    loading,
    error
  } = useEmpleadosCache(appState);

  // ----- Asistencia
  const [attData, setAttData] = React.useState([]);
  const [attPrev, setAttPrev] = React.useState([]);
  const [comparisonWindow, setComparisonWindow] = React.useState({ start: null, end: null });

  // ----- Sueldos (separados por ventana actual vs anterior para comparación fiel)
  const [sueldosCurr, setSueldosCurr] = React.useState([]);
  const [sueldosPrev, setSueldosPrev] = React.useState([]);
  const [payrollWindows, setPayrollWindows] = React.useState({
    current: { start: null, end: null },
    previous: { start: null, end: null },
  });

  // Controles rango/comparación
  const [quickRange, setQuickRange] = React.useState('LAST_7_DAYS');
  const [pendingDateRange, setPendingDateRange] = React.useState({
    start: dayjs().subtract(6, 'day').startOf('day').toDate(),
    end: dayjs().endOf('day').toDate()
  });
  const [pendingConfig, setPendingConfig] = React.useState({ comparisonType: 'none', compareByWeekdays: false });

  const handlePendingDateRangeChange = (key) => (value) =>
    setPendingDateRange((s) => ({ ...s, [key]: value }));

  const handlePendingConfigChange = (key) => (e) =>
    setPendingConfig((s) => ({ ...s, [key]: e.target.value }));

  const handleApply = React.useCallback(async () => {
    if (!emp?.rut) return;
    const cfg = pendingConfig || { comparisonType: 'none', compareByWeekdays: false };

    // --------- CON COMPARACIÓN
    if (cfg.comparisonType && cfg.comparisonType !== 'none') {
      const res = await loadAsistenciaDiariaWithComparison(
        {
          rut: String(emp.rut),
          start_date: pendingDateRange.start,
          end_date: pendingDateRange.end,
          skip: 0,
          limit: null
        },
        cfg
      );
      console.log("asistencia con comparación", res);
      const curr = Array.isArray(res?.current) ? res.current : [];
      const prev = Array.isArray(res?.previous) ? res.previous : [];
      setAttData(curr);
      setAttPrev(prev);
      setComparisonWindow({ start: res?.comparisonStart || null, end: res?.comparisonEnd || null });

      try {
        const start = dayjs(pendingDateRange.start);
        const end = dayjs(pendingDateRange.end);
        let prevStart = start;
        let prevEnd = end;
        if (cfg.comparisonType === 'same_period') {
          prevStart = start.subtract(1, 'year');
          prevEnd = end.subtract(1, 'year');
        } else if (cfg.comparisonType === 'previous_period') {
          const days = end.diff(start, 'day') + 1;
          prevEnd = start.subtract(1, 'day');
          prevStart = prevEnd.subtract(days - 1, 'day');
        }

        // Guardamos ventanas de payroll exactas (para etiquetas y “data fiel”)
        setPayrollWindows({
          current: { start: start.toDate(), end: end.toDate() },
          previous: { start: prevStart.toDate(), end: prevEnd.toDate() },
        });

        // Parametrizamos por YYYYMM
        const currPeriodoStart = start.format('YYYYMM');
        const currPeriodoEnd = end.format('YYYYMM');
        const prevPeriodoStart = prevStart.format('YYYYMM');
        const prevPeriodoEnd = prevEnd.format('YYYYMM');

        const currS = await loadSueldos({
          rut: String(emp.rut),
          periodo_start: currPeriodoStart,
          periodo_end: currPeriodoEnd,
          skip: 0,
          limit: 200
        });
        const prevS = await loadSueldos({
          rut: String(emp.rut),
          periodo_start: prevPeriodoStart,
          periodo_end: prevPeriodoEnd,
          skip: 0,
          limit: 200
        });

        const extract = (resS) =>
          Array.isArray(resS?.items)
            ? resS.items
            : Array.isArray(resS)
            ? resS
            : Array.isArray(resS?.asistencia)
            ? resS.asistencia
            : [];

        setSueldosCurr(extract(currS));
        setSueldosPrev(extract(prevS));
      } catch (_) {}
      return;
    }

    // --------- SIN COMPARACIÓN
    const res = await loadAsistenciaDiaria({
      rut: String(emp.rut),
      start_date: pendingDateRange.start,
      end_date: pendingDateRange.end,
      skip: 0,
      limit: null
    });
    console.log("asistencia sin comparación", res);
    const list = Array.isArray(res)
      ? res
      : Array.isArray(res?.asistencia)
      ? res.asistencia
      : Array.isArray(res?.items)
      ? res.items
      : [];

    setAttData(list);
    setAttPrev([]);
    setComparisonWindow({ start: null, end: null });

    try {
      const periodo_start = dayjs(pendingDateRange.start).format('YYYYMM');
      const periodo_end = dayjs(pendingDateRange.end).format('YYYYMM');
      const resS = await loadSueldos({
        rut: String(emp.rut),
        periodo_start,
        periodo_end,
        skip: 0,
        limit: 200
      });
      const items = Array.isArray(resS?.items)
        ? resS.items
        : Array.isArray(resS)
        ? resS
        : Array.isArray(resS?.asistencia)
        ? resS.asistencia
        : [];
      setSueldosCurr(items || []);
      setSueldosPrev([]);
      setPayrollWindows({
        current: { start: pendingDateRange.start, end: pendingDateRange.end },
        previous: { start: null, end: null },
      });
    } catch (_) {}
  }, [
    emp?.rut,
    pendingConfig,
    loadAsistenciaDiaria,
    loadAsistenciaDiariaWithComparison,
    loadSueldos,
    pendingDateRange.start,
    pendingDateRange.end
  ]);

  // Limpiar al abrir/cambiar empleado
  React.useEffect(() => {
    if (open) {
      setAttData([]);
      setAttPrev([]);
      setSueldosCurr([]);
      setSueldosPrev([]);
    }
  }, [open, emp?.rut]);

  const comparisonEnabled = (pendingConfig?.comparisonType && pendingConfig.comparisonType !== 'none');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: '100%',
          width: '100%',
          m: { xs: 1.25, sm: 2.5 },
          borderRadius: 3, // ~24px
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 18px 50px rgba(0,0,0,0.28)'
        }
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(0,0,0,0.35)'
          }
        }
      }}
    >
      <DialogTitle
        className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
        sx={{
          py: 1.25,
          px: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <EmployeeDetailHeader emp={emp} t={t} onClose={onClose} />
      </DialogTitle>

      <DialogContent
        className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
        sx={{ maxWidth: '100%', overflowX: 'hidden', px: { xs: 1.5, sm: 2 }, py: { xs: 1.25, sm: 1.75 } }}
      >
        <EmployeeDetailContent
          t={t}
          emp={emp}
          // asistencia
          attData={attData}
          attPrev={attPrev}
          comparisonWindow={comparisonWindow}
          // sueldos
          sueldosCurr={sueldosCurr}
          sueldosPrev={sueldosPrev}
          sueldosList={sueldosList}
          sueldosCount={sueldosCount}
          payrollWindows={payrollWindows}
          // estado
          loading={loading}
          error={error}
          // controles
          quickRange={quickRange}
          setQuickRange={setQuickRange}
          pendingDateRange={pendingDateRange}
          handlePendingDateRangeChange={handlePendingDateRangeChange}
          pendingConfig={pendingConfig}
          handlePendingConfigChange={handlePendingConfigChange}
          handleApply={handleApply}
          // flags
          comparisonEnabled={comparisonEnabled}
        />
      </DialogContent>

      <DialogActions
        className="bg-light-surface dark:bg-dark-surface"
        sx={{
          py: 1,
          px: { xs: 1.5, sm: 2 },
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <EmployeeDetailFooter t={t} onClose={onClose} />
      </DialogActions>
    </Dialog>
  );
};

export default EmployeeDetailModal;
