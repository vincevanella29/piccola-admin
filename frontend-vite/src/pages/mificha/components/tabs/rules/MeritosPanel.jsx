// src/pages/employees_register/components/tabs/rules/MeritosPanel.jsx

import React, { useState, useMemo, useEffect } from 'react';
import {
  LoaderCircle, Trophy, Calendar, CalendarRange, History,
  CheckCircle2, CircleDashed, ChevronDown, Target, TrendingUp, Zap, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RuleCard from './RuleCard';
import { useTranslation } from 'react-i18next';

// --- Utilitarios ---
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
    const text = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return periodo;
  }
}

// --- Componente: Roadmap & Oportunidades (NUEVO) ---
const RoadmapHeader = ({ title, totalAvailable, earned, pending, itemsCount, completedCount, t }) => {
    const progressPercent = totalAvailable > 0 ? (earned / totalAvailable) * 100 : 0;
    const efficiencyColor = progressPercent >= 80 ? 'text-matrix-green' : progressPercent >= 50 ? 'text-yellow-400' : 'text-red-400';
    const barColor = progressPercent >= 80 ? 'bg-matrix-green' : progressPercent >= 50 ? 'bg-yellow-400' : 'bg-red-400';

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-light-surface to-light-surface-secondary dark:from-dark-surface dark:to-[#1a1a1a] border border-light-border/10 dark:border-white/10 p-6 shadow-lg"
        >
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 opacity-10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none ${barColor.replace('bg-', 'bg-')}`} />

            <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
                {/* Left: Contexto */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-lg bg-light-surface-secondary dark:bg-white/10">
                            <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                            {title}
                        </span>
                    </div>
                    
                    <div>
                         <h2 className="text-3xl sm:text-4xl font-black text-light-text-primary dark:text-white tracking-tight">
                            {Math.round(progressPercent)}% <span className="text-lg font-medium text-light-text-secondary dark:text-dark-text-secondary">Eficiencia</span>
                        </h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            Has completado <strong>{completedCount}</strong> de <strong>{itemsCount}</strong> misiones disponibles.
                        </p>
                    </div>

                    {/* Barra de Progreso Maestra */}
                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className={efficiencyColor}>{t('mificha.progreso_actual', 'Tu Progreso')}</span>
                            <span className="text-light-text-tertiary dark:text-dark-text-tertiary">{t('mificha.meta_total', 'Meta Total')}</span>
                        </div>
                        <div className="h-3 w-full bg-light-surface-secondary dark:bg-black/30 rounded-full overflow-hidden shadow-inner ring-1 ring-black/5 dark:ring-white/5">
                            <motion.div 
                                className={`h-full ${barColor}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 1, ease: "circOut" }}
                            >
                                <div className="w-full h-full bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Right: The "Money" (Puntos) */}
                <div className="flex flex-row md:flex-col gap-4 justify-end min-w-[200px]">
                    
                    {/* Lo que tienes */}
                    <div className="flex-1 p-4 rounded-xl bg-light-surface-secondary/40 dark:bg-black/20 border border-light-border/10 dark:border-white/5 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-1 text-matrix-green">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] uppercase font-bold">{t('mificha.puntos_ganados', 'Ganados')}</span>
                        </div>
                        <p className="text-2xl font-mono font-bold text-light-text-primary dark:text-white">
                            +{earned}
                        </p>
                    </div>

                    {/* Lo que te falta (EL DOLOR) */}
                    <div className="flex-1 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 mb-1 text-yellow-500 relative z-10">
                            <Target size={16} />
                            <span className="text-[10px] uppercase font-bold">{t('mificha.puntos_juego', 'En Juego')}</span>
                        </div>
                        <p className="text-2xl font-mono font-bold text-light-text-primary dark:text-white relative z-10">
                            {pending > 0 ? `+${pending}` : '0'}
                        </p>
                        {pending > 0 && (
                             <div className="absolute bottom-2 right-2 text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold flex items-center gap-1 animate-bounce">
                                <AlertCircle size={10} /> ¡Consíguelos!
                             </div>
                        )}
                    </div>

                </div>
            </div>
        </motion.div>
    );
};

