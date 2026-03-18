import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Play, Loader2, AlertTriangle, CheckCircle2, XCircle,
  ChevronRight, Cpu, Hash, Clock, Zap, Timer, BarChart3,
  Search, X, LayoutGrid, List, ChevronDown,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_RE = /^\d{6}$/;
function validatePeriod(val) {
  if (!val?.trim()) return 'required';
  if (!PERIOD_RE.test(val.trim())) return 'invalid';
  return null;
}

const CATEGORY_META = {
  mtz:      { label: 'MTZ',      color: 'text-sky-400',     bg: 'bg-sky-500/10',    border: 'border-sky-500/25' },
  intranet: { label: 'Intranet', color: 'text-purple-400',  bg: 'bg-purple-500/10', border: 'border-purple-500/25' },
  kpis:     { label: 'KPIs',     color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/25' },
  general:  { label: 'General',  color: 'text-matrix-green',bg: 'bg-matrix-green/10', border: 'border-matrix-green/25' },
};
const catStyle = (cat) => CATEGORY_META[cat] ?? {
  label:  cat ?? '—',
  color:  'text-light-text-secondary dark:text-dark-text-secondary',
  bg:     'bg-light-surface-secondary dark:bg-dark-surface-secondary',
  border: 'border-light-border dark:border-dark-border',
};

// ─── Atoms ────────────────────────────────────────────────────────────────────

const CategoryBadge = ({ category, size = 'sm' }) => {
  const s = catStyle(category);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold border tracking-wide uppercase ${s.bg} ${s.color} ${s.border} ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'}`}>
      {s.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const ok = status === 'success' || status === 'ok';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
      ok ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/20'
         : 'bg-vanellix-purple/10 text-vanellix-purple border-vanellix-purple/20'}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {ok ? t('workers.result_success') : t('workers.result_error')}
    </span>
  );
};

// ─── WorkerCheckbox (card style) ──────────────────────────────────────────────

