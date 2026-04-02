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
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
      {label}
    </label>
    <div className="relative group">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full appearance-none text-sm font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/30 rounded-xl px-3 py-2.5 pr-8 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-matrix-green/60 focus:ring-2 focus:ring-matrix-green/20 transition-all cursor-pointer shadow-sm group-hover:border-matrix-green/30"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{getLabel ? getLabel(opt) : opt.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary/60 pointer-events-none group-hover:text-matrix-green transition-colors" />
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

  const periodOptions = (filterOptions?.periodos || []).map(p => ({
    value: p === 'all' ? '' : p,
    label: p === 'all' ? t('merit_rankings.toolbar.period_current') : (formatPeriodo(p) || p),
  }));

  const localOptions = [
    { value: '', label: t('merit_rankings.toolbar.local_all') },
    ...(filterOptions?.locales || []).filter(l => l !== 'all').map(l => ({ value: l, label: l })),
  ];

  const cargoOptions = [
    { value: '', label: t('merit_rankings.toolbar.cargo_all') },
    ...(filterOptions?.cargos || []).filter(c => c !== 'all').map(c => ({ value: c, label: c })),
  ];

  const hasActiveFilters = !!(filters.rule_id || filters.periodo || filters.sucursal || filters.cargo);

  // Wrapper: if embedded, don't add outer surface/border — parent handles it
  const wrapperCls = embedded
    ? 'border-t border-dark-border/10 dark:border-dark-border/15 pt-4 mt-2'
    : 'bg-white/70 dark:bg-dark-surface/50 backdrop-blur-xl border border-gray-200 dark:border-dark-border/20 rounded-[24px] overflow-hidden shadow-sm';

  return (
    <div className={wrapperCls}>
      {/* Row principal — search + filter toggle + refresh */}
      <div className={`flex items-center gap-3 ${embedded ? '' : 'p-4'}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-0 group">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary/50 dark:text-dark-text-secondary/50 pointer-events-none group-focus-within:text-matrix-green transition-colors" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('merit_rankings.toolbar.search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 text-[15px] font-medium bg-gray-50/80 dark:bg-dark-surface-secondary/40 border border-transparent focus:bg-white dark:focus:bg-dark-surface rounded-xl text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary/60 dark:placeholder-dark-text-secondary/40 focus:outline-none focus:border-matrix-green/50 focus:ring-4 focus:ring-matrix-green/10 transition-all shadow-inner focus:shadow-sm"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all shadow-sm ${
            hasActiveFilters || expanded
              ? 'bg-matrix-green/10 border border-matrix-green/30 text-matrix-green hover:bg-matrix-green/20'
              : 'bg-white dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/25 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:border-gray-300 dark:hover:border-dark-border/50'
          }`}
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">{t('merit_rankings.toolbar.filters')}</span>
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-matrix-green shadow-[0_0_8px_rgba(0,0,0,0.2)]" />
          )}
          {expanded ? <ChevronUp size={14} className="ml-1 opacity-70" /> : <ChevronDown size={14} className="ml-1 opacity-70" />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => applyFilters()}
          disabled={loading}
          title={t('merit_rankings.toolbar.refresh')}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/25 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green hover:border-matrix-green/40 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-matrix-green' : ''} />
        </button>
      </div>

      {/* Expanded filters panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={`${embedded ? 'pt-4' : 'px-4 pb-4 border-t border-gray-100 dark:border-dark-border/15 bg-gray-50/50 dark:bg-transparent'}`}>
              <div className={`grid ${hidePeriodFilter ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'} gap-4 ${embedded ? '' : 'pt-4'}`}>
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

              <div className="flex items-center justify-end gap-3 mt-5 pb-1">
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 text-[13px] font-bold px-4 py-2 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface-secondary/50 transition-all cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    {t('merit_rankings.toolbar.reset')}
                  </button>
                )}
                <button
                  onClick={() => { applyFilters(); setExpanded(false); }}
                  className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-matrix-green text-black font-bold border border-matrix-green/30 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-matrix-green/10"
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
