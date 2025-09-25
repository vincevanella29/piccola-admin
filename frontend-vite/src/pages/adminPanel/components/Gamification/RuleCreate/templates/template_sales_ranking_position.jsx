import React, { useMemo } from 'react';

// Template: sales_ranking_position with composite conditions support and its own UI
export const salesRankingTemplate = {
  key: 'sales_ranking_position',
  name: 'Ranking de Ventas (Top N)',
  description: 'Otorga mérito a empleados que alcanzan una posición específica (Top N) y soporta condiciones compuestas (AND).',
  category: 'sales',
  period: 'month',
  data_sources: [
    {
      collection: 'kpis_empleado_mensual',
      fields: [
        'rut', 'periodo', 'local', 'es_competidor',
        'sales', 'promedio_por_mesa', 'personas_atendidas', 'promedio_por_persona', 'promedio_venta_diaria'
      ],
      filter: 'Filtra por período y es_competidor=true, buscando la posición en el ranking anidado.'
    }
  ],
  required_params: {
    metric_key: {
      type: 'select',
      options: ['sales', 'avg_per_table', 'customers_served', 'avg_per_customer', 'avg_daily_sales'],
      default: 'sales',
      description: 'Métrica de venta a evaluar (Venta Total, Promedio x Mesa, Personas Atendidas, Promedio x Persona, Promedio de Venta Diaria).'
    },
    period_mode: {
      type: 'select',
      options: ['month', 'year'],
      default: 'month',
      description: 'Modo de período (mensual o anual).'
    },
    ranking_scope: {
      type: 'select',
      options: ['local', 'empresa'],
      default: 'local',
      description: 'Ámbito del ranking (a nivel de Local o de toda la Empresa).'
    },
    ranking_position: {
      type: 'number', min: 1, max: 100, default: 1,
      description: 'Posición máxima para calificar (ej: 1 para ser el N°1, 10 para estar en el Top 10).'
    }
  },
  optional_params: {
    conditions: {
      type: 'array',
      description: "Lista de condiciones a cumplir (AND). Cada condición puede ser de tipo 'ranking' o 'value'.",
      example: [
        { type: 'ranking', metric_key: 'sales', scope: 'local', max_position: 10 },
        { type: 'value', metric_key: 'avg_daily_sales', operator: 'gte', threshold: 500000 }
      ]
    },
    min_days_worked: {
      type: 'number',
      min: 0,
      max: 366,
      default: 0,
      description: 'Mínimo de días con venta registrados para calificar (0 desactiva el filtro).'
    }
  },
  Component: function SalesRankingComponent({ formData, setFormData, errors, t }) {
    const options = ['sales', 'avg_per_table', 'customers_served', 'avg_per_customer', 'avg_daily_sales'];
    const current = useMemo(() => formData?.params || {}, [formData]);

    const setParam = (name, value) => setFormData(prev => ({ ...prev, params: { ...prev.params, [name]: value } }));

    // Conditions helpers
    const getConditions = () => current.conditions || [];
    const setConditions = (next) => setParam('conditions', next);
    const addCondition = () => {
      const base = { type: 'ranking', metric_key: options[0], scope: 'local', max_position: 10 };
      setConditions([...(getConditions()), base]);
    };
    const removeCondition = (idx) => {
      const next = [...getConditions()];
      next.splice(idx, 1);
      setConditions(next);
    };
    const setCondField = (idx, field, value) => {
      const next = [...getConditions()];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'type') {
        if (value === 'ranking') next[idx] = { type: 'ranking', metric_key: options[0], scope: 'local', max_position: 10 };
        else next[idx] = { type: 'value', metric_key: options[0], operator: 'gte', threshold: 0 };
      }
      setConditions(next);
    };

    return (
      <div className="space-y-6">
        {/* Required params quick UI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.metric_key') || 'Métrica'}</label>
            <select
              value={current.metric_key ?? 'sales'}
              onChange={(e) => setParam('metric_key', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              {options.map(k => <option key={k} value={k}>{k}</option>)}
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.top') || 'Top (≤)'}</label>
            <input
              type="number"
              min={1}
              max={100}
              value={current.ranking_position ?? 1}
              onChange={(e) => setParam('ranking_position', Number(e.target.value))}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* Optional: Min days worked */}
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
            <p className="text-xs text-dark-text-secondary">{t('gamification.sales.min_days_worked_help') || '0 desactiva el filtro. En anual, usa días con venta del año.'}</p>
          </div>
        </div>

        {/* Optional Conditions (AND) */}
        <div className="pt-4 border-t border-dark-border/10">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-bold">{t('gamification.sales.conditions_and') || 'Condiciones (AND)'}</h4>
            <button type="button" onClick={addCondition} className="px-3 py-1.5 text-sm rounded-md bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20">+ {t('common.add') || 'Agregar'}</button>
          </div>
          {getConditions().length === 0 && (
            <p className="text-sm text-dark-text-secondary">{t('gamification.sales.no_conditions') || 'No hay condiciones. Puedes usar los parámetros simples, o agregar condiciones compuestas.'}</p>
          )}
          <div className="space-y-3">
            {getConditions().map((cond, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-dark-border/20 bg-light-surface-secondary dark:bg-dark-surface">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">{t('common.type') || 'Tipo'}</label>
                    <select value={cond.type} onChange={(e) => setCondField(idx, 'type', e.target.value)} className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2">
                      <option value="ranking">ranking</option>
                      <option value="value">value</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium">{t('common.metric') || 'Métrica'}</label>
                    <select value={cond.metric_key} onChange={(e) => setCondField(idx, 'metric_key', e.target.value)} className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2">
                      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  {cond.type === 'ranking' && (
                    <>
                      <div className="md:col-span-3">
                        <label className="text-sm font-medium">{t('gamification.sales.scope') || 'Ámbito'}</label>
                        <select value={cond.scope || 'local'} onChange={(e) => setCondField(idx, 'scope', e.target.value)} className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2">
                          <option value="local">local</option>
                          <option value="empresa">empresa</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">{t('gamification.sales.top') || 'Top (≤)'}</label>
                        <input type="number" min={1} max={100} value={cond.max_position ?? 10} onChange={(e) => setCondField(idx, 'max_position', Number(e.target.value))} className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2" />
                      </div>
                    </>
                  )}
                  {cond.type === 'value' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium">{t('common.operator') || 'Operador'}</label>
                        <select value={cond.operator || 'gte'} onChange={(e) => setCondField(idx, 'operator', e.target.value)} className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2">
                          <option value="gte">≥</option>
                          <option value="gt">{'>'}</option>
                          <option value="lte">≤</option>
                          <option value="lt">{'<'}</option>
                          <option value="eq">=</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-sm font-medium">{t('common.threshold') || 'Umbral'}</label>
                        <input type="number" value={cond.threshold ?? 0} onChange={(e) => setCondField(idx, 'threshold', Number(e.target.value))} className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2" />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2 flex md:justify-end">
                    <button type="button" onClick={() => removeCondition(idx)} className="px-3 py-2 text-sm rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20">{t('common.delete') || 'Eliminar'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
};
