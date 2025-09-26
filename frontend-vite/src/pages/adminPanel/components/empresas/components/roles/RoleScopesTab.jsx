// src/pages/adminPanel/components/empresas/components/roles/RoleScopesTab.jsx
import React, { useMemo, useState, useEffect } from 'react';
import Select from 'react-select';
import { Save, Trash2, RefreshCw, Shield } from 'lucide-react';
import { useIsDark, makeSelectStyles, ROLE_LEVEL_OPTIONS } from './common';
import useRolesAccess from '../../../../../../hooks/useRolesAccess.jsx';

const RoleScopesTab = ({
  appState,
  t,
  // puedes pasar options ya listas...
  sucursalesOptions = [],
  empresasOptions = [],
  // ...o prefetched crudos y aquí se arman las options
  prefetchedSucursales = [],
  prefetchedEmpresas = [],
}) => {
  const isDark = useIsDark();
  const selectStyles = useMemo(() => makeSelectStyles(isDark), [isDark]);

  const { getRoleLevelScope, saveRoleLevelScope, clearRoleLevelScope } = useRolesAccess(appState, t);

  // si no vienen options, fabrícalas desde los prefetched
  const sucsOpts = useMemo(() => {
    if (sucursalesOptions?.length) return sucursalesOptions;
    return (prefetchedSucursales || []).map(s => ({
      value: Number(s?.id_sucursal),
      label: `#${s?.id_sucursal}${s?.sigla ? `  · ${s.sigla}` : ''}${s?.nombre ? `  · ${s.nombre}` : ''}` ,
    }));
  }, [sucursalesOptions, prefetchedSucursales]);

  const empOpts = useMemo(() => {
    if (empresasOptions?.length) return empresasOptions;
    return (prefetchedEmpresas || []).map(e => ({
      value: String(e?._id),
      label: `${e?.nombre || ''}${e?.slug ? `  · ${e.slug}` : ''} · (${e?._id})` ,
    }));
  }, [empresasOptions, prefetchedEmpresas]);

  const [banner, setBanner] = useState({ type: null, msg: null });
  const [selectedRoleLevel, setSelectedRoleLevel] = useState(null);

  const [allowAllSuc, setAllowAllSuc] = useState(false);
  const [allowAllEmp, setAllowAllEmp] = useState(false);
  const [selSucursales, setSelSucursales] = useState([]); // [{ value: 101, label: 'LFD' }, ...]
  const [selEmpresas, setSelEmpresas] = useState([]);     // [{ value: '66fa...', label: 'LPI' }, ...]

  const load = async () => {
    try {
      setBanner({ type: null, msg: null });
      const rl = selectedRoleLevel?.value;
      if (!rl) return;

      const res = await getRoleLevelScope({ role_level: rl });

      setAllowAllSuc(!!res?.allow_all_sucursales);
      setAllowAllEmp(!!res?.allow_all_companies);

      setSelSucursales(
        (res?.sucursal_ids || []).map((id) => {
          const opt = (sucsOpts || []).find((o) => Number(o.value) === Number(id));
          return opt || { value: Number(id), label: String(id) };
        })
      );
      setSelEmpresas(
        (res?.empresa_ids || []).map((id) => {
          const opt = (empOpts || []).find((o) => String(o.value) === String(id));
          return opt || { value: String(id), label: String(id) };
        })
      );
    } catch {
      setBanner({ type: 'err', msg: t?.('empresa.load_error') || 'Error al cargar' });
    }
  };

  useEffect(() => {
    if (selectedRoleLevel?.value) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleLevel?.value]);

  const onSave = async () => {
    try {
      const rl = selectedRoleLevel?.value;
      if (!rl) {
        return setBanner({ type: 'err', msg: t?.('empresa.role_required') || 'Debes elegir un rol' });
      }
      await saveRoleLevelScope({
        role_level: rl,
        allow_all_companies: allowAllEmp,
        allow_all_sucursales: allowAllSuc,
        empresa_ids: allowAllEmp ? [] : selEmpresas.map((o) => String(o.value)),
        sucursal_ids: allowAllSuc ? [] : selSucursales.map((o) => Number(o.value)),
      });
      setBanner({ type: 'ok', msg: t?.('empresa.saved') || 'Guardado' });
    } catch {
      setBanner({ type: 'err', msg: t?.('empresa.save_error') || 'Error al guardar' });
    }
  };

  const onClear = async () => {
    try {
      const rl = selectedRoleLevel?.value;
      if (!rl) return;
      await clearRoleLevelScope({ role_level: rl });
      setAllowAllEmp(false);
      setAllowAllSuc(false);
      setSelEmpresas([]);
      setSelSucursales([]);
      setBanner({ type: 'ok', msg: t?.('empresa.cleared') || 'Configuración eliminada' });
    } catch {
      setBanner({ type: 'err', msg: t?.('empresa.clear_error') || 'Error al eliminar' });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t?.('empresa.role_scopes_title') || 'Visibilidad por nivel de rol'}
        </h3>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <RefreshCw className="h-4 w-4" />
          {t?.('empresa.refresh') || 'Refrescar'}
        </button>
      </div>

      {banner.msg && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2 ${
            banner.type === 'ok'
              ? 'border-green-300/40 bg-green-500/10 text-green-600 dark:border-green-500/30 dark:text-green-400'
              : 'border-red-300/40 bg-red-500/10 text-red-600 dark:border-red-500/30 dark:text-red-400'
          }`}
        >
          <span className="text-sm">{banner.msg}</span>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm mb-1">{t?.('empresa.role_level') || 'Nivel de rol'}</label>
          <Select
            isClearable
            options={ROLE_LEVEL_OPTIONS}
            value={selectedRoleLevel}
            onChange={setSelectedRoleLevel}
            styles={selectStyles}
            classNamePrefix="vxselect"
            className="text-sm"
            placeholder={t?.('empresa.choose_role_level') || 'Elige nivel de rol'}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-sm mb-1">{t?.('empresa.allow_all_sucursales') || 'Todas las sucursales'}</label>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allowAllSuc}
            onChange={(e) => setAllowAllSuc(e.target.checked)}
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-sm mb-1">{t?.('empresa.allow_all_companies') || 'Todas las empresas'}</label>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allowAllEmp}
            onChange={(e) => setAllowAllEmp(e.target.checked)}
          />
        </div>

        {!allowAllSuc && (
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">{t?.('empresa.sucursales_allowed') || 'Sucursales permitidas'}</label>
            <Select
              isMulti
              options={sucsOpts}
              value={selSucursales}
              onChange={setSelSucursales}
              styles={selectStyles}
              classNamePrefix="vxselect"
              className="text-sm"
              placeholder={t?.('empresa.choose_sucursales') || 'Elegir sucursales'}
            />
          </div>
        )}

        {!allowAllEmp && (
          <div className="md:col-span-3">
            <label className="block text-sm mb-1">{t?.('empresa.empresas_allowed') || 'Empresas permitidas'}</label>
            <Select
              isMulti
              options={empOpts}
              value={selEmpresas}
              onChange={setSelEmpresas}
              styles={selectStyles}
              classNamePrefix="vxselect"
              className="text-sm"
              placeholder={t?.('empresa.choose_empresas') || 'Elegir empresas'}
            />
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onSave}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
        >
          <Save className="h-4 w-4" />
          {t?.('empresa.save') || 'Guardar'}
        </button>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-4 w-4" />
          {t?.('empresa.clear') || 'Eliminar configuración'}
        </button>
      </div>
    </>
  );
};

export default RoleScopesTab;
