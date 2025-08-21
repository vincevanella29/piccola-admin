import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import ControlsBar from '../../../components/widgets/ControlsBar';
import KPIStat from '../../../components/widgets/KPIStat';
import VentasWidget from '../../../components/widgets/VentasWidget';
import GastosWidget from '../../../components/widgets/GastosWidget';

// helpers para extraer cuenta/resumen2
const getCuentaFromRow = (r) => {
  // 1) cuenta en el detalle (lo más confiable)
  const d = r?.details?.data;
  if (d?.cuenta != null) return String(d.cuenta);
  // 2) cuentas en el parent agrupado (si vino como grupo)
  const parentDetails = r?.details?.parent?.details;
  if (Array.isArray(parentDetails)) {
    const det = parentDetails.find(it => it?.cuenta != null);
    if (det) return String(det.cuenta);
  }
  // 3) fallback ultra defensivo
  if (r?.cuenta != null) return String(r.cuenta);
  return null;
};
const makeFiltrarCuentas = (excluded = []) => (rows = []) => {
  const set = new Set((excluded || []).map(String));
  return rows.filter(r => !set.has(String(getCuentaFromRow(r))));
};
const makeFiltrarResumen2 = (excluded = []) => (rows = []) => {
  const set = new Set((excluded || []).map((x) => String(x).toLowerCase().trim()));
  return rows.filter(r => !set.has(String(r?.label ?? '').toLowerCase().trim()));
};

const sumValues = (rows = []) => rows.reduce((acc, r) => acc + (Number(r.value) || 0), 0);

// Extrae personas de una fila de ventas de forma defensiva
const getPersonasFromRow = (r) => {
  const d = r?.details?.data;
  if (typeof d?.personas === 'number') return d.personas;
  const parentDetails = r?.details?.parent?.details;
  if (Array.isArray(parentDetails)) {
    return parentDetails.reduce((acc, it) => acc + (typeof it?.personas === 'number' ? it.personas : 0), 0);
  }
  if (typeof r?.personas === 'number') return r.personas;
  return 0;
};

const sumPersonas = (rows = []) => rows.reduce((acc, r) => acc + (getPersonasFromRow(r) || 0), 0);

