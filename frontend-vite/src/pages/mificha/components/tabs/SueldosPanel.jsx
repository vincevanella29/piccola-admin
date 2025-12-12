// File: frontend-vite/src/pages/mificha/components/tabs/sueldos/SueldosPanel.jsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  DollarSign, 
  Eye, 
  LoaderCircle, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  BarChart3,
  Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import LiquidacionModal from './sueldos/LiquidacionModal'; // Asegúrate de que la ruta sea correcta

// ===== Helpers =====
const toCLP = (n = 0) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
const safeNum = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v || 0));
const monthShort = (yyyymm) => {
  const s = String(yyyymm); const y = +s.slice(0,4); const m = +s.slice(4,6);
  return (!y||!m)?s:new Intl.DateTimeFormat('es-CL',{month:'short'}).format(new Date(y,m-1,1));
};

// ===== UI Atoms =====
function Pill({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide px-2 py-1 rounded-md
      border border-light-border/20 bg-light-surface-secondary/50
      dark:border-dark-border/20 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary ${className}`}>
      {children}
    </span>
  );
}

function KPI({ label, value, highlight, subtext }) {
  return (
    <div className={[
      "flex flex-col justify-between p-3 rounded-xl border transition-all",
      highlight
        ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
        : "border-light-border/30 bg-light-surface-secondary/20 dark:border-dark-border/20 dark:bg-dark-surface-secondary/20"
    ].join(' ')}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-secondary/70 mb-1 truncate">
        {label}
      </div>
      <div className={`font-mono font-semibold text-sm truncate ${highlight ? 'text-emerald-700 dark:text-emerald-400' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
        {value}
      </div>
      {subtext && <div className="text-[10px] text-light-text-tertiary mt-1">{subtext}</div>}
    </div>
  );
}

function TinyBar({ v = 0, max = 1, active }) {
  const h = max ? Math.max(4, Math.round((v / max) * 40)) : 4; // 4..40px height
  return (
    <div className="group relative flex flex-col items-center gap-1">
      {/* Tooltip on hover */}
      <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-black text-white px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none z-10">
        {toCLP(v)}
      </div>
      <div 
        className={`w-2.5 rounded-t-sm transition-all duration-500 ${active ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-border/50 dark:bg-dark-border/50'}`} 
        style={{ height: `${h}px` }} 
      />
    </div>
  );
}

// ===== Year Header (Financial Dashboard Style) =====
function YearCard({ y, agg, prev, months, t }) {
  const deltaAbs = prev ? agg.totalNeto - prev.totalNeto : 0;
  const deltaPct = prev ? (agg.totalNeto - prev.totalNeto) / (prev.totalNeto || 1) : 0;
  const pos = deltaAbs >= 0;
  const maxInYear = Math.max(...months.map(m => safeNum(m.neto_total)), 1);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 p-5
                 bg-gradient-to-br from-light-surface via-light-surface to-light-surface-secondary/30
                 dark:from-dark-surface dark:via-dark-surface dark:to-dark-surface-secondary/10 shadow-sm relative overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-32 bg-light-accent/5 dark:bg-dark-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">{y}</span>
            <div className={[
              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
              pos
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400"
            ].join(' ')}>
              {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(deltaPct * 100).toFixed(1)}% vs anterior</span>
            </div>
          </div>
          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            Resumen anual de remuneraciones y desempeño.
          </div>
        </div>

        {/* Mini Chart */}
        <div className="flex items-end gap-1.5 h-12 pb-1">
          {months.slice().reverse().map(m => ( // Mostrar orden cronológico visualmente
            <TinyBar key={m.periodo} v={safeNum(m.neto_total)} max={maxInYear} active={safeNum(m.neto_total) === agg.best} />
          ))}
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label={t('mificha.sueldos.total_neto')} value={toCLP(agg.totalNeto)} highlight />
        <KPI label={t('mificha.sueldos.promedio_neto')} value={toCLP(agg.promedioNeto)} />
        <KPI label="Mejor Ingreso" value={toCLP(agg.best)} subtext="Mensual más alto" />
        <KPI label="Total Días" value={agg.totalDias} subtext="Trabajados" />
        <KPI label="Total H.E." value={agg.totalHE} subtext="Horas Extras" />
        <KPI label="Días Licencia" value={agg.totalLicencia} />
      </div>
    </motion.div>
  );
}

