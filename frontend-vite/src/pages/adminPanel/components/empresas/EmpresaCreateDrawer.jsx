// src/pages/adminPanel/components/empresas/EmpresaCreateDrawer.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

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
    background: 'transparent',
    borderColor: state.isFocused
      ? (isDark ? 'var(--dark-accent, #009246)' : 'var(--light-accent, #009246)')
      : (isDark ? 'var(--dark-border, #333333)' : 'var(--light-border, #D1D5DB)'),
    boxShadow: state.isFocused
      ? `0 0 0 3px rgba(${isDark ? 'var(--matrix-green-rgb, 0, 146, 70)' : 'var(--matrix-green-rgb, 0, 146, 70)'}, .25)`
      : 'none',
    minHeight: 44,
    ':hover': {
      borderColor: isDark ? 'var(--dark-accent, #009246)' : 'var(--light-accent, #009246)',
    },
  }),
  menu: (base) => ({
    ...base,
    background: isDark ? 'var(--dark-surface, #1A1A1A)' : 'var(--light-surface, #FFFFFF)',
    border: `1px solid ${isDark ? 'var(--dark-border, #333333)' : 'var(--light-border, #D1D5DB)'}`,
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'rgba(0,146,70,.12)' : 'transparent',
    color: 'inherit',
  }),
  multiValue: (base) => ({
    ...base,
    background: 'rgba(0,146,70,.14)',
  }),
  multiValueLabel: (base) => ({ ...base, color: 'inherit' }),
  input: (base) => ({ ...base, color: 'inherit' }),
  singleValue: (base) => ({ ...base, color: 'inherit' }),
  placeholder: (base) => ({ ...base, color: isDark ? 'var(--dark-text-secondary, #B0B0B0)' : 'var(--light-text-secondary, #6B7280)' }),
});

/* ----------------------------- modal pieces ------------------------------ */
const ModalBackdrop = ({ children, onClose }) => (
  <motion.div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-[100] flex items-center justify-center"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <div className="absolute inset-0 bg-black/60" />
    {children}
  </motion.div>
);

