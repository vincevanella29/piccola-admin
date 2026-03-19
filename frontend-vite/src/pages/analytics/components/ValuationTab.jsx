/**
 * ValuationTab — EBITDA-based company valuation using global restaurant metrics.
 *
 * Uses actual revenue & expenses data to compute EBITDA, then applies
 * industry-standard EV/EBITDA multiples for restaurant businesses.
 *
 * Global restaurant industry benchmarks (2024):
 *   - Quick Service:      EV/EBITDA  8-12x
 *   - Fast Casual:        EV/EBITDA 10-15x
 *   - Casual Dining:      EV/EBITDA  6-10x
 *   - Fine Dining:        EV/EBITDA  8-14x
 *   - Multi-unit chains:  EV/EBITDA 10-18x
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, DollarSign, TrendingUp, BarChart3, Loader2,
  Calculator, Landmark, Globe, ChevronRight, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import dayjs from 'dayjs';
import useAnalyticsCache from '../../../hooks/useAnalyticsCache';

// ── Helpers ──────────────────────────────────────────────────────────────────
const CLP = (n) => Math.round(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const USD = (n) => Math.round(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// CLP to USD approximate conversion (adjustable)
const CLP_TO_USD = 1 / 950;

// ── Industry benchmarks ──────────────────────────────────────────────────────
const INDUSTRY_BENCHMARKS = [
  { key: 'quick_service',   label: 'valuation.quick_service',   low: 8,  mid: 10, high: 12, color: '#f97316' },
  { key: 'fast_casual',     label: 'valuation.fast_casual',     low: 10, mid: 12, high: 15, color: '#3b82f6' },
  { key: 'casual_dining',   label: 'valuation.casual_dining',   low: 6,  mid: 8,  high: 10, color: '#8b5cf6' },
  { key: 'fine_dining',     label: 'valuation.fine_dining',     low: 8,  mid: 11, high: 14, color: '#ec4899' },
  { key: 'multi_unit',      label: 'valuation.multi_unit',      low: 10, mid: 14, high: 18, color: '#22c55e' },
];

// Standard restaurant EBITDA margins
const MARGIN_BENCHMARKS = [
  { label: 'valuation.margin_low',  value: 10, desc: 'valuation.margin_low_desc' },
  { label: 'valuation.margin_avg',  value: 15, desc: 'valuation.margin_avg_desc' },
  { label: 'valuation.margin_good', value: 20, desc: 'valuation.margin_good_desc' },
  { label: 'valuation.margin_top',  value: 25, desc: 'valuation.margin_top_desc' },
];

// ── KPI Card ─────────────────────────────────────────────────────────────────
const ValuationKPI = ({ icon: Icon, label, value, sub, accent = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-emerald-500/10 text-emerald-500',
    purple: 'bg-purple-500/10 text-purple-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
  };
  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-light-text-primary dark:text-dark-text-primary">{value}</p>
      {sub && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">{sub}</p>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function ValuationTab({ appState, empresas = [], selectedEmpresaId, selectedEmpresa, selectedSucursalIds = [], excludedCuentas: EXCLUDED_CUENTAS = [], onSelectEmpresa, onSelectSucursales }) {
  const { t } = useTranslation();
  const {
    loadVentasSummary,
    loadGastosTotals,
    loading: cacheLoading,
  } = useAnalyticsCache(appState, selectedEmpresaId || 'valuation');

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState('fast_casual');

  // adjustable inputs
  const [customMultiple, setCustomMultiple] = useState(null); // override
  const [depreciationPct, setDepreciationPct] = useState(3); // D&A as % of revenue

  // Raw data
  const [annualRevenue, setAnnualRevenue] = useState(0);
  const [annualExpenses, setAnnualExpenses] = useState(0);

  // ── Build empresa filters (same logic as Dashboard) ──────────────────────
  const empresaFilters = useMemo(() => {
    const hasEmpresa = !!selectedEmpresaId;
    let sucursalesArr = Array.isArray(selectedEmpresa?.sucursales) ? selectedEmpresa.sucursales : [];

    const baseExcludedCuentas = Array.isArray(selectedEmpresa?.cuentas_exclude)
      ? selectedEmpresa.cuentas_exclude.map(String) : [];
    const excludeCuentas = Array.from(new Set([...baseExcludedCuentas, ...EXCLUDED_CUENTAS]));
    const excludeResumen2 = Array.isArray(selectedEmpresa?.resumen2_exclude)
      ? selectedEmpresa.resumen2_exclude.map(r => String(r).toLowerCase()) : [];

    if (Array.isArray(selectedSucursalIds) && selectedSucursalIds.length > 0) {
      const selSet = new Set(selectedSucursalIds.map(n => Number(n)));
      sucursalesArr = sucursalesArr.filter(s => selSet.has(Number(s?.id_sucursal)));
    }

    const sucursalIds = sucursalesArr
      .map(s => (typeof s?.id_sucursal === 'number' ? s.id_sucursal : null))
      .filter(v => v != null);

    const toLocalSlug = (s) =>
      s?.sigla_local || s?.location_slug || (s?.sigla ? `${String(s.sigla).toUpperCase()}LOC` : null);
    const ventaLocalSlugs = sucursalesArr.map(s => toLocalSlug(s)).map(x => x ? String(x) : null).filter(Boolean);

    const sucursalSiglas = sucursalesArr.map(s => s?.sigla ? String(s.sigla) : null).filter(Boolean);

    return { hasEmpresa, excludeCuentas, excludeResumen2, sucursalIds, ventaLocalSlugs, sucursalSiglas };
  }, [selectedEmpresaId, selectedEmpresa, selectedSucursalIds, EXCLUDED_CUENTAS]);

  // ── Fetch last 12 months ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const end = dayjs().endOf('month');
      const start = end.subtract(11, 'month').startOf('month');
      const startStr = start.format('YYYY-MM-DD');
      const endStr = end.format('YYYY-MM-DD');

      const { hasEmpresa, excludeCuentas, excludeResumen2, sucursalIds, ventaLocalSlugs, sucursalSiglas } = empresaFilters;

      const [vRes, gRes] = await Promise.all([
        loadVentasSummary(startStr, endStr, { labels: hasEmpresa ? ventaLocalSlugs : [], force: true }),
        loadGastosTotals(startStr, endStr, {
          labels: [],
          include_daily: true,
          force: true,
          exclude_cuentas: excludeCuentas,
          exclude_resumen2: excludeResumen2,
          include_sucursales_ids: sucursalIds,
          include_siglas: sucursalSiglas,
        }),
      ]);

      const totalRev = (vRes?.widget || []).reduce((s, r) => s + (Number(r.value) || 0), 0);
      const totalExp = (gRes?.widget || []).reduce((s, r) => s + (Number(r.value) || 0), 0);

      setAnnualRevenue(totalRev);
      setAnnualExpenses(totalExp);
      setLoaded(true);
    } catch (err) {
      console.error('[ValuationTab] fetch error', err);
    }
    setLoading(false);
  }, [loadVentasSummary, loadGastosTotals, empresaFilters]);

  // ── EBITDA calculation ──────────────────────────────────────────────────
  const valuation = useMemo(() => {
    if (!loaded || annualRevenue <= 0) return null;

    const operatingProfit = annualRevenue - annualExpenses;
    const depreciation = annualRevenue * (depreciationPct / 100);
    const ebitda = operatingProfit + depreciation;
    const ebitdaMargin = (ebitda / annualRevenue) * 100;

    const bench = INDUSTRY_BENCHMARKS.find(b => b.key === selectedBenchmark) || INDUSTRY_BENCHMARKS[1];
    const multiple = customMultiple || bench.mid;

    const evLow = ebitda * bench.low;
    const evMid = ebitda * multiple;
    const evHigh = ebitda * bench.high;

    // Radar chart data for health score
    const radarData = [
      { metric: t('analytics.valuation.profitability'), value: Math.min(100, ebitdaMargin * 4), fullMark: 100 },
      { metric: t('analytics.valuation.revenue_scale'), value: Math.min(100, (annualRevenue / 1e9) * 20), fullMark: 100 },
      { metric: t('analytics.valuation.cost_control'), value: Math.min(100, Math.max(0, 100 - (annualExpenses / annualRevenue * 100))), fullMark: 100 },
      { metric: t('analytics.valuation.growth_potential'), value: 65, fullMark: 100 }, // placeholder
      { metric: t('analytics.valuation.market_position'), value: 70, fullMark: 100 }, // placeholder
    ];

    // Comparison chart
    const comparisonData = INDUSTRY_BENCHMARKS.map(b => ({
      name: t(`analytics.${b.label}`),
      low: ebitda * b.low,
      mid: ebitda * b.mid,
      high: ebitda * b.high,
      color: b.color,
    }));

    return {
      annualRevenue,
      annualExpenses,
      operatingProfit,
      depreciation,
      ebitda,
      ebitdaMargin,
      multiple,
      evLow,
      evMid,
      evHigh,
      evLowUSD: evLow * CLP_TO_USD,
      evMidUSD: evMid * CLP_TO_USD,
      evHighUSD: evHigh * CLP_TO_USD,
      radarData,
      comparisonData,
      bench,
    };
  }, [loaded, annualRevenue, annualExpenses, selectedBenchmark, customMultiple, depreciationPct, t]);

  const isLoading = loading || cacheLoading;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
              <Landmark className="w-5 h-5 text-purple-500" />
              {t('analytics.valuation.title')}
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
              {t('analytics.valuation.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Empresa selector */}
            {Array.isArray(empresas) && empresas.length > 0 && (
              <select
                value={selectedEmpresaId || ''}
                onChange={(e) => onSelectEmpresa?.(e.target.value || null)}
                className="px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-primary dark:text-dark-text-primary"
              >
                <option value="">{t('analytics.Todas')}</option>
                {empresas.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.nombre || emp.name || emp._id}</option>
                ))}
              </select>
            )}

            {/* Industry segment selector */}
            <select
              value={selectedBenchmark}
              onChange={(e) => { setSelectedBenchmark(e.target.value); setCustomMultiple(null); }}
              className="px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-primary dark:text-dark-text-primary"
            >
              {INDUSTRY_BENCHMARKS.map(b => (
                <option key={b.key} value={b.key}>{t(`analytics.${b.label}`)}</option>
              ))}
            </select>

            {/* D&A percentage */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">D&A%</span>
              <input
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={depreciationPct}
                onChange={(e) => setDepreciationPct(Number(e.target.value))}
                className="w-16 px-2 py-1.5 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-primary dark:text-dark-text-primary text-center"
              />
            </div>

            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 dark:bg-purple-500 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {t('analytics.valuation.calculate')}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!loaded && !isLoading && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-light-surface dark:bg-dark-surface rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border p-16 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center max-w-md">
              {t('analytics.valuation.empty')}
            </p>
          </motion.div>
        )}

        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-16 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </motion.div>
        )}

        {loaded && valuation && !isLoading && (
          <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Enterprise Value Hero */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 dark:from-purple-700 dark:to-indigo-900 rounded-2xl p-6 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('analytics.valuation.enterprise_value')}
                  </p>
                  <p className="text-4xl font-black">{CLP(valuation.evMid)}</p>
                  <p className="text-lg font-semibold text-white/80 mt-1">≈ {USD(valuation.evMidUSD)}</p>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-xs text-white/60 uppercase">{t('analytics.valuation.low')}</p>
                    <p className="text-lg font-bold">{CLP(valuation.evLow)}</p>
                    <p className="text-xs text-white/60">{valuation.bench.low}x</p>
                  </div>
                  <div className="text-center border-x border-white/20 px-6">
                    <p className="text-xs text-white/60 uppercase">{t('analytics.valuation.mid')}</p>
                    <p className="text-lg font-bold">{CLP(valuation.evMid)}</p>
                    <p className="text-xs text-white/60">{valuation.multiple}x</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/60 uppercase">{t('analytics.valuation.high')}</p>
                    <p className="text-lg font-bold">{CLP(valuation.evHigh)}</p>
                    <p className="text-xs text-white/60">{valuation.bench.high}x</p>
                  </div>
                </div>
              </div>
            </div>

            {/* EBITDA KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <ValuationKPI icon={DollarSign} label={t('analytics.valuation.revenue_12m')} value={CLP(valuation.annualRevenue)} accent="blue" />
              <ValuationKPI icon={TrendingUp} label={t('analytics.valuation.op_profit')} value={CLP(valuation.operatingProfit)} accent="green" />
              <ValuationKPI icon={Calculator} label="D&A" value={CLP(valuation.depreciation)} sub={`${depreciationPct}% ${t('analytics.valuation.of_revenue')}`} accent="amber" />
              <ValuationKPI icon={BarChart3} label="EBITDA" value={CLP(valuation.ebitda)} sub={`${t('analytics.valuation.margin')}: ${valuation.ebitdaMargin.toFixed(1)}%`} accent="purple" />
              <ValuationKPI icon={Globe} label={t('analytics.valuation.multiple_used')} value={`${valuation.multiple}x`} sub={t(`analytics.${valuation.bench.label}`)} accent="blue" />
            </div>

            {/* EBITDA breakdown table */}
            <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
              <div className="px-5 py-3 border-b border-light-border dark:border-dark-border">
                <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                  {t('analytics.valuation.ebitda_breakdown')}
                </h3>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: t('analytics.Ventas') + ' (12m)', value: valuation.annualRevenue, color: 'text-blue-600 dark:text-blue-400', sign: '' },
                    { label: `(-) ${t('analytics.Gastos')} (12m)`, value: valuation.annualExpenses, color: 'text-red-500 dark:text-red-400', sign: '-' },
                    { label: `= ${t('analytics.valuation.op_profit')}`, value: valuation.operatingProfit, color: 'text-emerald-600 dark:text-emerald-400', sign: '', bold: true },
                    { label: `(+) ${t('analytics.valuation.depreciation')} (${depreciationPct}%)`, value: valuation.depreciation, color: 'text-amber-600 dark:text-amber-400', sign: '+' },
                    { label: '= EBITDA', value: valuation.ebitda, color: 'text-purple-600 dark:text-purple-400', sign: '', bold: true },
                    { label: `× ${t('analytics.valuation.multiple')} (${valuation.multiple}x)`, value: null, color: 'text-light-text-secondary dark:text-dark-text-secondary', sign: '' },
                    { label: `= ${t('analytics.valuation.enterprise_value')}`, value: valuation.evMid, color: 'text-purple-700 dark:text-purple-300', sign: '', bold: true, big: true },
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-light-border/30 dark:border-dark-border/30 last:border-0 ${row.bold ? 'bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/10' : ''}`}>
                      <td className={`px-5 py-3 ${row.bold ? 'font-bold' : 'font-medium'} text-light-text-primary dark:text-dark-text-primary`}>{row.label}</td>
                      <td className={`px-5 py-3 text-right ${row.bold ? 'font-bold' : 'font-semibold'} ${row.big ? 'text-lg' : ''} ${row.color}`}>
                        {row.value !== null ? CLP(row.value) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Industry comparison chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
                <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                  {t('analytics.valuation.by_segment')}
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={valuation.comparisonData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" strokeOpacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="var(--color-text-secondary, #9ca3af)" />
                    <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10 }} stroke="var(--color-text-secondary, #9ca3af)" />
                    <Tooltip formatter={(v) => CLP(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="mid" name={t('analytics.valuation.mid_valuation')} radius={[6, 6, 0, 0]}>
                      {valuation.comparisonData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* EBITDA margin benchmark */}
              <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
                <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                  {t('analytics.valuation.margin_benchmark')}
                </h3>
                <div className="space-y-3">
                  {MARGIN_BENCHMARKS.map((mb, i) => {
                    const isAbove = valuation.ebitdaMargin >= mb.value;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary">
                              {t(`analytics.${mb.label}`)} ({mb.value}%)
                            </span>
                            <span className={`text-xs font-bold ${isAbove ? 'text-emerald-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                              {isAbove ? '✓' : '—'}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isAbove ? 'bg-emerald-500' : 'bg-light-border dark:bg-dark-border'}`}
                              style={{ width: `${Math.min(100, (valuation.ebitdaMargin / mb.value) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {t(`analytics.${mb.desc}`)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-3 pt-3 border-t border-light-border dark:border-dark-border">
                    <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">
                      {t('analytics.valuation.your_margin')}: <span className="text-purple-600 dark:text-purple-400">{valuation.ebitdaMargin.toFixed(1)}%</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
