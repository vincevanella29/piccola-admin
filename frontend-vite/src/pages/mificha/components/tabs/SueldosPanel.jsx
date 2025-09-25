// File: frontend-vite/src/pages/mificha/components/tabs/sueldos/SueldosPanel.jsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  DollarSign, Eye, LoaderCircle, TrendingUp, TrendingDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LiquidacionModal from './sueldos/LiquidacionModal';

// ===== Helpers =====
const toCLP = (n = 0) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
const safeNum = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v || 0));
const monthShort = (yyyymm) => {
  const s = String(yyyymm); const y = +s.slice(0,4); const m = +s.slice(4,6);
  return (!y||!m)?s:new Intl.DateTimeFormat('es-CL',{month:'short'}).format(new Date(y,m-1,1));
};

// ===== UI Atoms =====
function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full
      border border-light-border/30 bg-light-surface
      dark:border-dark-border/30 dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary">
      {children}
    </span>
  );
}
function KPI({ label, value, highlight }) {
  return (
    <div className={[
      "px-3 py-2 rounded-xl border text-xs",
      highlight
        ? "border-light-accent/40 bg-light-accent/10 dark:border-dark-accent/40 dark:bg-dark-accent/10"
        : "border-light-border/30 bg-light-surface-secondary/30 dark:border-dark-border/30 dark:bg-dark-surface-secondary/40"
    ].join(' ')}>
      <div className="text-[10px] uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">{label}</div>
      <div className="font-semibold text-light-text-primary dark:text-dark-text-primary text-sm">{value}</div>
    </div>
  );
}
function TinyBar({ v = 0, max = 1 }) {
  const h = max ? Math.max(2, Math.round((v / max) * 32)) : 2; // 2..32px
  return (
    <div className="w-2.5 rounded-sm bg-light-surface-tertiary/50 dark:bg-dark-surface-secondary/60 overflow-hidden">
      <div className="w-full bg-matrix-green" style={{ height: `${h}px` }} />
    </div>
  );
}
function Gauge({ pct = 0 }) {
  return (
    <div className="w-full h-1.5 rounded bg-light-surface-tertiary/50 dark:bg-dark-surface-secondary/50 overflow-hidden">
      <div className="h-1.5 bg-matrix-green" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

// ===== Year Header (Trading style) =====
function YearCard({ y, agg, prev, months, t }) {
  const deltaAbs = prev ? agg.totalNeto - prev.totalNeto : 0;
  const deltaPct = prev ? (agg.totalNeto - prev.totalNeto) / (prev.totalNeto || 1) : 0;
  const pos = deltaAbs >= 0;
  const maxInYear = Math.max(...months.map(m => safeNum(m.neto_total)), 1);

  return (
    <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/20 p-4
                    bg-light-surface dark:bg-dark-surface">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{y}</div>
        <div className={[
          "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
          pos
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
        ].join(' ')}>
          {pos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <strong>{pos ? '+' : ''}{toCLP(deltaAbs)}</strong>
          <span>({(deltaPct*100).toFixed(1)}%)</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <KPI label={t('mificha.sueldos.total_neto')} value={toCLP(agg.totalNeto)} highlight />
        <KPI label={t('mificha.sueldos.promedio_neto')} value={toCLP(agg.promedioNeto)} />
        <KPI label={t('mificha.sueldos.mejor_mes')} value={toCLP(agg.best)} />
        <KPI label={t('mificha.sueldos.peor_mes')} value={toCLP(agg.worst)} />
        <KPI label={t('mificha.sueldos.total_horas_extra')} value={agg.totalHE} />
        <KPI label={t('mificha.sueldos.total_dias_trabajados')} value={agg.totalDias} />
      </div>

      {/* Sparkline tipo “volumenes” */}
      <div className="flex items-end gap-1 h-32 mb-2">
        {months.map(m => (
          <div key={m.periodo} className="flex flex-col items-center gap-1">
            <TinyBar v={safeNum(m.neto_total)} max={maxInYear} />
            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{monthShort(m.periodo)}</span>
          </div>
        ))}
      </div>
      <Gauge pct={Math.round((agg.totalNeto / (agg.months ? agg.promedioNeto * agg.months : 1)) * 100)} />
    </div>
  );
}

// ===== Month Row (compact “ticket”) =====
function MonthRow({ g, avg, onOpen, t }) {
  const neto = safeNum(g.neto_total);
  const bruto = safeNum(g.bruto_total);
  const ratio = bruto ? Math.round((neto / bruto) * 100) : 0;
  const delta = neto - (avg || 0);
  const pos = delta >= 0;
  const it = g.items?.[0];
  const he50 = safeNum(it?.hhs_extra_50);
  const he100 = safeNum(it?.hhs_extra_100);
  const dias = safeNum(it?.dias_trabajados);

  return (
    <div className="rounded-xl border border-light-border/30 dark:border-dark-border/20 p-3
                    bg-light-surface dark:bg-dark-surface">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2 py-0.5 rounded
                           bg-light-surface-secondary dark:bg-dark-surface
                           text-light-text-secondary dark:text-dark-text-secondary">
            {monthShort(g.periodo)} {String(g.periodo).slice(0,4)}
          </span>
          <span className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary">{toCLP(neto)}</span>
          <Pill>{t('mificha.sueldos.neto_bruto')}: <strong className="ml-1">{ratio}%</strong></Pill>
        </div>

        <button
          onClick={() => it?._id && onOpen(it._id)}
          className="inline-flex items-center gap-1 text-xs font-semibold
                     text-light-text-secondary hover:text-light-text-primary
                     dark:text-dark-text-secondary dark:hover:text-dark-text-primary"
        >
          <Eye size={14} /> {t('mificha.sueldos.ver_liquidacion')}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Pill>{t('mificha.sueldos.dias_trabajados')}: <strong className="ml-1">{dias}</strong></Pill>
        <Pill>{t('mificha.sueldos.horas_extra_50')}: <strong className="ml-1">{he50}</strong></Pill>
        <Pill>{t('mificha.sueldos.horas_extra_100')}: <strong className="ml-1">{he100}</strong></Pill>
        <span className={[
          "text-xs inline-flex items-center gap-1 px-2 py-1 rounded",
          pos ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 text-red-700 dark:text-red-300"
        ].join(' ')}>
          {pos ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
          {pos ? '+' : ''}{toCLP(delta)} {t('mificha.sueldos.vs_promedio')}
        </span>
      </div>
    </div>
  );
}

// ===== Main =====
export default function SueldosPanel({ isLoading, sueldos, fetchLiquidacionDetalle }) {
  const { t } = useTranslation();

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
        totalDias: totalDias,
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

  // Modal Liquidación
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

  // Loading / empty
  if (isLoading && sueldos === null) {
    return (
      <div className="flex justify-center p-8">
        <LoaderCircle className="animate-spin text-matrix-green" />
      </div>
    );
  }
  if (sueldos !== null && Array.isArray(sueldos) && sueldos.length === 0) {
    return (
      <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">
        {t('mificha.no_hay_sueldos')}
      </p>
    );
  }

  // Ready
  return (
    <>
      {Array.isArray(sueldos) && sueldos.length > 0 && (
        <section className="rounded-3xl border border-light-border/30 dark:border-dark-border/20
                            bg-light-surface dark:bg-dark-surface-secondary/40 p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <DollarSign size={22} className="text-matrix-green" />
              <h2 className="text-lg md:text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {t('mificha.sueldos.historial_sueldos')}
              </h2>
            </div>
          </div>

          {/* Year tabs (scroll) */}
          <div className="sticky top-0 z-10 -mx-2 mb-4 px-2 py-2
                          bg-light-surface/90 backdrop-blur-sm dark:bg-dark-surface/90">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setOpenYear(y)}
                  className={[
                    "px-3 py-1.5 rounded-lg border text-sm",
                    openYear === y
                      ? "border-light-accent/50 bg-light-accent/10 text-light-text-primary dark:border-dark-accent/50 dark:bg-dark-accent/10 dark:text-dark-text-primary"
                      : "border-light-border/30 bg-light-surface-secondary/40 text-light-text-secondary hover:bg-light-surface-secondary/60 dark:border-dark-border/30 dark:bg-dark-surface-secondary/40 dark:text-dark-text-secondary dark:hover:bg-dark-surface-secondary/60"
                  ].join(' ')}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Year card + month list */}
          {openYear && (
            <div className="space-y-4">
              <YearCard
                y={openYear}
                agg={yearAgg[openYear]}
                prev={yearAgg[String(Number(openYear) - 1)]}
                months={byYear.get(openYear) || []}
                t={t}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(byYear.get(openYear) || []).map(g => (
                  <MonthRow key={g.periodo} g={g} avg={yearAgg[openYear]?.promedioNeto} onOpen={openLiquidacion} t={t} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal Liquidación */}
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
