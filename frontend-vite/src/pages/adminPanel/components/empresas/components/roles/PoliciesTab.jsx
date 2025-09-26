import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Save, Trash2 } from 'lucide-react';
import Select from 'react-select';
import useRolesAccess from '../../../../../../hooks/useRolesAccess.jsx';
import { useIsDark, makeSelectStyles, sucLabel, empLabel } from './common';

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

  // NUEVO: “si su sucursal está en la lista ⇒ ver TODAS las sucursales”
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

  // --- prime meta + listado (evitar doble llamada en StrictMode)
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

    // NUEVO campos
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
      // ⬇️ NUEVO
      own_sucursal_grants_all: polOwnSucGrantsAll,
      own_sucursal_ids_grant_all: polOwnSucIdsAll.map(o => Number(o.value)),
    });
    resetPolicyForm();
    fetchPolicies().catch(()=>{});
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form */}
      <div className="lg:col-span-1 space-y-3">
        <h4 className="text-sm font-semibold">{t?.('empresa.policy_editor') || 'Editor de política'}</h4>

        <div>
          <label className="block text-sm mb-1">Tipo</label>
          <Select
            options={[{ value: 'cargo', label: 'Cargo' }, { value: 'seccion', label: 'Sección' }]}
            value={polType}
            onChange={(v) => { setPolType(v); setPolKey(null); }}
            styles={selectStyles}
            classNamePrefix="vxselect"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">{polType?.value === 'seccion' ? 'Sección' : 'Cargo'}</label>
          <Select
            options={polKeyOptions}
            value={polKey}
            onChange={setPolKey}
            isSearchable
            styles={selectStyles}
            classNamePrefix="vxselect"
            className="text-sm"
            placeholder="Selecciona…"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={polAllowAllEmp} onChange={e=>setPolAllowAllEmp(e.target.checked)} />
            Permitir TODAS las empresas
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={polAllowAllSuc} onChange={e=>setPolAllowAllSuc(e.target.checked)} />
            Permitir TODAS las sucursales
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={polAllowOwnSuc} onChange={e=>setPolAllowOwnSuc(e.target.checked)} />
            Permitir sucursal propia (desde ficha)
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={polActiveReq} onChange={e=>setPolActiveReq(e.target.checked)} />
            Requiere ficha ACTIVA
          </label>
        </div>

        {/* NUEVO: own_sucursal_grants_all + lista de sucursales que disparan ALL */}
        <div className="mt-2 grid grid-cols-1 gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={polOwnSucGrantsAll}
              onChange={e=>setPolOwnSucGrantsAll(e.target.checked)}
            />
            Si su Sucursal ∈ lista ⇒ ver TODAS las sucursales
          </label>

          <div>
            <label className="block text-sm mb-1">Sucursales que disparan acceso total</label>
            <Select
              isMulti
              options={sucursalOptions}
              value={polOwnSucIdsAll}
              onChange={setPolOwnSucIdsAll}
              styles={selectStyles}
              classNamePrefix="vxselect"
              className="text-sm"
              isDisabled={!polOwnSucGrantsAll}
              placeholder="Selecciona sucursales… (vacío = cualquiera)"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="block text-sm mb-1">Empresas permitidas (allow)</label>
          <Select
            isMulti
            options={empresaOptions}
            value={polEmpAllow}
            onChange={setPolEmpAllow}
            styles={selectStyles}
            classNamePrefix="vxselect"
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Sucursales permitidas (allow)</label>
          <Select
            isMulti
            options={sucursalOptions}
            value={polSucAllow}
            onChange={setPolSucAllow}
            styles={selectStyles}
            classNamePrefix="vxselect"
            className="text-sm"
          />
        </div>

        <button className="text-xs underline mt-2" onClick={()=>setShowAdvanced(v=>!v)}>
          {showAdvanced ? 'Ocultar avanzado' : 'Mostrar avanzado (block lists)'}
        </button>

        {showAdvanced && (
          <div className="space-y-2">
            <div>
              <label className="block text-sm mb-1">Empresas bloqueadas (block)</label>
              <Select
                isMulti
                options={empresaOptions}
                value={polEmpBlock}
                onChange={setPolEmpBlock}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Sucursales bloqueadas (block)</label>
              <Select
                isMulti
                options={sucursalOptions}
                value={polSucBlock}
                onChange={setPolSucBlock}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3">
          {editingPolicyId && (
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={async ()=>{ await removePolicy(editingPolicyId); resetPolicyForm(); fetchPolicies().catch(()=>{}); }}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          )}
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            onClick={onSavePolicyClick}
            disabled={!polType?.value || !polKey?.value}
          >
            <Save className="h-4 w-4" /> Guardar política
          </button>
        </div>
      </div>

      {/* Listado */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{t?.('empresa.policies_list') || 'Políticas vigentes'}</h4>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
            onClick={()=>fetchPolicies().catch(()=>{})}
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </button>
        </div>

        <div className="grid gap-2">
          {(policies || []).map((p) => (
            <div
              key={p._id}
              className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {p.type === 'seccion' ? 'Sección' : 'Cargo'}: <span className="font-mono">{p.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-70">{p.active_required ? 'requiere activo' : 'no requiere activo'}</span>
                  <button className="text-xs underline" onClick={()=>fillPolicyForm(p)}>Editar</button>
                </div>
              </div>

              <div className="mt-1 text-xs grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1">
                <div>all empresas: <b>{p.allow_all_companies ? 'sí' : 'no'}</b></div>
                <div>all sucursales: <b>{p.allow_all_sucursales ? 'sí' : 'no'}</b></div>
                <div>own sucursal: <b>{p.allow_own_sucursal ? 'sí' : 'no'}</b></div>
                <div>own→ALL: <b>{p.own_sucursal_grants_all ? 'sí' : 'no'}</b></div>
                <div>own→ALL ids: {(p.own_sucursal_ids_grant_all || []).length}</div>
                <div>emp allow: {(p.empresa_ids_allow||[]).length}</div>
                <div>suc allow: {(p.sucursal_ids_allow||[]).length}</div>
                <div>emp block: {(p.empresa_ids_block||[]).length} / suc block: {(p.sucursal_ids_block||[]).length}</div>
              </div>
            </div>
          ))}
          {!policies?.length && <div className="text-sm opacity-70">No hay políticas aún.</div>}
        </div>
      </div>
    </div>
  );
};

export default PoliciesTab;
