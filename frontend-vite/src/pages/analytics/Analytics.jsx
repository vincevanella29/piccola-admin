// src/pages/analytics/Analytics.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax';
dayjs.extend(minMax);

import useAnalyticsCache from '../../hooks/useAnalyticsCache';
import AnalyticsView from './components/AnalyticsView';
import ProjectionTab from './components/ProjectionTab';
import ValuationTab from './components/ValuationTab';

const fmt = (d) => (d && dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD') : null);

// Cuentas a excluir cuando hay empresa seleccionada
const EXCLUDED_CUENTAS = [
  '100000', '900000', '999963', '990099', '100001', '100002', '100099',
];

function computeComparison(dateRange, minDate, maxDate, { comparisonType, compareByWeekdays }) {
  if (!dateRange?.start || !dateRange?.end || comparisonType === 'none') return { start: null, end: null };
  const start = dayjs(dateRange.start).startOf('day');
  const end = dayjs(dateRange.end).endOf('day');
  const days = end.diff(start, 'day');
  let cs = null, ce = null;
  if (comparisonType === 'previous_period') { cs = start.subtract(days + 1, 'day'); ce = end.subtract(days + 1, 'day'); }
  if (comparisonType === 'same_period')     { cs = start.subtract(1, 'year'); ce = end.subtract(1, 'year'); }
  // Cuadrar por día de la semana si corresponde
  if (compareByWeekdays && cs && ce) {
    const curDow = start.day(); // 0..6 (dom..sáb)
    const cmpDow = cs.day();
    const delta  = (curDow - cmpDow + 7) % 7; // shift adelante hasta calzar weekday
    cs = cs.add(delta, 'day');
    ce = cs.add(days, 'day');
  }
  if (!cs || !ce) return { start: null, end: null };

  // Si hay límites disponibles, intentar encajar/clamp sin perder longitud
  const minD = minDate ? minDate.startOf('day') : null;
  const maxD = maxDate ? maxDate.endOf('day') : null;
  if (minD || maxD) {
    // Primero, si comienza antes del mínimo, mueve la ventana hacia adelante manteniendo la longitud
    if (minD && cs.isBefore(minD)) {
      cs = minD.clone();
      ce = cs.add(days, 'day');
    }
    // Luego, si termina después del máximo, mueve la ventana hacia atrás manteniendo la longitud
    if (maxD && ce.isAfter(maxD)) {
      ce = maxD.clone();
      cs = ce.subtract(days, 'day');
    }
    // Validación final: si aún queda fuera de rango (p.ej. ventana más larga que el rango total), aborta
    if ((minD && cs.isBefore(minD)) || (maxD && ce.isAfter(maxD))) {
      return { start: null, end: null };
    }
  }
  return { start: cs, end: ce };
}

const Analytics = ({ appState }) => {
  const [applyNonce, setApplyNonce] = useState(0);
  const { t } = useTranslation();

  // empresa selection state must be defined before using as cache key
  const [selectedEmpresaId, setSelectedEmpresaId] = useState(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  // selección de sucursales (ids)
  const [selectedSucursalIds, setSelectedSucursalIds] = useState([]);

  const {
    loadAvailableVentasDates,
    loadAvailableGastosDates,
    loadVentasSummary,
    loadGastosSummary,
    loadGastosTotals,
    clearCaches,
    loading: cacheLoading,
    error: cacheError,
  } = useAnalyticsCache(appState, selectedEmpresaId || 'global');

  const [quickRange, setQuickRange] = useState('CUSTOM');
  const [tab, setTab] = useState(0); // 0 Análisis, 1 Proyección, 2 Valorización

  // empresas: leer directamente desde appState.allowed.empresas
  const [empresas, setEmpresas] = useState(() =>
    Array.isArray(appState?.allowed?.empresas) ? appState.allowed.empresas : []
  );
  useEffect(() => {
    setEmpresas(Array.isArray(appState?.allowed?.empresas) ? appState.allowed.empresas : []);
  }, [appState?.allowed?.empresas]);

  const [pendingDateRange, setPendingDateRange] = useState({ start: null, end: null });
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  const [pendingConfig, setPendingConfig] = useState({ comparisonType: 'none', compareByWeekdays: false });
  const [appliedConfig, setAppliedConfig] = useState({ comparisonType: 'none', compareByWeekdays: false });

  const [ventaMinDate, setVentaMinDate] = useState(null);
  const [ventaMaxDate, setVentaMaxDate] = useState(null);
  const [gastoMinDate, setGastoMinDate] = useState(null);
  const [gastoMaxDate, setGastoMaxDate] = useState(null);
  const [isLoadings, setIsLoading] = useState(false);
  const isLoading = cacheLoading || isLoadings;
  const error = cacheError ? { message: cacheError.message || t('analytics.error_loading') } : null;
  // track last applied empresa to know when to force-refresh
  const [lastAppliedEmpresaId, setLastAppliedEmpresaId] = useState(null);
  const [lastAppliedSucursalIds, setLastAppliedSucursalIds] = useState([]);

  const [ventas, setVentas] = useState([]);
  const [ventaComparison, setVentaComparison] = useState({ previous: [], comparisonStart: null, comparisonEnd: null });

  const [gastos, setGastos] = useState([]);
  const [gastoComparison, setGastoComparison] = useState({ previous: [], comparisonStart: null, comparisonEnd: null });

  // load min/max
  useEffect(() => {
    (async () => {
      try {
        const [v, g] = await Promise.all([loadAvailableVentasDates(), loadAvailableGastosDates()]);
        if (v?.min_date) setVentaMinDate(dayjs(v.min_date));
        if (v?.max_date) setVentaMaxDate(dayjs(v.max_date));
        if (g?.min_date) setGastoMinDate(dayjs(g.min_date));
        if (g?.max_date) setGastoMaxDate(dayjs(g.max_date));
      } catch {}
    })();
  }, [loadAvailableVentasDates, loadAvailableGastosDates]);

  // when selecting empresa, set from allowed; Do NOT auto-apply
  const handleEmpresaSelect = useCallback((empresaId) => {
    console.debug('[Analytics.handleEmpresaSelect] empresaId', empresaId);
    setSelectedEmpresaId(empresaId || null);
    setSelectedSucursalIds([]); // reset selección al cambiar empresa
    if (!empresaId) {
      setSelectedEmpresa(null);
      return;
    }
    const chosen = (Array.isArray(empresas) ? empresas : []).find(e => String(e?._id) === String(empresaId)) || null;
    setSelectedEmpresa(chosen);
  }, [empresas]);

  // No limpiar data ni caches al cambiar empresa; sólo en Search (handleApply)

  const handlePendingDateRangeChange = useCallback(
    (field) => (date) => {
      setPendingDateRange(prev => ({ ...prev, [field]: date || null }));
    },
    []
  );
  const handlePendingConfigChange = useCallback(
    (field) => (event) => {
      setPendingConfig(prev => ({ ...prev, [field]: event.target.value }));
    },
    []
  );

  const handleApply = async () => {
    setAppliedConfig(pendingConfig);
    setDateRange(pendingDateRange);
    setIsLoading(true);
    // Limpiar caches SOLO si cambió la empresa o las sucursales desde la última búsqueda
    const empresaChanged = String(lastAppliedEmpresaId ?? '') !== String(selectedEmpresaId ?? '');
    const selectedSucursalIdsNum = Array.isArray(selectedSucursalIds) ? selectedSucursalIds.map((n) => Number(n)).sort((a,b)=>a-b) : [];
    const lastAppliedSucursalIdsNum = Array.isArray(lastAppliedSucursalIds) ? lastAppliedSucursalIds.slice().map((n)=>Number(n)).sort((a,b)=>a-b) : [];
    const sucursalesChanged = selectedSucursalIdsNum.length !== lastAppliedSucursalIdsNum.length || selectedSucursalIdsNum.some((v,i)=>v!==lastAppliedSucursalIdsNum[i]);
    const filtersChanged = empresaChanged || sucursalesChanged;
    if (filtersChanged) {
      try { clearCaches?.(); } catch {}
    }
    try {
      const startStr = fmt(pendingDateRange.start);
      const endStr   = fmt(pendingDateRange.end);

      // Build filters based on selected empresa
      let sucursalesArr = Array.isArray(selectedEmpresa?.sucursales) ? selectedEmpresa.sucursales : [];
      const hasEmpresa = !!selectedEmpresaId;
      const baseExcludedCuentas = Array.isArray(selectedEmpresa?.cuentas_exclude)
        ? selectedEmpresa.cuentas_exclude.map(String)
        : [];
      // Siempre excluir las cuentas globales, independientemente de la empresa seleccionada
      const excludeCuentas = Array.from(new Set([...baseExcludedCuentas, ...EXCLUDED_CUENTAS]));
      const excludeResumen2 = Array.isArray(selectedEmpresa?.resumen2_exclude)
        ? selectedEmpresa.resumen2_exclude.map((r) => String(r).toLowerCase())
        : [];

      // Aplicar filtro por sucursales seleccionadas (si hay)
      if (Array.isArray(selectedSucursalIds) && selectedSucursalIds.length > 0) {
        const selSet = new Set(selectedSucursalIds.map((n) => Number(n)));
        sucursalesArr = (Array.isArray(sucursalesArr) ? sucursalesArr : []).filter(
          (s) => selSet.has(Number(s?.id_sucursal))
        );
      }

      // Compute derived filters AFTER filtrado por selección
      const sucursalIds = (Array.isArray(sucursalesArr) ? sucursalesArr : [])
        .map((s) => (typeof s?.id_sucursal === 'number' ? s.id_sucursal : null))
        .filter((v) => v != null);

      // Para VENTAS: slugs de local (preferimos lo que viene en allowed)
      const toLocalSlug = (s) =>
        s?.sigla_local || s?.location_slug || (s?.sigla ? `${String(s.sigla).toUpperCase()}LOC` : null);

      const ventaLocalSlugs = (Array.isArray(sucursalesArr) ? sucursalesArr : [])
        .map((s) => toLocalSlug(s))
        .map((x) => (x ? String(x) : null))
        .filter(Boolean);

      // Para GASTOS: usamos ids y siglas (endpoint soporta ambos)
      const sucursalSiglas = (Array.isArray(sucursalesArr) ? sucursalesArr : [])
        .map((s) => (s?.sigla ? String(s.sigla) : null))
        .filter(Boolean);

      console.debug('[Analytics.handleApply] selectedEmpresaId', selectedEmpresaId, {
        ventaLocalSlugs,
        labels: ventaLocalSlugs,
        ids: sucursalIds,
        selectedSucursalIds,
        excludeCuentas,
        excludeResumen2,
        startStr,
        endStr,
      });

      // Siempre llamar ventas; si no hay slugs y no hay empresa, la API trae global
      console.debug('[Analytics.handleApply] calling loadVentasSummary', { labels: hasEmpresa ? ventaLocalSlugs : [], force: filtersChanged });
      const vCur = await loadVentasSummary(startStr, endStr, { labels: hasEmpresa ? ventaLocalSlugs : [], force: filtersChanged });
      setVentas(vCur?.widget || []);
      const { start: vCs, end: vCe } = computeComparison(pendingDateRange, ventaMinDate, ventaMaxDate, pendingConfig);
      if (vCs && vCe && pendingConfig.comparisonType !== 'none') {
        console.debug('[Analytics.handleApply] calling loadVentasSummary (comparison)', { labels: hasEmpresa ? ventaLocalSlugs : [], force: filtersChanged });
        const vPrev = await loadVentasSummary(fmt(vCs), fmt(vCe), { labels: hasEmpresa ? ventaLocalSlugs : [], force: filtersChanged });
        setVentaComparison({ previous: vPrev?.widget || [], comparisonStart: fmt(vCs), comparisonEnd: fmt(vCe) });
      } else {
        setVentaComparison({ previous: [], comparisonStart: null, comparisonEnd: null });
      }

      // gastos: si hay empresa y no tiene sucursales, NO mostrar global
      const noSucursalFilters = hasEmpresa && sucursalIds.length === 0 && sucursalSiglas.length === 0;
      if (noSucursalFilters) {
        setGastos([]);
        setGastoComparison({ previous: [], comparisonStart: null, comparisonEnd: null });
      } else {
        console.debug('[Analytics.handleApply] calling loadGastosTotals');
        const gCur = await loadGastosTotals(startStr, endStr, {
          labels: [],
          by: 'resumen2',
          include_daily: true,                  // importante para series por día
          exclude_cuentas: excludeCuentas,      // backend filtra por cuentas excluidas de la empresa
          exclude_resumen2: excludeResumen2,
          include_sucursales_ids: sucursalIds,
          include_siglas: sucursalSiglas,
        });
        setGastos(gCur?.widget || []);
        const { start: gCs, end: gCe } = computeComparison(pendingDateRange, gastoMinDate, gastoMaxDate, pendingConfig);
        if (gCs && gCe && pendingConfig.comparisonType !== 'none') {
          console.debug('[Analytics.handleApply] calling loadGastosTotals (comparison)');
          const gPrev = await loadGastosTotals(fmt(gCs), fmt(gCe), {
            labels: [],
            by: 'resumen2',
            include_daily: true,
            exclude_cuentas: excludeCuentas,
            exclude_resumen2: excludeResumen2,
            include_sucursales_ids: sucursalIds,
            include_siglas: sucursalSiglas,
          });
          setGastoComparison({ previous: gPrev?.widget || [], comparisonStart: fmt(gCs), comparisonEnd: fmt(gCe) });
        } else {
          setGastoComparison({ previous: [], comparisonStart: null, comparisonEnd: null });
        }
      }

      // marcar “nueva búsqueda”
      setApplyNonce(n => n + 1);
      setLastAppliedEmpresaId(selectedEmpresaId ?? null);
      setLastAppliedSucursalIds(selectedSucursalIdsNum);
    } catch {}
    setIsLoading(false);
  };

  // (auto-aplicar manejado en handleEmpresaSelect para evitar carreras)

  const tabs = [
    { id: 0, label: t('analytics.dashboard'), icon: '📊' },
    { id: 1, label: t('analytics.projection'), icon: '📈' },
    { id: 2, label: t('analytics.valuation'), icon: '🏢' },
  ];

  return (
    <div className="w-full p-4 text-light-text-primary dark:text-dark-text-primary min-h-[80vh]">
      {/* Tabs */}
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-1.5 mb-5 flex gap-1">
        {tabs.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === tb.id
                ? 'bg-light-accent dark:bg-dark-accent text-white shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/30'
            }`}
          >
            <span>{tb.icon}</span>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <AnalyticsView
          t={t}
          applyNonce={applyNonce}
          ventaMinDate={ventaMinDate}
          ventaMaxDate={ventaMaxDate}
          gastoMinDate={gastoMinDate}
          gastoMaxDate={gastoMaxDate}
          pendingDateRange={pendingDateRange}
          handlePendingDateRangeChange={handlePendingDateRangeChange}
          handleApply={handleApply}
          quickRange={quickRange}
          setQuickRange={setQuickRange}
          pendingConfig={pendingConfig}
          appliedConfig={appliedConfig}
          handlePendingConfigChange={handlePendingConfigChange}
          empresaOptions={empresas}
          selectedEmpresaId={selectedEmpresaId}
          onSelectEmpresa={handleEmpresaSelect}
          sucursalOptions={(Array.isArray(selectedEmpresa?.sucursales) ? selectedEmpresa.sucursales : []).map((s) => ({
            id: s?.id_sucursal,
            sigla: s?.sigla,
            label: s?.sigla_local || s?.location_slug || s?.sigla || `Sucursal ${s?.id_sucursal}`,
          }))}
          selectedSucursalIds={selectedSucursalIds}
          onSelectSucursales={setSelectedSucursalIds}
          excludedCuentas={(() => {
            const base = Array.isArray(selectedEmpresa?.cuentas_exclude) ? selectedEmpresa.cuentas_exclude.map(String) : [];
            return Array.from(new Set([...base, ...EXCLUDED_CUENTAS]));
          })()}
          excludedResumen2={Array.isArray(selectedEmpresa?.resumen2_exclude) ? selectedEmpresa.resumen2_exclude.map((r) => String(r).toLowerCase()) : []}
          isLoading={isLoading}
          error={error}
          gastos={gastos}
          gastoComparison={gastoComparison}
          ventas={ventas}
          ventaComparison={ventaComparison}
        />
      )}

      {tab === 1 && (
        <ProjectionTab
          appState={appState}
          empresas={empresas}
          selectedEmpresaId={selectedEmpresaId}
          selectedEmpresa={selectedEmpresa}
          selectedSucursalIds={selectedSucursalIds}
          excludedCuentas={EXCLUDED_CUENTAS}
          onSelectEmpresa={handleEmpresaSelect}
          onSelectSucursales={setSelectedSucursalIds}
        />
      )}

      {tab === 2 && (
        <ValuationTab
          appState={appState}
          empresas={empresas}
          selectedEmpresaId={selectedEmpresaId}
          selectedEmpresa={selectedEmpresa}
          selectedSucursalIds={selectedSucursalIds}
          excludedCuentas={EXCLUDED_CUENTAS}
          onSelectEmpresa={handleEmpresaSelect}
          onSelectSucursales={setSelectedSucursalIds}
        />
      )}
    </div>
  );
};

export default Analytics;

export const pageMetadata = {
  path: '/app/analytics/analysis',
  label: 'analytics.label',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 6,
  order: 1,
  locations: ['sidebar'],
  description: 'analytics.description',
  icon: 'FaChartBar',
  isMainPage: false,
  isSearchable: true,
};
