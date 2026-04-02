// src/pages/adminPanel/components/empresas/components/cproduccion/ProductionCentersTab.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCentrosProduccion } from '../../../../../../hooks/useCentrosProduccion.jsx';
import { Search, Save, RefreshCw, Loader2, X, Flame, ChefHat, Activity, ClipboardList } from 'lucide-react';

/* ── UI HELPERS (Apple Glass Style) ── */

const Chip = ({ children, onRemove, className = '' }) => (
  <motion.span
    initial={{ scale: 0.9, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.9, opacity: 0 }}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider mr-2 mb-2 transition-colors ${className}`}
  >
    {children}
    {onRemove && (
      <button
        className="rounded-lg hover:bg-black/10 dark:hover:bg-white/10 p-0.5 ml-1 transition-colors"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Quitar"
      >
        <X className="h-3 w-3 opacity-70" />
      </button>
    )}
  </motion.span>
);

const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <motion.div
      className={`relative w-12 h-7 rounded-full transition-colors ${
        checked
          ? 'bg-gradient-to-r from-orange-400 to-red-500'
          : 'bg-gray-300 dark:bg-gray-700'
      }`}
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md"
        animate={{ left: checked ? '22px' : '2px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.div>
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
      {label}
    </span>
  </label>
);

const MultiSelectGlass = ({ options, value, onChange, placeholder, disabled = false, badgeColor = "orange" }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  
  const byVal = useMemo(() => new Map(options.map(o => [o.value, o])), [options]);
  const selected = useMemo(() => value?.map(v => byVal.get(v)).filter(Boolean) || [], [value, byVal]);
  const available = useMemo(() => {
    const set = new Set(value || []);
    const qq = q.trim().toLowerCase();
    const filtered = options.filter(o => !set.has(o.value) && (qq ? (o.label?.toLowerCase()?.includes(qq)) : true));
    return filtered.slice(0, 10);
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

  const colors = {
    orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  };

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex flex-col gap-2 p-1">
        <div className="relative group">
          <Search className="h-4 w-4 absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
          <input
            className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-black/30 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none text-sm focus:ring-2 focus:ring-orange-500/50 backdrop-blur-sm transition-all shadow-sm"
            placeholder={placeholder}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
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

        <AnimatePresence>
          {open && (q || available.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 top-[52px] left-0 w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur-24px max-h-56 overflow-auto py-2"
            >
              {available.map(opt => (
                <button
                  key={String(opt.value)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); add(opt.value); }}
                >
                  {opt.label}
                </button>
              ))}
              {available.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">No hay coincidencias</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap gap-1">
          <AnimatePresence>
            {selected.map(opt => (
              <Chip key={String(opt.value)} onRemove={() => remove(opt.value)} className={colors[badgeColor]}>
                {opt.label}
              </Chip>
            ))}
          </AnimatePresence>
          {selected.length === 0 && (
            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1 mt-1">Ninguno seleccionado</div>
          )}
        </div>
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

  const [q, setQ] = useState('');
  const [selectedCentro, setSelectedCentro] = useState(null);

  const [selCargoIds, setSelCargoIds] = useState([]);
  const [selSecciones, setSelSecciones] = useState([]);
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargoOptions = useMemo(() => {
    const arr = (cargos || []).map((c) => {
      const id = Number(c?.id_cargo ?? c?.id);
      const name = String(c?.cargo ?? c?.nombre ?? c?.label ?? id);
      return { value: id, label: `${id} — ${name}` };
    });
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

  useEffect(() => {
    (async () => {
      await fetchMeta();
      await fetchConfigs();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await fetchConfigs();
    } finally {
      setSaving(false);
    }
  }, [selectedIdOrSlug, selCargoIds, selSecciones, active, notes, saveConfig, fetchConfigs]);

  const handleReset = useCallback(async () => {
    if (!selectedIdOrSlug) return;
    const cfg = await fetchConfig(selectedIdOrSlug);
    setSelCargoIds(Array.isArray(cfg?.cargo_ids) ? cfg.cargo_ids.map(Number) : []);
    setSelSecciones(Array.isArray(cfg?.secciones) ? cfg.secciones.map(String) : []);
    setNotes(cfg?.notes || '');
    setActive(typeof cfg?.active === 'boolean' ? cfg.active : true);
  }, [selectedIdOrSlug, fetchConfig]);

  return (
    <div className="space-y-6">

      {/* DASHBOARD HEADER */}
      <div className="bg-white/40 dark:bg-black/20 rounded-[32px] border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="flex-1 flex gap-4">
            <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-orange-400/20 to-red-500/20 border border-orange-500/10 flex items-center justify-center shadow-inner">
              <ChefHat className="h-8 w-8 text-orange-500 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 mb-1">
                {t?.('empresa.production_centers_title') || 'Centros de Producción'}
              </h2>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t?.('empresa.production_centers_subtitle') || 'Configura las estaciones (ej. Parrilla, Cocina Caliente) y mapea los cargos operativos'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-4 flex gap-3 shadow-none">
          <Activity className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-[13px] leading-relaxed font-medium text-orange-800 dark:text-orange-300">
            {t?.('empresa.production_centers_info') || 'Asigna qué cargos trabajan en cada centro de producción. Cuando un empleado registre asistencia, sus métricas de rendimiento y tiempos se atribuirán automáticamente a este centro. Esto les permitirá además solicitar recetas, procesar mermas y subir inventarios de sus áreas productivas.'}
          </p>
        </div>
      </div>


      {/* MAIN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* LIST VIEW (Left) */}
        <div className="lg:col-span-1 bg-white/40 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-4 flex flex-col h-[600px]">
          <div className="relative mb-4">
            <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-black/40 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none transition-all shadow-sm"
              placeholder={t?.('empresa.search_centro') || 'Buscar centro…'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none space-y-2 pr-1">
            {centrosFiltrados.map((c) => {
              const isSel = selectedCentro && (c._id === selectedCentro._id || c.slug === selectedCentro.slug);
              return (
                <motion.button
                  key={c._id || c.slug}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCentro(c)}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition-all ${
                    isSel 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-md shadow-orange-500/20 text-white' 
                      : 'hover:bg-white/80 dark:hover:bg-gray-800/80 bg-white/30 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className={`font-bold text-sm truncate ${isSel ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {c?.nombre || c?.nombre_norm || c?.slug}
                  </div>
                  <div className={`text-[11px] uppercase tracking-widest font-semibold mt-1 ${isSel ? 'text-orange-100' : 'text-gray-400'}`}>
                    {c?.slug}
                  </div>
                </motion.button>
              );
            })}
            {!centrosFiltrados?.length && (
              <div className="text-center py-10 opacity-50">
                <Flame className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-bold tracking-tight">{t?.('empresa.empty') || 'Sin centros.'}</span>
              </div>
            )}
          </div>
        </div>

        {/* EDITOR PANELS (Right) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* CONFIG CARD */}
          <div className="bg-white/40 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-6">
            {!selectedCentro ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center px-4">
               <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-inner">
                 <ClipboardList className="h-8 w-8 text-gray-400" />
               </div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t?.('empresa.pick_one_title') || 'Selecciona un Centro'}</h3>
               <p className="text-sm text-gray-500 mt-2 max-w-sm">{t?.('empresa.pick_one_desc') || 'Haz clic en un centro de producción a la izquierda para configurar qué cargos conforman sus operaciones.'}</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                
                {/* Header Compacto */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                      {selectedCentro?.nombre || selectedCentro?.nombre_norm || selectedCentro?.slug}
                    </h3>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-orange-500 mt-1">{selectedCentro?.slug}</div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/50 dark:bg-black/40 px-4 py-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <Toggle checked={active} onChange={setActive} label={t?.('empresa.active') || 'En Operación'} />
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleReset}
                      className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                      disabled={isLoading || saving}
                      title={t?.('common.refresh') || 'Deshacer'}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSave}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 disabled:opacity-60 transition-all"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t?.('common.save') || 'Guardar'}
                    </motion.button>
                  </div>
                </div>

                {/* Form Selection Grids */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Cargos */}
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-gray-100 dark:border-gray-800 p-5">
                    <div className="mb-4">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        {t?.('empresa.cargos_assigned') || 'Cargos Operativos'}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-widest font-semibold">{t?.('empresa.cargos_desc') || 'Personal que trabaja en este centro'}</p>
                    </div>
                    <MultiSelectGlass
                      options={cargoOptions}
                      value={selCargoIds}
                      onChange={(arr) => setSelCargoIds(arr.map(Number))}
                      placeholder={t?.('empresa.search_cargos') || 'Ej: Cocinero, Parrillero...'}
                      disabled={saving}
                      badgeColor="orange"
                    />
                  </div>

                  {/* Secciones */}
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-gray-100 dark:border-gray-800 p-5">
                    <div className="mb-4">
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        {t?.('empresa.areas_assigned') || 'Áreas de Configuración'}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-widest font-semibold">{t?.('empresa.areas_desc') || 'Ubicaciones de layout'}</p>
                    </div>
                    <MultiSelectGlass
                      options={seccionOptions}
                      value={selSecciones}
                      onChange={(arr) => setSelSecciones(arr.map(String))}
                      placeholder={t?.('empresa.search_sections') || 'Ej: Cocina, Salón...'}
                      disabled={saving}
                      badgeColor="blue"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="pt-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 block mb-2">{t?.('empresa.notes') || 'Notas e Instrucciones Internas'}</label>
                  <textarea
                    className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/30 p-4 text-sm focus:ring-2 focus:ring-orange-500/50 outline-none backdrop-blur-sm shadow-sm transition-all resize-none"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instrucciones del centro de producción, detalles de inventario..."
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* TABLE OF EXISTING */}
          <div className="bg-white/40 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-6">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-500" />
              {t?.('empresa.existing_configs') || 'Resumen de Centros de Producción Configurables'}
            </h4>
            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/60 dark:bg-black/40">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-[10px] uppercase font-bold tracking-widest text-gray-500">
                    <tr>
                      <th className="px-5 py-4">Centro</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Cargos</th>
                      <th className="px-5 py-4">Secciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                    {(configs || []).map((c) => (
                      <tr key={c?._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-bold text-gray-900 dark:text-white">{c?.centro_nombre || c?.centro_slug || '—'}</div>
                          <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-0.5">{c?.centro_slug || '—'}</div>
                        </td>
                        <td className="px-5 py-3">
                          {c?.active 
                            ? <span className="inline-flex px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">Activo</span>
                            : <span className="inline-flex px-2 py-0.5 bg-gray-500/15 text-gray-600 dark:text-gray-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">Inactivo</span>
                          }
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-bold">{c?.cargo_ids?.length || 0}</span>
                        </td>
                        <td className="px-5 py-3">
                           <span className="font-bold">{c?.secciones?.length || 0}</span>
                        </td>
                      </tr>
                    ))}
                    {!configs?.length && (
                      <tr><td className="px-5 py-8 text-center text-gray-500 text-sm font-medium" colSpan={4}>Ningún centro verificado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
