import React, { useMemo } from 'react';

/* =========================================================
 * 1) Ranking de Ventas (Top N / Exacto / Rango) + Conditions
 *    — alineado con backend (position_type, position_from/to,
 *      conditions[].min_position/max_position)
 * ========================================================= */
export const salesRankingTemplate = {
  key: 'sales_ranking_position',
  name: 'Ranking de Ventas (Top N / Rango)',
  description:
    'Otorga mérito por posición en ranking (Top N, exacto o rango). Soporta condiciones compuestas (AND) y días mínimos trabajados.',
  category: 'sales',
  period: 'month',
  data_sources: [
    {
      collection: 'kpis_empleado_mensual',
      fields: [
        'rut',
        'periodo',
        'local',
        'es_competidor',
        'sales',
        'promedio_por_mesa',
        'personas_atendidas',
        'promedio_por_persona',
        'promedio_venta_diaria',
      ],
      filter:
        'Filtra por período y es_competidor=true, usando los puestos pre-calculados (local/empresa).',
    },
  ],
  required_params: {
    metric_key: {
      type: 'select',
      options: ['sales', 'avg_per_table', 'customers_served', 'avg_per_customer', 'avg_daily_sales'],
      default: 'sales',
      description:
        'Métrica a evaluar (Venta Total, Promedio x Mesa, Personas Atendidas, Promedio x Persona, Promedio de Venta Diaria).',
    },
    period_mode: {
      type: 'select',
      options: ['month', 'year'],
      default: 'month',
      description: 'Mensual o Anual.',
    },
    ranking_scope: {
      type: 'select',
      options: ['local', 'empresa'],
      default: 'local',
      description: 'Ámbito del ranking.',
    },
    // NUEVO: modo de posición
    position_type: {
      type: 'select',
      options: ['top_n', 'exact', 'range'],
      default: 'top_n',
      description: 'Cómo se evalúa el puesto: Top N (≤N), Exacto (=N) o Rango (entre dos puestos).',
    },
    // para top_n/exact
    ranking_position: {
      type: 'number',
      min: 1,
      max: 100,
      default: 1,
      description: 'N para Top N o posición exacta, según position_type.',
    },
    // para range
    position_from: {
      type: 'number',
      min: 1,
      max: 100,
      default: 4,
      description: 'Desde (inclusive) si position_type = range.',
    },
    position_to: {
      type: 'number',
      min: 1,
      max: 100,
      default: 10,
      description: 'Hasta (inclusive) si position_type = range.',
    },
  },
  optional_params: {
    // conditions con min/max_position por condición tipo ranking
    conditions: {
      type: 'array',
      description:
        "Lista de condiciones AND. Soporta {type:'ranking', metric_key, scope, min_position?, max_position?} y {type:'value', metric_key, operator, threshold}.",
      example: [
        { type: 'ranking', metric_key: 'sales', scope: 'local', min_position: 1, max_position: 10 },
        { type: 'value', metric_key: 'avg_daily_sales', operator: 'gte', threshold: 500000 },
      ],
    },
    min_days_worked: {
      type: 'number',
      min: 0,
      max: 366,
      default: 0,
      description:
        'Mínimo de días con venta para calificar. (0 desactiva; en anual usa días del año).',
    },
  },
  Component: function SalesRankingComponent({ formData, setFormData, errors, t }) {
    const metricOptions = ['sales', 'avg_per_table', 'customers_served', 'avg_per_customer', 'avg_daily_sales'];
    const current = useMemo(() => formData?.params || {}, [formData]);
    const setParam = (name, value) =>
      setFormData((prev) => ({ ...prev, params: { ...prev.params, [name]: value } }));

    // --- Conditions helpers
    const getConditions = () => current.conditions || [];
    const setConditions = (next) => setParam('conditions', next);
    const addCondition = () => {
      const base = { type: 'ranking', metric_key: metricOptions[0], scope: 'local', min_position: 1, max_position: 10 };
      setConditions([...(getConditions()), base]);
    };
    const removeCondition = (idx) => {
      const next = [...getConditions()];
      next.splice(idx, 1);
      setConditions(next);
    };
    const setCondField = (idx, field, value) => {
      const next = [...getConditions()];
      const base = next[idx] || {};
      // cuando cambia type, reestablece campos por defecto útiles
      if (field === 'type') {
        next[idx] =
          value === 'ranking'
            ? { type: 'ranking', metric_key: metricOptions[0], scope: 'local', min_position: 1, max_position: 10 }
            : { type: 'value', metric_key: metricOptions[0], operator: 'gte', threshold: 0 };
      } else {
        next[idx] = { ...base, [field]: value };
      }
      setConditions(next);
    };

    const positionType = current.position_type ?? 'top_n';

    return (
      <div className="space-y-6">
        {/* Requeridos */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.metric_key') || 'Métrica'}</label>
            <select
              value={current.metric_key ?? 'sales'}
              onChange={(e) => setParam('metric_key', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              {metricOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.period_mode') || 'Período'}</label>
            <select
              value={current.period_mode ?? 'month'}
              onChange={(e) => setParam('period_mode', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="month">{t('gamification.sales.period_month') || 'Mensual'}</option>
              <option value="year">{t('gamification.sales.period_year') || 'Anual'}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.scope') || 'Ámbito'}</label>
            <select
              value={current.ranking_scope ?? 'local'}
              onChange={(e) => setParam('ranking_scope', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="local">local</option>
              <option value="empresa">empresa</option>
            </select>
          </div>

          {/* NUEVO: tipo de puesto */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Modo de puesto</label>
            <select
              value={positionType}
              onChange={(e) => setParam('position_type', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="top_n">Top N (≤N)</option>
              <option value="exact">Exacto (=N)</option>
              <option value="range">Rango (desde/hasta)</option>
            </select>
          </div>

          {/* Campo(s) dependientes */}
          {positionType !== 'range' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{positionType === 'exact' ? 'Posición (=N)' : 'Top (≤N)'}</label>
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
                <label className="text-sm font-medium">Desde (puesto)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={current.position_from ?? 4}
                  onChange={(e) => setParam('position_from', Number(e.target.value))}
                  className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Hasta (puesto)</label>
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
        </div>

        {/* Opcional: días mínimos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.min_days_worked') || 'Mín. días trabajados'}</label>
            <input
              type="number"
              min={0}
              max={366}
              value={current.min_days_worked ?? 0}
              onChange={(e) => setParam('min_days_worked', Number(e.target.value))}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-dark-text-secondary">
              {t('gamification.sales.min_days_worked_help') ||
                '0 desactiva el filtro. En anual, usa días con venta del año.'}
            </p>
          </div>
        </div>

        {/* Condiciones compuestas (AND) */}
        <div className="pt-4 border-t border-dark-border/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-bold">{t('gamification.sales.conditions_and') || 'Condiciones (AND)'}</h4>
            <button
              type="button"
              onClick={addCondition}
              className="px-3 py-1.5 text-sm rounded-md bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20"
            >
              + {t('common.add') || 'Agregar'}
            </button>
          </div>

          {getConditions().length === 0 && (
            <p className="text-sm text-dark-text-secondary">
              {t('gamification.sales.no_conditions') ||
                'Sin condiciones. Puedes usar solo los parámetros simples, o agregar condiciones compuestas.'}
            </p>
          )}

          <div className="space-y-3">
            {getConditions().map((cond, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-dark-border/20 bg-light-surface-secondary dark:bg-dark-surface">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">{t('common.type') || 'Tipo'}</label>
                    <select
                      value={cond.type}
                      onChange={(e) => setCondField(idx, 'type', e.target.value)}
                      className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                    >
                      <option value="ranking">ranking</option>
                      <option value="value">value</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-sm font-medium">{t('common.metric') || 'Métrica'}</label>
                    <select
                      value={cond.metric_key}
                      onChange={(e) => setCondField(idx, 'metric_key', e.target.value)}
                      className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                    >
                      {metricOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {cond.type === 'ranking' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">{t('gamification.sales.scope') || 'Ámbito'}</label>
                        <select
                          value={cond.scope || 'local'}
                          onChange={(e) => setCondField(idx, 'scope', e.target.value)}
                          className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                        >
                          <option value="local">local</option>
                          <option value="empresa">empresa</option>
                        </select>
                      </div>

                      {/* NUEVO: min/max_position */}
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">Puesto mín. (opcional)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={cond.min_position ?? ''}
                          onChange={(e) =>
                            setCondField(
                              idx,
                              'min_position',
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                          className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                          placeholder="p.ej. 4"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">Puesto máx. (opcional)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={cond.max_position ?? ''}
                          onChange={(e) =>
                            setCondField(
                              idx,
                              'max_position',
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                          className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                          placeholder="p.ej. 10"
                        />
                      </div>
                    </>
                  )}

                  {cond.type === 'value' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">{t('common.operator') || 'Operador'}</label>
                        <select
                          value={cond.operator || 'gte'}
                          onChange={(e) => setCondField(idx, 'operator', e.target.value)}
                          className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                        >
                          <option value="gte">≥</option>
                          <option value="gt">{'>'}</option>
                          <option value="lte">≤</option>
                          <option value="lt">{'<'}</option>
                          <option value="eq">=</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-sm font-medium">{t('common.threshold') || 'Umbral'}</label>
                        <input
                          type="number"
                          value={cond.threshold ?? 0}
                          onChange={(e) => setCondField(idx, 'threshold', Number(e.target.value))}
                          className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-1 flex md:justify-end">
                    <button
                      type="button"
                      onClick={() => removeCondition(idx)}
                      className="px-3 py-2 text-sm rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    >
                      {t('common.delete') || 'Eliminar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};
