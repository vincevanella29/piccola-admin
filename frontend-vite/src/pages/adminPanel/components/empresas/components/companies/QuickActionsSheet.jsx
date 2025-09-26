import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from 'react-select';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { makeSelectStyles, parseIds, useIsDark } from './QuickActionsCommon';

const QuickActionsSheet = ({
  open,
  onClose,
  empresa,
  resumen2Options = [],
  onIncludeByResumen2,
  onExcludeByResumen2,
  onIncludeCuentas,
  onExcludeCuentas,
}) => {
  const { t } = useTranslation();
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const isDark = useIsDark();
  const selectStyles = useMemo(() => makeSelectStyles(isDark), [isDark]);

  const [loading, setLoading] = useState(false);
  const [r2In, setR2In] = useState([]);
  const [r2Ex, setR2Ex] = useState([]);
  const [idsIn, setIdsIn] = useState('');
  const [idsEx, setIdsEx] = useState('');

  useEffect(() => {
    if (!open) return;
    setR2In((empresa?.resumen2_include || []).map((v) => ({ value: String(v), label: String(v) })));
    setR2Ex((empresa?.resumen2_exclude || []).map((v) => ({ value: String(v), label: String(v) })));
  }, [open, empresa]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const doApply = async () => {
    try {
      setLoading(true);
      const empresaId = empresa?._id || empresa?.id;
      if (r2In.length && onIncludeByResumen2) await onIncludeByResumen2(empresaId, r2In.map((o) => String(o.value)));
      if (r2Ex.length && onExcludeByResumen2) await onExcludeByResumen2(empresaId, r2Ex.map((o) => String(o.value)));
      const incIds = parseIds(idsIn);
      const excIds = parseIds(idsEx);
      if (incIds.length && onIncludeCuentas) await onIncludeCuentas(empresaId, incIds);
      if (excIds.length && onExcludeCuentas) await onExcludeCuentas(empresaId, excIds);
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  if (!open || !portalTarget) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[2147482000] bg-black/50"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[2147483000]
                   bg-light-surface text-light-text-primary dark:bg-dark-surface dark:text-dark-text-primary
                   border-t border-light-border dark:border-dark-border
                   rounded-t-2xl shadow-modal transition-transform duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-light-border dark:border-dark-border">
          <div className="font-medium">{t('empresa.quick_actions') || 'Acciones rápidas'}</div>
          <button
            className="p-1 rounded-md hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs mb-1 opacity-80">{t('empresa.incluir_resumen2_multi') || 'Incluir por Resumen2'}</label>
              <Select
                isMulti
                options={resumen2Options}
                value={r2In}
                onChange={setR2In}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                menuPortalTarget={portalTarget}
                menuPosition="fixed"
                placeholder={t('empresa.select_resumen2_incluir_placeholder') || 'Selecciona…'}
              />
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-80">{t('empresa.excluir_resumen2_multi') || 'Excluir por Resumen2'}</label>
              <Select
                isMulti
                options={resumen2Options}
                value={r2Ex}
                onChange={setR2Ex}
                styles={selectStyles}
                classNamePrefix="vxselect"
                className="text-sm"
                menuPortalTarget={portalTarget}
                menuPosition="fixed"
                placeholder={t('empresa.select_resumen2_excluir_placeholder') || 'Selecciona…'}
              />
            </div>

            <div>
              <label className="block text-xs mb-1 opacity-80">{t('empresa.incluir_cuentas_ids') || 'Incluir cuentas (IDs, coma/espacio)'}</label>
              <input
                className="w-full px-3 py-2 rounded-md border bg-transparent
                           border-light-border focus:outline-none focus:ring-2 focus:ring-light-accent
                           dark:border-dark-border dark:focus:ring-dark-accent"
                value={idsIn}
                onChange={(e) => setIdsIn(e.target.value)}
                placeholder="101, 202, 303"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 opacity-80">{t('empresa.excluir_cuentas_ids') || 'Excluir cuentas (IDs, coma/espacio)'}</label>
              <input
                className="w-full px-3 py-2 rounded-md border bg-transparent
                           border-light-border focus:outline-none focus:ring-2 focus:ring-light-accent
                           dark:border-dark-border dark:focus:ring-dark-accent"
                value={idsEx}
                onChange={(e) => setIdsEx(e.target.value)}
                placeholder="404 505 606"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-light-border dark:border-dark-border flex items-center justify-end gap-2">
          <button
            className="px-3 py-2 rounded-md border border-light-border hover:bg-light-surface-secondary/60
                       dark:border-dark-border dark:hover:bg-dark-surface-secondary/60"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel') || 'Cancelar'}
          </button>
          <button
            className="px-4 py-2 rounded-md text-white
                       bg-light-accent hover:bg-light-accent-hover
                       dark:bg-dark-accent dark:hover:bg-dark-accent-hover
                       disabled:opacity-60 inline-flex items-center gap-2"
            onClick={doApply}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.apply') || 'Aplicar'}
          </button>
        </div>
      </div>
    </>,
    portalTarget
  );
};

export default QuickActionsSheet;
