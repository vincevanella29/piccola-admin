import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Users, Star, TrendingUp,
  CheckCircle, Zap, Calendar, BarChart2,
  X, ChevronDown, Award
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const METRIC_LABELS = {
  total_sales:     { label: 'Ventas',    icon: TrendingUp, color: 'text-matrix-green' },
  avg_daily_sales: { label: 'Venta/día', icon: BarChart2,  color: 'text-blue-400' },
  pm_per_mesa:     { label: '$/Mesa',    icon: Zap,        color: 'text-purple-400' },
  pm_por_persona:  { label: '$/Persona', icon: Users,      color: 'text-pink-400' },
  presence_days:   { label: 'Presencia', icon: Calendar,   color: 'text-yellow-400' },
  avg_seg:         { label: 'T.Prom',    icon: Clock,      color: 'text-orange-400' },
  samples:         { label: 'Muestras',  icon: BarChart2,  color: 'text-cyan-400' },
};

const CATEGORY_LABELS = {
  sales:          { label: 'Ventas',     color: 'text-matrix-green', bg: 'bg-matrix-green/10 border-matrix-green/20 dark:bg-matrix-green/20' },
  sales_admin:    { label: 'Ventas Adm', color: 'text-indigo-500',  bg: 'bg-indigo-500/10 border-indigo-500/20 dark:bg-indigo-500/20' },
  times_employee: { label: 'Tiempos',    color: 'text-orange-500',   bg: 'bg-orange-500/10 border-orange-500/20 dark:bg-orange-500/20' },
  times_local:    { label: 'T.Local',    color: 'text-cyan-500',     bg: 'bg-cyan-500/10 border-cyan-500/20 dark:bg-cyan-500/20' },
  attendance:     { label: 'Asistencia', color: 'text-yellow-500',   bg: 'bg-yellow-500/10 border-yellow-500/20 dark:bg-yellow-500/20' },
};

function positionLabel(comp) {
  const pt = comp.position_type || 'top_n';
  if (pt === 'range' && comp.position_from && comp.position_to)
    return `P.${comp.position_from}–${comp.position_to}`;
  if (comp.ranking_position)
    return `${pt === 'exact' ? 'P.' : 'Top'} ${comp.ranking_position}`;
  return null;
}

function barColor(tplCat, isAnnual) {
  if (isAnnual) return 'bg-yellow-400';
  if (tplCat === 'attendance') return 'bg-yellow-400';
  if (tplCat === 'times_employee' || tplCat === 'times_local') return 'bg-orange-400';
  if (tplCat === 'sales_admin') return 'bg-indigo-500';
  return 'bg-matrix-green';
}

// ── Section header ────────────────────────────────────────────────────────────

const SectionDivider = ({ label, icon: Icon, count }) => (
  <div className="flex items-center gap-3 py-3 px-1">
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={14} className="text-light-text-secondary/70 dark:text-dark-text-secondary/70" strokeWidth={2.5} />}
      <span className="text-[12px] font-black uppercase tracking-widest text-light-text-secondary/70 dark:text-dark-text-secondary/70">{label}</span>
    </div>
    <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border/20 rounded-full" />
    <div className="flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-gray-100 dark:bg-dark-surface-secondary text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary px-1.5">
      {count}
    </div>
  </div>
);

// ── Compact Dropdown Filter (Apple-style) ─────────────────────────────────────

