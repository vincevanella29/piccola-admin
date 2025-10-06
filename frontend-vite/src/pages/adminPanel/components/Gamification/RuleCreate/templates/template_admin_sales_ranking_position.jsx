import React, { useMemo } from 'react';

/* =========================================================
 * Admin KPIs (kpis_admin_mensual) — Ranking (Top N / Exacto / Rango)
 * Métricas soportadas: avg_daily_sales, pm_per_mesa, pm_por_persona, presence_days
 * Alineado con backend admin_sales_ranking.py
 * ========================================================= */
export const adminSalesRankingTemplate = {
  key: 'admin_sales_ranking',
  name: 'Ranking KPIs Admin (Ventas/PM/Presencia)',
  description:
    'Premia a administradores por posición en ranking de KPIs (ventas promedio diario, PM mesa/persona, presencia).',
  category: 'sales',
  period: 'month',
  data_sources: [
    {
      collection: 'kpis_admin_mensual',
      fields: [
        'rut',
        'periodo',
        'local',
        'days_present_admin',
        'sales.avg_diario',
        'sales.puesto_empresa',
        'sales.puesto_local',
        'sales.best_empresa',
        'sales.avg_empresa',
        'sales.best_local',
        'sales.avg_local',
        'sales.puesto_empresa_samples',
        'sales.puesto_local_samples',
        'restaurant.promedio_por_mesa',
        'restaurant.promedio_persona',
        'restaurant.puesto_empresa_pm_mesa',
        'restaurant.puesto_local_pm_mesa',
        'restaurant.best_empresa_pm_mesa',
        'restaurant.avg_empresa_pm_mesa',
        'restaurant.puesto_empresa_pm_persona',
        'restaurant.puesto_local_pm_persona',
        'restaurant.best_empresa_pm_persona',
        'restaurant.avg_empresa_pm_persona',
      ],
      filter: 'KPIs de administradores por período (mensual o anual, según period_mode).',
    },
  ],
  required_params: {
    metric_key: {
      type: 'select',
      options: ['avg_daily_sales', 'total_sales', 'pm_per_mesa', 'pm_por_persona', 'presence_days'],
      default: 'avg_daily_sales',
      description: 'Métrica a evaluar.'
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
    position_type: {
      type: 'select',
      options: ['top_n', 'exact', 'range'],
      default: 'top_n',
      description: 'Cómo se evalúa el puesto: Top N (≤N), Exacto (=N) o Rango (entre dos puestos).',
    },
    ranking_position: {
      type: 'number',
      min: 1,
      max: 100,
      default: 1,
      description: 'N para Top N o posición exacta, según position_type.',
    },
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
    min_days_worked: {
      type: 'number',
      min: 0,
      max: 366,
      default: 0,
      description: 'Mínimo de días para calificar (aplica principalmente a presence_days).',
    },
    name: { type: 'text', default: '' },
  },
  Component: function AdminSalesRankingComponent({ formData, setFormData, errors, t }) {
    const metricOptions = ['avg_daily_sales', 'total_sales', 'pm_per_mesa', 'pm_por_persona', 'presence_days'];
    const current = useMemo(() => formData?.params || {}, [formData]);
    const setParam = (name, value) => setFormData((prev) => ({ ...prev, params: { ...prev.params, [name]: value } }));

    const positionType = current.position_type ?? 'top_n';

    return (
      <div className="space-y-6">
        {/* Requeridos */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.sales.metric_key') || 'Métrica'}</label>
            <select
              value={current.metric_key ?? 'avg_daily_sales'}
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

          {/* Tipo de puesto */}
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
              {t('gamification.sales.min_days_worked_help') || '0 desactiva el filtro.'}
            </p>
          </div>
        </div>
      </div>
    );
  },
};
