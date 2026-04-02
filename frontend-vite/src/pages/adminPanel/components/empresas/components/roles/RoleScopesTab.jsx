// src/pages/adminPanel/components/empresas/components/roles/RoleScopesTab.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { Save, Trash2, RefreshCw, Shield, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useIsDark, makeSelectStyles, ROLE_LEVEL_OPTIONS } from './common';
import useRolesAccess from '../../../../../../hooks/useRolesAccess.jsx';

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

const RoleScopesTab = ({
  appState,
  t,
  sucursalesOptions = [],
  empresasOptions = [],
  prefetchedSucursales = [],
  prefetchedEmpresas = [],
}) => {
  const isDark = useIsDark();
  const selectStyles = useMemo(() => makeSelectStyles(isDark), [isDark]);

  const { getRoleLevelScope, saveRoleLevelScope, clearRoleLevelScope } = useRolesAccess(appState, t);

  const sucsOpts = useMemo(() => {
    if (sucursalesOptions?.length) return sucursalesOptions;
    return (prefetchedSucursales || []).map(s => ({
      value: Number(s?.id_sucursal),
      label: `#${s?.id_sucursal}${s?.sigla ? `  · ${s.sigla}` : ''}${s?.nombre ? `  · ${s.nombre}` : ''}`,
    }));
  }, [sucursalesOptions, prefetchedSucursales]);

  const empOpts = useMemo(() => {
    if (empresasOptions?.length) return empresasOptions;
    return (prefetchedEmpresas || []).map(e => ({
      value: String(e?._id),
      label: `${e?.nombre || ''}${e?.slug ? `  · ${e.slug}` : ''} · (${e?._id})`,
    }));
  }, [empresasOptions, prefetchedEmpresas]);

  const [banner, setBanner] = useState({ type: null, msg: null });
  const [selectedRoleLevel, setSelectedRoleLevel] = useState(null);

  const [allowAllSuc, setAllowAllSuc] = useState(false);
  const [allowAllEmp, setAllowAllEmp] = useState(false);
  const [selSucursales, setSelSucursales] = useState([]);
  const [selEmpresas, setSelEmpresas] = useState([]);

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
      setBanner({ type: 'ok', msg: t?.('empresa.saved') || 'Guardado correctamente' });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/20 to-indigo-500/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t?.('empresa.role_scopes_title') || 'Visibilidad por nivel de rol'}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t?.('empresa.role_scopes_desc') || 'Configura qué puede ver cada nivel de wallet'}</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold shadow-sm transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          {t?.('empresa.refresh') || 'Refrescar'}
        </motion.button>
      </div>

      {/* Banner */}
      <AnimatePresence>
        {banner.msg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
              banner.type === 'ok'
                ? 'border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'border-red-500/20 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
            }`}
          >
            {banner.type === 'ok' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <span className="text-sm font-medium">{banner.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Level Selector — prominent card */}
      <div className="bg-white/40 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl p-6 space-y-6">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">{t?.('empresa.role_level') || 'Nivel de Rol'}</label>
          <Select
            isClearable
            options={ROLE_LEVEL_OPTIONS}
            value={selectedRoleLevel}
            onChange={setSelectedRoleLevel}
            styles={selectStyles}
            classNamePrefix="vxselect"
            className="text-sm font-medium max-w-lg"
            placeholder={t?.('empresa.choose_role_level') || 'Selecciona un nivel de rol...'}
          />
        </div>

        {selectedRoleLevel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl">
              <Toggle checked={allowAllSuc} onChange={setAllowAllSuc} label={t?.('empresa.allow_all_sucursales') || 'Permitir todas las sucursales'} />
              <Toggle checked={allowAllEmp} onChange={setAllowAllEmp} label={t?.('empresa.allow_all_companies') || 'Permitir todas las empresas'} />
            </div>

            {/* Conditional selectors */}
            <AnimatePresence>
              {!allowAllSuc && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" /> {t?.('empresa.sucursales_allowed') || 'Sucursales permitidas'}
                  </label>
                  <Select
                    isMulti
                    options={sucsOpts}
                    value={selSucursales}
                    onChange={setSelSucursales}
                    styles={selectStyles}
                    classNamePrefix="vxselect"
                    className="text-sm font-medium"
                    placeholder={t?.('empresa.choose_sucursales') || 'Elegir sucursales...'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!allowAllEmp && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" /> {t?.('empresa.empresas_allowed') || 'Empresas permitidas'}
                  </label>
                  <Select
                    isMulti
                    options={empOpts}
                    value={selEmpresas}
                    onChange={setSelEmpresas}
                    styles={selectStyles}
                    classNamePrefix="vxselect"
                    className="text-sm font-medium"
                    placeholder={t?.('empresa.choose_empresas') || 'Elegir empresas...'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClear}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold text-sm transition-all"
              >
                <Trash2 className="h-4 w-4" />
                {t?.('empresa.clear') || 'Eliminar configuración'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSave}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 text-white font-bold text-sm shadow-lg shadow-primary-500/20 transition-all"
              >
                <Save className="h-4 w-4" />
                {t?.('empresa.save') || 'Guardar'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RoleScopesTab;
