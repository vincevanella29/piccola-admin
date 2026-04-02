// src/pages/adminPanel/components/empresas/components/roles/ApiAccessRulesTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { Save, Trash2, ToggleLeft, ToggleRight, RefreshCw, Shield, Zap, Lock, Unlock } from 'lucide-react';
import { useIsDark, makeSelectStyles } from './common';
import useRolesAccess from '../../../../../../hooks/useRolesAccess.jsx';

export default function ApiAccessRulesTab({ appState, t }) {
  const isDark = useIsDark();
  const selectStyles = useMemo(() => makeSelectStyles(isDark), [isDark]);
  const {
    fetchRolesMeta,
    rolesMeta,
    listApiAccessRules,
    upsertApiAccessRule,
    toggleApiAccessRule,
    deleteApiAccessRule,
  } = useRolesAccess(appState, t);

  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState([]);
  const [selectedPrefix, setSelectedPrefix] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [includeSecciones, setIncludeSecciones] = useState([]);
  const [excludeSecciones, setExcludeSecciones] = useState([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await fetchRolesMeta();
      const items = await listApiAccessRules({});
      setRules(items || []);
      if (items && items.length && !selectedPrefix) {
        handlePickRule(items[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefixesOptions = useMemo(() => {
    return (rules || []).map(r => ({ value: r.path_prefix, label: r.path_prefix }));
  }, [rules]);

  const seccionesOptions = useMemo(() => {
    return (rolesMeta?.secciones || []).map(s => ({ value: s, label: s }));
  }, [rolesMeta]);

  const handlePickRule = (ruleOrOption) => {
    const rule = ruleOrOption?.path_prefix ? ruleOrOption : (rules || []).find(r => r.path_prefix === ruleOrOption?.value);
    if (!rule) return;
    setSelectedPrefix(rule.path_prefix);
    setEnabled(Boolean(rule.enabled !== false));
    setIncludeSecciones((rule.include_secciones || []).map(s => ({ value: s, label: s })));
    setExcludeSecciones((rule.exclude_secciones || []).map(s => ({ value: s, label: s })));
  };

  const onSave = async () => {
    if (!selectedPrefix) return;
    await upsertApiAccessRule({
      path_prefix: selectedPrefix,
      include_secciones: includeSecciones.map(o => o.value),
      exclude_secciones: excludeSecciones.map(o => o.value),
      enabled,
    });
    const items = await listApiAccessRules({});
    setRules(items || []);
  };

  const onToggle = async () => {
    if (!selectedPrefix) return;
    await toggleApiAccessRule({ path_prefix: selectedPrefix, enabled: !enabled });
    setEnabled(!enabled);
  };

  const onDelete = async () => {
    if (!selectedPrefix) return;
    await deleteApiAccessRule({ path_prefix: selectedPrefix });
    setSelectedPrefix(null);
    setIncludeSecciones([]);
    setExcludeSecciones([]);
    const items = await listApiAccessRules({});
    setRules(items || []);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t?.('empresa.api_access_rules') || 'Reglas de Acceso por API'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Control de visibilidad por secciones en cada endpoint</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold shadow-sm transition-all"
          onClick={loadAll}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t?.('common.refresh') || 'Refrescar'}</span>
        </motion.button>
      </div>

      {/* Rule selector card */}
      <div className="bg-white/40 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-6 space-y-6">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
            {t?.('empresa.api_prefix') || 'Prefijo de API'}
          </label>
          <Select
            options={prefixesOptions}
            value={selectedPrefix ? { value: selectedPrefix, label: selectedPrefix } : null}
            onChange={(opt) => handlePickRule(opt)}
            styles={selectStyles}
            placeholder={t?.('empresa.pick_api_prefix') || 'Selecciona un prefijo /api...'}
            isClearable
            className="max-w-lg text-sm font-medium"
            classNamePrefix="vxselect"
          />
        </div>

        <AnimatePresence>
          {selectedPrefix && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Status bar */}
              <div className="flex items-center gap-3 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold ${
                  enabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-gray-500/15 text-gray-600 dark:text-gray-400'
                }`}>
                  {enabled ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {enabled ? (t?.('common.enabled') || 'Habilitada') : (t?.('common.disabled') || 'Deshabilitada')}
                </div>

                <code className="text-xs font-mono bg-gray-200/60 dark:bg-gray-800 px-3 py-1.5 rounded-xl text-gray-600 dark:text-gray-400">
                  {selectedPrefix}
                </code>

                <div className="ml-auto flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggle}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      enabled
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                    }`}
                  >
                    {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {enabled ? 'Deshabilitar' : 'Habilitar'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onDelete}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-sm font-bold transition-all"
                  >
                    <Trash2 className="h-4 w-4" /> {t?.('common.delete') || 'Eliminar'}
                  </motion.button>
                </div>
              </div>

              {/* Sections include/exclude side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Include */}
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-widest">Incluir</div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t?.('empresa.include_sections') || 'Secciones Permitidas'}</span>
                  </div>
                  <Select
                    isMulti
                    options={seccionesOptions}
                    value={includeSecciones}
                    onChange={(vals) => setIncludeSecciones(vals || [])}
                    styles={selectStyles}
                    classNamePrefix="vxselect"
                    className="text-sm"
                    placeholder={t?.('empresa.pick_sections') || 'Añadir secciones...'}
                  />
                </div>

                {/* Exclude */}
                <div className="bg-red-50/50 dark:bg-red-900/10 p-5 rounded-3xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="px-2 py-1 bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase tracking-widest">Excluir</div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t?.('empresa.exclude_sections') || 'Secciones Bloqueadas'}</span>
                  </div>
                  <Select
                    isMulti
                    options={seccionesOptions}
                    value={excludeSecciones}
                    onChange={(vals) => setExcludeSecciones(vals || [])}
                    styles={selectStyles}
                    classNamePrefix="vxselect"
                    className="text-sm"
                    placeholder={t?.('empresa.pick_sections') || 'Bloquear secciones...'}
                  />
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center justify-end pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSave}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 text-white font-bold text-sm shadow-lg shadow-primary-500/20 transition-all"
                >
                  <Save className="h-4 w-4" /> {t?.('common.save') || 'Guardar Cambios'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
