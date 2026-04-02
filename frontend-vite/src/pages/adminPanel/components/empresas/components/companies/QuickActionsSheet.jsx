import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from 'react-select';
import { X, Loader2, Settings2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
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

  if (!portalTarget) return null;
  
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[2147482000] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-[2147483000]
                       bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl text-gray-900 dark:text-white
                       border-t border-gray-200 dark:border-gray-800
                       rounded-t-[32px] shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Grabber Handle */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-primary-500/20 flex items-center justify-center">
                     <Settings2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                 </div>
                 <div className="font-semibold text-lg">{t('empresa.quick_actions') || 'Acciones Rápidas'}</div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 bg-gray-50 dark:bg-gray-800/50 transition-colors"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <div className="px-6 py-5 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">{t('empresa.incluir_resumen2_multi') || 'Incluir por Resumen2'}</label>
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
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">{t('empresa.excluir_resumen2_multi') || 'Excluir por Resumen2'}</label>
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
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">{t('empresa.incluir_cuentas_ids') || 'Incluir Cuentas (IDs)'}</label>
                  <input
                    className="w-full px-4 py-3 rounded-2xl border bg-gray-50/50 dark:bg-black/20
                               border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500
                               dark:border-gray-800 dark:focus:ring-primary-500 transition-all text-sm"
                    value={idsIn}
                    onChange={(e) => setIdsIn(e.target.value)}
                    placeholder="Ej: 101, 202, 303"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">{t('empresa.excluir_cuentas_ids') || 'Excluir Cuentas (IDs)'}</label>
                  <input
                    className="w-full px-4 py-3 rounded-2xl border bg-gray-50/50 dark:bg-black/20
                               border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500
                               dark:border-gray-800 dark:focus:ring-primary-500 transition-all text-sm"
                    value={idsEx}
                    onChange={(e) => setIdsEx(e.target.value)}
                    placeholder="Ej: 404, 505, 606"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-3 pb-8">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-base shadow-lg
                           bg-gradient-to-r from-primary-500 to-indigo-500 active:from-primary-600 active:to-indigo-600
                           disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                onClick={doApply}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {t('common.apply') || 'Aplicar Cambios'}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 rounded-2xl border border-gray-200 bg-white active:bg-gray-50 text-gray-700 font-bold text-base shadow-sm
                           dark:border-gray-700 dark:bg-gray-800 dark:active:bg-gray-700 dark:text-gray-300 transition-colors"
                onClick={onClose}
                disabled={loading}
              >
                {t('common.cancel') || 'Cancelar'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalTarget
  );
};

export default QuickActionsSheet;