const ModalPanel = ({ children, onClose, title, closeLabel }) => (
  <motion.div
    className="
      relative z-[101] w-full max-w-5xl mx-4
      rounded-3xl border
      bg-light-surface text-light-text-primary border-light-border shadow-modal
      dark:bg-dark-surface dark:text-dark-text-primary dark:border-dark-border
      overflow-hidden
    "
    initial={{ y: 24, scale: 0.98, opacity: 0 }}
    animate={{ y: 0, scale: 1, opacity: 1 }}
    exit={{ y: 24, scale: 0.98, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    onClick={(e) => e.stopPropagation()}
  >
    {/* header */}
    <div
      className="
        sticky top-0 flex items-center justify-between px-6 py-4
        bg-light-surface/90 border-b border-light-border backdrop-blur-sm
        dark:bg-dark-surface/90 dark:border-dark-border
      "
    >
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <button
        className="
          p-2 rounded-md
          hover:bg-light-surface-secondary/60
          dark:hover:bg-dark-surface-secondary/60
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-accent dark:focus:ring-dark-accent
        "
        onClick={onClose}
        aria-label={closeLabel || 'Cerrar'}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
    {/* body */}
    <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-none">{children}</div>
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

  return (
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
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    banner.type === 'ok'
                      ? 'border-light-success/40 bg-light-success/10 text-light-accent dark:border-dark-success/40 dark:bg-dark-success/10 dark:text-dark-success'
                      : 'border-light-error/40 bg-light-error/10 text-light-error dark:border-dark-error/40 dark:bg-dark-error/10 dark:text-dark-error'
                  }`}
                >
                  {banner.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span className="text-sm">{banner.msg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Datos base */}
            <section className="space-y-3 mb-6">
              <div>
                <label className="block text-sm mb-1">{t?.('empresa.nombre') || 'Nombre'}</label>
                <input
                  className="w-full px-3 py-2 rounded-md border bg-transparent
                             border-light-border focus:outline-none focus:ring-2 focus:ring-light-accent
                             dark:border-dark-border dark:focus:ring-dark-accent"
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder={t?.('empresa.name_placeholder') || 'Mi Empresa S.A.'}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">{t?.('empresa.slug_label') || 'Slug'}</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border bg-transparent
                               border-light-border focus:outline-none focus:ring-2 focus:ring-light-accent
                               dark:border-dark-border dark:focus:ring-dark-accent"
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder={t?.('empresa.slug_placeholder') || 'mi-empresa'}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">{t?.('common.description') || 'Descripción'}</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border bg-transparent
                               border-light-border focus:outline-none focus:ring-2 focus:ring-light-accent
                               dark:border-dark-border dark:focus:ring-dark-accent"
                    value={form.descripcion}
                    onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                    placeholder={t?.('empresa.description_placeholder') || 'Opcional'}
                  />
                </div>
              </div>
            </section>

            {/* Sucursales */}
            <section className="mb-6">
              <h4 className="text-sm font-semibold mb-2">{t?.('empresa.sucursales_multi') || 'Sucursales (multi)'}</h4>
              <Select
                isMulti
                isSearchable
                options={sucOptions}
                value={selectedSucursales}
                onChange={setSelectedSucursales}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                placeholder={t?.('empresa.select_sucursales_placeholder') || 'Selecciona sucursales…'}
              />
            </section>

            {/* Incluir por Cuentas */}
            <section className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">{t?.('empresa.incluir_cuentas_multi') || 'Incluir por Cuentas (multi)'}</h4>
                <span className="text-xs opacity-70">
                  {(t && t('empresa.total_cuentas', { count: (prefetchedCuentas || []).length })) || `Total cuentas: ${(prefetchedCuentas || []).length}`}
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
                className="text-sm"
                placeholder={t?.('empresa.select_cuentas_incluir_placeholder') || 'Selecciona cuentas a incluir…'}
              />
            </section>

            {/* Incluir por Resumen2 */}
            <section className="mb-6">
              <h4 className="text-sm font-semibold mb-2">{t?.('empresa.incluir_resumen2_multi') || 'Incluir por Resumen2 (multi)'}</h4>
              <Select
                isMulti
                isSearchable
                options={resumen2Options}
                value={selectedIncludeR2}
                onChange={setSelectedIncludeR2}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                placeholder={t?.('empresa.select_resumen2_incluir_placeholder') || 'Selecciona etiquetas resumen2 a incluir…'}
              />
            </section>

            {/* Excluir por Cuentas */}
            <section className="mb-6">
              <h4 className="text-sm font-semibold mb-2">{t?.('empresa.excluir_cuentas_multi') || 'Excluir por Cuentas (multi)'}</h4>
              <Select
                isMulti
                isSearchable
                options={ctaOptions}
                value={selectedExcludeCtas}
                onChange={setSelectedExcludeCtas}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                placeholder={t?.('empresa.select_cuentas_excluir_placeholder') || 'Selecciona cuentas a excluir…'}
              />
            </section>

            {/* Excluir por Resumen2 */}
            <section className="mb-8">
              <h4 className="text-sm font-semibold mb-2">{t?.('empresa.excluir_resumen2_multi') || 'Excluir por Resumen2 (multi)'}</h4>
              <Select
                isMulti
                isSearchable
                options={resumen2Options}
                value={selectedExcludeR2}
                onChange={setSelectedExcludeR2}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                placeholder={t?.('empresa.select_resumen2_excluir_placeholder') || 'Selecciona etiquetas resumen2 a excluir…'}
              />
            </section>

            {/* actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                className="px-4 py-2 rounded-md border
                           border-light-border hover:bg-light-surface-secondary/60
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-accent
                           dark:border-dark-border dark:hover:bg-dark-surface-secondary/60 dark:focus:ring-dark-accent"
                onClick={onClose}
                disabled={submitting}
              >
                {t?.('common.cancel') || 'Cancelar'}
              </button>
              <button
                className="px-4 py-2 rounded-md text-white
                           bg-light-accent hover:bg-light-accent-hover shadow-neon
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-light-accent
                           disabled:opacity-50
                           dark:bg-dark-accent dark:hover:bg-dark-accent-hover dark:focus:ring-dark-accent"
                onClick={handleCreate}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t?.('common.saving') || 'Guardando'}
                  </span>
                ) : (
                  isEdit ? (t?.('common.save_changes') || 'Guardar cambios') : (t?.('empresa.create') || 'Crear empresa')
                )}
              </button>
            </div>
          </ModalPanel>
        </ModalBackdrop>
      )}
    </AnimatePresence>
  );
};

export default EmpresaCreateDrawer;
