import React from 'react';
import { Search, ChevronDown, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
import DatePickerTheme from '../common/DatePickerTheme';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const resolveQuickRange = (key) => {
  const today = dayjs().endOf('day');
  switch (key) {
    case 'THIS_YEAR':    return { start: dayjs().startOf('year').toDate(), end: today.toDate() };
    case 'LAST_YEAR':    return { start: dayjs().subtract(1,'year').startOf('year').toDate(), end: dayjs().subtract(1,'year').endOf('year').toDate() };
    case 'LAST_2_YEARS': return { start: dayjs().subtract(2,'year').startOf('year').toDate(), end: today.toDate() };
    case 'THIS_WEEK':    return { start: dayjs().isoWeekday(1).startOf('day').toDate(), end: dayjs().isoWeekday(7).endOf('day').toDate() };
    case 'LAST_WEEK':    return { start: dayjs().subtract(1,'week').isoWeekday(1).startOf('day').toDate(), end: dayjs().subtract(1,'week').isoWeekday(7).endOf('day').toDate() };
    case 'LAST_7_DAYS':  return { start: dayjs().subtract(6,'day').startOf('day').toDate(), end: today.toDate() };
    case 'THIS_MONTH':   return { start: dayjs().startOf('month').toDate(), end: today.toDate() };
    case 'LAST_MONTH':   return { start: dayjs().subtract(1,'month').startOf('month').toDate(), end: dayjs().subtract(1,'month').endOf('month').toDate() };
    case 'TWO_AGO':      return { start: dayjs().subtract(2,'month').startOf('month').toDate(), end: dayjs().subtract(2,'month').endOf('month').toDate() };
    default:             return { start: null, end: null };
  }
};

const ControlsBar = ({
  t,
  ventaMinDate, ventaMaxDate,
  gastoMinDate, gastoMaxDate,
  quickRange, setQuickRange,
  pendingDateRange, handlePendingDateRangeChange,
  pendingConfig, handlePendingConfigChange,
  handleApply,
  empresaOptions = [],
  selectedEmpresaId = null,
  onSelectEmpresa,
  sucursalOptions = [],
  selectedSucursalIds = [],
  onSelectSucursales,
  isLoading, error,
}) => {
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    if (didInitRef.current) return;
    const needQuick = !quickRange || quickRange === 'CUSTOM';
    const needDates = !pendingDateRange?.start || !pendingDateRange?.end;
    const needCmp = pendingConfig?.comparisonType === 'none' || pendingConfig?.comparisonType == null;
    if (needQuick || needDates || needCmp) {
      const defKey = 'LAST_MONTH';
      setQuickRange?.(defKey);
      const { start, end } = resolveQuickRange(defKey);
      handlePendingDateRangeChange('start')(start);
      handlePendingDateRangeChange('end')(end);
      handlePendingConfigChange('comparisonType')({ target: { value: 'same_period' } });
      handlePendingConfigChange('compareByWeekdays')({ target: { value: true } });
    }
    didInitRef.current = true;
  }, [quickRange, pendingDateRange?.start, pendingDateRange?.end, pendingConfig?.comparisonType, pendingConfig?.compareByWeekdays, setQuickRange, handlePendingDateRangeChange, handlePendingConfigChange]);

  const minAll = React.useMemo(() => dayjs.min(ventaMinDate || dayjs(null), gastoMinDate || dayjs(null)), [ventaMinDate, gastoMinDate]);
  const maxAll = React.useMemo(() => dayjs.max(ventaMaxDate || dayjs(null), gastoMaxDate || dayjs(null)), [ventaMaxDate, gastoMaxDate]);

  const handleQuickSelect = (key) => {
    setQuickRange(key);
    const { start, end } = resolveQuickRange(key);
    if (key !== 'CUSTOM') {
      handlePendingDateRangeChange('start')(start);
      handlePendingDateRangeChange('end')(end);
    } else {
      handlePendingDateRangeChange('start')(null);
      handlePendingDateRangeChange('end')(null);
    }
  };

  const quickOptions = [
    { key: 'LAST_7_DAYS', label: t('analytics.Últimos 7 días') },
    { key: 'THIS_WEEK', label: t('analytics.Esta semana') },
    { key: 'LAST_WEEK', label: t('analytics.Semana pasada') },
    { key: 'THIS_MONTH', label: t('analytics.Este mes') },
    { key: 'LAST_MONTH', label: t('analytics.Mes pasado') },
    { key: 'THIS_YEAR', label: t('analytics.Este año') },
    { key: 'LAST_YEAR', label: t('analytics.Año pasado') },
    { key: 'LAST_2_YEARS', label: t('analytics.Últimos 2 años') },
    { key: 'TWO_AGO', label: t('analytics.Antepasado') },
    { key: 'CUSTOM', label: t('analytics.Personalizado') },
  ];

  const comparisonOptions = [
    { value: 'none', label: t('analytics.Sin comparación') },
    { value: 'same_period', label: t('analytics.Mismo período') },
    { value: 'previous_period', label: t('analytics.Período anterior'), disabled: quickRange === 'CUSTOM' },
  ];

  const SelectWrapper = ({ children, className = '' }) => (
    <div className={`relative ${className}`}>
      {children}
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
    </div>
  );

  const selectClass = `h-8 pl-2.5 pr-7 rounded-lg text-xs font-medium appearance-none cursor-pointer
    bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40
    text-light-text-primary dark:text-dark-text-primary
    border border-light-border/30 dark:border-dark-border/30
    focus:outline-none focus:border-light-accent/50 dark:focus:border-dark-accent/50
    transition-colors`;

  return (
    <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 space-y-3">

      {/* Row 1: Empresa + Branches + Comparison */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Company */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
            {t('analytics.Empresa')}
          </label>
          <SelectWrapper>
            <select
              value={selectedEmpresaId || ''}
              onChange={(e) => onSelectEmpresa?.(e.target.value || null)}
              className={selectClass}
            >
              <option value="">{t('analytics.Todas')}</option>
              {(empresaOptions || []).map((emp) => (
                <option key={emp.id || emp._id || emp.empresa_id || emp.value} value={emp.id || emp._id || emp.empresa_id || emp.value}>
                  {emp.nombre || emp.name || emp.label || `Empresa ${emp.id || emp._id || ''}`}
                </option>
              ))}
            </select>
          </SelectWrapper>
        </div>

        {/* Branches */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
            {t('analytics.Sucursales')}
          </label>
          <select
            multiple
            disabled={!selectedEmpresaId}
            value={Array.isArray(selectedSucursalIds) ? selectedSucursalIds : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
              onSelectSucursales?.(selected);
            }}
            className={`min-h-[32px] max-h-20 pl-2.5 pr-2.5 py-1 rounded-lg text-xs font-medium
              bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40
              text-light-text-primary dark:text-dark-text-primary
              border border-light-border/30 dark:border-dark-border/30
              focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed min-w-[120px]`}
          >
            {(sucursalOptions || []).map((s) => (
              <option key={s.id} value={s.id}>{s.label || s.sigla || `Sucursal ${s.id}`}</option>
            ))}
          </select>
        </div>

        {/* Comparison */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
            {t('analytics.Comparación', 'Comparación')}
          </label>
          <div className="flex gap-0.5">
            {comparisonOptions.map((opt) => (
              <button
                key={opt.value}
                disabled={opt.disabled}
                onClick={() => handlePendingConfigChange('comparisonType')({ target: { value: opt.value } })}
                className={`px-2.5 py-1.5 text-[10px] font-bold transition-colors rounded-lg
                  ${pendingConfig.comparisonType === opt.value
                    ? 'bg-light-accent dark:bg-dark-accent text-white'
                    : 'bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary'
                  }
                  disabled:opacity-20 disabled:cursor-not-allowed`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Align days */}
        <button
          onClick={() => handlePendingConfigChange('compareByWeekdays')({ target: { value: !pendingConfig.compareByWeekdays } })}
          disabled={pendingConfig.comparisonType === 'none'}
          className="flex items-center gap-1 text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary disabled:opacity-20 pb-0.5"
        >
          {pendingConfig.compareByWeekdays
            ? <ToggleRight size={16} className="text-light-accent dark:text-dark-accent" />
            : <ToggleLeft size={16} />
          }
          {t('analytics.Cuadrar días (L–D)')}
        </button>
      </div>

      {/* Row 2: Quick range pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={14} className="text-light-text-secondary dark:text-dark-text-secondary shrink-0" />
        {quickOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleQuickSelect(opt.key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors
              ${quickRange === opt.key
                ? 'bg-light-accent dark:bg-dark-accent text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Row 3: Dates + Search */}
      <div className="flex items-center gap-2 flex-wrap">
        {quickRange === 'CUSTOM' ? (
          <div className="flex gap-2">
            <DatePickerTheme
              className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
              label={t('analytics.Fecha Inicio')}
              value={pendingDateRange.start ? (typeof pendingDateRange.start.toDate === 'function' ? pendingDateRange.start.toDate() : new Date(pendingDateRange.start)) : null}
              onChange={handlePendingDateRangeChange('start')}
              minDate={minAll?.isValid?.() ? minAll.toDate() : undefined}
              maxDate={pendingDateRange.end || (maxAll?.isValid?.() ? maxAll.toDate() : undefined)}
              showYearDropdown
            />
            <DatePickerTheme
              className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
              label={t('analytics.Fecha Fin')}
              value={pendingDateRange.end ? (typeof pendingDateRange.end.toDate === 'function' ? pendingDateRange.end.toDate() : new Date(pendingDateRange.end)) : null}
              onChange={handlePendingDateRangeChange('end')}
              minDate={pendingDateRange.start || (minAll?.isValid?.() ? minAll.toDate() : undefined)}
              maxDate={maxAll?.isValid?.() ? maxAll.toDate() : undefined}
              showYearDropdown
            />
          </div>
        ) : (
          pendingDateRange.start && pendingDateRange.end && (
            <span className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <Calendar size={12} />
              {dayjs(pendingDateRange.start).format('YYYY-MM-DD')} – {dayjs(pendingDateRange.end).format('YYYY-MM-DD')}
            </span>
          )
        )}

        <button
          onClick={handleApply}
          disabled={!pendingDateRange.start || !pendingDateRange.end || isLoading}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-bold
            bg-light-accent dark:bg-dark-accent text-white
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:opacity-90 active:scale-[0.98] transition-all ml-auto shrink-0"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {t('analytics.Buscar')}
        </button>
      </div>

      {isLoading && <p className="text-[10px] font-semibold text-light-accent dark:text-dark-accent animate-pulse">{t('analytics.Cargando...')}</p>}
      {error && <p className="text-[10px] font-semibold text-light-error dark:text-dark-error">{error.message}</p>}
    </div>
  );
};

export default ControlsBar;
