import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BadgeCheck, Clock, AlertCircle, ChevronsRight, Trophy, BarChart, 
  Calendar, Users, MapPin, Star, CheckCircle, XCircle, ChevronDown 
} from 'lucide-react';
import { getPublicEmployeeMeritHistory } from '../../../../../utils/meritRankings.jsx';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = new Intl.NumberFormat('es-CL');

// --- SUB-COMPONENTES DE UI (Primitivos) ---

const Shimmer = ({ className = '' }) => <div className={`bg-dark-surface-secondary/40 animate-pulse rounded ${className}`} />;

/**
 * Badge para el estado del mérito (Minteado, Pendiente, No cumplido)
 */
const MeritBadge = ({ item, t }) => {
  const { status, mint_status } = item;
  let kind = status; // 'fulfilled' (pendiente) o 'not_fulfilled' (no cumplido)
  if (mint_status === 'minted') {
    kind = 'minted';
  }

  const base = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold';
  if (kind === 'minted') return <span className={`${base} border border-emerald-400/30 text-emerald-300 bg-emerald-400/10`}><BadgeCheck size={14}/>{t('merits.modal.badges.minted', 'Minteado')}</span>;
  if (kind === 'fulfilled') return <span className={`${base} border-amber-400/30 text-amber-300 bg-amber-400/10`}><Clock size={14}/>{t('merits.modal.badges.pending', 'Pendiente')}</span>;
  if (kind === 'not_fulfilled') return <span className={`${base} border-rose-400/30 text-rose-300 bg-rose-400/10`}><AlertCircle size={14}/>{t('merits.modal.badges.not', 'No cumplido')}</span>;
  return null;
};

/**
 * Item de Requerimiento (copiado de tu ejemplo)
 */
const RequirementItem = ({ icon: Icon, label, value }) => {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-dark-text-secondary" /><span className="font-semibold text-dark-text-primary">{label}:</span> <span className="truncate">{String(value)}</span></div>;
};

/**
 * Item de Resultado (copiado de tu ejemplo)
 */
const ResultItem = ({ icon: Icon, label, rank, total }) => {
  if (rank == null && total == null) return null;
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-dark-text-secondary" /> <span className="font-semibold text-dark-text-primary">{label}:</span> <span>{rank != null ? `#${rank}` : 'N/A'} / {total != null ? fmt.format(total) : 'N/A'}</span></div>;
};

/**
 * Tarjeta de historial individual (copiada de tu ejemplo)
 */
const HistoryItem = ({ item, t }) => {
  const { status, mint_status, segment, name, template_key, merit_points, rule_params: rp = {}, placement: plc = {} } = item;
  const sym = segment?.symbol || '???';
  const segName = segment?.name || t('merits.modal.item.unknown_segment', 'Segmento Desconocido');
  
  const positionText = useMemo(() => {
    if (!rp.position_type) return null;
    let text = t(`merits.modal.item.position_type.${rp.position_type}`, rp.position_type);
    if (rp.position_type === 'exact' && rp.ranking_position) text += ` #${rp.ranking_position}`;
    if (rp.position_type === 'top_n' && rp.position_to) text += ` ${rp.position_from || 1}-${rp.position_to}`;
    return text;
  }, [rp, t]);

  return (
    <div className="px-3 py-3 rounded-lg border border-dark-border/20 bg-dark-surface-secondary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-grow flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-matrix-green/10 text-matrix-green border border-matrix-green/30">{sym}</span>
            <div className="truncate">
              <div className="text-sm font-semibold text-white truncate">{name || template_key || t('merits.modal.item.fallback_rule_name', 'Regla de Mérito')}</div>
              <div className="text-[11px] text-dark-text-secondary truncate capitalize">{segName}</div>
            </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="tabular-nums text-sm font-bold text-white">{fmt.format(Number(merit_points || 0))} pts</span>
          <MeritBadge item={item} t={t} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-dark-text-secondary">
        <div className="rounded-md border border-dark-border/10 bg-dark-surface/40 p-2 space-y-1.5">
          <RequirementItem icon={ChevronsRight} label={t('merits.modal.item.scope', 'Ámbito')} value={t(`merits.modal.item.scope_type.${rp.ranking_scope}`, rp.ranking_scope)} />
          <RequirementItem icon={Trophy} label={t('merits.modal.item.position', 'Posición')} value={positionText} />
          <RequirementItem icon={BarChart} label={t('merits.modal.item.metric', 'Métrica')} value={t(`merits.modal.item.metric_type.${rp.metric || rp.metric_key}`, rp.metric || rp.metric_key)} />
          <RequirementItem icon={Calendar} label={t('merits.modal.item.min_days', 'Días mín.')} value={rp.min_days_worked} />
        </div>
        <div className="rounded-md border border-dark-border/10 bg-dark-surface/40 p-2 space-y-1.5">
          <ResultItem icon={Users} label={t('merits.modal.item.company_rank', 'Rank Empresa')} rank={plc.company?.rank} total={plc.company?.total} />
          <ResultItem icon={MapPin} label={t('merits.modal.item.local_rank', 'Rank Local')} rank={plc.local?.rank} total={plc.local?.total} />
          <div className="flex items-start gap-2 pt-1"><Star size={14} className="mt-0.5 shrink-0 text-dark-text-secondary" /><span className="font-semibold text-dark-text-primary">{t('merits.modal.item.status', 'Estado')}:</span> <span>{t(`merits.modal.item.status_type.${status}`, status)}</span></div>
        </div>
      </div>
    </div>
  );
};