export default function MeritosPanel({ isLoading, meritos, ficha }) {
  const { i18n, t } = useTranslation();
  const [activeTab, setActiveTab] = useState('month'); // 'month' | 'year' | 'history'
  const [historyFilter, setHistoryFilter] = useState('fulfilled');
  const [openPeriods, setOpenPeriods] = useState({});
  const segmentMap = useSegmentMap(ficha);

  if (isLoading && !meritos) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <LoaderCircle className="animate-spin text-matrix-green" size={40} strokeWidth={1.5} />
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary animate-pulse">{t('mificha.cargando_misiones', 'Analizando rendimiento...')}</p>
      </div>
    );
  }

  // --- Data Logic ---
  const currentPeriod = meritos?.current_period || '';
  const currentMonthRaw = meritos?.merits?.current_month || [];
  const historyFulfilled = meritos?.merits?.history_fulfilled || [];
  const historyNotFulfilled = meritos?.merits?.history_not_fulfilled || [];

  const yearMissions = currentMonthRaw.filter((m) => m?.params?.period_mode === 'year');
  const monthMissions = currentMonthRaw.filter((m) => m?.params?.period_mode !== 'year');

  // Sort: Incomplete first to generate action
  const byStatusAction = (a, b) => {
     if (a.status !== 'fulfilled' && b.status === 'fulfilled') return -1;
     if (a.status === 'fulfilled' && b.status !== 'fulfilled') return 1;
     return 0;
  };
  
  const sortedMonth = [...monthMissions].sort(byStatusAction);
  const sortedYear = [...yearMissions].sort(byStatusAction);

  const periodPretty = formatPeriodo(currentPeriod, i18n?.language || 'es');

  // --- Calculadora de Totales para el Roadmap ---
  const calculateTotals = (items) => {
      const totalAvailable = items.reduce((acc, m) => acc + (Number(m.merit_points) || 0), 0);
      const earned = items.filter(m => m.status === 'fulfilled').reduce((acc, m) => acc + (Number(m.merit_points) || 0), 0);
      return {
          totalAvailable,
          earned,
          pending: totalAvailable - earned,
          count: items.length,
          completedCount: items.filter(m => m.status === 'fulfilled').length
      };
  };

  const monthStats = calculateTotals(sortedMonth);
  const yearStats = calculateTotals(sortedYear);

  // Group History
  const groupByPeriod = (items) => {
    const map = new Map();
    for (const it of items) {
      const per = it.periodo || 'desconocido';
      const prev = map.get(per) || { periodo: per, items: [], total_points: 0 };
      prev.items.push(it);
      prev.total_points += Number(it.merit_points || 0);
      map.set(per, prev);
    }
    return Array.from(map.values()).sort((a, b) => (b.periodo || '').localeCompare(a.periodo || ''));
  };

  const activeHistoryGroups = groupByPeriod(historyFilter === 'fulfilled' ? historyFulfilled : historyNotFulfilled);
  const togglePeriod = (per) => setOpenPeriods((st) => ({ ...st, [per]: !st[per] }));

  const tabs = [
    { id: 'month', label: t('mificha.tabs.misiones_mes', 'Misiones del Mes'), icon: Calendar, count: monthStats.pending > 0 ? `! ${monthStats.pending} pts` : null },
    { id: 'year', label: t('mificha.tabs.misiones_ano', 'Misiones Anuales'), icon: CalendarRange, count: null },
    { id: 'history', label: t('mificha.tabs.historial', 'Historial'), icon: History, count: null },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* --- ROADMAP SUMMARY (Dynamic based on Tab) --- */}
      <AnimatePresence mode="wait">
        {activeTab === 'month' && (
             <RoadmapHeader 
                key="month-header"
                title={`Roadmap ${periodPretty}`}
                {...monthStats}
                t={t}
             />
        )}
        {activeTab === 'year' && (
             <RoadmapHeader 
                key="year-header"
                title={`Roadmap Anual ${currentPeriod.split('-')[0]}`}
                {...yearStats}
                t={t}
             />
        )}
      </AnimatePresence>

      {/* --- TABS --- */}
      <div className="sticky top-0 z-20 bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-md py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex p-1 bg-gray-100 dark:bg-black/20 rounded-xl overflow-hidden shadow-inner">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                        relative flex-1 flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all
                        ${activeTab === tab.id ? 'text-light-text-primary dark:text-white' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-white'}
                    `}
                >
                    {activeTab === tab.id && (
                        <motion.div
                            layoutId="merit-tab-bg"
                            className="absolute inset-0 bg-white dark:bg-white/10 shadow-sm rounded-lg border border-black/5 dark:border-white/5"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                        <tab.icon size={16} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                        
                        {/* Notification Dot for Pending Points */}
                        {tab.count && activeTab !== tab.id && (
                             <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold border border-yellow-500/20 animate-pulse">
                                {tab.count}
                             </span>
                        )}
                    </span>
                </button>
            ))}
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'month' && (
              <MissionGrid items={sortedMonth} segmentMap={segmentMap} emptyTitle={t('mificha.no_misiones_mes', '¡Todo completado!')} />
            )}

            {activeTab === 'year' && (
              <MissionGrid items={sortedYear} segmentMap={segmentMap} emptyTitle={t('mificha.no_misiones_ano', 'Sin misiones anuales')} />
            )}

            {activeTab === 'history' && (
                <HistoryView 
                    historyFilter={historyFilter} 
                    setHistoryFilter={setHistoryFilter}
                    groups={activeHistoryGroups}
                    openPeriods={openPeriods}
                    togglePeriod={togglePeriod}
                    segmentMap={segmentMap}
                    t={t}
                    i18n={i18n}
                />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Sub-components ---

const MissionGrid = ({ items, segmentMap, emptyTitle }) => (
    items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {items.map((merit, index) => (
                <motion.div 
                    key={merit.rule_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                >
                    <RuleCard merit={merit} type="current" segmentMap={segmentMap} />
                </motion.div>
            ))}
        </div>
    ) : (
        <EmptyState icon={Trophy} title={emptyTitle} subtitle="No tienes misiones pendientes en este periodo." />
    )
);

const HistoryView = ({ historyFilter, setHistoryFilter, groups, openPeriods, togglePeriod, segmentMap, t, i18n }) => (
    <div className="space-y-6">
        <div className="flex justify-center">
            <div className="inline-flex p-1 bg-light-surface-secondary dark:bg-white/5 rounded-lg border border-light-border/10 dark:border-white/5">
                {[
                    { id: 'fulfilled', label: t('mificha.completadas', 'Completadas'), icon: CheckCircle2 },
                    { id: 'not_fulfilled', label: t('mificha.no_completadas', 'No Completadas'), icon: CircleDashed }
                ].map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setHistoryFilter(opt.id)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            historyFilter === opt.id 
                            ? 'bg-white dark:bg-white/10 text-light-text-primary dark:text-white shadow-sm' 
                            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-white'
                        }`}
                    >
                        <opt.icon size={14} className={historyFilter === opt.id ? 'text-matrix-green' : 'text-gray-400'}/>
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>

        {groups.length > 0 ? (
            <div className="space-y-4">
                {groups.map((grp) => {
                    const isOpen = !!openPeriods[grp.periodo];
                    return (
                        <div key={grp.periodo} className="bg-white dark:bg-dark-surface border border-light-border/10 dark:border-white/10 rounded-xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
                            <button
                                onClick={() => togglePeriod(grp.periodo)}
                                className="w-full flex items-center justify-between p-4 bg-light-surface-secondary/20 hover:bg-light-surface-secondary/40 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isOpen ? 'bg-matrix-green/10 text-matrix-green' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}>
                                        <Calendar size={18} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-light-text-primary dark:text-white">
                                            {formatPeriodo(grp.periodo, i18n?.language)}
                                        </p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {grp.items.length} {t('mificha.misiones', 'misiones')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase">{t('mificha.total_puntos', 'Total')}</p>
                                        <p className="text-sm font-mono font-bold text-matrix-green">+{grp.total_points}</p>
                                    </div>
                                    <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: 'auto', opacity: 1 }} 
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-light-surface-secondary/10 border-t border-light-border/5">
                                            {grp.items.map((merit) => (
                                                <RuleCard
                                                    key={merit.result_id || merit.rule_id}
                                                    merit={merit}
                                                    type="history"
                                                    historyStatus={historyFilter}
                                                    segmentMap={segmentMap}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        ) : (
            <EmptyState icon={History} title={t('mificha.sin_historial', 'No hay historial disponible')} />
        )}
    </div>
);

const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-light-border/20 dark:border-white/10 rounded-2xl bg-light-surface-secondary/10">
    <div className="p-4 rounded-full bg-light-surface-secondary dark:bg-white/5 mb-4 text-light-text-tertiary dark:text-dark-text-tertiary">
        <Icon size={32} strokeWidth={1.5} />
    </div>
    <h3 className="text-sm font-semibold text-light-text-primary dark:text-white">{title}</h3>
    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs">
      {subtitle || "No hay información para mostrar."}
    </p>
  </div>
);