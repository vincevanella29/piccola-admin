// ui/templates/timesMetricsEmployeeTemplate.jsx
import React, { useMemo } from 'react';
import Select from 'react-select';

export const timesMetricsEmployeeTemplate = {
  key: 'times_metrics_employee',
  name: 'Tiempos (Empleado): Métricas general / por categoría',
  description:
    'Premia por ranking de tiempos a nivel de empleado: general (overall) o por centro/familia/subfamilia.',
  category: 'times',
  period: 'month',

  Component: function TimesMetricsEmployeeComponent({ formData, setFormData, errors, t }) {
    const catalogs =
      formData?.catalogs ||
      formData?.template_meta?.catalogs ||
      formData?.__resolvedTemplate?.catalogs ||
      {};

    const current = useMemo(() => formData?.params || {}, [formData]);
    const setParam = (name, value) =>
      setFormData((prev) => ({ ...prev, params: { ...prev.params, [name]: value } }));

    const level = current.level ?? 'overall'; // overall | center | family | subfamily
    const scope = current.ranking_scope ?? 'empresa';
    const positionType = current.position_type ?? 'top_n';
    const positionMetric = current.position_metric ?? 'avg';

    // Options
    const centerOptions = useMemo(() => {
      const list = catalogs?.centers || [];
      return list.map((c) => ({ value: c.slug, label: c.label || c.slug }));
    }, [catalogs]);
    const familyOptions = useMemo(() => {
      const list = catalogs?.families || [];
      return list.map((f) => ({ value: f.key, label: f.key }));
    }, [catalogs]);
    const subfamilyOptions = useMemo(() => {
      const list = catalogs?.subfamilies || [];
      return list.map((sf) => ({ value: sf.key, label: `${sf.key} — ${sf.family}` }));
    }, [catalogs]);

    const levelOptionsMap = {
      center: centerOptions,
      family: familyOptions,
      subfamily: subfamilyOptions,
    };

    const selectedKeys = current.selected_keys ?? [];
    const setSelection = (items) => {
      const keys = (items || []).map((it) => String(it.value));
      const labels = (items || []).map((it) => String(it.label));
      setParam('selected_keys', keys);
      setParam('selected_labels', labels);
      setParam('name', labels[0] ?? '');
      setParam('names', labels);
    };
    const selectedToReactSelect = (opts) => {
      const dict = new Map((opts || []).map((o) => [String(o.value), o]));
      return (selectedKeys || []).map((k) => dict.get(String(k))).filter(Boolean);
    };

    const onChangeLevel = (nextLevel) => {
      setParam('level', nextLevel);
      setParam('selected_keys', []);
      setParam('selected_labels', []);
      setParam('name', '');
      setParam('names', []);
    };

    const optionsForLevel = levelOptionsMap[level] || [];

    return (
      <div className="space-y-6">
        {/* Nivel / Scope / Período / Métrica */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Nivel */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-sm font-medium">{t?.('gamification.sales.scope_level') || 'Nivel'}</label>
            <select
              value={level}
              onChange={(e) => onChangeLevel(e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="overall">overall (general empleado)</option>
              <option value="center">center (por centro)</option>
              <option value="family">family (por familia)</option>
              <option value="subfamily">subfamily (por subfamilia)</option>
            </select>
          </div>

          {/* Ámbito */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.sales.scope') || 'Ámbito'}</label>
            <select
              value={scope}
              onChange={(e) => setParam('ranking_scope', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="empresa">empresa</option>
              <option value="local">local</option>
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

        {/* Selector dependiente segun level (solo en center/family/subfamily) */}
        {level !== 'overall' && (
          <div className="flex flex-col gap-1.5 bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg p-3">
            <label className="text-sm font-medium">
              {level === 'center'
                ? (t?.('gamification.times.centers_label') || 'Centros (1 o más)')
                : level === 'subfamily'
                ? (t?.('gamification.times.subfamilies_label') || 'Subfamilias (1 o más)')
                : (t?.('gamification.times.families_label') || 'Familias (1 o más)')}
            </label>
            <Select
              isMulti
              options={optionsForLevel}
              value={selectedToReactSelect(optionsForLevel)}
              onChange={(vals) => setSelection(vals || [])}
              classNamePrefix="react-select dark:bg-dark-surface-secondary dark:border-dark-border/20 border border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary rounded-lg px-3 py-2"
              placeholder={
                level === 'center'
                  ? (t?.('gamification.times.search_centers') || 'Busca centros…')
                  : level === 'subfamily'
                  ? (t?.('gamification.times.search_subfamilies') || 'Busca subfamilias…')
                  : (t?.('gamification.times.search_families') || 'Busca familias…')
              }
            />
            {!selectedKeys?.length && errors?.selected_keys && (
              <p className="text-xs text-red-500 mt-1">{errors.selected_keys}</p>
            )}
          </div>
        )}

        <p className="text-xs text-dark-text-secondary">
          Usa <code>kpis_tiempos_empleado_mensual</code>. Métrica: avg_seg (asc) o producción (desc).
        </p>
      </div>
    );
  },
};
