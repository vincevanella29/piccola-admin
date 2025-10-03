import React, { useState, useMemo } from 'react';
import {
  LoaderCircle,
  Trophy,
  Calendar,
  CalendarRange,
  History,
  XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RuleCard from './RuleCard';
import { useTranslation } from 'react-i18next';

const SegTab = ({ label, shortLabel, icon: Icon, count = 0, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={[
      // base
      'relative w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2',
      'px-3 sm:px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold',
      'transition-colors whitespace-nowrap',
      // state
      active
        ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary'
        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover',
    ].join(' ')}
  >
    <Icon size={16} className="shrink-0" />
    {/* Etiqueta corta en móvil, larga en sm+ */}
    <span className="sm:hidden">{shortLabel ?? label}</span>
    <span className="hidden sm:inline">{label}</span>
    <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] border border-light-border dark:border-dark-border bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60">
      {count}
    </span>
    {active && (
      <motion.span
        layoutId="seg-indicator"
        className="absolute inset-0 rounded-xl ring-2 ring-light-accent/30 dark:ring-dark-accent/30 pointer-events-none"
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      />
    )}
  </button>
);

function useSegmentMap(ficha) {
  return useMemo(() => {
    const segments = ficha?.merit_profile?.segments || [];
    return segments.reduce((acc, seg) => {
      acc[seg.token_id] = seg;
      return acc;
    }, {});
  }, [ficha]);
}

function formatPeriodo(periodo = '', locale = 'es') {
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m) return periodo || '';
  const d = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return periodo;
  }
}

export default function MeritosPanel({ isLoading, meritos, ficha }) {
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('month'); // 'month' | 'year' | 'history'
  const segmentMap = useSegmentMap(ficha);

  if (isLoading && !meritos) {
    return (
      <div className="flex justify-center p-8">
        <LoaderCircle className="animate-spin text-light-accent dark:text-dark-accent" size={32} />
      </div>
    );
  }

  const currentPeriod = meritos?.current_period || '';
  const currentMonthRaw = meritos?.merits?.current_month || [];
  const historyFulfilled = meritos?.merits?.history_fulfilled || [];
  const historyNotFulfilled = meritos?.merits?.history_not_fulfilled || [];

  // Particiona: mes vs año (period_mode: 'year')
  const yearMissions = currentMonthRaw.filter((m) => m?.params?.period_mode === 'year');
  const monthMissions = currentMonthRaw.filter((m) => m?.params?.period_mode !== 'year');

  // Ordena: cumplidos primero
  const byStatus = (a, b) => {
    const aw = a.status === 'fulfilled' ? 0 : 1;
    const bw = b.status === 'fulfilled' ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return (a.name || '').localeCompare(b.name || '');
  };
  const sortedMonth = [...monthMissions].sort(byStatus);
  const sortedYear = [...yearMissions].sort(byStatus);

  // KPIs rápidos
  const monthDone = monthMissions.filter((m) => m.status === 'fulfilled').length;
  const yearDone = yearMissions.filter((m) => m.status === 'fulfilled').length;

  const periodPretty = formatPeriodo(currentPeriod, i18n?.language || 'es');

  return (
    <div className="space-y-6">
      {/* Header & tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-light-text-tertiary dark:text-dark-text-tertiary">
            Periodo actual
          </div>
          <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
            {periodPretty || currentPeriod}
          </div>
        </div>

        {/* Contenedor 100% ancho en móvil (grid 3 cols) / inline-flex en sm+ */}
        <div className="w-full sm:w-auto">
          <div className="rounded-xl border border-light-border/20 dark:border-dark-border/20 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 p-1">
            <div className="grid grid-cols-3 gap-1 sm:gap-1 sm:grid-cols-none sm:inline-flex sm:items-center sm:gap-1">
              <SegTab
                label="Misiones del Mes"
                shortLabel="Mes"
                icon={Calendar}
                count={sortedMonth.length}
                active={activeTab === 'month'}
                onClick={() => setActiveTab('month')}
              />
              <SegTab
                label="Misiones del Año"
                shortLabel="Año"
                icon={CalendarRange}
                count={sortedYear.length}
                active={activeTab === 'year'}
                onClick={() => setActiveTab('year')}
              />
              <SegTab
                label="Historial"
                shortLabel="Hist."
                icon={History}
                count={historyFulfilled.length + historyNotFulfilled.length}
                active={activeTab === 'history'}
                onClick={() => setActiveTab('history')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI chips (se envuelven sin romper) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-light-border dark:border-dark-border bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
          <Trophy size={14} className="text-light-accent dark:text-dark-accent" />
          <strong>{monthDone}</strong> / {sortedMonth.length} mes
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-light-border dark:border-dark-border bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
          <Trophy size={14} className="text-light-accent dark:text-dark-accent" />
          <strong>{yearDone}</strong> / {sortedYear.length} año
        </span>
      </div>

      {/* Grids */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'month' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedMonth.length > 0 ? (
                sortedMonth.map((merit) => (
                  <RuleCard key={merit.rule_id} merit={merit} type="current" segmentMap={segmentMap} />
                ))
              ) : (
                <EmptyState
                  icon={XCircle}
                  title="No hay misiones mensuales activas"
                  subtitle="Cuando existan, aparecerán aquí con su progreso en tiempo real."
                />
              )}
            </div>
          )}

          {activeTab === 'year' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedYear.length > 0 ? (
                sortedYear.map((merit) => (
                  <RuleCard key={merit.rule_id} merit={merit} type="current" segmentMap={segmentMap} />
                ))
              ) : (
                <EmptyState
                  icon={XCircle}
                  title="No hay misiones anuales activas"
                  subtitle="Las misiones con período anual se listarán acá."
                />
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {(historyFulfilled.length + historyNotFulfilled.length) > 0 ? (
                <>
                  {historyFulfilled.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-light-text-tertiary dark:text-dark-text-tertiary">Completadas</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {historyFulfilled.map((merit) => (
                          <RuleCard key={merit.result_id} merit={merit} type="history" historyStatus="fulfilled" segmentMap={segmentMap} />
                        ))}
                      </div>
                    </div>
                  )}
                  {historyNotFulfilled.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-light-text-tertiary dark:text-dark-text-tertiary">No completadas</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {historyNotFulfilled.map((merit) => (
                          <RuleCard key={merit.result_id} merit={merit} type="history" historyStatus="not_fulfilled" segmentMap={segmentMap} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <EmptyState
                    icon={History}
                    title="Sin historial todavía"
                    subtitle="A medida que cumplas o intentes misiones, el historial aparecerá aquí."
                  />
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="col-span-full flex flex-col items-center text-center py-10 border border-dashed border-light-border/60 dark:border-dark-border/60 rounded-2xl bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20">
      <Icon size={28} className="mb-2 text-light-text-tertiary dark:text-dark-text-tertiary" />
      <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{title}</div>
      <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{subtitle}</div>
    </div>
  );
}
