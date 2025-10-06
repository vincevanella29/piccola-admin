import React, { useMemo } from 'react';
import Select from 'react-select';

/* ==============================================
 * Top Ventas por Categoría (ADMIN)
 * — Admin usa kpis_admin_mensual y sólo expone sales_by_category
 * — Niveles soportados: family | subfamily
 * Guarda en params:
 *   - level: 'family' | 'subfamily'
 *   - selected_keys: string[]   (keys de familia/subfamilia)
 *   - selected_labels: string[] (labels legibles)
 *   - name: string              (backcompat: 1er seleccionado o '')
 *   - names: string[]           (backcompat: copia de selected_labels)
 *   - metric, ranking_scope, period_mode, position_*
 * ============================================== */
export const adminSalesTopCategoryTemplate = {
  key: 'admin_sales_top_category',
  name: 'Top Ventas por Categoría (Admin)',
  description:
    'Premia a administradores que lideran ventas por familia o subfamilia (monto o cantidad), a nivel local o empresa.',
  category: 'sales',
  period: 'month',
  data_sources: [
    {
      collection: 'kpis_admin_mensual',
      fields: ['rut', 'periodo', 'local', 'sales_by_category', 'promedio_venta_diaria.dias_con_venta'],
      filter:
        'Descompone categorías y agrupa por RUT (y local); ordena por total o cantidad para calcular ranking.',
    },
  ],
  required_params: {
    level: {
      type: 'select',
      options: ['family', 'subfamily'],
      default: 'family',
      description: 'Nivel a evaluar (familia o subfamilia).',
    },
    metric: {
      type: 'select',
      options: ['amount', 'quantity'],
      default: 'amount',
      description: 'Métrica: monto total (amount) o cantidad (quantity).',
    },
    ranking_scope: {
      type: 'select',
      options: ['local', 'empresa'],
      default: 'empresa',
      description: 'Ámbito del ranking.',
    },
    period_mode: {
      type: 'select',
      options: ['month', 'year'],
      default: 'month',
      description: 'Mensual o Anual.',
    },
    position_type: {
      type: 'select',
      options: ['top_n', 'exact', 'range'],
      default: 'top_n',
      description: 'Top N (≤N), Exacto (=N), o Rango (desde/hasta).',
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
      default: 1,
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
      description: 'Mínimo de días con venta (0 desactiva).',
    },
  },

  // 👇 Componente con selects dependientes y multi-select
  Component: function AdminSalesTopCategoryComponent({ formData, setFormData, errors, t }) {
    console.log(formData);
    const catalogs = formData?.catalogs || formData?.template_meta?.catalogs || /** desde Step2_Logic */ (formData?.__resolvedTemplate?.catalogs) || {};
    console.log(catalogs);

    const current = useMemo(() => formData?.params || {}, [formData]);
    const setParam = (name, value) =>
      setFormData((prev) => ({ ...prev, params: { ...prev.params, [name]: value } }));

    const level = current.level ?? 'family';
    const positionType = current.position_type ?? 'top_n';

    // --- Builders de opciones
    const familyOptions = useMemo(() => {
      const list = catalogs?.families || [];
      return list.map(f => ({ value: f.key, label: f.key }));
    }, [catalogs]);

    const subfamilyOptions = useMemo(() => {
      const list = catalogs?.subfamilies || [];
      return list.map(sf => ({ value: sf.key, label: `${sf.key} — ${sf.family}` }));
    }, [catalogs]);

    const levelOptionsMap = {
      family: familyOptions,
      subfamily: subfamilyOptions,
    };

    const selectedKeys = current.selected_keys ?? [];   // array de strings
    const selectedLabels = current.selected_labels ?? []; // array de strings legibles

    const setSelection = (items) => {
      const keys = items.map(it => String(it.value));
      const labels = items.map(it => String(it.label));
      // Backcompat: 'name' = primero o '', 'names' = labels[]
      setParam('selected_keys', keys);
      setParam('selected_labels', labels);
      setParam('name', labels[0] ?? '');
      setParam('names', labels);
    };

    const selectedToReactSelect = (opts) => {
      const dict = new Map((opts || []).map(o => [String(o.value), o]));
      return selectedKeys.map(k => dict.get(String(k))).filter(Boolean);
    };

    // Reset dependientes cuando cambia el nivel
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
        {/* Fila principal */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Nivel */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-sm font-medium">Nivel</label>
            <select
              value={level}
              onChange={(e) => onChangeLevel(e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary dark:border-dark-border/20 border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="family">family (familia)</option>
              <option value="subfamily">subfamily (subfamilia)</option>
            </select>
          </div>

          {/* Selector dependiente con multi-select */}
          <div className="flex flex-col gap-1.5 md:col-span-4 bg-light-surface dark:bg-dark-surface-secondary dark:border-dark-border/20 border border-dark-border/20 rounded-lg p-3">
            <label className="text-sm font-medium">
              {level === 'subfamily' ? 'Subfamilias (1 o más)' : 'Familias (1 o más)'}
            </label>
            <Select
              isMulti
              options={optionsForLevel}
              value={selectedToReactSelect(optionsForLevel)}
              onChange={(vals) => setSelection(vals || [])}
              classNamePrefix="react-select dark:bg-dark-surface-secondary dark:border-dark-border/20 border border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary rounded-lg px-3 py-2"
              placeholder={level === 'subfamily' ? 'Busca subfamilias…' : 'Busca familias…'}
            />
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Se guardará la selección en <code>selected_keys</code> y <code>selected_labels</code>.
            </p>
            {errors?.selected_keys && <p className="text-xs text-red-500 mt-1">{errors.selected_keys}</p>}
          </div>
        </div>

        {/* Métrica / Ámbito / Período */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Métrica</label>
            <select
              value={current.metric ?? 'amount'}
              onChange={(e) => setParam('metric', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="amount">amount (monto)</option>
              <option value="quantity">quantity (cantidad)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t?.('gamification.sales.scope') || 'Ámbito'}</label>
            <select
              value={current.ranking_scope ?? 'empresa'}
              onChange={(e) => setParam('ranking_scope', e.target.value)}
              className="w-full bg-light-surface dark:bg-dark-surface-secondary border border-dark-border/20 rounded-lg px-3 py-2"
            >
              <option value="local">local</option>
              <option value="empresa">empresa</option>
            </select>
          </div>

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

          {/* Puestos */}
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
                  value={current.position_from ?? 1}
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

        {/* Nota rápida de compatibilidad */}
        <p className="text-xs text-dark-text-secondary">
          Compatibilidad: <code>name</code> (string) toma el primer seleccionado; <code>names</code> es copia de
          <code> selected_labels</code>. Usa <code>selected_keys</code> para filtrar en tu pipeline (familia/subfamilia = key).
        </p>
      </div>
    );
  },
};