// --- HELPERS ---

/**
 * Helper para calcular totales de un array de items (copiado de tu ejemplo)
 */
const computeTotalsFromItems = (items = []) => {
  let total_points = 0;
  let fulfilled_count = 0;
  let not_fulfilled_count = 0;
  let minted_count = 0;
  for (const it of items) {
    if (it?.mint_status === 'minted') {
      minted_count += 1;
      total_points += Number(it?.merit_points || 0);
    } else if (it?.status === 'fulfilled') {
      fulfilled_count += 1;
      total_points += Number(it?.merit_points || 0); // Contamos puntos pendientes también
    } else if (it?.status === 'not_fulfilled') {
      not_fulfilled_count += 1;
    }
  }
  return { total_points, fulfilled_count, not_fulfilled_count, minted_count };
};

/**
 * Badges de totales (copiado de tu ejemplo, con íconos de mi v2)
 */
const TotalsBadges = ({ totals, t }) => (
  <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-dark-text-secondary">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dark-border/30 bg-dark-surface/40 text-white">
      Σ {fmt.format(totals.total_points || 0)}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
      <BadgeCheck size={12} /> {fmt.format(totals.minted_count || 0)}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-300">
      <Clock size={12} /> {fmt.format(totals.fulfilled_count || 0)}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-400/30 bg-rose-400/10 text-rose-300">
      <XCircle size={12} /> {fmt.format(totals.not_fulfilled_count || 0)}
    </span>
  </div>
);


/**
 * Helper para formatear '2025-09' a 'Septiembre 2025'
 */
const formatPeriodo = (periodoStr) => {
  if (!periodoStr || !periodoStr.includes('-')) return periodoStr || '...';
  try {
    const [year, month] = periodoStr.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 2));
    const str = date.toLocaleString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch (e) {
    return periodoStr; // Fallback
  }
};


// --- COMPONENTES DE ACORDEÓN (Copiados de tu ejemplo y adaptados) ---