// ===== Month Row (Detailed Ticket) =====
function MonthRow({ g, avg, onOpen, t, index }) {
  const neto = safeNum(g.neto_total);
  const bruto = safeNum(g.bruto_total);
  const delta = neto - (avg || 0);
  const pos = delta >= 0;
  const it = g.items?.[0];
  const he50 = safeNum(it?.hhs_extra_50);
  const he100 = safeNum(it?.hhs_extra_100);
  
  // Variantes de animación
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { delay: index * 0.05, duration: 0.3 } }
  };

  return (
    <motion.div 
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="group relative rounded-xl border border-light-border/30 dark:border-dark-border/30 
                 bg-light-surface dark:bg-dark-surface hover:border-light-accent/30 dark:hover:border-dark-accent/30
                 transition-colors overflow-hidden"
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary flex flex-col items-center justify-center border border-light-border/20 dark:border-dark-border/20">
              <span className="text-[9px] uppercase font-bold text-light-text-tertiary">{String(g.periodo).slice(0,4)}</span>
              <span className="text-xs font-black text-light-text-primary dark:text-dark-text-primary uppercase">{monthShort(g.periodo).replace('.','')}</span>
            </div>
            <div>
              <div className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary tabular-nums tracking-tight">
                {toCLP(neto)}
              </div>
              <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                <span>Líquido a Pago</span>
                <span className={`flex items-center ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {pos ? <TrendingUp size={10} className="mr-0.5"/> : <TrendingDown size={10} className="mr-0.5"/>}
                  {Math.abs(delta / (avg || 1) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => it?._id && onOpen(it._id)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                       bg-light-text-primary text-light-surface hover:bg-light-text-primary/90
                       dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-colors"
          >
            <Eye size={14} /> 
            <span className="hidden sm:inline">{t('mificha.sueldos.ver_liquidacion')}</span>
          </button>
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-light-border/10 dark:border-dark-border/10 mt-1">
          <Pill><Clock size={10} /> {it?.dias_trabajados} días trab.</Pill>
          {(he50 > 0 || he100 > 0) && (
            <Pill className="text-orange-600/80 dark:text-orange-400/80 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30">
               <Clock size={10} /> {he50 + he100} HE
            </Pill>
          )}
          <Pill>Bruto: {toCLP(bruto)}</Pill>
        </div>
      </div>
    </motion.div>
  );
}

// ===== Main =====
export default function SueldosPanel({ isLoading, sueldos, fetchLiquidacionDetalle }) {
  const { t } = useTranslation();

  // Ordenar y agrupar data (lógica conservada)
  const sorted = useMemo(() => {
    const arr = Array.isArray(sueldos) ? [...sueldos] : [];
    return arr.sort((a,b) => Number(b.periodo) - Number(a.periodo));
  }, [sueldos]);

  const byYear = useMemo(() => {
    const map = new Map();
    for (const g of sorted) {
      const y = String(g.periodo).slice(0,4);
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(g);
    }
    for (const [,list] of map.entries()) list.sort((a,b)=>Number(b.periodo)-Number(a.periodo));
    return map;
  }, [sorted]);

  const years = useMemo(() => Array.from(byYear.keys()).sort((a,b)=>Number(b)-Number(a)), [byYear]);

  const yearAgg = useMemo(() => {
    const agg = {};
    for (const y of years) {
      const list = byYear.get(y) || [];
      const totalNeto = list.reduce((a,g)=>a+safeNum(g.neto_total),0);
      const totalBruto = list.reduce((a,g)=>a+safeNum(g.bruto_total),0);
      const best = list.reduce((mx,g)=>Math.max(mx, safeNum(g.neto_total)),0);
      const worst = list.reduce((mn,g)=>Math.min(mn, safeNum(g.neto_total)), Number.MAX_SAFE_INTEGER);

      let totalDias=0,totalLic=0,totalAus=0,totalHE50=0,totalHE100=0;
      for (const g of list) {
        const it = Array.isArray(g.items) && g.items.length ? g.items[0] : null;
        if (it) {
          totalDias   += safeNum(it.dias_trabajados);
          totalLic    += safeNum(it.dias_licencia);
          totalAus    += safeNum(it.dias_ausencia);
          totalHE50   += safeNum(it.hhs_extra_50);
          totalHE100  += safeNum(it.hhs_extra_100);
        }
      }

      agg[y] = {
        months: list.length,
        totalNeto,
        totalBruto,
        promedioNeto: list.length ? totalNeto / list.length : 0,
        best,
        worst: worst===Number.MAX_SAFE_INTEGER ? 0 : worst,
        totalDias,
        totalLicencia: totalLic,
        totalAusencia: totalAus,
        totalHE50,
        totalHE100,
        totalHE: totalHE50 + totalHE100,
      };
    }
    return agg;
  }, [years, byYear]);

  const [openYear, setOpenYear] = useState(() => years[0] || null);

  // Modal State
  const [liq, setLiq] = useState({ open:false, loading:false, data:null, error:null });
  
  const openLiquidacion = useCallback(async (id) => {
    if (!id || !fetchLiquidacionDetalle) return;
    setLiq({ open:true, loading:true, data:null, error:null });
    try {
      const payload = await fetchLiquidacionDetalle({ liquidationId: id });
      setLiq({ open:true, loading:false, data:payload?.liquidacion || null, error:null });
    } catch (e) {
      setLiq({ open:true, loading:false, data:null, error:e?.response?.data?.detail || e?.message || 'Error' });
    }
  }, [fetchLiquidacionDetalle]);

  const closeLiquidacion = () => setLiq({ open:false, loading:false, data:null, error:null });

  // Loading View
  if (isLoading && sueldos === null) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3 min-h-[300px]">
        <LoaderCircle className="animate-spin text-light-accent dark:text-dark-accent" size={32} />
        <span className="text-sm text-light-text-tertiary animate-pulse">Cargando historial...</span>
      </div>
    );
  }

  // Empty View
  if (sueldos !== null && Array.isArray(sueldos) && sueldos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-center border border-dashed border-light-border/30 dark:border-dark-border/30 rounded-3xl bg-light-surface/50 dark:bg-dark-surface/50">
        <div className="p-4 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary mb-3">
            <DollarSign size={24} className="text-light-text-tertiary" />
        </div>
        <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">
          {t('mificha.no_hay_sueldos')}
        </p>
      </div>
    );
  }

  // Ready View
  return (
    <>
      <div className="space-y-6">
        {Array.isArray(sueldos) && sueldos.length > 0 && (
          <section>
            {/* Header Title */}
            <div className="flex items-center gap-3 mb-6 px-1">
               <div className="p-2.5 rounded-xl bg-gradient-to-br from-light-accent/20 to-light-accent/5 dark:from-dark-accent/20 dark:to-dark-accent/5 border border-light-accent/10 dark:border-dark-accent/10">
                 <BarChart3 size={20} className="text-light-accent dark:text-dark-accent" />
               </div>
               <div>
                 <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                    {t('mificha.sueldos.historial_sueldos')}
                 </h2>
                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                   Historial completo de liquidaciones y bonos.
                 </p>
               </div>
            </div>

            {/* Year Selector (Sticky) */}
            <div className="sticky top-0 z-20 py-3 bg-light-background/80 dark:bg-dark-background/80 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => setOpenYear(y)}
                    className={`
                      px-4 py-1.5 rounded-full border text-xs font-semibold transition-all whitespace-nowrap
                      ${openYear === y
                        ? "border-light-accent/50 bg-light-accent text-white dark:border-dark-accent/50 dark:bg-dark-accent dark:text-black shadow-md shadow-light-accent/20 dark:shadow-dark-accent/20"
                        : "border-light-border/30 bg-light-surface dark:border-dark-border/30 dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary"
                      }
                    `}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
              {openYear && (
                <motion.div 
                  key={openYear}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Summary Card */}
                  <YearCard
                    y={openYear}
                    agg={yearAgg[openYear]}
                    prev={yearAgg[String(Number(openYear) - 1)]}
                    months={byYear.get(openYear) || []}
                    t={t}
                  />

                  {/* Month Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(byYear.get(openYear) || []).map((g, idx) => (
                      <MonthRow 
                        key={g.periodo} 
                        g={g} 
                        avg={yearAgg[openYear]?.promedioNeto} 
                        onOpen={openLiquidacion} 
                        t={t} 
                        index={idx}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>

      {/* Modal Integration */}
      <LiquidacionModal
        open={liq.open}
        onClose={closeLiquidacion}
        data={liq.data}
        loading={liq.loading}
        error={liq.error}
        t={t}
      />
    </>
  );
}