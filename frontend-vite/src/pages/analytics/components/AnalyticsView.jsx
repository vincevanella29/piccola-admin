import React, { useMemo, useState } from 'react';
import ControlsBar from '../../../components/widgets/ControlsBar';
import KPIStat from '../../../components/widgets/KPIStat';
import VentasWidget from '../../../components/widgets/VentasWidget';
import GastosWidget from '../../../components/widgets/GastosWidget';

// helpers para extraer cuenta/resumen2
const getCuentaFromRow = (r) => {
  const d = r?.details?.data;
  if (d?.cuenta != null) return String(d.cuenta);
  const parentDetails = r?.details?.parent?.details;
  if (Array.isArray(parentDetails)) {
    const det = parentDetails.find(it => it?.cuenta != null);
    if (det) return String(det.cuenta);
  }
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
  ventaMinDate, ventaMaxDate,
  gastoMinDate, gastoMaxDate,
  pendingDateRange,
  handlePendingDateRangeChange,
  handleApply,
  pendingConfig,
  appliedConfig,
  handlePendingConfigChange,
  empresaOptions,
  selectedEmpresaId,
  onSelectEmpresa,
  sucursalOptions = [],
  selectedSucursalIds = [],
  onSelectSucursales,
  excludedCuentas = [],
  excludedResumen2 = [],
  isLoading,
  error,
  gastos,
  gastoComparison,
  ventas,
  ventaComparison,
  quickRange,
  setQuickRange,
}) => {

  const filtrarCuentasGasto = useMemo(() => makeFiltrarCuentas(excludedCuentas), [excludedCuentas]);
  const filtrarResumen2Gasto = useMemo(() => makeFiltrarResumen2(excludedResumen2), [excludedResumen2]);
  const gastosFiltrados = useMemo(() => filtrarResumen2Gasto(filtrarCuentasGasto(gastos)), [gastos, filtrarCuentasGasto, filtrarResumen2Gasto]);
  const ventaTotalNum   = useMemo(() => sumValues(ventas), [ventas]);
  const gastoTotalNum   = useMemo(() => sumValues(gastosFiltrados), [gastosFiltrados]);
  const ratio = ventaTotalNum > 0 ? (gastoTotalNum / ventaTotalNum) : 0;

  const personasTotalNum = useMemo(() => sumPersonas(ventas), [ventas]);
  const promedioPorPersona = personasTotalNum > 0 ? (ventaTotalNum / personasTotalNum) : 0;

  const mesasTotalRaw = useMemo(() => ventas.reduce((acc, v) => acc + (Number(v?.details?.data?.mesas ?? v?.mesas ?? 0)), 0), [ventas]);
  const promedioPorMesa = mesasTotalRaw > 0 ? (ventaTotalNum / mesasTotalRaw) : 0;

  const ventaPrevNum = useMemo(
    () => sumValues(ventaComparison?.previous || []),
    [ventaComparison?.previous]
  );
  const mesasPrevRaw = useMemo(() => (ventaComparison?.previous || []).reduce((acc, v) => acc + (Number(v?.details?.data?.mesas ?? v?.mesas ?? 0)), 0), [ventaComparison?.previous]);
  const promedioPrevMesa = mesasPrevRaw > 0 ? (ventaPrevNum / mesasPrevRaw) : 0;

  const gastoPrevNum = useMemo(
    () => sumValues(filtrarResumen2Gasto(filtrarCuentasGasto(gastoComparison?.previous || []))),
    [gastoComparison?.previous]
  );

  const personasPrevNum = useMemo(
    () => sumPersonas(ventaComparison?.previous || []),
    [ventaComparison?.previous]
  );
  const promedioPrev = personasPrevNum > 0 ? (ventaPrevNum / personasPrevNum) : 0;

  if (process.env.NODE_ENV === 'development') {
    console.debug('[AnalyticsView] lens:', { ventas: ventas.length, gastos: gastos.length });
  }

  const variationVentaPct = (appliedConfig.comparisonType !== 'none' && ventaPrevNum > 0)
    ? ((ventaTotalNum - ventaPrevNum) / ventaPrevNum) * 100 : null;

  const variationGastoPct = (appliedConfig.comparisonType !== 'none' && gastoPrevNum > 0)
    ? ((gastoTotalNum - gastoPrevNum) / gastoPrevNum) * 100 : null;

  const variationPersonasPct = (appliedConfig.comparisonType !== 'none' && personasPrevNum > 0)
    ? ((personasTotalNum - personasPrevNum) / personasPrevNum) * 100 : null;

  const variationPromedioPct = (appliedConfig.comparisonType !== 'none' && promedioPrev > 0)
    ? ((promedioPorPersona - promedioPrev) / promedioPrev) * 100 : null;

  const variationMesasPct = (appliedConfig.comparisonType !== 'none' && mesasPrevRaw > 0)
    ? ((mesasTotalRaw - mesasPrevRaw) / mesasPrevRaw) * 100 : null;
  const variationPromedioMesaPct = (appliedConfig.comparisonType !== 'none' && promedioPrevMesa > 0)
    ? ((promedioPorMesa - promedioPrevMesa) / promedioPrevMesa) * 100 : null;

  const ventaTotalFmt = ventaTotalNum.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const gastoTotalFmt = gastoTotalNum.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const personasTotalFmt = personasTotalNum.toLocaleString();
  const promedioFmt = promedioPorPersona.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });
  const mesasTotalFmt = mesasTotalRaw.toLocaleString();
  const promedioMesaFmt = promedioPorMesa.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });

  const descuentosTotal = useMemo(() => ventas.reduce((acc, v) => acc + (Number(v?.details?.data?.desctos ?? v?.desctos ?? 0)), 0), [ventas]);
  const descuentosPrev = useMemo(() => (ventaComparison?.previous || []).reduce((acc, v) => acc + (Number(v?.details?.data?.desctos ?? v?.desctos ?? 0)), 0), [ventaComparison?.previous]);
  const variationDescuentosPct = (appliedConfig.comparisonType !== 'none' && descuentosPrev > 0)
    ? ((descuentosTotal - descuentosPrev) / descuentosPrev) * 100 : null;
  const descuentosFmt = descuentosTotal.toLocaleString(undefined, { style: 'currency', currency: 'CLP' });

  const [kpiTab, setKpiTab] = useState('personas');

  return (
    <div className="space-y-4">
      {/* Controls */}
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
        empresaOptions={empresaOptions}
        selectedEmpresaId={selectedEmpresaId}
        onSelectEmpresa={onSelectEmpresa}
        sucursalOptions={sucursalOptions}
        selectedSucursalIds={selectedSucursalIds}
        onSelectSucursales={onSelectSucursales}
        isLoading={isLoading} error={error}
      />

      {/* KPI Tab toggle */}
      <div className="flex items-center gap-1">
        {[
          { key: 'personas', label: t('analytics.Personas') },
          { key: 'mesas', label: t('analytics.Mesas') },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setKpiTab(tb.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
              ${kpiTab === tb.key
                ? 'bg-light-accent dark:bg-dark-accent text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }
            `}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <KPIStat isLoading={isLoading} label={t('analytics.Ventas')} value={ventaTotalFmt} deltaPct={variationVentaPct} goodWhenUp />
        <KPIStat isLoading={isLoading} label={t('analytics.Gastos')} value={gastoTotalFmt} deltaPct={variationGastoPct} goodWhenUp={false} />
        <KPIStat isLoading={isLoading} label={t('analytics.Descuentos') || 'Descuentos'} value={descuentosFmt} deltaPct={variationDescuentosPct} goodWhenUp={false} />
        <KPIStat isLoading={isLoading} label={`% ${t('analytics.Gastos')} / ${t('analytics.Ventas')}`} value={`${(ratio * 100).toFixed(1)}%`} />
        {kpiTab === 'personas' ? (
          <>
            <KPIStat isLoading={isLoading} label={t('analytics.Personas')} value={personasTotalFmt} deltaPct={variationPersonasPct} goodWhenUp />
            <KPIStat isLoading={isLoading} label={t('analytics.Promedio por persona')} value={promedioFmt} deltaPct={variationPromedioPct} goodWhenUp />
          </>
        ) : (
          <>
            <KPIStat isLoading={isLoading} label={t('analytics.Mesas')} value={mesasTotalFmt} deltaPct={variationMesasPct} goodWhenUp />
            <KPIStat isLoading={isLoading} label={t('analytics.Promedio por mesa')} value={promedioMesaFmt} deltaPct={variationPromedioMesaPct} goodWhenUp />
          </>
        )}
      </div>

      {/* Charts: Ventas + Gastos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>
    </div>
  );
};

export default React.memo(AnalyticsView);
