// src/pages/adminPanel/components/meritRankings/MeritToolbar.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

function formatPeriodo(p) {
  if (!p || p === 'all') return null;
  const [y, m] = p.split('-').map(Number);
  if (!y || !m) return p;
  try {
    const text = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1));
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch { return p; }
}

const SelectField = ({ label, value, onChange, options, getLabel }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary">
      {label}
    </label>
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full appearance-none text-sm bg-dark-surface-secondary border border-dark-border/30 rounded-xl px-3 py-2 pr-8 text-dark-text-primary focus:outline-none focus:border-matrix-green/60 focus:ring-2 focus:ring-matrix-green/10 transition-all cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{getLabel ? getLabel(opt) : opt.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-text-secondary/60 pointer-events-none" />
    </div>
  </div>
);

const MeritToolbar = ({
  competitions,
  filterOptions,
  filters,
  updateFilter,
  applyFilters,
  resetFilters,
  loading,
  search,
  setSearch,
  t,
  hidePeriodFilter = false,
  embedded = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const compOptions = [
    { value: '', label: t('merit_rankings.toolbar.competition_all') },
    ...competitions.map(c => ({ value: c.rule_id, label: c.rule_name })),
  ];

  const periodOptions = (filterOptions.periodos || []).map(p => ({
    value: p === 'all' ? '' : p,
    label: p === 'all' ? t('merit_rankings.toolbar.period_current') : (formatPeriodo(p) || p),
  }));

  const localOptions = [
    { value: '', label: t('merit_rankings.toolbar.local_all') },
    ...(filterOptions.locales || []).filter(l => l !== 'all').map(l => ({ value: l, label: l })),
  ];

  const cargoOptions = [
    { value: '', label: t('merit_rankings.toolbar.cargo_all') },
    ...(filterOptions.cargos || []).filter(c => c !== 'all').map(c => ({ value: c, label: c })),
  ];

  const hasActiveFilters = !!(filters.rule_id || filters.periodo || filters.sucursal || filters.cargo);

  // Wrapper: if embedded, don't add outer surface/border — parent handles it
  const wrapperCls = embedded
    ? 'border-t border-dark-border/15 pt-3'
    : 'bg-dark-surface border border-dark-border/20 rounded-2xl overflow-hidden shadow-sm';

  return (
    <div className={wrapperCls}>
      {/* Row principal — search + filter toggle + refresh */}
      <div className={`flex items-center gap-2 ${embedded ? '' : 'p-3'}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-secondary/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('merit_rankings.toolbar.search_placeholder')}
            className="w-full pl-9 pr-3 py-2 text-sm bg-dark-surface-secondary border border-dark-border/25 rounded-xl text-dark-text-primary placeholder-dark-text-secondary/40 focus:outline-none focus:border-matrix-green/50 focus:ring-2 focus:ring-matrix-green/10 transition-all"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={`relative flex items-center gap-1.5 px-2.5 py-2 text-sm rounded-xl border transition-all ${
            hasActiveFilters || expanded
              ? 'bg-matrix-green/10 border-matrix-green/30 text-matrix-green'
              : 'bg-dark-surface-secondary border-dark-border/25 text-dark-text-secondary hover:text-dark-text-primary hover:border-dark-border/50'
          }`}
        >
          <SlidersHorizontal size={13} />
          <span className="hidden sm:inline text-xs font-medium">{t('merit_rankings.toolbar.filters')}</span>
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-matrix-green" />
          )}
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => applyFilters()}
          disabled={loading}
          title={t('merit_rankings.toolbar.refresh')}
          className="flex items-center gap-1.5 px-2.5 py-2 text-sm bg-dark-surface-secondary border border-dark-border/25 rounded-xl text-dark-text-secondary hover:text-matrix-green hover:border-matrix-green/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Expanded filters panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`${embedded ? 'pt-3' : 'px-3 pb-3 border-t border-dark-border/15'}`}>
              <div className={`grid ${hidePeriodFilter ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'} gap-3 ${embedded ? '' : 'pt-3'}`}>
                <SelectField
                  label={t('merit_rankings.toolbar.competition_label')}
                  value={filters.rule_id || ''}
                  onChange={v => updateFilter('rule_id', v || null)}
                  options={compOptions}
                />
                {!hidePeriodFilter && (
                  <SelectField
                    label={t('merit_rankings.toolbar.period_label')}
                    value={filters.periodo || ''}
                    onChange={v => updateFilter('periodo', v || null)}
                    options={periodOptions}
                  />
                )}
                <SelectField
                  label={t('merit_rankings.toolbar.local_label')}
                  value={filters.sucursal || ''}
                  onChange={v => updateFilter('sucursal', v || null)}
                  options={localOptions}
                />
                <SelectField
                  label={t('merit_rankings.toolbar.cargo_label')}
                  value={filters.cargo || ''}
                  onChange={v => updateFilter('cargo', v || null)}
                  options={cargoOptions}
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-3">
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dark-border/30 text-dark-text-secondary hover:text-dark-text-primary hover:border-dark-border/60 transition-all"
                  >
                    <RotateCcw size={11} />
                    {t('merit_rankings.toolbar.reset')}
                  </button>
                )}
                <button
                  onClick={() => { applyFilters(); setExpanded(false); }}
                  className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-matrix-green text-black font-bold hover:bg-matrix-green/90 transition-all"
                >
                  {t('merit_rankings.toolbar.apply')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MeritToolbar;