const AnalyticsView = ({
  t,
  applyNonce,
  // límites
  ventaMinDate, ventaMaxDate,
  gastoMinDate, gastoMaxDate,
  // rango único
  pendingDateRange,
  handlePendingDateRangeChange,
  handleApply,
  // comparación (global)
  pendingConfig,
  appliedConfig,
  handlePendingConfigChange,
  // empresa
  empresaOptions,
  selectedEmpresaId,
  onSelectEmpresa,
  // sucursales
  sucursalOptions = [],
  selectedSucursalIds = [],
  onSelectSucursales,
  excludedCuentas = [],
  excludedResumen2 = [],
  // estado
  isLoading,
  error,
  // data normalizada
  gastos,
  gastoComparison,
  ventas,
  ventaComparison,
  // quick
  quickRange,
  setQuickRange,
}) => {
  
  
  // Totales (VENTAS igual, GASTOS filtrando cuentas especiales)
  // Memoized calculations
  const filtrarCuentasGasto = useMemo(() => makeFiltrarCuentas(excludedCuentas), [excludedCuentas]);
  const filtrarResumen2Gasto = useMemo(() => makeFiltrarResumen2(excludedResumen2), [excludedResumen2]);
  const gastosFiltrados = useMemo(() => filtrarResumen2Gasto(filtrarCuentasGasto(gastos)), [gastos, filtrarCuentasGasto, filtrarResumen2Gasto]);
  const ventaTotalNum   = useMemo(() => sumValues(ventas), [ventas]);
  const gastoTotalNum   = useMemo(() => sumValues(gastosFiltrados), [gastosFiltrados]);
  const ratio = ventaTotalNum > 0 ? (gastoTotalNum / ventaTotalNum) : 0;

  // Personas y promedios (solo ventas)
  const personasTotalNum = useMemo(() => sumPersonas(ventas), [ventas]);
  const promedioPorPersona = personasTotalNum > 0 ? (ventaTotalNum / personasTotalNum) : 0;

  const ventaPrevNum = useMemo(
    () => sumValues(ventaComparison?.previous || []),
    [ventaComparison?.previous]
  );
  const gastoPrevNum = useMemo(
    () => sumValues(filtrarResumen2Gasto(filtrarCuentasGasto(gastoComparison?.previous || []))),
    [gastoComparison?.previous]
  );

  const personasPrevNum = useMemo(
    () => sumPersonas(ventaComparison?.previous || []),
    [ventaComparison?.previous]
  );
  const promedioPrev = personasPrevNum > 0 ? (ventaPrevNum / personasPrevNum) : 0;

  // Dev-only lightweight log
  if (process.env.NODE_ENV === 'development') {
    console.debug('[AnalyticsView] lens:', { ventas: ventas.length, gastos: gastos.length });
  }

  const variationVentaPct = (appliedConfig.comparisonType !== 'none' && ventaPrevNum > 0)
    ? ((ventaTotalNum - ventaPrevNum) / ventaPrevNum) * 100
    : null;

  const variationGastoPct = (appliedConfig.comparisonType !== 'none' && gastoPrevNum > 0)
    ? ((gastoTotalNum - gastoPrevNum) / gastoPrevNum) * 100
    : null;

  const variationPersonasPct = (appliedConfig.comparisonType !== 'none' && personasPrevNum > 0)
    ? ((personasTotalNum - personasPrevNum) / personasPrevNum) * 100
    : null;

  const variationPromedioPct = (appliedConfig.comparisonType !== 'none' && promedioPrev > 0)
    ? ((promedioPorPersona - promedioPrev) / promedioPrev) * 100
    : null;

  // Formateados
  const ventaTotalFmt = ventaTotalNum.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const gastoTotalFmt = gastoTotalNum.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const ventaPrevFmt  = ventaPrevNum.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const gastoPrevFmt  = gastoPrevNum.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const personasTotalFmt = personasTotalNum.toLocaleString();
  const promedioFmt = promedioPorPersona.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });

  return (
    <div className="rounded-3xl p-4 shadow-modal">
      {/* Controles globales (rango + comparación) */}
      <ControlsBar
        t={t}
        ventaMinDate={ventaMinDate} ventaMaxDate={ventaMaxDate}
        gastoMinDate={gastoMinDate} gastoMaxDate={gastoMaxDate}
        quickRange={quickRange} setQuickRange={setQuickRange}
        pendingDateRange={pendingDateRange}
        handlePendingDateRangeChange={handlePendingDateRangeChange}
        pendingConfig={pendingConfig}
        handlePendingConfigChange={handlePendingConfigChange}
        handleApply={handleApply}
        // empresa selector
        empresaOptions={empresaOptions}
        selectedEmpresaId={selectedEmpresaId}
        onSelectEmpresa={onSelectEmpresa}
        // sucursales selector
        sucursalOptions={sucursalOptions}
        selectedSucursalIds={selectedSucursalIds}
        onSelectSucursales={onSelectSucursales}
        isLoading={isLoading} error={error}
      />

      {/* KPIs */}
      <Box className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        <KPIStat isLoading={isLoading} label={t('analytics.Ventas')} value={ventaTotalFmt} deltaPct={variationVentaPct} goodWhenUp />
        <KPIStat isLoading={isLoading} label={t('analytics.Gastos')} value={gastoTotalFmt} deltaPct={variationGastoPct} goodWhenUp={false} />
        <KPIStat isLoading={isLoading} label={`% ${t('analytics.Gastos')} / ${t('analytics.Ventas')}`} value={`${(ratio * 100).toFixed(1)}%`} />
        <KPIStat isLoading={isLoading} label={t('analytics.Personas')} value={personasTotalFmt} deltaPct={variationPersonasPct} goodWhenUp />
        <KPIStat isLoading={isLoading} label={t('analytics.Promedio por persona')} value={promedioFmt} deltaPct={variationPromedioPct} goodWhenUp />
      </Box>

      {/* 1 widget Ventas + 1 widget Gastos */}
      <Box className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <VentasWidget
          key={`ventas-${applyNonce}`}
          nonce={applyNonce}
          data={ventas}
          comparisonData={ventaComparison?.previous || []}
          comparisonType={appliedConfig.comparisonType}
          loading={isLoading}
        />
        <GastosWidget
          key={`gastos-${applyNonce}`}
          nonce={applyNonce}
          data={gastosFiltrados}
          comparisonData={useMemo(() => filtrarResumen2Gasto(filtrarCuentasGasto(gastoComparison?.previous || [])), [gastoComparison?.previous, filtrarCuentasGasto, filtrarResumen2Gasto])}
          comparisonType={appliedConfig.comparisonType}
          loading={isLoading}
        />
      </Box>
    </div>
  );
};

export default React.memo(AnalyticsView);