const WorkerCard = ({ name, checked, onToggle, description, category, compact = false }) => (
  <button
    type="button"
    onClick={() => onToggle(name)}
    className={`w-full flex items-start gap-3 rounded-xl border transition-all text-left group ${
      checked
        ? 'bg-matrix-green/5 border-matrix-green/30 shadow-sm shadow-matrix-green/10'
        : 'bg-transparent border-light-border/40 dark:border-dark-border/40 hover:border-light-border dark:hover:border-dark-border hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/30'
    } ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
  >
    {/* Checkbox */}
    <span className={`shrink-0 mt-0.5 w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition-all ${
      checked ? 'bg-matrix-green border-matrix-green' : 'border-light-border dark:border-dark-border group-hover:border-matrix-green/50'
    }`} style={{ width: 18, height: 18 }}>
      <AnimatePresence>
        {checked && (
          <motion.svg key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            transition={{ duration: 0.12 }} className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </AnimatePresence>
    </span>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-semibold text-light-text-primary dark:text-dark-text-primary truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          {name}
        </span>
        {category && <CategoryBadge category={category} size="xs" />}
      </div>
      {!compact && description && (
        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 line-clamp-1">
          {description}
        </p>
      )}
    </div>
  </button>
);

// ─── ResultRow ────────────────────────────────────────────────────────────────

const ResultRow = ({ res, index }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = res.message || res.detail || res.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.22 }}
      className="rounded-2xl border border-light-border/60 dark:border-dark-border/60 bg-light-surface dark:bg-dark-surface overflow-hidden"
    >
      <button type="button" onClick={() => hasDetail && setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${hasDetail ? 'hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/40 cursor-pointer' : 'cursor-default'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Cpu className="w-3.5 h-3.5 text-light-text-secondary/60 shrink-0" />
            <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
              {res.worker || res.name || '—'}
            </span>
            {res.category && <CategoryBadge category={res.category} size="xs" />}
          </div>
          {(res.handler || res.duration_ms != null) && (
            <div className="flex items-center gap-2 mt-0.5 pl-5">
              {res.handler && <span className="text-[10px] font-mono text-light-text-secondary/60">{res.handler}()</span>}
              {res.duration_ms != null && (
                <span className="flex items-center gap-0.5 text-[10px] text-light-text-secondary/50">
                  <Timer className="w-2.5 h-2.5" />
                  {res.duration_ms < 1000 ? `${res.duration_ms}ms` : `${(res.duration_ms / 1000).toFixed(2)}s`}
                </span>
              )}
            </div>
          )}
        </div>
        <StatusBadge status={res.status} />
        {hasDetail && (
          <ChevronRight className={`w-4 h-4 text-light-text-secondary/40 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
      </button>
      <AnimatePresence>
        {expanded && hasDetail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-3">
              <div className="rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/40 dark:border-dark-border/40 px-3 py-2">
                <p className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary break-all leading-relaxed">
                  {res.message || res.detail || res.error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Category Group ───────────────────────────────────────────────────────────

const CategoryGroup = ({ category, workers, selected, onToggle, compact, searchQuery }) => {
  const [collapsed, setCollapsed] = useState(false);
  const s = catStyle(category);
  const allChecked  = workers.every(w => selected.includes(w.name));
  const someChecked = workers.some(w => selected.includes(w.name));

  const handleGroupToggle = () => {
    const names = workers.map(w => w.name);
    if (allChecked) {
      // deselect all in group
      onToggle({ type: 'group-deselect', names });
    } else {
      onToggle({ type: 'group-select', names });
    }
  };

  return (
    <div className="rounded-2xl border border-light-border/40 dark:border-dark-border/40 overflow-hidden">
      {/* Group header */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${s.bg} border-b border-light-border/30 dark:border-dark-border/30`}>
        <div className="flex items-center gap-2">
          {/* Group checkbox */}
          <button type="button" onClick={handleGroupToggle}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
              allChecked ? 'bg-matrix-green border-matrix-green'
              : someChecked ? 'bg-matrix-green/30 border-matrix-green/60'
              : 'border-light-border/60 dark:border-dark-border/60 hover:border-matrix-green/50'
            }`} style={{ width: 16, height: 16 }}>
            {(allChecked || someChecked) && (
              <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                {allChecked
                  ? <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d="M2.5 6h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                }
              </svg>
            )}
          </button>

          <span className={`text-[11px] font-bold uppercase tracking-widest ${s.color}`}>{s.label}</span>
          <span className="text-[10px] text-light-text-secondary/50 dark:text-dark-text-secondary/50">
            {workers.filter(w => selected.includes(w.name)).length}/{workers.length}
          </span>
        </div>

        <button type="button" onClick={() => setCollapsed(v => !v)}
          className="text-light-text-secondary/40 hover:text-light-text-secondary dark:hover:text-dark-text-secondary transition-colors">
          <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {/* Workers in group */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`p-2 ${compact ? 'grid grid-cols-1 sm:grid-cols-2 gap-1.5' : 'space-y-1'}`}>
              {workers.map(w => (
                <WorkerCard
                  key={w.name}
                  name={w.name}
                  checked={selected.includes(w.name)}
                  onToggle={name => onToggle({ type: 'single', name })}
                  description={w.description}
                  category={w.category}
                  compact={compact}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const WorkersView = ({
  workers = [],
  workersMeta = [],
  isLoading,
  error,
  runWorkers,
  executionResults = [],
  executionSummary = null,
}) => {
  const { t } = useTranslation();

  const [period, setPeriod]           = useState('');
  const [periodError, setPeriodError] = useState(null);
  const [selected, setSelected]       = useState([]);
  const [results, setResults]         = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [runError, setRunError]       = useState(null);
  const [hasRun, setHasRun]           = useState(false);

  // Filters
  const [search, setSearch]           = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [gridMode, setGridMode]       = useState(false);

  useEffect(() => {
    if (Array.isArray(executionResults) && executionResults.length > 0) {
      setResults(executionResults);
    }
  }, [executionResults]);

  // Build rich list from workers (string[]) + workersMeta
  const metaMap = useMemo(() => {
    const map = {};
    workersMeta.forEach(m => { map[m.name] = m; });
    return map;
  }, [workersMeta]);

  const richWorkers = useMemo(() =>
    workers.map(name => ({
      name,
      description: metaMap[name]?.description ?? '',
      category: metaMap[name]?.category ?? 'general',
    })),
    [workers, metaMap]
  );

  // Unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(richWorkers.map(w => w.category))].filter(Boolean);
    return cats;
  }, [richWorkers]);

  // Filtered workers
  const filtered = useMemo(() => {
    let list = richWorkers;
    if (activeCategory !== 'all') list = list.filter(w => w.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(w => w.name.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q));
    }
    return list;
  }, [richWorkers, activeCategory, search]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(w => {
      if (!groups[w.category]) groups[w.category] = [];
      groups[w.category].push(w);
    });
    return groups;
  }, [filtered]);

  const groupKeys   = Object.keys(grouped);
  const allSelected = selected.length === workers.length && workers.length > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleToggle = useCallback((action) => {
    if (typeof action === 'string') {
      // legacy
      setSelected(prev => prev.includes(action) ? prev.filter(w => w !== action) : [...prev, action]);
      return;
    }
    if (action.type === 'single') {
      setSelected(prev => prev.includes(action.name) ? prev.filter(w => w !== action.name) : [...prev, action.name]);
    } else if (action.type === 'group-select') {
      setSelected(prev => [...new Set([...prev, ...action.names])]);
    } else if (action.type === 'group-deselect') {
      setSelected(prev => prev.filter(w => !action.names.includes(w)));
    }
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelected(allSelected ? [] : [...workers]);
  }, [workers, allSelected]);

  const handlePeriodChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPeriod(val);
    if (periodError) setPeriodError(null);
  };

  const handleRun = async () => {
    const err = validatePeriod(period);
    if (err) { setPeriodError(err); return; }
    setRunError(null);
    setLocalLoading(true);
    setHasRun(false);
    try {
      const res = await runWorkers({
        mesano: period.trim(),
        include: selected.length > 0 ? selected : undefined,
      });
      if (Array.isArray(res)) setResults(res);
      setHasRun(true);
    } catch (e) {
      setRunError(e?.message || t('workers.error_run'));
    } finally {
      setLocalLoading(false);
    }
  };

  const isRunning = localLoading || isLoading;
  const canRun    = !!period && !isRunning;

  const successCount   = executionSummary?.success_count ?? results.filter(r => r.status === 'ok' || r.status === 'success').length;
  const failCount      = executionSummary?.error_count   ?? (results.length - successCount);
  const totalDurationMs= executionSummary?.total_duration_ms ?? null;

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-matrix-green/10 border border-matrix-green/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-matrix-green" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
              {t('workers.dashboard')}
            </h1>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              {t('workers.subtitle')}
            </p>
          </div>
        </motion.div>

        {/* ── Error banner ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {(error || runError) && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-vanellix-purple/10 border border-vanellix-purple/20">
              <AlertTriangle className="w-4 h-4 text-vanellix-purple shrink-0 mt-0.5" />
              <p className="text-sm text-vanellix-purple font-medium">{error || runError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main content: 2-column on desktop ────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* LEFT: Workers list ──────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="flex-1 min-w-0 rounded-3xl border border-light-border/60 dark:border-dark-border/60 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md overflow-hidden shadow-sm">

            {/* Card header */}
            <div className="px-4 py-3.5 border-b border-light-border/50 dark:border-dark-border/50 space-y-3">
              {/* Top row: title + view toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                  <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                    {t('workers.available_title')}
                  </span>
                  {workers.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">
                      {workers.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Grid / List toggle */}
                  <div className="flex p-0.5 bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 rounded-lg border border-light-border/30 dark:border-dark-border/30">
                    {[
                      { mode: false, Icon: List },
                      { mode: true,  Icon: LayoutGrid },
                    ].map(({ mode, Icon }) => (
                      <button key={String(mode)} type="button" onClick={() => setGridMode(mode)}
                        className={`p-1.5 rounded-md transition-all ${gridMode === mode ? 'bg-light-surface dark:bg-dark-surface shadow-sm text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary/50 dark:text-dark-text-secondary/50 hover:text-light-text-secondary dark:hover:text-dark-text-secondary'}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                  {/* Select all */}
                  {workers.length > 0 && (
                    <button type="button" onClick={handleToggleAll}
                      className="text-xs font-semibold text-matrix-green hover:text-matrix-green/70 transition-colors">
                      {allSelected ? t('workers.deselect_all') : t('workers.select_all')}
                    </button>
                  )}
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary/50 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('workers.search_placeholder') || 'Search workers...'}
                  className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border/50 dark:border-dark-border/50 text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/40 dark:placeholder:text-dark-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-matrix-green/20 focus:border-matrix-green/30 transition-all"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-light-text-secondary/40 hover:text-light-text-secondary transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category filter chips */}
              {categories.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setActiveCategory('all')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                      activeCategory === 'all'
                        ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/30'
                        : 'bg-transparent text-light-text-secondary dark:text-dark-text-secondary border-light-border/40 dark:border-dark-border/40 hover:border-light-border dark:hover:border-dark-border'
                    }`}>
                    ALL
                  </button>
                  {categories.map(cat => {
                    const s = catStyle(cat);
                    const active = activeCategory === cat;
                    return (
                      <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide transition-all ${
                          active ? `${s.bg} ${s.color} ${s.border}` : 'bg-transparent text-light-text-secondary dark:text-dark-text-secondary border-light-border/40 dark:border-dark-border/40 hover:border-light-border dark:hover:border-dark-border'
                        }`}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Workers body */}
            <div className="p-3">
              {isLoading && !workers.length ? (
                <div className="flex items-center justify-center gap-3 py-10 text-light-text-secondary dark:text-dark-text-secondary">
                  <Loader2 className="w-5 h-5 animate-spin text-matrix-green" />
                  <span className="text-sm">{t('workers.loading')}</span>
                </div>
              ) : workers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-light-text-secondary/30" />
                  </div>
                  <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">{t('workers.available_empty')}</p>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary max-w-[200px]">{t('workers.available_empty_desc')}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Search className="w-6 h-6 text-light-text-secondary/30" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {t('workers.search_empty') || 'No workers match your filter'}
                  </p>
                  <button type="button" onClick={() => { setSearch(''); setActiveCategory('all'); }}
                    className="text-xs font-semibold text-matrix-green hover:underline">
                    {t('workers.clear_filters') || 'Clear filters'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupKeys.map(cat => (
                    <CategoryGroup
                      key={cat}
                      category={cat}
                      workers={grouped[cat]}
                      selected={selected}
                      onToggle={handleToggle}
                      compact={gridMode}
                      searchQuery={search}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Selected indicator footer */}
            <AnimatePresence>
              {selected.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                  className="overflow-hidden border-t border-light-border/40 dark:border-dark-border/40">
                  <div className="px-4 py-2.5 bg-matrix-green/5 flex items-center justify-between">
                    <p className="text-xs font-semibold text-matrix-green">
                      {selected.length === 1
                        ? t('workers.selected_count', { count: selected.length })
                        : t('workers.selected_count_plural', { count: selected.length })}
                    </p>
                    <button type="button" onClick={() => setSelected([])}
                      className="text-[10px] font-bold text-matrix-green/60 hover:text-matrix-green transition-colors flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {t('workers.clear') || 'Clear'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RIGHT: Config + Run (sticky on desktop) ────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="w-full lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-6">

            {/* Period card */}
            <div className="rounded-3xl border border-light-border/60 dark:border-dark-border/60 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3.5 border-b border-light-border/50 dark:border-dark-border/50">
                <Clock className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                  {t('workers.period_label')}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Input */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary/50 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={period}
                      onChange={handlePeriodChange}
                      placeholder={t('workers.period_placeholder')}
                      maxLength={6}
                      className={`w-full pl-9 pr-9 py-2.5 rounded-xl text-sm font-mono font-semibold
                        bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border
                        text-light-text-primary dark:text-dark-text-primary
                        placeholder:text-light-text-secondary/40 dark:placeholder:text-dark-text-secondary/40
                        focus:outline-none focus:ring-2 transition-all
                        ${periodError
                          ? 'border-vanellix-purple/60 focus:ring-vanellix-purple/20'
                          : period && !validatePeriod(period)
                            ? 'border-matrix-green/40 focus:ring-matrix-green/20'
                            : 'border-light-border/60 dark:border-dark-border/60 focus:ring-matrix-green/20 focus:border-matrix-green/40'
                        }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <AnimatePresence mode="wait">
                        {period && !validatePeriod(period) && (
                          <motion.div key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <CheckCircle2 className="w-4 h-4 text-matrix-green" />
                          </motion.div>
                        )}
                        {periodError && (
                          <motion.div key="err" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <AlertTriangle className="w-4 h-4 text-vanellix-purple" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {periodError ? (
                      <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-[11px] font-medium text-vanellix-purple pl-1">
                        {t(`workers.period_${periodError}`)}
                      </motion.p>
                    ) : (
                      <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary pl-1">
                        {t('workers.period_hint')}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Run button */}
                <motion.button type="button" onClick={handleRun} disabled={!canRun}
                  whileHover={canRun ? { scale: 1.015 } : {}}
                  whileTap={canRun ? { scale: 0.97 } : {}}
                  className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-bold transition-all
                    ${canRun
                      ? 'bg-matrix-green text-white shadow-neon hover:shadow-[0_0_20px_rgba(0,146,70,0.4)] cursor-pointer'
                      : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary cursor-not-allowed opacity-60'
                    }`}>
                  {isRunning ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t('workers.running')}</>
                  ) : (
                    <><Play className="w-4 h-4" />{selected.length > 0 ? t('workers.run_selected') : t('workers.run_all')}</>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Quick-stats mini card (shows after run) */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface dark:bg-dark-surface p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                      {t('workers.results_title')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xl font-bold text-matrix-green tabular-nums">{successCount}</p>
                      <p className="text-[10px] text-light-text-secondary/60">OK</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-vanellix-purple tabular-nums">{failCount}</p>
                      <p className="text-[10px] text-light-text-secondary/60">{t('workers.result_error')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tabular-nums text-sm">
                        {totalDurationMs != null
                          ? totalDurationMs < 1000 ? `${totalDurationMs}ms` : `${(totalDurationMs / 1000).toFixed(1)}s`
                          : '—'}
                      </p>
                      <p className="text-[10px] text-light-text-secondary/60">{t('workers.duration') || 'time'}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Results list ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {(results.length > 0 || hasRun) && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl border border-light-border/60 dark:border-dark-border/60 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-light-border/50 dark:border-dark-border/50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                  <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                    {t('workers.results_title')}
                  </span>
                </div>
                {results.length > 0 && (
                  <div className="flex items-center gap-2">
                    {successCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-matrix-green/10 text-matrix-green border border-matrix-green/20">
                        <CheckCircle2 className="w-2.5 h-2.5" />{successCount}
                      </span>
                    )}
                    {failCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-vanellix-purple/10 text-vanellix-purple border border-vanellix-purple/20">
                        <XCircle className="w-2.5 h-2.5" />{failCount}
                      </span>
                    )}
                    {totalDurationMs != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary border border-light-border/60 dark:border-dark-border/60">
                        <Timer className="w-2.5 h-2.5" />
                        {totalDurationMs < 1000 ? `${totalDurationMs}ms` : `${(totalDurationMs / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">{t('workers.results_empty')}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('workers.results_empty_desc')}</p>
                  </div>
                ) : (
                  results.map((res, i) => (
                    <ResultRow key={`${res.worker}-${i}`} res={res} index={i} />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default WorkersView;
