import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Save, Trash2, ChevronDown, ChevronUp, Pencil, FileText, Settings2 } from 'lucide-react';
import Select from 'react-select';
import useRolesAccess from '../../../../../../hooks/useRolesAccess.jsx';
import { useIsDark, makeSelectStyles, sucLabel, empLabel } from './common';

/* ── Apple-style toggle ── */
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer group">
    <motion.div
      className={`relative w-12 h-7 rounded-full transition-colors ${
        checked
          ? 'bg-gradient-to-r from-primary-500 to-indigo-500'
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

/* ── Badge pill ── */
const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-500/15 text-red-600 dark:text-red-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    gray: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
};

const PoliciesTab = ({ appState, t, prefetchedEmpresas = [], prefetchedSucursales = [] }) => {
  const isDark = useIsDark();
  const selectStyles = useMemo(() => makeSelectStyles(isDark), [isDark]);

  const {
    rolesMeta, policies, fetchRolesMeta, fetchPolicies, savePolicy, removePolicy,
  } = useRolesAccess(appState, t);

  // --- form state
  const [polType, setPolType] = useState({ value: 'cargo', label: 'Cargo' });
  const [polKey, setPolKey] = useState(null);

  const [polAllowAllEmp, setPolAllowAllEmp] = useState(false);
  const [polAllowAllSuc, setPolAllowAllSuc] = useState(false);
  const [polAllowOwnSuc, setPolAllowOwnSuc] = useState(false);
  const [polActiveReq, setPolActiveReq] = useState(true);

  const [polEmpAllow, setPolEmpAllow] = useState([]);
  const [polSucAllow, setPolSucAllow] = useState([]);
  const [polEmpBlock, setPolEmpBlock] = useState([]);
  const [polSucBlock, setPolSucBlock] = useState([]);

  const [polOwnSucGrantsAll, setPolOwnSucGrantsAll] = useState(false);
  const [polOwnSucIdsAll, setPolOwnSucIdsAll] = useState([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState(null);

  // --- memo options
  const empresaOptions = useMemo(
    () => (prefetchedEmpresas || []).map((e) => ({ value: e?._id, label: empLabel(e), _raw: e })),
    [prefetchedEmpresas]
  );

  const sucursalOptions = useMemo(
    () => (prefetchedSucursales || []).map((s) => ({ value: s.id_sucursal, label: sucLabel(s), _raw: s })),
    [prefetchedSucursales]
  );

  const polKeyOptions = useMemo(() => {
    if (polType?.value === 'seccion') {
      return (rolesMeta?.secciones || []).map((s) => ({ value: (s || '').toLowerCase(), label: s }));
    }
    return (rolesMeta?.cargos || []).map((c) => ({ value: (c || '').toLowerCase(), label: c }));
  }, [polType, rolesMeta]);

  // --- prime meta + listado
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        await fetchRolesMeta();
        await fetchPolicies();
      } catch {}
    })();
  }, []);

  // --- helpers
  const resetPolicyForm = () => {
    setEditingPolicyId(null);
    setPolAllowAllEmp(false);
    setPolAllowAllSuc(false);
    setPolAllowOwnSuc(false);
    setPolActiveReq(true);
    setPolEmpAllow([]); setPolSucAllow([]);
    setPolEmpBlock([]); setPolSucBlock([]);
    setPolOwnSucGrantsAll(false);
    setPolOwnSucIdsAll([]);
    setShowAdvanced(false);
  };

  const toOptEmp = (ids) => (ids || []).map((id) => {
    const raw = (prefetchedEmpresas || []).find(e => String(e?._id) === String(id));
    return raw ? { value: String(raw?._id), label: empLabel(raw) } : { value: String(id), label: String(id) };
  });

  const toOptSuc = (ids) => (ids || []).map((sid) => {
    const raw = (prefetchedSucursales || []).find(s => Number(s?.id_sucursal) === Number(sid));
    return raw
      ? { value: Number(raw?.id_sucursal), label: sucLabel(raw) }
      : { value: Number(sid), label: `#${sid}` };
  });

  const fillPolicyForm = (p) => {
    setEditingPolicyId(p?._id || null);
    setPolType({ value: p?.type, label: p?.type === 'seccion' ? 'Sección' : 'Cargo' });
    setPolKey({ value: p?.key, label: p?.key });

    setPolAllowAllEmp(!!p?.allow_all_companies);
    setPolAllowAllSuc(!!p?.allow_all_sucursales);
    setPolAllowOwnSuc(!!p?.allow_own_sucursal);
    setPolActiveReq(!!p?.active_required);

    setPolEmpAllow(toOptEmp(p?.empresa_ids_allow));
    setPolSucAllow(toOptSuc(p?.sucursal_ids_allow));
    setPolEmpBlock(toOptEmp(p?.empresa_ids_block));
    setPolSucBlock(toOptSuc(p?.sucursal_ids_block));

    setPolOwnSucGrantsAll(!!p?.own_sucursal_grants_all);
    setPolOwnSucIdsAll(toOptSuc(p?.own_sucursal_ids_grant_all));
  };

  const onSavePolicyClick = async () => {
    if (!polType?.value || !polKey?.value) return;
    await savePolicy({
      type: polType.value,
      key: polKey.value,
      allow_all_companies: polAllowAllEmp,
      allow_all_sucursales: polAllowAllSuc,
      allow_own_sucursal: polAllowOwnSuc,
      active_required: polActiveReq,
      empresa_ids_allow: polEmpAllow.map(o => String(o.value)),
      sucursal_ids_allow: polSucAllow.map(o => Number(o.value)),
      empresa_ids_block: polEmpBlock.map(o => String(o.value)),
      sucursal_ids_block: polSucBlock.map(o => Number(o.value)),
      own_sucursal_grants_all: polOwnSucGrantsAll,
      own_sucursal_ids_grant_all: polOwnSucIdsAll.map(o => Number(o.value)),
    });
    resetPolicyForm();
    fetchPolicies().catch(()=>{});
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ─── Editor Panel (left/top) ─── */}
      <div className="lg:col-span-2">
        <div className="bg-white/40 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-6 space-y-5 sticky top-4">
          {/* Editor title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500/20 to-indigo-500/20 flex items-center justify-center">
              <Settings2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <h4 className="font-bold text-base">{t?.('empresa.policy_editor') || 'Editor de Política'}</h4>
              <p className="text-[11px] text-gray-500">{editingPolicyId ? 'Editando política existente' : 'Crear nueva política'}</p>
            </div>
          </div>

          {/* Type + Key */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Tipo</label>
              <Select
                options={[{ value: 'cargo', label: 'Cargo' }, { value: 'seccion', label: 'Sección' }]}
                value={polType}
                onChange={(v) => { setPolType(v); setPolKey(null); }}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">{polType?.value === 'seccion' ? 'Sección' : 'Cargo'}</label>
              <Select
                options={polKeyOptions}
                value={polKey}
                onChange={setPolKey}
                isSearchable
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm font-medium"
                placeholder="Selecciona…"
              />
            </div>
          </div>

          {/* Toggles grid */}
          <div className="grid grid-cols-1 gap-3 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl">
            <Toggle checked={polAllowAllEmp} onChange={setPolAllowAllEmp} label="Permitir TODAS las empresas" />
            <Toggle checked={polAllowAllSuc} onChange={setPolAllowAllSuc} label="Permitir TODAS las sucursales" />
            <Toggle checked={polAllowOwnSuc} onChange={setPolAllowOwnSuc} label="Permitir sucursal propia (ficha)" />
            <Toggle checked={polActiveReq} onChange={setPolActiveReq} label="Requiere ficha ACTIVA" />
          </div>

          {/* Suc grants all */}
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-3">
            <Toggle checked={polOwnSucGrantsAll} onChange={setPolOwnSucGrantsAll} label="Si su sucursal ∈ lista ⇒ ver TODAS" />
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Sucursales que disparan acceso total</label>
              <Select
                isMulti
                options={sucursalOptions}
                value={polOwnSucIdsAll}
                onChange={setPolOwnSucIdsAll}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                isDisabled={!polOwnSucGrantsAll}
                placeholder="Vacío = cualquiera"
              />
            </div>
          </div>

          {/* Allow lists */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Empresas permitidas</label>
              <Select isMulti options={empresaOptions} value={polEmpAllow} onChange={setPolEmpAllow} styles={selectStyles} classNamePrefix="vxselect" className="text-sm" placeholder="Seleccionar..." />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Sucursales permitidas</label>
              <Select isMulti options={sucursalOptions} value={polSucAllow} onChange={setPolSucAllow} styles={selectStyles} classNamePrefix="vxselect" className="text-sm" placeholder="Seleccionar..." />
            </div>
          </div>

          {/* Advanced toggle */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? 'Ocultar listas de bloqueo' : 'Mostrar listas de bloqueo'}
          </motion.button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
                <div className="p-4 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Empresas bloqueadas</label>
                    <Select isMulti options={empresaOptions} value={polEmpBlock} onChange={setPolEmpBlock} styles={selectStyles} classNamePrefix="vxselect" className="text-sm" placeholder="Bloquear..." />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Sucursales bloqueadas</label>
                    <Select isMulti options={sucursalOptions} value={polSucBlock} onChange={setPolSucBlock} styles={selectStyles} classNamePrefix="vxselect" className="text-sm" placeholder="Bloquear..." />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            {editingPolicyId && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold text-sm transition-all"
                onClick={async () => { await removePolicy(editingPolicyId); resetPolicyForm(); fetchPolicies().catch(()=>{}); }}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl text-white font-bold text-sm shadow-lg transition-all ${
                polType?.value && polKey?.value
                  ? 'bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 shadow-primary-500/20'
                  : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
              }`}
              onClick={onSavePolicyClick}
              disabled={!polType?.value || !polKey?.value}
            >
              <Save className="h-4 w-4" /> Guardar política
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── Policies List (right/bottom) ─── */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <h4 className="font-bold text-base">{t?.('empresa.policies_list') || 'Políticas Vigentes'}</h4>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold shadow-sm transition-all"
            onClick={() => fetchPolicies().catch(()=>{})}
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </motion.button>
        </div>

        <div className="space-y-3">
          {(policies || []).map((p) => (
            <motion.div
              key={p._id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/40 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge color="indigo">{p.type === 'seccion' ? 'Sección' : 'Cargo'}</Badge>
                  <span className="font-bold text-sm">{p.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={p.active_required ? 'green' : 'gray'}>
                    {p.active_required ? 'Requiere activo' : 'No req. activo'}
                  </Badge>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    onClick={() => fillPolicyForm(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Empresas:</span>
                  <Badge color={p.allow_all_companies ? 'green' : 'gray'}>{p.allow_all_companies ? 'Todas' : `${(p.empresa_ids_allow||[]).length}`}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Sucursales:</span>
                  <Badge color={p.allow_all_sucursales ? 'green' : 'gray'}>{p.allow_all_sucursales ? 'Todas' : `${(p.sucursal_ids_allow||[]).length}`}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Propia:</span>
                  <Badge color={p.allow_own_sucursal ? 'green' : 'gray'}>{p.allow_own_sucursal ? 'Sí' : 'No'}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Own→ALL:</span>
                  <Badge color={p.own_sucursal_grants_all ? 'blue' : 'gray'}>{p.own_sucursal_grants_all ? 'Sí' : 'No'}</Badge>
                </div>
              </div>

              {/* Block counts if any */}
              {((p.empresa_ids_block||[]).length > 0 || (p.sucursal_ids_block||[]).length > 0) && (
                <div className="mt-2 flex items-center gap-3 text-[10px]">
                  <Badge color="red">Block emp: {(p.empresa_ids_block||[]).length}</Badge>
                  <Badge color="red">Block suc: {(p.sucursal_ids_block||[]).length}</Badge>
                </div>
              )}
            </motion.div>
          ))}

          {!policies?.length && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No hay políticas configuradas aún.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PoliciesTab;
