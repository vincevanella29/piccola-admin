import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, LoaderCircle, ListX, PencilLine } from 'lucide-react';
import RuleEditModal from './RuleEditModal.jsx';

const Pill = ({ active }) => (
  <span
    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
      active ? 'bg-matrix-green/20 text-matrix-green' : 'bg-rose-500/20 text-rose-400'
    }`}
  >
    {active ? 'Activa' : 'Inactiva'}
  </span>
);

const nf = new Intl.NumberFormat();

/** Chip para pares clave:valor de params */
function ParamChips({ params = {}, max = 4 }) {
  const entries = Object.entries(params || {});
  if (!entries.length) return <span className="text-xs text-dark-text-secondary">—</span>;
  const show = entries.slice(0, max);
  const rest = Math.max(0, entries.length - show.length);
  return (
    <div className="flex flex-wrap gap-1.5">
      {show.map(([k, v]) => {
        const text =
          typeof v === 'object' ? JSON.stringify(v) :
          typeof v === 'number' ? nf.format(v) :
          String(v);
        const truncated = text.length > 28 ? `${text.slice(0, 28)}…` : text;
        return (
          <span
            key={k}
            title={`${k}: ${text}`}
            className="px-2 py-0.5 rounded-md bg-dark-surface-secondary/50 border border-dark-border/30 text-xs font-mono"
          >
            <b className="font-semibold">{k}</b>: {truncated}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="px-2 py-0.5 rounded-md bg-dark-surface-secondary/50 border border-dark-border/30 text-xs">
          +{rest} más
        </span>
      )}
    </div>
  );
}

/** Celda de segmento: símbolo — nombre (ID) */
function SegmentCell({ seg }) {
  if (!seg) return <span className="text-xs text-dark-text-secondary">—</span>;
  return (
    <div className="leading-tight">
      <div className="font-semibold">{seg.symbol} — {seg.name}</div>
      <div className="text-[11px] text-dark-text-secondary">ID: {seg.token_id}</div>
    </div>
  );
}

/** Resumen de scope legible */
function ScopeSummary({ scope }) {
  if (!scope || typeof scope !== 'object') {
    return <span className="text-xs text-dark-text-secondary">Todos</span>;
  }
  const s = [];
  if (scope.cargos) {
    const inc = Array.isArray(scope.cargos?.include) ? scope.cargos.include.length : 0;
    const exc = Array.isArray(scope.cargos?.exclude) ? scope.cargos.exclude.length : 0;
    s.push(`Cargos: ${inc ? `incl ${inc}` : ''}${inc && exc ? ' · ' : ''}${exc ? `excl ${exc}` : ''}`.trim());
  }
  if (scope.secciones) {
    const inc = Array.isArray(scope.secciones?.include) ? scope.secciones.include.length : 0;
    const exc = Array.isArray(scope.secciones?.exclude) ? scope.secciones.exclude.length : 0;
    s.push(`Secciones: ${inc ? `incl ${inc}` : ''}${inc && exc ? ' · ' : ''}${exc ? `excl ${exc}` : ''}`.trim());
  }
  return <span className="text-xs">{s.length ? s.join(' | ') : 'Todos'}</span>;
}

/** Celda de template: nombre bonito + key monoespaciado */
function TemplateCell({ tplName, tplKey }) {
  return (
    <div className="leading-tight">
      <div className="font-semibold">{tplName || '—'}</div>
      <div className="text-[11px] text-dark-text-secondary font-mono">{tplKey || '—'}</div>
    </div>
  );
}

const RuleList = ({
  isLoading,
  rules = [],
  onRefresh,
  onUpdate,
  loadTemplates, // () => Promise
  loadSegments,  // () => Promise
  loadCatalogs,  // (solo lo usa el modal)
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  // Para mostrar nombres de segmentos y templates en la tabla
  const [segmentMap, setSegmentMap] = useState({});
  const [templateMap, setTemplateMap] = useState({}); // key -> name

  // Cargar segments/templates una vez para la vista (además de que el modal los vuelve a pedir)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (typeof loadSegments === 'function') {
          const segRes = await loadSegments();
          const segs = segRes?.segments || segRes?.data?.segments || [];
          if (alive) {
            const map = {};
            segs.forEach(s => { map[Number(s.token_id)] = s; });
            setSegmentMap(map);
          }
        }
      } catch { /* noop */ }

      try {
        if (typeof loadTemplates === 'function') {
          const tplRes = await loadTemplates();
          const tpls = Array.isArray(tplRes) ? tplRes : (tplRes?.templates || []);
          if (alive) {
            const map = {};
            tpls.forEach(tpl => { map[tpl.key] = tpl.name || tpl.key; });
            setTemplateMap(map);
          }
        }
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [loadSegments, loadTemplates]);

  const openEdit = (r) => setEditing(r);
  const closeEdit = () => setEditing(null);

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      await onUpdate?.(payload);
      await onRefresh?.({});
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    return rules.map((r, idx) => {
      const seg = segmentMap[Number(r.segment_token_id)];
      const tplKey = r.template_key || r.trigger_type || '';
      const tplName = templateMap[tplKey] || '';
      const params = r.params || r.trigger_params || {};
      return { id: `${r.rule_name}-${idx}`, rule: r, seg, tplKey, tplName, params };
    });
  }, [rules, segmentMap, templateMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
          {t('gamification.rules_defined') || 'Reglas Definidas'}
        </h2>
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface dark:hover:bg-dark-surface border border-dark-border/20 transition-all disabled:opacity-60"
          onClick={() => onRefresh?.({})}
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          {isLoading ? (t('common.loading') || 'Cargando…') : (t('common.refresh') || 'Refrescar')}
        </button>
      </div>

      {/* Empty state */}
      {rows.length === 0 && !isLoading ? (
        <div className="text-center py-16 px-6 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary/40 border border-dashed border-dark-border/20">
          <ListX size={40} className="mx-auto text-dark-text-secondary" />
          <h3 className="mt-4 text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
            {t('gamification.no_rules_defined') || 'Aún no se han definido reglas'}
          </h3>
          <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {t('gamification.create_first_rule_hint') || 'Crea tu primera regla en la pestaña "Crear".'}
          </p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-xl border border-dark-border/20">
          <table className="min-w-full text-sm">
            <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Regla</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Puntos</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Template</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Segmento</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Alcance</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Parámetros</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/20">
              {rows.map(({ id, rule, seg, tplKey, tplName, params }) => (
                <tr key={id} className="hover:bg-light-surface/40 dark:hover:bg-dark-surface-secondary/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold">{rule.rule_name}</div>
                    <div className="mt-1"><Pill active={!!rule.is_active} /></div>
                  </td>

                  <td className="px-6 py-4 text-matrix-green font-bold text-base">
                    {nf.format(Number(rule.merit_points || 0))}
                  </td>

                  <td className="px-6 py-4">
                    <TemplateCell tplName={tplName} tplKey={tplKey} />
                  </td>

                  <td className="px-6 py-4">
                    <SegmentCell seg={seg} />
                  </td>

                  <td className="px-6 py-4">
                    <ScopeSummary scope={rule.scope} />
                  </td>

                  <td className="px-6 py-4">
                    <ParamChips params={params} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <button
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dark-border/30 hover:bg-dark-surface-secondary"
                        onClick={() => setEditing(rule)}
                        title={t('common.edit', 'Editar')}
                      >
                        <PencilLine size={16} />
                        {t('common.edit', 'Editar')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && (
                <tr>
                  <td className="px-6 py-6 text-center text-dark-text-secondary" colSpan={7}>
                    <LoaderCircle size={16} className="animate-spin inline-block mr-2" />
                    {t('common.loading', 'Cargando…')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edición (Steps 1/2/3 adentro) */}
      <RuleEditModal
        open={!!editing}
        rule={editing}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          setSaving(true);
          try {
            await onUpdate?.(payload);
            await onRefresh?.({});
          } finally {
            setSaving(false);
          }
        }}
        isSaving={saving}
        loadTemplates={loadTemplates}
        loadSegments={loadSegments}
        loadCatalogs={loadCatalogs}
      />
    </div>
  );
};

export default RuleList;