const MonthAccordion = ({ period, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const monthTotals = useMemo(() => computeTotalsFromItems(period.items || []), [period]);
  
  // No renderizar si no hay items para este mes
  if (!period.items || period.items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-dark-border/10 bg-dark-surface-secondary/10 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold text-white hover:bg-dark-surface-secondary/30 transition-colors">
        <span className="font-semibold text-sm text-dark-text-primary capitalize">
          {formatPeriodo(period.periodo)} {/* <-- USANDO TU HELPER */}
        </span>
        <div className="flex items-center gap-3">
          <TotalsBadges totals={monthTotals} t={t} />
          <ChevronDown size={18} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial="collapsed" animate="open" exit="collapsed"
            variants={{ open: { opacity: 1, height: 'auto' }, collapsed: { opacity: 0, height: 0 } }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-dark-border/10"
          >
            <div className="p-3 space-y-2">
              {period.items.map((item, idx) => (
                <HistoryItem key={item.result_id || idx} item={item} t={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const YearAccordion = ({ year, periods, t, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const yearTotals = useMemo(() => {
    const agg = { total_points: 0, fulfilled_count: 0, not_fulfilled_count: 0, minted_count: 0 };
    periods.forEach(p => {
      const mt = computeTotalsFromItems(p.items || []);
      agg.total_points += mt.total_points;
      agg.fulfilled_count += mt.fulfilled_count;
      agg.not_fulfilled_count += mt.not_fulfilled_count;
      agg.minted_count += mt.minted_count;
    });
    return agg;
  }, [periods]);

  return (
    <div className="rounded-lg border border-dark-border/20 bg-dark-surface-secondary/20 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-white hover:bg-dark-surface-secondary/40 transition-colors">
        <span className="text-lg font-bold">{year}</span>
        <div className="flex items-center gap-3">
          <TotalsBadges totals={yearTotals} t={t} />
          <ChevronDown size={20} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial="collapsed" animate="open" exit="collapsed"
            variants={{ open: { opacity: 1, height: 'auto' }, collapsed: { opacity: 0, height: 0 } }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-dark-border/20"
          >
            <div className="p-3 space-y-2">
              {periods.map(period => (
                <MonthAccordion key={period.periodo} period={period} t={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HistoryView = ({ history, loading, error, t }) => {
    const groupedHistory = useMemo(() => {
        if (!history || history.length === 0) return {};
        const groups = history.reduce((acc, period) => {
            const year = period.periodo.substring(0, 4);
            if (!acc[year]) acc[year] = [];
            acc[year].push(period);
            return acc;
        }, {});
        
        const sortedYears = Object.keys(groups).sort((a, b) => b - a);
        const out = {};
        for (const y of sortedYears) {
          out[y] = groups[y].sort((p1, p2) => (p1.periodo < p2.periodo ? 1 : -1));
        }
        return out;
    }, [history]);
    
  return (
    <div className="p-1">
      {loading && !history?.length ? (
        <div className="p-4 space-y-4">
          <Shimmer className="h-24 w-full" />
          <Shimmer className="h-40 w-full" />
        </div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-rose-300 flex flex-col items-center gap-2">
          <AlertCircle size={32} />
          <p>{t('merits.modal.error_prefix', 'Error al cargar historial')}</p>
          <p className="text-xs text-rose-300/60">{String(error)}</p>
        </div>
      ) : !history?.length ? (
        <div className="p-12 text-center text-sm text-dark-text-secondary">
          {t('merits.modal.empty_history', 'No se encontró historial de méritos.')}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedHistory).map(([year, periods], idx) => (
            <YearAccordion 
              key={year} 
              year={year} 
              periods={periods} 
              t={t} 
              defaultOpen={idx === 0} // <-- Abre el primer año (más reciente) por defecto
            />
          ))}
        </div>
      )}
    </div>
  );
};


// --- COMPONENTE PRINCIPAL (Wrapper) ---

export const HistoryTab = ({ employee, appState }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const rut = employee?.rut;
  const wallet = employee?.wallet || employee?.merit_profile?.wallet || null;

  // Efecto para cargar el historial
  useEffect(() => {
    let active = true;
    async function run() {
      if (!rut && !wallet) return;
      setLoading(true);
      setError(null);
      setPayload(null);
      try {
        const res = await getPublicEmployeeMeritHistory(appState, { rut, wallet, include_profile: true });
        if (!active) return;
        setPayload(res);
      } catch (e) {
        if (!active) return;
        setError(e?.message || 'Error al cargar historial');
        setPayload(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    run();
    return () => { active = false; };
  }, [appState, rut, wallet]);

  return (
    <div className="space-y-4">
      {/* Cabecera con título y TOTALES GENERALES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">Historial de Méritos (General)</div>
        {payload?.totals && <TotalsBadges totals={payload.totals} t={t} />}
      </div>
      
      <hr className="border-dark-border/10" />

      {/* Vista de Acordeones Año -> Mes -> Item */}
      <HistoryView
        history={payload?.history || []}
        loading={loading}
        error={error}
        t={t}
      />
    </div>
  );
};