const DropdownFilter = ({ label, icon: Icon, items, active, onSelect, accentColor = 'matrix-green' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!items || items.length === 0) return null;

  const isActive = !!active;
  const colors = {
    'matrix-green': { activeBg: 'bg-matrix-green/10', activeBorder: 'border-matrix-green/30', activeText: 'text-matrix-green' },
    'orange-400':   { activeBg: 'bg-orange-500/10',   activeBorder: 'border-orange-500/30',   activeText: 'text-orange-500'   },
  }[accentColor] || { activeBg: 'bg-matrix-green/10', activeBorder: 'border-matrix-green/30', activeText: 'text-matrix-green' };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-2 rounded-xl transition-all shadow-sm ${
          isActive
            ? `${colors.activeBg} border ${colors.activeBorder} ${colors.activeText}`
            : 'border border-gray-200 dark:border-dark-border/25 text-light-text-secondary dark:text-dark-text-secondary hover:border-gray-300 dark:hover:border-dark-border/50 hover:text-light-text-primary dark:hover:text-dark-text-primary bg-white dark:bg-dark-surface'
        }`}
      >
        {Icon && <Icon size={12} className={isActive ? colors.activeText : 'opacity-60'} />}
        <span className="max-w-[80px] truncate">{isActive ? active : label}</span>
        {isActive ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onSelect(''); setOpen(false); }}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/50 dark:hover:bg-dark-surface-secondary transition-colors text-current"
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown size={12} className={`ml-0.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 left-0 top-full mt-2 min-w-[160px] max-h-[220px] overflow-y-auto bg-white/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-gray-200 dark:border-dark-border/30 rounded-2xl shadow-xl shadow-black/10 py-1.5 scrollbar-thin"
          >
            {items.map(item => (
              <button
                key={item}
                onClick={() => { onSelect(active === item ? '' : item); setOpen(false); }}
                className={`w-full text-left text-[12px] font-medium px-4 py-2 transition-colors ${
                  active === item
                    ? `${colors.activeText} bg-gray-50 dark:bg-dark-surface-secondary/40 font-bold`
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-gray-50 dark:hover:bg-dark-surface-secondary/40'
                }`}
              >
                {item}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Competition Card ──────────────────────────────────────────────────────────

const CompetitionCard = ({ comp, isSelected, onClick }) => {
  const total     = comp.total_participants || 0;
  const fulfilled = comp.fulfilled_count    || 0;
  const pct       = total > 0 ? Math.round((fulfilled / total) * 100) : 0;

  const tplCat     = comp.template_category || '';
  const catInfo    = CATEGORY_LABELS[tplCat] || null;
  const metricInfo = METRIC_LABELS[comp.metric_key] || { label: comp.metric_key || 'KPI', icon: Target, color: 'text-light-text-secondary' };
  const MetricIcon = metricInfo.icon;
  const posLabel   = positionLabel(comp);
  const isAnnual   = comp.period_mode === 'year';
  const isAdmin    = comp.is_admin_rule;
  const isLive     = comp.is_live;

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full text-left transition-all duration-200 rounded-2xl border group block ${
        isSelected
          ? 'border-matrix-green/50 bg-matrix-green/5 dark:bg-matrix-green/10 shadow-[0_4px_12px_rgba(20,241,149,0.08)]'
          : 'border-gray-200 dark:border-dark-border/20 hover:border-gray-300 dark:hover:border-dark-border/40 bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-surface-secondary/20 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Top bar: badges inline */}
        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
          {catInfo && (
            <span className={`text-[9px] font-black uppercase tracking-wider border px-2 py-0.5 rounded-full ${catInfo.bg} ${catInfo.color} leading-none whitespace-nowrap`}>
              {catInfo.label}
            </span>
          )}
          <span className="text-[9px] font-bold text-light-text-secondary/80 dark:text-dark-text-secondary/80 bg-gray-100 dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/20 px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
            {comp.ranking_scope === 'empresa' ? '🏢 EMPRESA' : '📍 LOCAL'}
          </span>
          {isAnnual && (
            <span className="flex items-center gap-1 text-[9px] font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
              <Star size={9} fill="currentColor" /> ANUAL
            </span>
          )}
          {isAdmin && (
            <span className="text-[9px] font-black text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
              ADMIN
            </span>
          )}
          {!comp.is_active && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/50 bg-gray-100 dark:bg-dark-surface-secondary px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
              <Clock size={9} /> HISTÓRICO
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> EN VIVO
            </span>
          )}
          {/* Points + position right-aligned */}
          <span className="ml-auto text-[11px] font-black font-mono text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded-full border border-matrix-green/20 leading-none shadow-inner">
            +{comp.merit_points} PT
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-bold leading-snug line-clamp-2 text-light-text-primary dark:text-white mb-2 transition-colors">
          {comp.rule_name}
        </h3>

        {/* Compact inline cargos/secciones + posLabel */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {posLabel && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-400/10 border border-yellow-200 dark:border-yellow-400/20 px-2 py-1 rounded-lg leading-none whitespace-nowrap shadow-sm">
              <Award size={10} /> {posLabel}
            </span>
          )}
          {(comp.include_cargos || []).slice(0, 2).map(c => (
            <span key={c} className="text-[10px] font-semibold bg-gray-100 dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/20 px-2 py-1 rounded-lg text-light-text-secondary dark:text-dark-text-secondary leading-none shadow-sm whitespace-nowrap">
              {c}
            </span>
          ))}
          {(comp.include_cargos || []).length > 2 && (
            <span className="text-[10px] font-semibold text-light-text-secondary/60 dark:text-dark-text-secondary/50 leading-none">
              +{comp.include_cargos.length - 2}
            </span>
          )}
        </div>

        {/* Progress */}
        {comp.has_data ? (
          <div className="space-y-1.5 bg-gray-50/50 dark:bg-dark-surface-secondary/30 p-2.5 rounded-xl border border-gray-100 dark:border-dark-border/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`flex items-center gap-1 font-bold ${isLive ? 'text-amber-500 dark:text-amber-400' : 'text-matrix-green'}`}>
                  <CheckCircle size={10} className={isLive ? 'opacity-80' : ''} /> {fulfilled} {isLive ? 'ganarían' : 'cumplen'}
                </span>
                <span className="text-light-text-secondary/40 dark:text-dark-text-secondary/40 font-bold">/</span>
                <span className="text-light-text-secondary dark:text-dark-text-secondary font-bold">{total} totales</span>
              </div>
              <span className={`font-black text-[11px] tracking-wide ${pct >= 50 ? (isLive ? 'text-amber-500 dark:text-amber-400' : 'text-matrix-green') : 'text-light-text-primary dark:text-white'}`}>
                {pct}%
              </span>
            </div>

            <div className="h-1.5 bg-gray-200 dark:bg-dark-border/30 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className={`h-full rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)] ${isLive ? 'bg-amber-500 dark:bg-amber-400' : barColor(tplCat, isAnnual)}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: [0.04, 0.62, 0.23, 0.98] }}
              />
            </div>
          </div>
        ) : (
          <div className="text-[11px] font-medium text-light-text-secondary/60 dark:text-dark-text-secondary/60 text-center py-2.5 border border-dashed border-gray-200 dark:border-dark-border/30 rounded-xl bg-gray-50 dark:bg-dark-surface-secondary/10">
            Sin datos procesados en este período
          </div>
        )}
      </div>
    </motion.button>
  );
};

// ── Main List ─────────────────────────────────────────────────────────────────

const MeritCompetitionList = ({
  summary,
  selectedRuleId,
  onSelectRule,
  showHistoric,
  onToggleHistoric,
  loading,
  periodMode,
  listCargos = [],
  listSecciones = [],
  listFilterCargo = '',
  listFilterSeccion = '',
  onListFilterCargo,
  onListFilterSeccion,
  t,
}) => {
  const hasListFilter = !!(listFilterCargo || listFilterSeccion);

  const annual   = summary.filter(c => c.period_mode === 'year');
  const monthly  = summary.filter(c => c.period_mode !== 'year');
  const showSections = periodMode === 'all' && annual.length > 0 && monthly.length > 0;

  return (
    <div className="space-y-4">
      {/* Header row — compact horizontal */}
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-base font-black text-light-text-primary dark:text-dark-text-primary shrink-0 tracking-tight">
          <Target size={16} className="text-matrix-green" strokeWidth={2.5} />
          {t('merit_rankings.competitions.section_title')}
          <span className="text-[12px] font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/50 ml-1">({summary.length})</span>
        </h2>
        <button
          onClick={onToggleHistoric}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all shadow-sm shrink-0 ${
            showHistoric
              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
              : 'border-gray-200 dark:border-dark-border/25 text-light-text-secondary dark:text-dark-text-secondary bg-white dark:bg-dark-surface hover:border-gray-300 dark:hover:border-dark-border/50 hover:text-light-text-primary dark:hover:text-dark-text-primary'
          }`}
        >
          {showHistoric ? 'Viendo Activas' : 'Ver Historial'}
        </button>
      </div>

      {/* Filter row — horizontal dropdowns Apple-style */}
      {(listCargos.length > 0 || listSecciones.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap pb-2">
          <DropdownFilter
            label="Filtrar por Cargo"
            icon={Users}
            items={listCargos}
            active={listFilterCargo}
            onSelect={v => onListFilterCargo?.(v)}
            accentColor="matrix-green"
          />
          <DropdownFilter
            label="Filtrar por Sección"
            icon={TrendingUp}
            items={listSecciones}
            active={listFilterSeccion}
            onSelect={v => onListFilterSeccion?.(v)}
            accentColor="orange-400"
          />
          <AnimatePresence>
            {hasListFilter && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => { onListFilterCargo?.(''); onListFilterSeccion?.(''); }}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors ml-1 border border-red-200 dark:border-transparent"
                title="Limpiar filtros"
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Cards */}
      <div className="pb-4">
        {loading && summary.length === 0 ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-[140px] rounded-2xl bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border/15 animate-pulse shadow-sm" />
            ))}
          </div>
        ) : summary.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center text-center py-12 px-6 border-2 border-dashed border-gray-200 dark:border-dark-border/20 rounded-[24px] bg-gray-50/50 dark:bg-dark-surface-secondary/20">
             <div className="p-4 bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border/10 mb-4">
                <Target size={32} className="text-light-text-secondary/40 dark:text-dark-text-secondary/40" strokeWidth={1.5} />
             </div>
            {hasListFilter ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">No hay competiciones con esos filtros</span>
                <button onClick={() => { onListFilterCargo?.(''); onListFilterSeccion?.(''); }} className="text-xs font-bold text-matrix-green hover:underline decoration-matrix-green/50 underline-offset-4 transition-all">
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{t('merit_rankings.no_rules_active')}</span>
            )}
          </motion.div>
        ) : showSections ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {annual.length > 0 && (
              <div className="space-y-3">
                <SectionDivider icon={Star} label="Competiciones Anuales" count={annual.length} />
                {annual.map(comp => (
                  <CompetitionCard
                    key={comp.rule_id}
                    comp={comp}
                    isSelected={selectedRuleId === comp.rule_id}
                    onClick={() => onSelectRule(comp.rule_id)}
                  />
                ))}
              </div>
            )}
            {monthly.length > 0 && (
              <div className="space-y-3">
                <SectionDivider icon={Calendar} label="Competiciones Mensuales" count={monthly.length} />
                {monthly.map(comp => (
                  <CompetitionCard
                    key={comp.rule_id}
                    comp={comp}
                    isSelected={selectedRuleId === comp.rule_id}
                    onClick={() => onSelectRule(comp.rule_id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {summary.map(comp => (
              <CompetitionCard
                key={comp.rule_id}
                comp={comp}
                isSelected={selectedRuleId === comp.rule_id}
                onClick={() => onSelectRule(comp.rule_id)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MeritCompetitionList;
