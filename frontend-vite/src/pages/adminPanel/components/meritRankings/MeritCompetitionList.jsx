// src/pages/adminPanel/components/meritRankings/MeritCompetitionList.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Users, Star, TrendingUp,
  CheckCircle, Zap, Calendar, BarChart2,
  X, ChevronDown,
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
  sales:          { label: 'Ventas',     color: 'text-matrix-green', bg: 'bg-matrix-green/10 border-matrix-green/20' },
  sales_admin:    { label: 'Ventas Adm', color: 'text-dark-accent',  bg: 'bg-dark-accent/10  border-dark-accent/20' },
  times_employee: { label: 'Tiempos',    color: 'text-orange-400',   bg: 'bg-orange-400/10   border-orange-400/20' },
  times_local:    { label: 'T.Local',    color: 'text-cyan-400',     bg: 'bg-cyan-400/10     border-cyan-400/20' },
  attendance:     { label: 'Asistencia', color: 'text-yellow-400',   bg: 'bg-yellow-400/10   border-yellow-400/20' },
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
  if (tplCat === 'sales_admin') return 'bg-dark-accent';
  return 'bg-matrix-green';
}

// ── Section header ────────────────────────────────────────────────────────────

const SectionDivider = ({ label, icon: Icon, count }) => (
  <div className="flex items-center gap-2 py-1">
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={11} className="text-dark-text-secondary/60" />}
      <span className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary/60">{label}</span>
    </div>
    <div className="flex-1 h-px bg-dark-border/20" />
    <span className="text-[9px] text-dark-text-secondary/40">{count}</span>
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
    'matrix-green': { activeBg: 'bg-matrix-green/12', activeBorder: 'border-matrix-green/35', activeText: 'text-matrix-green' },
    'orange-400':   { activeBg: 'bg-orange-400/12',   activeBorder: 'border-orange-400/35',   activeText: 'text-orange-400'   },
  }[accentColor] || { activeBg: 'bg-matrix-green/12', activeBorder: 'border-matrix-green/35', activeText: 'text-matrix-green' };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-[11px] font-semibold pl-2.5 pr-2 py-1.5 rounded-lg border transition-all ${
          isActive
            ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText}`
            : 'border-dark-border/25 text-dark-text-secondary hover:border-dark-border/50 hover:text-dark-text-primary bg-dark-surface'
        }`}
      >
        {Icon && <Icon size={11} className={isActive ? colors.activeText : 'text-dark-text-secondary/50'} />}
        <span className="max-w-[80px] truncate">{isActive ? active : label}</span>
        {isActive ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onSelect(''); setOpen(false); }}
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-dark-surface-secondary transition-colors"
          >
            <X size={9} />
          </span>
        ) : (
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 top-full mt-1 min-w-[140px] max-h-[200px] overflow-y-auto bg-dark-surface border border-dark-border/30 rounded-xl shadow-xl shadow-black/30 py-1 scrollbar-thin"
          >
            {items.map(item => (
              <button
                key={item}
                onClick={() => { onSelect(active === item ? '' : item); setOpen(false); }}
                className={`w-full text-left text-[11px] px-3 py-1.5 transition-colors ${
                  active === item
                    ? `${colors.activeText} ${colors.activeBg} font-bold`
                    : 'text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-surface-secondary/40'
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
  const metricInfo = METRIC_LABELS[comp.metric_key] || { label: comp.metric_key || 'KPI', icon: Target, color: 'text-dark-text-secondary' };
  const MetricIcon = metricInfo.icon;
  const posLabel   = positionLabel(comp);
  const isAnnual   = comp.period_mode === 'year';
  const isAdmin    = comp.is_admin_rule;
  const isLive     = comp.is_live;

  return (
    <motion.button
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.988 }}
      onClick={onClick}
      className={`w-full text-left transition-all rounded-xl border group ${
        isSelected
          ? 'border-matrix-green/40 bg-matrix-green/[0.04] shadow-lg shadow-matrix-green/5'
          : 'border-dark-border/20 hover:border-dark-border/40 bg-dark-surface hover:bg-dark-surface-secondary/15'
      }`}
    >
      <div className="p-3">
        {/* Top bar: badges inline */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {catInfo && (
            <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded-full ${catInfo.bg} ${catInfo.color} leading-none`}>
              {catInfo.label}
            </span>
          )}
          <span className="text-[8px] text-dark-text-secondary/60 bg-dark-surface-secondary border border-dark-border/15 px-1.5 py-0.5 rounded-full leading-none">
            {comp.ranking_scope === 'empresa' ? '🏢 Emp' : '📍 Loc'}
          </span>
          {isAnnual && (
            <span className="flex items-center gap-0.5 text-[8px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded-full leading-none">
              <Star size={7} /> Anual
            </span>
          )}
          {isAdmin && (
            <span className="text-[8px] font-bold text-dark-accent bg-dark-accent/10 border border-dark-accent/20 px-1.5 py-0.5 rounded-full leading-none">
              ADM
            </span>
          )}
          {!comp.is_active && (
            <span className="flex items-center gap-0.5 text-[8px] text-dark-text-secondary/50 bg-dark-surface-secondary px-1.5 py-0.5 rounded-full leading-none">
              <Clock size={7} /> Hist.
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-0.5 text-[8px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full leading-none animate-pulse">
              ● EN VIVO
            </span>
          )}
          {/* Points + position right-aligned */}
          <span className="ml-auto text-[10px] font-black font-mono text-matrix-green leading-none">+{comp.merit_points}pt</span>
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-bold leading-snug line-clamp-2 text-dark-text-primary mb-1">
          {comp.rule_name}
        </h3>

        {/* Compact inline cargos/secciones + posLabel */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {posLabel && (
            <span className="text-[8px] font-bold text-yellow-400 bg-yellow-400/8 border border-yellow-400/15 px-1.5 py-0.5 rounded-md leading-none">🏆 {posLabel}</span>
          )}
          {(comp.include_cargos || []).slice(0, 2).map(c => (
            <span key={c} className="text-[8px] bg-dark-surface-secondary/80 border border-dark-border/15 px-1.5 py-0.5 rounded-md text-dark-text-secondary/70 leading-none">{c}</span>
          ))}
          {(comp.include_cargos || []).length > 2 && (
            <span className="text-[8px] text-dark-text-secondary/40 leading-none">+{comp.include_cargos.length - 2}</span>
          )}
        </div>

        {/* Progress */}
        {comp.has_data ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[9px]">
                <span className={`flex items-center gap-0.5 font-bold ${isLive ? 'text-amber-400' : 'text-matrix-green'}`}>
                  <CheckCircle size={8} /> {fulfilled} {isLive ? 'ganarían' : ''}
                </span>
                <span className="text-dark-text-secondary/40">/</span>
                <span className="text-dark-text-secondary">{total}</span>
              </div>
              <span className={`font-bold text-[10px] ${pct >= 50 ? (isLive ? 'text-amber-400' : 'text-matrix-green') : 'text-yellow-400'}`}>
                {pct}%
              </span>
            </div>

            <div className="h-[3px] bg-dark-border/15 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isLive ? 'bg-amber-400/70' : barColor(tplCat, isAnnual)}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        ) : (
          <div className="text-[8px] text-dark-text-secondary/40 italic text-center py-1 border border-dashed border-dark-border/15 rounded-lg">
            Sin datos — worker pendiente
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
    <div className="space-y-2">
      {/* Header row — compact horizontal */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-dark-text-primary shrink-0">
          <Target size={13} className="text-matrix-green" />
          {t('merit_rankings.competitions.section_title')}
          <span className="text-[10px] font-normal text-dark-text-secondary/50 ml-0.5">({summary.length})</span>
        </h2>
        <button
          onClick={onToggleHistoric}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all shrink-0 ${
            showHistoric
              ? 'border-dark-accent/40 bg-dark-accent/10 text-dark-accent'
              : 'border-dark-border/25 text-dark-text-secondary hover:border-dark-border/50'
          }`}
        >
          {showHistoric ? 'Activas' : 'Historial'}
        </button>
      </div>

      {/* Filter row — horizontal dropdowns Apple-style */}
      {(listCargos.length > 0 || listSecciones.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <DropdownFilter
            label="Cargo"
            icon={Users}
            items={listCargos}
            active={listFilterCargo}
            onSelect={v => onListFilterCargo?.(v)}
            accentColor="matrix-green"
          />
          <DropdownFilter
            label="Sección"
            icon={TrendingUp}
            items={listSecciones}
            active={listFilterSeccion}
            onSelect={v => onListFilterSeccion?.(v)}
            accentColor="orange-400"
          />
          {hasListFilter && (
            <button
              onClick={() => { onListFilterCargo?.(''); onListFilterSeccion?.(''); }}
              className="text-[9px] text-dark-text-secondary/40 hover:text-red-400 transition-colors ml-0.5"
              title="Limpiar filtros"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Cards */}
      {loading && summary.length === 0 ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-dark-surface border border-dark-border/15 animate-pulse" />
          ))}
        </div>
      ) : summary.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-dark-border/20 rounded-xl text-sm text-dark-text-secondary">
          {hasListFilter ? (
            <span className="text-xs">
              Sin resultados.{' '}
              <button onClick={() => { onListFilterCargo?.(''); onListFilterSeccion?.(''); }} className="text-matrix-green underline">
                Limpiar filtro
              </button>
            </span>
          ) : (
            t('merit_rankings.no_rules_active')
          )}
        </div>
      ) : showSections ? (
        <>
          {annual.length > 0 && (
            <>
              <SectionDivider icon={Star} label="Anuales" count={annual.length} />
              {annual.map(comp => (
                <CompetitionCard
                  key={comp.rule_id}
                  comp={comp}
                  isSelected={selectedRuleId === comp.rule_id}
                  onClick={() => onSelectRule(comp.rule_id)}
                />
              ))}
            </>
          )}
          {monthly.length > 0 && (
            <>
              <SectionDivider icon={Calendar} label="Mensuales" count={monthly.length} />
              {monthly.map(comp => (
                <CompetitionCard
                  key={comp.rule_id}
                  comp={comp}
                  isSelected={selectedRuleId === comp.rule_id}
                  onClick={() => onSelectRule(comp.rule_id)}
                />
              ))}
            </>
          )}
        </>
      ) : (
        <div className="space-y-1.5">
          {summary.map(comp => (
            <CompetitionCard
              key={comp.rule_id}
              comp={comp}
              isSelected={selectedRuleId === comp.rule_id}
              onClick={() => onSelectRule(comp.rule_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MeritCompetitionList;
