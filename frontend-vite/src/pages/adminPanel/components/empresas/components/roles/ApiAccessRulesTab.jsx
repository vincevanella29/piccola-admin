// src/pages/adminPanel/components/empresas/components/roles/ApiAccessRulesTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { Save, Trash2, ToggleLeft, ToggleRight, RefreshCw, Shield } from 'lucide-react';
import { useIsDark, makeSelectStyles } from './common';
import useRolesAccess from '../../../../../../hooks/useRolesAccess.jsx';

const Section = ({ title, children }) => (
  <div className="mb-4">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</h3>
    {children}
  </div>
);

const Inline = ({ children }) => (
  <div className="flex items-center gap-2 flex-wrap">{children}</div>
);

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
    // refresh rules to reflect changes
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
    // reload
    const items = await listApiAccessRules({});
    setRules(items || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-light-text-primary dark:text-dark-text-primary">
        <Shield className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{t?.('empresa.api_access_rules') || 'Reglas de Acceso por API (Secciones)'}</h2>
        <button
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
          onClick={loadAll}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t?.('common.refresh') || 'Refrescar'}</span>
        </button>
      </div>

      <Section title={t?.('empresa.api_prefix') || 'Prefijo de API'}>
        <div className="max-w-md">
          <Select
            options={prefixesOptions}
            value={selectedPrefix ? { value: selectedPrefix, label: selectedPrefix } : null}
            onChange={(opt) => handlePickRule(opt)}
            styles={selectStyles}
            placeholder={t?.('empresa.pick_api_prefix') || 'Selecciona un prefijo /api'}
            isClearable
          />
        </div>
      </Section>

      {selectedPrefix && (
        <>
          <Section title={`${t?.('empresa.rule_for') || 'Regla para'} ${selectedPrefix}`}>
            <Inline>
              <button
                onClick={onToggle}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${enabled ? 'border-green-500 text-green-600' : 'border-gray-400 text-gray-500'}`}
              >
                {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {enabled ? (t?.('common.enabled') || 'Habilitada') : (t?.('common.disabled') || 'Deshabilitada')}
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-500 text-red-600"
              >
                <Trash2 className="h-4 w-4" /> {t?.('common.delete') || 'Eliminar'}
              </button>
            </Inline>
          </Section>

          <Section title={t?.('empresa.include_sections') || 'Incluir Secciones (no se aplica aún)'}>
            <div className="max-w-2xl">
              <Select
                isMulti
                options={seccionesOptions}
                value={includeSecciones}
                onChange={(vals) => setIncludeSecciones(vals || [])}
                styles={selectStyles}
                placeholder={t?.('empresa.pick_sections') || 'Selecciona secciones'}
              />
            </div>
          </Section>

          <Section title={t?.('empresa.exclude_sections') || 'Bloquear Secciones (se aplica)'}>
            <div className="max-w-2xl">
              <Select
                isMulti
                options={seccionesOptions}
                value={excludeSecciones}
                onChange={(vals) => setExcludeSecciones(vals || [])}
                styles={selectStyles}
                placeholder={t?.('empresa.pick_sections') || 'Selecciona secciones'}
              />
            </div>
          </Section>

          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              <Save className="h-4 w-4" /> {t?.('common.save') || 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
