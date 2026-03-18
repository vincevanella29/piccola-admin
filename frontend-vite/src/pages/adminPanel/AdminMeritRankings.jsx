// src/pages/adminPanel/AdminMeritRankings.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Layers, Users, Crown, Calendar,
  ChevronLeft, ChevronRight, Clock, Star, TrendingUp
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

import useAdminMeritRankings   from '../../hooks/useAdminMeritRankings';
import MeritToolbar            from './components/meritRankings/MeritToolbar';
import MeritCompetitionList    from './components/meritRankings/MeritCompetitionList';
import MeritStatStrip          from './components/meritRankings/MeritStatStrip';
import MeritLeaderboardTable   from './components/meritRankings/MeritLeaderboardTable';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPeriodo(p) {
  if (!p) return '';
  const [y, m] = p.split('-').map(Number);
  if (!y || !m) return p;
  try {
    return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: es })
      .replace(/^\w/, c => c.toUpperCase());
  } catch { return p; }
}

function getPeriodOptions() {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 13; i++) {
    const d = subMonths(now, i);
    opts.push(format(d, 'yyyy-MM'));
  }
  return opts; // desc order
}

// ── Quick period nav ──────────────────────────────────────────────────────────

const QuickPeriodNav = ({ selectedPeriodo, onChange }) => {
  const periods = useMemo(() => getPeriodOptions(), []);
  const currentIdx = selectedPeriodo ? periods.indexOf(selectedPeriodo) : 0;

  const quickButtons = [
    { label: 'Este mes',         value: periods[0] },
    { label: 'Mes pasado',       value: periods[1] },
    { label: periods[2] ? fmtPeriodo(periods[2]).slice(0, 3) + '.' : '', value: periods[2] },
  ].filter(b => b.value);

  return (
    <div className="flex items-center gap-2">
      {/* Quick buttons */}
      <div className="flex items-center gap-1">
        {quickButtons.map(btn => (
          <button
            key={btn.value}
            onClick={() => onChange(btn.value)}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
              selectedPeriodo === btn.value
                ? 'bg-matrix-green/15 border-matrix-green/40 text-matrix-green'
                : 'border-dark-border/25 text-dark-text-secondary hover:border-dark-border/50 hover:text-dark-text-primary'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Prev / current / next */}
      <div className="flex items-center gap-1 ml-1">
        <button
          disabled={currentIdx >= periods.length - 1}
          onClick={() => onChange(periods[Math.min(currentIdx + 1, periods.length - 1)])}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-dark-border/25 text-dark-text-secondary hover:text-dark-text-primary hover:border-dark-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={13} />
        </button>
        <div className="text-[11px] font-bold text-dark-text-primary px-2 py-1 bg-dark-surface border border-dark-border/20 rounded-lg min-w-[90px] text-center">
          {fmtPeriodo(selectedPeriodo || periods[0])}
        </div>
        <button
          disabled={currentIdx <= 0}
          onClick={() => onChange(periods[Math.max(currentIdx - 1, 0)])}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-dark-border/25 text-dark-text-secondary hover:text-dark-text-primary hover:border-dark-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};

// ── Period mode tabs ──────────────────────────────────────────────────────────

const PeriodModeTabs = ({ mode, onChange }) => (
  <div className="flex items-center p-0.5 bg-dark-surface-secondary/60 rounded-xl border border-dark-border/20 gap-0.5">
    {[
      { value: 'month', label: 'Por mes', icon: Calendar },
      { value: 'year',  label: 'Por año', icon: Star },
      { value: 'all',   label: 'Todas',   icon: Layers },
    ].map(({ value, label, icon: Icon }) => (
      <button
        key={value}
        onClick={() => onChange(value)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          mode === value
            ? 'bg-dark-surface shadow-sm text-dark-text-primary border border-dark-border/20'
            : 'text-dark-text-secondary hover:text-dark-text-primary'
        }`}
      >
        <Icon size={12} />
        {label}
      </button>
    ))}
  </div>
);

// ── KPI Chip ─────────────────────────────────────────────────────────────────

const KpiChip = ({ icon: Icon, label, value, highlight }) => (
  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
    highlight
      ? 'bg-matrix-green/10 border-matrix-green/25'
      : 'bg-dark-surface border-dark-border/20'
  }`}>
    <Icon size={14} className={highlight ? 'text-matrix-green' : 'text-dark-text-secondary'} />
    <span className="text-xs text-dark-text-secondary hidden sm:inline">{label}</span>
    <span className={`text-sm font-black ${highlight ? 'text-matrix-green' : 'text-dark-text-primary'}`}>
      {value}
    </span>
  </div>
);

// ── Year selector ─────────────────────────────────────────────────────────────

const YearSelector = ({ selectedYear, onChange }) => {
  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2];
  }, []);
  return (
    <div className="flex items-center gap-1">
      {years.map(y => (
        <button
          key={y}
          onClick={() => onChange(String(y))}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
            selectedYear === String(y)
              ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-400'
              : 'border-dark-border/25 text-dark-text-secondary hover:border-dark-border/50'
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
};

// ── Leaderboard panel header ──────────────────────────────────────────────────

const LeaderboardHeader = ({ comp, periodMode }) => {
  if (!comp) return null;

  const METRIC_LABELS = {
    total_sales:     'Ventas totales',
    avg_daily_sales: 'Venta/día promedio',
    pm_per_mesa:     '$/Mesa',
    pm_por_persona:  '$/Persona',
    presence_days:   'Días presentes',
  };

  const posLabel = (() => {
    const pt = comp.position_type || 'top_n';
    if (pt === 'range' && comp.position_from && comp.position_to)
      return `Puestos ${comp.position_from}–${comp.position_to}`;
    if (comp.ranking_position)
      return `${pt === 'exact' ? 'Puesto' : 'Top'} ${comp.ranking_position}`;
    return null;
  })();

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {comp.period_mode === 'year' && (
            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
              <Star size={8} /> Anual
            </span>
          )}
          {comp.is_admin_rule && (
            <span className="text-[9px] font-black uppercase text-dark-accent bg-dark-accent/10 border border-dark-accent/20 px-2 py-0.5 rounded-full">
              Admin KPI
            </span>
          )}
          {posLabel && (
            <span className="text-[9px] font-bold text-yellow-400">🏆 {posLabel}</span>
          )}
          <span className="text-[9px] text-dark-text-secondary">
            {METRIC_LABELS[comp.metric_key] || comp.metric_key}
          </span>
          <span className="text-dark-text-secondary/30">·</span>
          <span className="text-[9px] text-dark-text-secondary capitalize">{comp.ranking_scope}</span>
          <span className="text-[9px] font-black text-matrix-green font-mono">+{comp.merit_points}pts</span>
        </div>
        <h2 className="text-base font-bold text-dark-text-primary leading-tight">{comp.rule_name}</h2>

        {/* Cargos elegibles inline */}
        {comp.include_cargos?.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <Users size={9} className="text-dark-text-secondary/50" />
            {comp.include_cargos.map(c => (
              <span key={c} className="text-[9px] bg-dark-surface-secondary border border-dark-border/20 px-1.5 py-0.5 rounded-md text-dark-text-secondary">
                {c}
              </span>
            ))}
          </div>
        )}
        {comp.include_secciones?.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <TrendingUp size={9} className="text-dark-text-secondary/50" />
            {comp.include_secciones.map(s => (
              <span key={s} className="text-[9px] bg-dark-surface-secondary border border-dark-border/20 px-1.5 py-0.5 rounded-md text-dark-text-secondary italic">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-2xl font-black text-dark-text-primary leading-none">{comp.total_participants ?? 0}</p>
        <p className="text-[9px] uppercase tracking-widest text-dark-text-secondary mt-0.5">participantes</p>
        {comp.min_days_worked > 0 && (
          <p className="text-[9px] text-dark-text-secondary/60 mt-1">Mín. {comp.min_days_worked} días</p>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const AdminMeritRankings = ({ appState }) => {
  const { t: tRaw } = useTranslation('translation');
  const t = useCallback((key, opts) => tRaw(`admin_merit_rankings.${key}`, opts), [tRaw]);

  const {
    competitions,
    competitionBoards,
    summary,
    filterOptions,
    filters,
    updateFilter,
    applyFilters,
    resetFilters,
    loading,
    loadingBoard,
    error,
    currentPeriodo,
    restrictedToLocal,
    fetchCompetitions,
  } = useAdminMeritRankings(appState);

  // Period mode: 'month' | 'year' | 'all'
  const [periodMode, setPeriodMode] = useState('month');
  // Selected year for annual comps
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  // Selected period for monthly comps
  const [selectedPeriodo, setSelectedPeriodo] = useState(null); // null = current month
  // Selected competition — SOLO estado local, no re-fetcha
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  // Search del leaderboard
  const [search, setSearch] = useState('');
  // Show historic competitions
  const [showHistoric, setShowHistoric] = useState(false);
  // Filtros de la lista de competencias (filtrado local/visual)
  const [listFilterCargo, setListFilterCargo] = useState('');
  const [listFilterSeccion, setListFilterSeccion] = useState('');

  const handlePeriodModeChange = (mode) => {
    setPeriodMode(mode);
    setSelectedRuleId(null);
    if (mode === 'year') {
      // Anuales: traer TODAS las reglas (sin filtro de periodo)
      // El filtrado por period_mode === 'year' se hace localmente en filteredSummaryRaw
      applyFilters({ periodo: null });
    } else if (mode === 'month') {
      applyFilters({ periodo: selectedPeriodo });
    } else {
      // 'all': sin filtro de periodo
      applyFilters({ periodo: null });
    }
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
    // Solo actualizamos el año seleccionado — la vista anual no filtra por mes
    // El filtrado es local (period_mode === 'year')
  };

  const handlePeriodoChange = (p) => {
    setSelectedPeriodo(p);
    applyFilters({ periodo: p });
  };

  // handleSelectRule: SOLO local — no re-fetcha. Todas las competencias quedan visibles.
  const handleSelectRule = (ruleId) => {
    setSelectedRuleId(prev => prev === ruleId ? null : ruleId); // toggle
  };

  const handleToggleHistoric = () => {
    const next = !showHistoric;
    setShowHistoric(next);
    fetchCompetitions(next ? null : true);
  };

  // 1) Competencias filtradas por periodMode (base)
  const filteredSummaryRaw = useMemo(() => {
    if (periodMode === 'all') return summary;
    return summary.filter(c => {
      if (periodMode === 'year') return c.period_mode === 'year';
      return c.period_mode !== 'year';
    });
  }, [summary, periodMode]);

  // 2) Derivar cargos y secciones únicos para los chips de filtro rápido
  const listCargos = useMemo(() => {
    const set = new Set();
    filteredSummaryRaw.forEach(c => (c.include_cargos || []).forEach(x => set.add(x)));
    return Array.from(set).sort();
  }, [filteredSummaryRaw]);

  const listSecciones = useMemo(() => {
    const set = new Set();
    filteredSummaryRaw.forEach(c => (c.include_secciones || []).forEach(x => set.add(x)));
    return Array.from(set).sort();
  }, [filteredSummaryRaw]);

  // 3) Filtrado visual por cargo/sección sobre la lista de competencias
  const filteredSummary = useMemo(() => {
    return filteredSummaryRaw.filter(c => {
      if (listFilterCargo && (c.include_cargos || []).length > 0) {
        if (!c.include_cargos.includes(listFilterCargo)) return false;
      }
      if (listFilterSeccion && (c.include_secciones || []).length > 0) {
        if (!c.include_secciones.includes(listFilterSeccion)) return false;
      }
      return true;
    });
  }, [filteredSummaryRaw, listFilterCargo, listFilterSeccion]);

  // Active comp in the leaderboard panel
  const activeComp = useMemo(() => {
    const boards = competitionBoards.filter(c => {
      if (periodMode === 'year') return c.period_mode === 'year';
      if (periodMode === 'month') return c.period_mode !== 'year';
      return true;
    });
    if (selectedRuleId) return boards.find(c => c.rule_id === selectedRuleId) || boards[0] || null;
    return boards[0] || null;
  }, [selectedRuleId, competitionBoards, periodMode]);

  // Global KPIs
  const totalWinners      = filteredSummary.reduce((a, c) => a + (c.fulfilled_count || 0), 0);
  const totalParticipants = filteredSummary.reduce((a, c) => a + (c.total_participants || 0), 0);
  const activeCount       = filteredSummary.filter(c => c.is_active).length;

  const displayPeriodo    = selectedPeriodo || currentPeriodo;

  return (
    <div className="w-full min-h-screen bg-dark-background text-dark-text-primary">
      <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="p-2 rounded-xl bg-yellow-400/10 shrink-0">
                <Trophy size={18} className="text-yellow-400" />
              </div>
              <h1 className="text-xl font-black text-dark-text-primary tracking-tight">
                {t('merit_rankings.page_title')}
              </h1>
              {restrictedToLocal && (
                <span className="text-[9px] font-bold bg-dark-accent/10 border border-dark-accent/20 text-dark-accent px-2 py-0.5 rounded-full">
                  🔒 Solo: {restrictedToLocal}
                </span>
              )}
            </div>
            <p className="text-xs text-dark-text-secondary pl-0.5">{t('merit_rankings.page_desc')}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <KpiChip icon={Layers} label={t('merit_rankings.kpi_competitions')} value={activeCount} />
            <KpiChip icon={Users}   label={t('merit_rankings.kpi_participants')} value={totalParticipants} />
            <KpiChip icon={Crown}   label={t('merit_rankings.kpi_winners')}      value={totalWinners} highlight />
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
            ⚠ {String(error)}
          </div>
        )}

        {/* ── CONTROLS BAR (period mode + nav + search + filters) ─── */}
        <div className="bg-dark-surface border border-dark-border/20 rounded-2xl p-3 space-y-3">
          {/* Row 1: Period mode + period nav */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <PeriodModeTabs mode={periodMode} onChange={handlePeriodModeChange} />
            <div className="flex items-center gap-2">
              {periodMode === 'year' ? (
                <YearSelector selectedYear={selectedYear} onChange={handleYearChange} />
              ) : periodMode === 'month' ? (
                <QuickPeriodNav selectedPeriodo={displayPeriodo} onChange={handlePeriodoChange} />
              ) : null}
            </div>
          </div>

          {/* Row 2: Search + filters */}
          <MeritToolbar
            competitions={competitions.filter(c =>
              periodMode === 'all' ? true
              : periodMode === 'year' ? c.period_mode === 'year'
              : c.period_mode !== 'year'
            )}
            filterOptions={filterOptions}
            filters={filters}
            updateFilter={updateFilter}
            applyFilters={applyFilters}
            resetFilters={resetFilters}
            loading={loading}
            search={search}
            setSearch={setSearch}
            t={t}
            hidePeriodFilter={periodMode !== 'all'}
            embedded
          />
        </div>


        {/* ── MAIN LAYOUT ─────────────────────────────────────────────── */}
        <div className="flex flex-col xl:flex-row gap-5">

          {/* LEFT: Competition list */}
          <div className="xl:w-72 xl:shrink-0">
            <div className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-0.5 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-dark-border/20">

              {/* Annual competition highlight */}
              {periodMode === 'all' && filteredSummary.some(c => c.period_mode === 'year') && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-400 mb-1">
                  <Star size={10} /> Competencias anuales
                </div>
              )}

              <MeritCompetitionList
                summary={filteredSummary}
                selectedRuleId={selectedRuleId}
                onSelectRule={handleSelectRule}
                showHistoric={showHistoric}
                onToggleHistoric={handleToggleHistoric}
                loading={loading}
                periodMode={periodMode}
                listCargos={listCargos}
                listSecciones={listSecciones}
                listFilterCargo={listFilterCargo}
                listFilterSeccion={listFilterSeccion}
                onListFilterCargo={setListFilterCargo}
                onListFilterSeccion={setListFilterSeccion}
                t={t}
              />
            </div>
          </div>

          {/* RIGHT: Leaderboard */}
          <div className="flex-1 min-w-0 space-y-4">
            <LeaderboardHeader comp={activeComp} periodMode={periodMode} />
            <MeritStatStrip comp={activeComp} t={t} />

            {loadingBoard ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-11 rounded-xl bg-dark-surface border border-dark-border/10 animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
                ))}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeComp?.rule_id || 'none'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <MeritLeaderboardTable comp={activeComp} search={search} t={t} />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminMeritRankings;

export const pageMetadata = {
  path: '/app/admin/merit-rankings',
  label: 'Admin Merit Rankings',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 6,
  order: 6,
  locations: ['sidebar'],
  description: 'Ranking de competencias de meritocracia por ventas y periodo',
  icon: 'FaTrophy',
  isMainPage: false,
  isSearchable: true,
};
