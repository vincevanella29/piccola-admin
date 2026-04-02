// src/pages/adminPanel/components/empresas/EmpresaCreateDrawer.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { X, Loader2, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';

/* ----------------------------- helpers theme ----------------------------- */
const useIsDark = () => {
  const get = () => (typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false);
  const [isDark, setIsDark] = useState(get);
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

const makeSelectStyles = (isDark) => ({
  control: (base, state) => ({
    ...base,
    background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(249, 250, 251, 0.5)',
    minHeight: 48,
    borderRadius: '1rem',
    borderWidth: '1px',
    borderColor: state.isFocused
      ? (isDark ? '#6366f1' : '#6366f1') // indigo-500
      : (isDark ? 'var(--dark-border, #1f2937)' : 'var(--light-border, #e5e7eb)'),
    boxShadow: state.isFocused
      ? `0 0 0 3px rgba(99, 102, 241, .2)`
      : 'none',
    ':hover': { borderColor: '#6366f1' },
    backdropFilter: 'blur(12px)'
  }),
  menu: (base) => ({
    ...base,
    background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: '1rem',
    overflow: 'hidden',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    zIndex: 99999,
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#6366f1' : state.isFocused ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)') : 'transparent',
    color: state.isSelected ? '#ffffff' : 'inherit',
    cursor: 'pointer',
    padding: '12px 16px',
    ':active': { background: '#4f46e5' }
  }),
  multiValue: (base) => ({ 
      ...base, 
      background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
      borderRadius: '8px',
      margin: '2px 4px 2px 0'
  }),
  multiValueLabel: (base) => ({ 
      ...base, 
      color: isDark ? '#a5b4fc' : '#4338ca',
      fontWeight: '600',
      fontSize: '0.85rem',
      padding: '4px 8px',
  }),
  multiValueRemove: (base) => ({
      ...base,
      borderRadius: '0 8px 8px 0',
      ':hover': {
          background: 'rgba(239,68,68,0.2)',
          color: '#ef4444'
      }
  }),
  input: (base) => ({ ...base, color: 'inherit' }),
  singleValue: (base) => ({ ...base, color: 'inherit' }),
  placeholder: (base) => ({ ...base, color: isDark ? '#9ca3af' : '#6b7280' }),
});

/* ----------------------------- modal pieces ------------------------------ */
const ModalBackdrop = ({ children, onClose }) => (
  <motion.div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    {children}
  </motion.div>
);

const ModalPanel = ({ children, onClose, title, closeLabel }) => (
  <motion.div
    className="
      relative z-[101] w-full max-w-5xl mx-auto
      rounded-[32px] border shadow-2xl backdrop-blur-xl
      bg-white/95 text-gray-900 border-gray-200
      dark:bg-gray-900/95 dark:text-white dark:border-gray-800
      flex flex-col max-h-[90vh] overflow-hidden
    "
    initial={{ y: 20, scale: 0.95, opacity: 0 }}
    animate={{ y: 0, scale: 1, opacity: 1 }}
    exit={{ y: 20, scale: 0.95, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    onClick={(e) => e.stopPropagation()}
  >
    {/* header */}
    <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/60 bg-white/40 dark:bg-black/20">
      <div className="flex items-center gap-3">
         <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/20 to-indigo-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
         </div>
         <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      </div>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors bg-gray-50 dark:bg-gray-800/50"
        onClick={onClose}
        aria-label={closeLabel || 'Cerrar'}
      >
        <X className="h-5 w-5" />
      </motion.button>
    </div>
    {/* body */}
    <div className="flex-1 overflow-y-auto scrollbar-none p-6">{children}</div>
  </motion.div>
);

/* ------------------------------- component ------------------------------- */
function sucLabel(s) {
  const id = s?.id_sucursal ?? s?.value ?? s;
  const sigla = s?.sigla || '';
  const nombre = s?.location?.nombre || s?.label || '';
  return `#${id}${sigla ? ` · ${sigla}` : ''}${nombre ? ` · ${nombre}` : ''}`;
}
function ctaLabel(c) {
  const id = c?.cuenta ?? c?.value ?? c;
  const name = c?.nombre_cuenta || c?.label || '';
  const r2 = c?.resumen2 || '';
  return `#${id}${name ? ` · ${name}` : ''}${r2 ? ` · ${r2}` : ''}`;
}

const EmpresaCreateDrawer = ({
  open,
  onClose,
  onCreated,
  onUpdated,
  createEmpresa,
  updateEmpresa,
  includeByResumen2, // fn( {empresaId, resumen2: string[]} )
  excludeByResumen2, // fn( {empresaId, resumen2: string[]} )
  prefetchedSucursales = [],
  prefetchedCuentas = [],
  resumen2Options = [],
  empresa, // edit mode
  t,
}) => {
  const isDark = useIsDark();
  const selectStyles = useMemo(() => makeSelectStyles(isDark), [isDark]);

  const [form, setForm] = useState({ nombre: '', slug: '', descripcion: '' });

  const [selectedSucursales, setSelectedSucursales] = useState([]);
  const [selectedIncludeCtas, setSelectedIncludeCtas] = useState([]);
  const [selectedExcludeCtas, setSelectedExcludeCtas] = useState([]);
  const [selectedIncludeR2, setSelectedIncludeR2] = useState([]);
  const [selectedExcludeR2, setSelectedExcludeR2] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: null, msg: null });

  const isEdit = !!(empresa && (empresa._id || empresa.id));

  // esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // reset/prefill al abrir
  useEffect(() => {
    if (!open) return;
    setBanner({ type: null, msg: null });

    if (!isEdit) {
      setForm({ nombre: '', slug: '', descripcion: '' });
      setSelectedSucursales([]);
      setSelectedIncludeCtas([]);
      setSelectedExcludeCtas([]);
      setSelectedIncludeR2([]);
      setSelectedExcludeR2([]);
      return;
    }
    // Prefill from empresa
    const e = empresa || {};
    setForm({
      nombre: e.nombre || '',
      slug: e.slug || '',
      descripcion: e.descripcion || '',
    });

    const sucSet = new Set((e.sucursales || []).map((s) => Number(s.id_sucursal)).filter(Number.isFinite));
    setSelectedSucursales((prefetchedSucursales || [])
      .filter((s) => sucSet.has(Number(s.id_sucursal)))
      .map((s) => ({ value: s.id_sucursal, label: sucLabel(s), _raw: s })));

    const incSet = new Set((e.cuentas_include || []).map((n) => Number(n)).filter(Number.isFinite));
    const excSet = new Set((e.cuentas_exclude || []).map((n) => Number(n)).filter(Number.isFinite));
    setSelectedIncludeCtas((prefetchedCuentas || [])
      .filter((c) => incSet.has(Number(c.cuenta)))
      .map((c) => ({ value: c.cuenta, label: ctaLabel(c), _raw: c })));
    setSelectedExcludeCtas((prefetchedCuentas || [])
      .filter((c) => excSet.has(Number(c.cuenta)))
      .map((c) => ({ value: c.cuenta, label: ctaLabel(c), _raw: c })));

    const r2i = new Set((e.resumen2_include || []).map(String));
    const r2e = new Set((e.resumen2_exclude || []).map(String));
    setSelectedIncludeR2((resumen2Options || []).filter((o) => r2i.has(String(o.value))));
    setSelectedExcludeR2((resumen2Options || []).filter((o) => r2e.has(String(o.value))));
  }, [open, isEdit, empresa, prefetchedSucursales, prefetchedCuentas, resumen2Options]);

  const sucOptions = useMemo(
    () => {
      const list = Array.isArray(prefetchedSucursales) ? prefetchedSucursales : [];
      const empresaId = empresa?._id || empresa?.id || null;
      const filtered = isEdit
        ? list.filter((s) => {
            const assigned = s?.assigned_empresa_id || null;
            const isAssigned = s?.is_assigned === true;
            // Keep if unassigned, or assigned to this empresa
            return !assigned && !isAssigned ? true : String(assigned) === String(empresaId);
          })
        : list.filter((s) => !s?.assigned_empresa_id && s?.is_assigned !== true);
      return filtered.map((s) => ({ value: s.id_sucursal, label: sucLabel(s), _raw: s }));
    },
    [prefetchedSucursales, isEdit, empresa]
  );
  const ctaOptions = useMemo(
    () => (prefetchedCuentas || []).map((c) => ({ value: c.cuenta, label: ctaLabel(c), _raw: c })),
    [prefetchedCuentas]
  );

  const canSubmit = !!form.nombre?.trim();

  const handleCreate = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setBanner({ type: null, msg: null });
    try {
      const sucursales = selectedSucursales.map((o) => Number(o.value)).filter(Number.isFinite);
      const cuentas_include = selectedIncludeCtas.map((o) => Number(o.value)).filter(Number.isFinite);
      const cuentas_exclude = selectedExcludeCtas.map((o) => Number(o.value)).filter(Number.isFinite);
      const r2_include = selectedIncludeR2.map((o) => String(o.value));
      const r2_exclude = selectedExcludeR2.map((o) => String(o.value));

      if (!isEdit) {
        const resp = await createEmpresa({
          nombre: form.nombre.trim(),
          slug: form.slug?.trim() || null,
          descripcion: form.descripcion?.trim() || null,
          sucursales: sucursales.length ? sucursales : null,
          cuentas_include: cuentas_include.length ? cuentas_include : null,
          cuentas_exclude: cuentas_exclude.length ? cuentas_exclude : null,
        });

        const empresaId = resp?._id || resp?.id || resp?.empresa?._id;
        if (empresaId) {
          if (r2_include.length) await includeByResumen2({ empresaId, resumen2: r2_include });
          if (r2_exclude.length) await excludeByResumen2({ empresaId, resumen2: r2_exclude });
        }

        setBanner({ type: 'ok', msg: t?.('empresa.created_success') || 'Empresa creada correctamente' });
        onCreated?.(resp);
      } else {
        const empresaId = empresa?._id || empresa?.id;
        const body = {
          nombre: form.nombre.trim(),
          slug: form.slug?.trim() || null,
          descripcion: form.descripcion?.trim() || null,
          sucursales,
          cuentas_include,
          cuentas_exclude,
          resumen2_include: r2_include,
          resumen2_exclude: r2_exclude,
        };
        const resp = await updateEmpresa({ empresaId, data: body });
        setBanner({ type: 'ok', msg: t?.('empresa.updated_success') || 'Empresa actualizada correctamente' });
        onUpdated?.(resp);
      }
    } catch (e) {
      const msg = e?.response?.data?.detail?.message || e?.response?.data?.detail || e?.message;
      setBanner({ type: 'err', msg: msg || (isEdit ? 'Error al actualizar empresa' : 'Error al crear empresa') });
    } finally {
      setSubmitting(false);
    }
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <ModalBackdrop onClose={onClose}>
          <ModalPanel
            onClose={onClose}
            title={
              isEdit
                ? (t?.('empresa.drawer_title_edit') || 'Editar empresa')
                : (t?.('empresa.drawer_title') || 'Crear empresa')
            }
            closeLabel={t?.('empresa.close')}
          >
            {/* Banner */}
            <AnimatePresence>
              {banner.msg && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
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

            {/* Datos base */}
            <section className="space-y-4 mb-8">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-1.5 h-6 bg-gradient-to-b from-primary-500 to-indigo-600 rounded-full" />
                 <h4 className="font-bold text-lg">{t?.('empresa.basic_info') || 'Información Básica'}</h4>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">{t?.('empresa.nombre') || 'Nombre de la Empresa'}</label>
                <input
                  className="w-full px-4 py-3 rounded-2xl border bg-gray-50/50 dark:bg-black/20 text-sm font-medium
                             border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all
                             dark:border-gray-800 dark:focus:ring-primary-500"
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder={t?.('empresa.name_placeholder') || 'Escriba un nombre...'}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">{t?.('empresa.slug_label') || 'Identificador (Slug)'}</label>
                  <input
                    className="w-full px-4 py-3 rounded-2xl border bg-gray-50/50 dark:bg-black/20 text-sm font-medium
                               border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all
                               dark:border-gray-800 dark:focus:ring-primary-500"
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder={t?.('empresa.slug_placeholder') || 'ej: mi-empresa'}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">{t?.('common.description') || 'Descripción'}</label>
                  <input
                    className="w-full px-4 py-3 rounded-2xl border bg-gray-50/50 dark:bg-black/20 text-sm font-medium
                               border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all
                               dark:border-gray-800 dark:focus:ring-primary-500"
                    value={form.descripcion}
                    onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder={t?.('empresa.description_placeholder') || 'Opciona...'}
                  />
                </div>
              </div>
            </section>

            {/* Sucursales */}
            <section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                 <h4 className="font-bold text-lg">{t?.('empresa.sucursales_multi') || 'Asignación de Sucursales'}</h4>
              </div>
              <Select
                isMulti
                isSearchable
                options={sucOptions}
                value={selectedSucursales}
                onChange={setSelectedSucursales}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm font-medium"
                placeholder={t?.('empresa.select_sucursales_placeholder') || 'Puedes asignar sucursales a esta empresa...'}
              />
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
               {/* Reglas de Inclusión */}
               <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2 mb-4">
                      <div className="px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-widest">Incluir</div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reglas Positivas</span>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t?.('empresa.incluir_cuentas_multi') || 'Por Cuentas (multi)'}</label>
                        <span className="text-[10px] font-bold opacity-70 bg-gray-200 dark:bg-gray-800 px-2 rounded-md">
                          {(t && t('empresa.total_cuentas', { count: (prefetchedCuentas || []).length })) || `Total: ${(prefetchedCuentas || []).length}`}
                        </span>
                      </div>
                      <Select
                        isMulti
                        isSearchable
                        options={ctaOptions}
                        value={selectedIncludeCtas}
                        onChange={setSelectedIncludeCtas}
                        styles={selectStyles}
                        classNamePrefix="vxselect"
                        className="text-sm shadow-sm"
                        placeholder={t?.('empresa.select_cuentas_incluir_placeholder') || 'Añadir cuentas...'}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">{t?.('empresa.incluir_resumen2_multi') || 'Por Resumen2 (multi)'}</label>
                      <Select
                        isMulti
                        isSearchable
                        options={resumen2Options}
                        value={selectedIncludeR2}
                        onChange={setSelectedIncludeR2}
                        styles={selectStyles}
                        classNamePrefix="vxselect"
                        className="text-sm shadow-sm"
                        placeholder={t?.('empresa.select_resumen2_incluir_placeholder') || 'Añadir etiquetas resumen2...'}
                      />
                    </div>
                  </div>
               </div>

               {/* Reglas de Exclusión */}
               <div className="bg-red-50/50 dark:bg-red-900/10 p-5 rounded-3xl border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-2 mb-4">
                      <div className="px-2 py-1 bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold uppercase tracking-widest">Excluir</div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reglas Negativas</span>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">{t?.('empresa.excluir_cuentas_multi') || 'Por Cuentas (multi)'}</label>
                      <Select
                        isMulti
                        isSearchable
                        options={ctaOptions}
                        value={selectedExcludeCtas}
                        onChange={setSelectedExcludeCtas}
                        styles={selectStyles}
                        classNamePrefix="vxselect"
                        className="text-sm shadow-sm"
                        placeholder={t?.('empresa.select_cuentas_excluir_placeholder') || 'Bloquear cuentas...'}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">{t?.('empresa.excluir_resumen2_multi') || 'Por Resumen2 (multi)'}</label>
                      <Select
                        isMulti
                        isSearchable
                        options={resumen2Options}
                        value={selectedExcludeR2}
                        onChange={setSelectedExcludeR2}
                        styles={selectStyles}
                        classNamePrefix="vxselect"
                        className="text-sm shadow-sm"
                        placeholder={t?.('empresa.select_resumen2_excluir_placeholder') || 'Bloquear etiquetas resumen2...'}
                      />
                    </div>
                  </div>
               </div>
            </div>

            {/* actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold shadow-sm
                           dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                onClick={onClose}
                disabled={submitting}
              >
                {t?.('common.cancel') || 'Cancelar'}
              </motion.button>
              <motion.button
                whileHover={{ scale: canSubmit && !submitting ? 1.02 : 1 }}
                whileTap={{ scale: canSubmit && !submitting ? 0.98 : 1 }}
                className={`w-full sm:w-auto px-8 py-3 rounded-2xl text-white font-bold shadow-xl flex items-center justify-center transition-all ${
                   canSubmit && !submitting 
                   ? 'bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 shadow-primary-500/30' 
                   : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                }`}
                onClick={handleCreate}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> {t?.('common.saving') || 'Guardando'}
                  </span>
                ) : (
                  isEdit ? (t?.('common.save_changes') || 'Guardar cambios') : (t?.('empresa.create') || 'Crear empresa')
                )}
              </motion.button>
            </div>
          </ModalPanel>
        </ModalBackdrop>
      )}
    </AnimatePresence>,
    portalTarget
  );
};

export default EmpresaCreateDrawer;
