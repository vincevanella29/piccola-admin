import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import useEmpleadosCache from '../../../hooks/useEmpleadosCache';
import ControlsBar from '../../../components/widgets/ControlsBar';

import ProfileTab from './EmployeeDetailModal/ProfileTab';
import PayrollTab from './EmployeeDetailModal/PayrollTab';
import AttendanceTab from './EmployeeDetailModal/AttendanceTab';

// ── Helpers ──────────────────────────────────────────────────────────────────
function initialsFrom(emp) {
  const parts = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno]
    .filter(Boolean).map(s => String(s).trim());
  const name = parts.join(' ').trim();
  if (!name) return '??';
  const tokens = name.split(/\s+/);
  return ((tokens[0]?.[0] || '') + (tokens[1]?.[0] || '')).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════════════════
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

  // ── State ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = React.useState(0);
  const [attData, setAttData] = React.useState([]);
  const [attPrev, setAttPrev] = React.useState([]);
  const [comparisonWindow, setComparisonWindow] = React.useState({ start: null, end: null });

  const [sueldosCurr, setSueldosCurr] = React.useState([]);
  const [sueldosPrev, setSueldosPrev] = React.useState([]);
  const [payrollWindows, setPayrollWindows] = React.useState({
    current: { start: null, end: null },
    previous: { start: null, end: null },
  });

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

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = React.useCallback(async () => {
    if (!emp?.rut) return;
    const cfg = pendingConfig || { comparisonType: 'none', compareByWeekdays: false };

    if (cfg.comparisonType && cfg.comparisonType !== 'none') {
      const res = await loadAsistenciaDiariaWithComparison(
        { rut: String(emp.rut), start_date: pendingDateRange.start, end_date: pendingDateRange.end, skip: 0, limit: null },
        cfg
      );
      const curr = Array.isArray(res?.current) ? res.current : [];
      const prev = Array.isArray(res?.previous) ? res.previous : [];
      setAttData(curr);
      setAttPrev(prev);
      setComparisonWindow({ start: res?.comparisonStart || null, end: res?.comparisonEnd || null });

      try {
        const start = dayjs(pendingDateRange.start);
        const end = dayjs(pendingDateRange.end);
        let prevStart = start, prevEnd = end;
        if (cfg.comparisonType === 'same_period') {
          prevStart = start.subtract(1, 'year');
          prevEnd = end.subtract(1, 'year');
        } else if (cfg.comparisonType === 'previous_period') {
          const days = end.diff(start, 'day') + 1;
          prevEnd = start.subtract(1, 'day');
          prevStart = prevEnd.subtract(days - 1, 'day');
        }

        setPayrollWindows({ current: { start: start.toDate(), end: end.toDate() }, previous: { start: prevStart.toDate(), end: prevEnd.toDate() } });

        const extract = (resS) => Array.isArray(resS?.items) ? resS.items : Array.isArray(resS) ? resS : Array.isArray(resS?.asistencia) ? resS.asistencia : [];

        const currS = await loadSueldos({ rut: String(emp.rut), periodo_start: start.format('YYYYMM'), periodo_end: end.format('YYYYMM'), skip: 0, limit: 200 });
        const prevS = await loadSueldos({ rut: String(emp.rut), periodo_start: prevStart.format('YYYYMM'), periodo_end: prevEnd.format('YYYYMM'), skip: 0, limit: 200 });
        setSueldosCurr(extract(currS));
        setSueldosPrev(extract(prevS));
      } catch (_) {}
      return;
    }

    const res = await loadAsistenciaDiaria({ rut: String(emp.rut), start_date: pendingDateRange.start, end_date: pendingDateRange.end, skip: 0, limit: null });
    const list = Array.isArray(res) ? res : Array.isArray(res?.asistencia) ? res.asistencia : Array.isArray(res?.items) ? res.items : [];
    setAttData(list);
    setAttPrev([]);
    setComparisonWindow({ start: null, end: null });

    try {
      const periodo_start = dayjs(pendingDateRange.start).format('YYYYMM');
      const periodo_end = dayjs(pendingDateRange.end).format('YYYYMM');
      const resS = await loadSueldos({ rut: String(emp.rut), periodo_start, periodo_end, skip: 0, limit: 200 });
      const items = Array.isArray(resS?.items) ? resS.items : Array.isArray(resS) ? resS : Array.isArray(resS?.asistencia) ? resS.asistencia : [];
      setSueldosCurr(items || []);
      setSueldosPrev([]);
      setPayrollWindows({ current: { start: pendingDateRange.start, end: pendingDateRange.end }, previous: { start: null, end: null } });
    } catch (_) {}
  }, [emp?.rut, pendingConfig, loadAsistenciaDiaria, loadAsistenciaDiariaWithComparison, loadSueldos, pendingDateRange.start, pendingDateRange.end]);

  React.useEffect(() => {
    if (open) { setAttData([]); setAttPrev([]); setSueldosCurr([]); setSueldosPrev([]); setTab(0); }
  }, [open, emp?.rut]);

  const comparisonEnabled = pendingConfig?.comparisonType && pendingConfig.comparisonType !== 'none';

  // ── Derived data ──────────────────────────────────────────────────────────
  const name = React.useMemo(() => {
    const parts = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno].filter(Boolean).map(s => String(s).trim());
    return parts.join(' ') || t('employees.table.unknown');
  }, [emp, t]);

  const tabs = [
    { id: 0, label: t('employees.tabs.profile'), icon: '👤' },
    { id: 1, label: t('employees.tabs.payroll'), icon: '💰' },
    { id: 2, label: t('employees.tabs.attendance'), icon: '📋' },
  ];

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
          >
            <div
              className="w-full max-w-5xl bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border shadow-2xl overflow-hidden my-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ─── Header ────────────────────────────────────────────── */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-light-border dark:border-dark-border">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center text-lg font-black text-light-accent dark:text-dark-accent shrink-0">
                  {emp?.profile_image_url ? (
                    <img src={emp.profile_image_url} alt={name} className="w-14 h-14 rounded-2xl object-cover" />
                  ) : (
                    initialsFrom(emp)
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary truncate">{name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                      {t('employees.table.rut')}: {emp?.rut ?? '—'}
                    </span>
                    <span className="text-light-border dark:text-dark-border">·</span>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {emp?.cargo ?? '—'}
                    </span>
                    <span className="text-light-border dark:text-dark-border">·</span>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {emp?.sucursal ?? '—'}
                    </span>
                    {emp?.seccion && (
                      <>
                        <span className="text-light-border dark:text-dark-border">·</span>
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{emp.seccion}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {emp?.activo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {t('employees.profile.active')}
                    </span>
                  )}
                  {emp?.nongrata && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500">
                      {t('employees.profile.blacklisted')}
                    </span>
                  )}
                </div>

                {/* Close */}
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/30 transition text-light-text-secondary dark:text-dark-text-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ─── Controls ──────────────────────────────────────────── */}
              <div className="px-5 py-3 border-b border-light-border/50 dark:border-dark-border/50">
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
              </div>

              {/* ─── Tabs ──────────────────────────────────────────────── */}
              <div className="px-5 pt-3">
                <div className="flex gap-1 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 rounded-xl p-1">
                  {tabs.map(tb => (
                    <button
                      key={tb.id}
                      onClick={() => setTab(tb.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        tab === tb.id
                          ? 'bg-light-accent dark:bg-dark-accent text-white shadow-sm'
                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                      }`}
                    >
                      <span>{tb.icon}</span>
                      {tb.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Tab Content ───────────────────────────────────────── */}
              <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                {tab === 0 && <ProfileTab t={t} emp={emp} />}

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
              </div>

              {/* ─── Footer ────────────────────────────────────────────── */}
              <div className="flex justify-end px-5 py-3 border-t border-light-border dark:border-dark-border">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-bold hover:opacity-90 transition"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EmployeeDetailModal;
