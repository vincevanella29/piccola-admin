// src/pages/adminPanel/components/empresas/components/cproduccion/ProductionCentersTab.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useCentrosProduccion } from '../../../../../../hooks/useCentrosProduccion.jsx';
import { Search, Save, RefreshCw, Loader2, X } from 'lucide-react';

// ---------- UI helpers (chips, switch, multiselect minimal) ----------
const Chip = ({ children, onRemove, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-sm mr-2 mb-2 ${className}`}>
    {children}
    {onRemove && (
      <button
        className="rounded hover:bg-gray-100 dark:hover:bg-gray-800 p-0.5"
        onClick={onRemove}
        aria-label="Quitar"
      >
        <X className="h-3.5 w-3.5 opacity-70" />
      </button>
    )}
  </span>
);

const Switch = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-3 select-none cursor-pointer">
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    <span
      className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange(!checked)}
    >
      <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </span>
  </label>
);

const MultiSelect = ({
  options,         // [{ value, label }]
  value,           // array of values
  onChange,        // (nextArray) => void
  placeholder = 'Buscar…',
  disabled = false,
}) => {
  const [q, setQ] = useState('');
  const byVal = useMemo(() => new Map(options.map(o => [o.value, o])), [options]);
  const selected = useMemo(() => value?.map(v => byVal.get(v)).filter(Boolean) || [], [value, byVal]);
  const available = useMemo(() => {
    const set = new Set(value || []);
    const qq = q.trim().toLowerCase();
    const filtered = options.filter(o => !set.has(o.value) && (qq ? (o.label?.toLowerCase()?.includes(qq)) : true));
    return filtered.slice(0, 8);
  }, [options, value, q]);

  const add = (val) => {
    if (disabled) return;
    if (!value?.includes(val)) onChange([...(value || []), val]);
    setQ('');
  };
  const remove = (val) => {
    if (disabled) return;
    onChange((value || []).filter(v => v !== val));
  };

  return (
    <div className={`relative ${disabled ? 'opacity-70 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-2 border rounded-md px-2 py-1.5">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && available[0]) {
              add(available[0].value);
              e.preventDefault();
            }
            if (e.key === 'Backspace' && !q && selected.length) {
              remove(selected[selected.length - 1].value);
            }
          }}
        />
      </div>

      {!!q && !!available.length && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-white dark:bg-gray-900 shadow max-h-56 overflow-auto">
          {available.map(opt => (
            <button
              key={String(opt.value)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => add(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Chips */}
      <div className="mt-2">
        {selected.map(opt => (
          <Chip key={String(opt.value)} onRemove={() => remove(opt.value)} className="border-gray-200 dark:border-gray-700">
            {opt.label}
          </Chip>
        ))}
        {!selected.length && (
          <div className="text-sm text-gray-500">{'Sin elementos seleccionados.'}</div>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------

export default function ProductionCentersTab({ appState, t }) {
  const {
    isLoading,
    centros,
    cargos,
    secciones,
    configs,
    currentConfig,
    fetchMeta,
    fetchConfigs,
    fetchConfig,
    saveConfig,
  } = useCentrosProduccion(appState, t);

  // Estado básico
  const [q, setQ] = useState('');
  const [selectedCentro, setSelectedCentro] = useState(null);

  // Estado del formulario (local, editable)
  const [selCargoIds, setSelCargoIds] = useState([]);     // number[]
  const [selSecciones, setSelSecciones] = useState([]);   // string[]
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mapas/Options
  const cargoOptions = useMemo(() => {
    const arr = (cargos || []).map((c) => {
      const id = Number(c?.id_cargo ?? c?.id);
      const name = String(c?.cargo ?? c?.nombre ?? c?.label ?? id);
      return { value: id, label: `${id} — ${name}` };
    });
    // únicos y ordenados por id
    const seen = new Set();
    const uniq = [];
    for (const o of arr) {
      if (!seen.has(o.value)) { seen.add(o.value); uniq.push(o); }
    }
    return uniq.sort((a, b) => Number(a.value) - Number(b.value));
  }, [cargos]);

  const seccionOptions = useMemo(
    () => (secciones || []).map(s => ({ value: String(s), label: String(s) })).sort((a, b) => a.label.localeCompare(b.label)),
    [secciones]
  );

  const centrosFiltrados = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = Array.isArray(centros) ? centros : [];
    if (!qq) return list;
    return list.filter(c => {
      const n = (c?.nombre || c?.nombre_norm || '').toLowerCase();
      const s = (c?.slug || '').toLowerCase();
      return n.includes(qq) || s.includes(qq);
    });
  }, [centros, q]);

  const selectedIdOrSlug = useMemo(() => selectedCentro?.slug || selectedCentro?._id || null, [selectedCentro]);

  // Carga inicial
  useEffect(() => {
    (async () => {
      await fetchMeta();     // centros, cargos, secciones
      await fetchConfigs();  // listado (para tablero inferior/consistencia)
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar centro, traer config y setear formulario
  useEffect(() => {
    if (!selectedIdOrSlug) return;
    (async () => {
      const cfg = await fetchConfig(selectedIdOrSlug);
      setSelCargoIds(Array.isArray(cfg?.cargo_ids) ? cfg.cargo_ids.map(Number) : []);
      setSelSecciones(Array.isArray(cfg?.secciones) ? cfg.secciones.map(String) : []);
      setNotes(cfg?.notes || '');
      setActive(typeof cfg?.active === 'boolean' ? cfg.active : true);
    })();
  }, [selectedIdOrSlug, fetchConfig]);

  const handleSave = useCallback(async () => {
    if (!selectedIdOrSlug) return;
    setSaving(true);
    try {
      await saveConfig({
        idOrSlug: selectedIdOrSlug,
        cargoIds: selCargoIds,
        secciones: selSecciones,
        active,
        notes,
      });
    } finally {
      setSaving(false);
    }
  }, [selectedIdOrSlug, selCargoIds, selSecciones, active, notes, saveConfig]);

  const handleReset = useCallback(async () => {
    if (!selectedIdOrSlug) return;
    const cfg = await fetchConfig(selectedIdOrSlug);
    setSelCargoIds(Array.isArray(cfg?.cargo_ids) ? cfg.cargo_ids.map(Number) : []);
    setSelSecciones(Array.isArray(cfg?.secciones) ? cfg.secciones.map(String) : []);
    setNotes(cfg?.notes || '');
    setActive(typeof cfg?.active === 'boolean' ? cfg.active : true);
  }, [selectedIdOrSlug, fetchConfig]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lista de centros (minimal) */}
      <div className="lg:col-span-1 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
        <div className="relative mb-3">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
            placeholder={t?.('empresa.search') || 'Buscar centro…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="max-h-[60vh] overflow-auto divide-y divide-gray-100 dark:divide-gray-800">
          {centrosFiltrados.map((c) => {
            const isSel = selectedCentro && (c._id === selectedCentro._id || c.slug === selectedCentro.slug);
            return (
              <button
                key={c._id || c.slug}
                onClick={() => setSelectedCentro(c)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition ${
                  isSel ? 'bg-gray-50 dark:bg-gray-900' : ''
                }`}
              >
                <div className="font-medium text-sm">{c?.nombre || c?.nombre_norm || c?.slug}</div>
                <div className="text-xs text-gray-500">{c?.slug}</div>
              </button>
            );
          })}
          {!centrosFiltrados?.length && (
            <div className="text-sm text-gray-500 p-3">{t?.('empresa.empty') || 'Sin centros.'}</div>
          )}
        </div>
      </div>

      {/* Formulario (minimal) */}
      <div className="lg:col-span-2 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
        {!selectedCentro ? (
          <div className="text-gray-500">{t?.('empresa.pick_one') || 'Selecciona un centro para configurar.'}</div>
        ) : (
          <>
            {/* Header compacto */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-semibold leading-tight">
                  {selectedCentro?.nombre || selectedCentro?.nombre_norm || selectedCentro?.slug}
                </div>
                <div className="text-xs text-gray-500">{selectedCentro?.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onChange={setActive} label={t?.('empresa.active') || 'Activo'} />
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 text-sm"
                  disabled={isLoading || saving}
                  title={t?.('common.refresh') || 'Refrescar'}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{t?.('common.refresh') || 'Refrescar'}</span>
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 text-sm disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t?.('common.save') || 'Guardar'}
                </button>
              </div>
            </div>

            {/* Secciones del form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <div className="mb-2 text-sm font-medium">{t?.('empresa.cargos') || 'Cargos'}</div>
                <MultiSelect
                  options={cargoOptions}
                  value={selCargoIds}
                  onChange={(arr) => setSelCargoIds(arr.map(Number))}
                  placeholder={t?.('empresa.search_cargos') || 'Buscar cargo por nombre o ID…'}
                  disabled={saving}
                />
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <div className="mb-2 text-sm font-medium">{t?.('empresa.secciones') || 'Secciones'}</div>
                <MultiSelect
                  options={seccionOptions}
                  value={selSecciones}
                  onChange={(arr) => setSelSecciones(arr.map(String))}
                  placeholder={t?.('empresa.search_sections') || 'Buscar sección…'}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm block mb-1">{t?.('empresa.notes') || 'Notas'}</label>
              <textarea
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas…"
              />
            </div>

            {/* Resumen compacto */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-300">
              <div className="border rounded-md p-2">
                <div className="font-medium mb-1">{t?.('empresa.summary_cargos') || 'Cargos seleccionados'}</div>
                <div className="max-h-24 overflow-auto">
                  {selCargoIds.length ? selCargoIds.sort((a, b) => a - b).map((id) => (
                    <code key={id} className="mr-1 mb-1 inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                      {id}
                    </code>
                  )) : <span className="text-gray-500">—</span>}
                </div>
              </div>
              <div className="border rounded-md p-2">
                <div className="font-medium mb-1">{t?.('empresa.summary_sections') || 'Secciones seleccionadas'}</div>
                <div className="max-h-24 overflow-auto">
                  {selSecciones.length ? selSecciones.sort().map((s) => (
                    <span key={s} className="mr-1 mb-1 inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                      {s}
                    </span>
                  )) : <span className="text-gray-500">—</span>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabla ultra-compacta de configs (sólo lectura) */}
      <div className="lg:col-span-3 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
        <div className="text-sm font-medium mb-2">{t?.('empresa.existing_configs') || 'Configuraciones existentes'}</div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-2">Centro</th>
                <th className="py-2 pr-2">Slug</th>
                <th className="py-2 pr-2">Activo</th>
                <th className="py-2 pr-2">#Cargos</th>
                <th className="py-2 pr-2">#Secciones</th>
              </tr>
            </thead>
            <tbody>
              {(configs || []).map((c) => (
                <tr key={c?._id} className="border-b border-gray-100 dark:border-gray-900">
                  <td className="py-2 pr-2">{c?.centro?.nombre || c?.centro?.nombre_norm || '—'}</td>
                  <td className="py-2 pr-2">{c?.centro?.slug || '—'}</td>
                  <td className="py-2 pr-2">{c?.active ? 'Sí' : 'No'}</td>
                  <td className="py-2 pr-2">{c?.cargo_ids?.length || 0}</td>
                  <td className="py-2 pr-2">{c?.secciones?.length || 0}</td>
                </tr>
              ))}
              {!configs?.length && (
                <tr><td className="py-2 text-gray-500" colSpan={5}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
