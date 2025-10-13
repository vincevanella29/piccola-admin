// ui/templates/timesMetricsLocalTemplate.jsx
import React, { useMemo } from 'react';
import Select from 'react-select';

export const timesMetricsLocalTemplate = {
  key: 'times_metrics_local',
  name: 'Tiempos (Local): Métricas por Local/Centro',
  description:
    'Premia a empleados por ranking de tiempos a nivel de local (overall) o por centro de producción (selected_centers).',
  category: 'times',
  period: 'month',

  Component: function TimesMetricsLocalComponent({ formData, setFormData, errors, t }) {
    const catalogs =
      formData?.catalogs ||
      formData?.template_meta?.catalogs ||
      formData?.__resolvedTemplate?.catalogs ||
      {};
    console.log(catalogs);

    const current = useMemo(() => formData?.params || {}, [formData]);
    const setParam = (name, value) =>
      setFormData((prev) => ({ ...prev, params: { ...prev.params, [name]: value } }));

    const level = current.level ?? 'overall'; // overall | center
    const positionType = current.position_type ?? 'top_n';
    const positionMetric = current.position_metric ?? 'avg';

    const centerOptions = useMemo(() => {
      const list = catalogs?.centers || [];
      return list.map((c) => ({ value: c.slug, label: c.label || c.slug }));
    }, [catalogs]);

    const selectedCenters = current.selected_centers ?? [];
    const setCenters = (items) => {
      const keys = (items || []).map((it) => String(it.value));
      const labels = (items || []).map((it) => String(it.label));
      setParam('selected_centers', keys);
      setParam('selected_center_labels', labels);
      setParam('name', labels[0] ?? '');
      setParam('names', labels);
    };
    const selectedToReactSelect = (opts) => {
      const dict = new Map((opts || []).map((o) => [String(o.value), o]));
      return (selectedCenters || []).map((k) => dict.get(String(k))).filter(Boolean);
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Nivel */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.sales.scope_level') || 'Nivel'}</label>
            <select
              value={level}
              onChange={(e) => setParam('level', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="overall">overall (por local)</option>
              <option value="center">center (por centro)</option>
            </select>
          </div>

          {/* Período */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.sales.period_mode') || 'Período'}</label>
            <select
              value={current.period_mode ?? 'month'}
              onChange={(e) => setParam('period_mode', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="month">{t?.('gamification.sales.period_month') || 'Mensual'}</option>
              <option value="year">{t?.('gamification.sales.period_year') || 'Anual'}</option>
            </select>
          </div>

          {/* Métrica */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.times.metric') || 'Métrica'}</label>
            <select
              value={positionMetric}
              onChange={(e) => setParam('position_metric', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="avg">avg_seg (menor mejor)</option>
              <option value="samples">producción (mayor mejor)</option>
            </select>
          </div>

          {/* Modo de puesto */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.times.mode_position_label') || 'Modo de puesto'}</label>
            <select
              value={positionType}
              onChange={(e) => setParam('position_type', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="top_n">{t?.('gamification.times.option_top_n') || 'Top N (≤N)'}</option>
              <option value="exact">{t?.('gamification.times.option_exact') || 'Exacto (=N)'}</option>
              <option value="range">{t?.('gamification.times.option_range') || 'Rango (desde/hasta)'}</option>
            </select>
          </div>

          {/* Posiciones */}
          {positionType !== 'range' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {positionType === 'exact'
                  ? t?.('gamification.times.position_exact_label') || 'Posición (=N)'
                  : t?.('gamification.times.position_top_label') || 'Top (≤N)'}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={current.ranking_position ?? 1}
                onChange={(e) => setParam('ranking_position', Number(e.target.value))}
                className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t?.('gamification.times.position_from_label') || 'Desde (puesto)'}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={current.position_from ?? 1}
                  onChange={(e) => setParam('position_from', Number(e.target.value))}
                  className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t?.('gamification.times.position_to_label') || 'Hasta (puesto)'}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={current.position_to ?? 10}
                  onChange={(e) => setParam('position_to', Number(e.target.value))}
                  className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                />
              </div>
            </>
          )}

          {/* Mín días trabajados */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.sales.min_days_worked') || 'Mín. días trabajados'}</label>
            <input
              type="number"
              min={0}
              max={366}
              value={current.min_days_worked ?? 0}
              onChange={(e) => setParam('min_days_worked', Number(e.target.value))}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* Selector de centros si level = center */}
        {level === 'center' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {t?.('gamification.times.centers_label') || 'Centros de producción (1 o más)'}
            </label>
            <Select
              isMulti
              options={centerOptions}
              value={selectedToReactSelect(centerOptions)}
              onChange={(vals) => setCenters(vals || [])}
              classNamePrefix="react-select dark:bg-dark-surface-secondary dark:border-dark-border/20 border border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary rounded-lg px-3 py-2"
              placeholder={t?.('gamification.times.search_centers') || 'Busca centros…'}
            />
            {!selectedCenters?.length && errors?.selected_centers && (
              <p className="text-xs text-red-500 mt-1">{errors.selected_centers}</p>
            )}
          </div>
        )}

        <p className="text-xs text-dark-text-secondary">
          Usa KPIs de <code>kpis_tiempos_local_mensual</code>. Métrica: avg_seg (asc) o producción (desc). Ganadores → empleados con asistencia en locales ganadores.
        </p>
      </div>
    );
  },
};
