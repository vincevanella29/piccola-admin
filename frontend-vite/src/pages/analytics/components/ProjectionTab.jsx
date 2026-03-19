/**
 * ProjectionTab — Financial projection from historical data.
 *
 * Takes the last 12 months of real data, calculates growth rates,
 * and projects revenue/expenses forward 1-3 years under 3 scenarios.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Calendar, Loader2,
  ChevronDown, DollarSign, BarChart3, Target,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import useAnalyticsCache from '../../../hooks/useAnalyticsCache';

// ── Helpers ──────────────────────────────────────────────────────────────────
const CLP = (n) => Math.round(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const SCENARIOS = [
  { key: 'pessimistic', color: '#ef4444', mult: 0.85, label: 'projection.pessimistic' },
  { key: 'moderate',    color: '#3b82f6', mult: 1.00, label: 'projection.moderate' },
  { key: 'optimistic',  color: '#22c55e', mult: 1.15, label: 'projection.optimistic' },
];

const YEARS_OPTIONS = [1, 2, 3];

// ── KPI Card ─────────────────────────────────────────────────────────────────
const KPI = ({ icon: Icon, label, value, sub, color = 'text-light-accent dark:text-dark-accent' }) => (
  <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-4 flex items-start gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color.includes('red') ? 'bg-red-500/10' : color.includes('green') ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary truncate">{value}</p>
      {sub && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── Scenario toggle ──────────────────────────────────────────────────────────
const ScenarioToggle = ({ active, onChange, t }) => (
  <div className="flex items-center gap-1 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl p-1">
    {SCENARIOS.map(s => (
      <button
        key={s.key}
        onClick={() => onChange(s.key)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          active === s.key
            ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}
      >
        <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: s.color }} />
        {t(`analytics.${s.label}`)}
      </button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
const ProjectionTab = ({ appState, empresas = [], selectedEmpresaId, selectedEmpresa, selectedSucursalIds = [], excludedCuentas: EXCLUDED_CUENTAS = [], onSelectEmpresa, onSelectSucursales }) => {
  const { t } = useTranslation();
  const {
    loadVentasSummary,
    loadGastosTotals,
    loading: cacheLoading,
  } = useAnalyticsCache(appState, selectedEmpresaId || 'projection');

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scenario, setScenario] = useState('moderate');
  const [years, setYears] = useState(2);

  // Raw monthly data
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [monthlyExpense, setMonthlyExpense] = useState([]);

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

  // ── Fetch last 24 months of data ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const end = dayjs().endOf('month');
      const start = end.subtract(23, 'month').startOf('month');
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

      // Aggregate by month
      const vByMonth = {};
      for (const r of (vRes?.widget || [])) {
        const d = r.dateLabel || r.date;
        if (!d) continue;
        const m = dayjs(d).format('YYYY-MM');
        vByMonth[m] = (vByMonth[m] || 0) + (Number(r.value) || 0);
      }

      const gByMonth = {};
      for (const r of (gRes?.widget || [])) {
        const d = r.dateLabel || r.date;
        if (!d) continue;
        const m = dayjs(d).format('YYYY-MM');
        gByMonth[m] = (gByMonth[m] || 0) + (Number(r.value) || 0);
      }

      // Build sorted monthly arrays
      const allMonths = new Set([...Object.keys(vByMonth), ...Object.keys(gByMonth)]);
      const sorted = [...allMonths].sort();
      const rev = sorted.map(m => ({ month: m, value: vByMonth[m] || 0 }));
      const exp = sorted.map(m => ({ month: m, value: gByMonth[m] || 0 }));

      setMonthlyRevenue(rev);
      setMonthlyExpense(exp);
      setLoaded(true);
    } catch (err) {
      console.error('[ProjectionTab] fetch error', err);
    }
    setLoading(false);
  }, [loadVentasSummary, loadGastosTotals, empresaFilters]);

  // ── Compute projections ─────────────────────────────────────────────────
  const projection = useMemo(() => {
    if (!loaded || monthlyRevenue.length < 2) return null;

    const sc = SCENARIOS.find(s => s.key === scenario) || SCENARIOS[1];

    // Calculate average monthly revenue & expense from last 12 months
    const last12Rev = monthlyRevenue.slice(-12);
    const last12Exp = monthlyExpense.slice(-12);
    const avgMonthlyRev = last12Rev.reduce((s, r) => s + r.value, 0) / last12Rev.length;
    const avgMonthlyExp = last12Exp.reduce((s, r) => s + r.value, 0) / last12Exp.length;

    // Year-over-year growth rate (if we have at least 13 months)
    let yoyGrowth = 0.05; // default 5%
    if (monthlyRevenue.length >= 13) {
      const prev12 = monthlyRevenue.slice(-24, -12);
      const curr12 = monthlyRevenue.slice(-12);
      const prevTotal = prev12.reduce((s, r) => s + r.value, 0);
      const currTotal = curr12.reduce((s, r) => s + r.value, 0);
      if (prevTotal > 0) yoyGrowth = (currTotal - prevTotal) / prevTotal;
    }

    // Apply scenario multiplier to growth
    const scenarioGrowth = yoyGrowth * sc.mult;

    // Build historical data for chart
    const historical = monthlyRevenue.map((r, i) => ({
      month: dayjs(r.month + '-01').format('MMM YY'),
      monthRaw: r.month,
      revenue: r.value,
      expense: monthlyExpense[i]?.value || 0,
      profit: r.value - (monthlyExpense[i]?.value || 0),
      type: 'historical',
    }));

    // Build projected months
    const projected = [];
    const lastMonth = dayjs(monthlyRevenue[monthlyRevenue.length - 1].month + '-01');
    const totalProjectedMonths = years * 12;
    for (let i = 1; i <= totalProjectedMonths; i++) {
      const m = lastMonth.add(i, 'month');
      const yearFactor = Math.pow(1 + scenarioGrowth, i / 12);
      const projRev = avgMonthlyRev * yearFactor;
      // Expenses grow at 70% of revenue growth rate (operational leverage)
      const expFactor = Math.pow(1 + scenarioGrowth * 0.7, i / 12);
      const projExp = avgMonthlyExp * expFactor;
      projected.push({
        month: m.format('MMM YY'),
        monthRaw: m.format('YYYY-MM'),
        projRevenue: Math.round(projRev),
        projExpense: Math.round(projExp),
        projProfit: Math.round(projRev - projExp),
        type: 'projected',
      });
    }

    // Annual summaries
    const annualSummaries = [];
    for (let y = 0; y < years; y++) {
      const yearSlice = projected.slice(y * 12, (y + 1) * 12);
      const rev = yearSlice.reduce((s, r) => s + r.projRevenue, 0);
      const exp = yearSlice.reduce((s, r) => s + r.projExpense, 0);
      annualSummaries.push({
        year: lastMonth.add(y + 1, 'year').year(),
        revenue: rev,
        expense: exp,
        profit: rev - exp,
        margin: rev > 0 ? ((rev - exp) / rev * 100) : 0,
      });
    }

    // Last 12 month totals
    const last12TotalRev = last12Rev.reduce((s, r) => s + r.value, 0);
    const last12TotalExp = last12Exp.reduce((s, r) => s + r.value, 0);

    return {
      historical,
      projected,
      chartData: [...historical, ...projected],
      annualSummaries,
      yoyGrowth,
      scenarioGrowth,
      avgMonthlyRev,
      avgMonthlyExp,
      last12TotalRev,
      last12TotalExp,
      last12Profit: last12TotalRev - last12TotalExp,
      last12Margin: last12TotalRev > 0 ? ((last12TotalRev - last12TotalExp) / last12TotalRev * 100) : 0,
    };
  }, [loaded, monthlyRevenue, monthlyExpense, scenario, years]);

  const isLoading = loading || cacheLoading;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header + controls */}
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {t('analytics.projection.title')}
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
              {t('analytics.projection.subtitle')}
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

            {/* Years selector */}
            <div className="flex items-center gap-1 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl p-1">
              {YEARS_OPTIONS.map(y => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    years === y
                      ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                      : 'text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  {y} {t('analytics.projection.years')}
                </button>
              ))}
            </div>

            {/* Scenario toggle */}
            <ScenarioToggle active={scenario} onChange={setScenario} t={t} />

            {/* Fetch button */}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              {t('analytics.projection.calculate')}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {!loaded && !isLoading && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-light-surface dark:bg-dark-surface rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border p-16 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center max-w-md">
              {t('analytics.projection.empty')}
            </p>
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-16 flex items-center justify-center"
          >
            <Loader2 className="w-8 h-8 animate-spin text-light-accent dark:text-dark-accent" />
          </motion.div>
        )}

        {loaded && projection && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI
                icon={DollarSign}
                label={t('analytics.projection.annual_revenue')}
                value={CLP(projection.last12TotalRev)}
                sub={`${t('analytics.projection.growth')}: ${pct(projection.yoyGrowth * 100)}`}
                color="text-blue-500"
              />
              <KPI
                icon={TrendingDown}
                label={t('analytics.projection.annual_expense')}
                value={CLP(projection.last12TotalExp)}
                sub={`${pct(-(projection.last12TotalExp / projection.last12TotalRev * 100))} ${t('analytics.projection.of_revenue')}`}
                color="text-red-500"
              />
              <KPI
                icon={TrendingUp}
                label={t('analytics.projection.net_profit')}
                value={CLP(projection.last12Profit)}
                sub={`${t('analytics.projection.margin')}: ${projection.last12Margin.toFixed(1)}%`}
                color="text-emerald-500"
              />
              <KPI
                icon={Target}
                label={t('analytics.projection.scenario_growth')}
                value={pct(projection.scenarioGrowth * 100)}
                sub={SCENARIOS.find(s => s.key === scenario)?.key}
                color="text-purple-500"
              />
            </div>

            {/* Main chart */}
            <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
              <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                {t('analytics.projection.revenue_projection')}
              </h3>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={projection.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SCENARIOS.find(s => s.key === scenario)?.color || '#3b82f6'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={SCENARIOS.find(s => s.key === scenario)?.color || '#3b82f6'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" strokeOpacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-text-secondary, #9ca3af)" />
                  <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10 }} stroke="var(--color-text-secondary, #9ca3af)" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: 12, fontSize: 12 }}
                    formatter={(v) => CLP(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="revenue" name={t('analytics.Ventas')} stroke="#3b82f6" fill="url(#gradRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" name={t('analytics.Gastos')} stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="projRevenue" name={t('analytics.projection.projected_revenue')} stroke={SCENARIOS.find(s => s.key === scenario)?.color} fill="url(#gradProj)" strokeWidth={2} strokeDasharray="6 3" />
                  <Area type="monotone" dataKey="projExpense" name={t('analytics.projection.projected_expense')} stroke="#f97316" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Annual summaries table */}
            <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
              <div className="px-5 py-3 border-b border-light-border dark:border-dark-border">
                <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                  {t('analytics.projection.annual_summary')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-light-border/50 dark:border-dark-border/50">
                      {[t('analytics.projection.year'), t('analytics.Ventas'), t('analytics.Gastos'), t('analytics.projection.profit'), t('analytics.projection.margin')].map((h, i) => (
                        <th key={i} className="px-5 py-3 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Current year row */}
                    <tr className="border-b border-light-border/30 dark:border-dark-border/30 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/10">
                      <td className="px-5 py-3 font-bold text-light-text-primary dark:text-dark-text-primary">
                        {dayjs().year()} <span className="text-[10px] ml-1 text-light-text-secondary dark:text-dark-text-secondary font-normal">({t('analytics.projection.actual')})</span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-blue-600 dark:text-blue-400">{CLP(projection.last12TotalRev)}</td>
                      <td className="px-5 py-3 font-semibold text-red-500 dark:text-red-400">{CLP(projection.last12TotalExp)}</td>
                      <td className="px-5 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{CLP(projection.last12Profit)}</td>
                      <td className="px-5 py-3 font-semibold">{projection.last12Margin.toFixed(1)}%</td>
                    </tr>
                    {projection.annualSummaries.map((a, i) => (
                      <tr key={a.year} className="border-b border-light-border/30 dark:border-dark-border/30 last:border-0">
                        <td className="px-5 py-3 font-bold text-light-text-primary dark:text-dark-text-primary">
                          {a.year} <span className="text-[10px] ml-1 text-light-text-secondary dark:text-dark-text-secondary font-normal">({t('analytics.projection.projected')})</span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-blue-600 dark:text-blue-400">{CLP(a.revenue)}</td>
                        <td className="px-5 py-3 font-semibold text-red-500 dark:text-red-400">{CLP(a.expense)}</td>
                        <td className="px-5 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{CLP(a.profit)}</td>
                        <td className="px-5 py-3 font-semibold">{a.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Profit bar chart */}
            <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5">
              <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                {t('analytics.projection.profit_by_year')}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: `${dayjs().year()} (${t('analytics.projection.actual')})`, profit: projection.last12Profit, fill: '#3b82f6' },
                  ...projection.annualSummaries.map(a => ({
                    name: `${a.year}`,
                    profit: a.profit,
                    fill: SCENARIOS.find(s => s.key === scenario)?.color || '#3b82f6',
                  })),
                ]} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" strokeOpacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-text-secondary, #9ca3af)" />
                  <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10 }} stroke="var(--color-text-secondary, #9ca3af)" />
                  <Tooltip formatter={(v) => CLP(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="profit" name={t('analytics.projection.profit')} radius={[8, 8, 0, 0]}>
                    {[
                      { name: 'actual', fill: '#3b82f6' },
                      ...projection.annualSummaries.map(() => ({
                        fill: SCENARIOS.find(s => s.key === scenario)?.color || '#3b82f6',
                      })),
                    ].map((entry, idx) => (
                      <rect key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectionTab;
