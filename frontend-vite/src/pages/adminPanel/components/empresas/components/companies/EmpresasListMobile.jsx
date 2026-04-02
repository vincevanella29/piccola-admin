import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, Wrench, Edit3, Building2 } from 'lucide-react';
import QuickActionsSheet from './QuickActionsSheet';

const EmpresasListMobile = ({
  items = [],
  total = 0,
  page = 1,
  limit = 10,
  loading = false,
  q = '',
  error = null,
  onSearchChange,
  onPageChange,
  onSelectEmpresa,
  onRefresh,
  onChangeLimit,
  resumen2Options = [],
  onIncludeByResumen2,
  onExcludeByResumen2,
  onIncludeCuentas,
  onExcludeCuentas,
}) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 10)));
  const [sheetFor, setSheetFor] = useState(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* toolbar mobile */}
      <div className="flex flex-col gap-3 bg-light-surface/40 dark:bg-dark-surface/40 p-3 flex-wrap rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
          <input
            className="w-full pl-11 pr-4 py-3 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:outline-none backdrop-blur-md transition-all text-sm"
            placeholder={t('common.search_placeholder') || 'Buscar empresa...'}
            value={q}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRefresh?.(); }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 min-w-[120px] justify-center px-4 py-2.5 rounded-2xl text-white font-medium bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 shadow-md shadow-primary-500/20 transition-all flex items-center gap-2"
            onClick={() => onRefresh?.()}
          >
            <Search className="w-4 h-4" />
            <span className="font-bold">{t('common.search')}</span>
          </motion.button>

          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/30 px-3 py-2 rounded-2xl border border-gray-200 dark:border-gray-800">
            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('common.per_page') || 'Por pág.'}</span>
            <select
              className="bg-transparent text-sm font-bold text-gray-900 dark:text-white focus:outline-none appearance-none pr-1"
              value={limit}
              onChange={(e) => onChangeLimit?.(Number(e.target.value))}
            >
              {[10, 25, 50].map((n) => <option key={n} value={n} className="dark:bg-gray-900">{n}</option>)}
            </select>
          </div>
        </div>
        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1">
            {t('common.total')}: <span className="text-gray-900 dark:text-gray-100">{total}</span>
        </div>
      </div>

      {/* cards */}
      <motion.div 
        className="grid grid-cols-1 gap-4"
        initial="hidden"
        animate="show"
        variants={containerVariants}
      >
        {loading ? (
          <div className="px-4 py-12 flex flex-col items-center justify-center gap-3 text-gray-500 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-black/20 backdrop-blur-xl">
             <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin shadow-primary-500/50 shadow-lg" />
             <span className="font-medium animate-pulse">{t('common.loading')}...</span>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-500 font-bold dark:text-red-400 rounded-3xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 backdrop-blur-xl">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 italic rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-black/20 backdrop-blur-xl">
            {t('common.no_results')}
          </div>
        ) : (
          items.map((it) => {
            const incCount = Array.isArray(it.cuentas_include) ? it.cuentas_include.length : 0;
            const excCount = Array.isArray(it.cuentas_exclude) ? it.cuentas_exclude.length : 0;
            const r2iCount = Array.isArray(it.resumen2_include) ? it.resumen2_include.length : 0;
            const r2eCount = Array.isArray(it.resumen2_exclude) ? it.resumen2_exclude.length : 0;

            return (
              <motion.div
                key={it._id}
                variants={itemVariants}
                className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-dark-surface/60 p-4 shadow-sm backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center shadow-md shrink-0">
                       <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <div className="text-sm font-bold text-gray-900 dark:text-white capitalize leading-tight">{it.nombre}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-mono tracking-tight text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-1.5 py-0.5 rounded shadow-sm border border-gray-200 dark:border-gray-700">
                               {it._id}
                            </span>
                            {it.slug && (
                               <span className="text-[9px] uppercase font-black text-indigo-500 dark:text-indigo-400 tracking-wider">@{it.slug}</span>
                            )}
                        </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                    onClick={() => onSelectEmpresa?.(it)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shadow-sm">
                    {t('empresa.sucursales')}: {Array.isArray(it.sucursales) ? it.sucursales.length : 0}
                  </span>
                  
                  {incCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">INC CTA: {incCount}</span>}
                  {excCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">EXC CTA: {excCount}</span>}
                  {r2iCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">INC R2: {r2iCount}</span>}
                  {r2eCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">EXC R2: {r2eCount}</span>}
                </div>

                <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl font-semibold text-sm
                               border border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 shadow-sm text-gray-700
                               dark:border-gray-700 dark:bg-gray-800/80 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
                    onClick={() => setSheetFor(it)}
                  >
                    <Wrench className="h-4 w-4" />
                    {t('common.configure') || 'Configurar Reglas'}
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-light-surface/40 dark:bg-dark-surface/40 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-sm mb-4">
        <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-black/30 px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-800">
            {t('common.page')} <span className="text-gray-900 dark:text-white mx-1">{page}</span> / <span className="text-gray-900 dark:text-white mx-1">{totalPages}</span>
        </div>
        <div className="flex items-center gap-3 w-full justify-center">
          <motion.button
            whileHover={{ scale: page <= 1 ? 1 : 1.05 }}
            whileTap={{ scale: page <= 1 ? 1 : 0.95 }}
            className={`flex-1 max-w-[120px] py-2.5 rounded-2xl border flex items-center justify-center transition-all ${page <= 1 ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 bg-transparent' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow text-gray-700 dark:text-gray-300'}`}
            disabled={page <= 1 || loading}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: page >= totalPages ? 1 : 1.05 }}
            whileTap={{ scale: page >= totalPages ? 1 : 0.95 }}
            className={`flex-1 max-w-[120px] py-2.5 rounded-2xl border flex items-center justify-center transition-all ${page >= totalPages ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 bg-transparent' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow text-gray-700 dark:text-gray-300'}`}
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange?.(page + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      <QuickActionsSheet
        open={!!sheetFor}
        onClose={() => setSheetFor(null)}
        empresa={sheetFor || {}}
        resumen2Options={resumen2Options}
        onIncludeByResumen2={onIncludeByResumen2}
        onExcludeByResumen2={onExcludeByResumen2}
        onIncludeCuentas={onIncludeCuentas}
        onExcludeCuentas={onExcludeCuentas}
      />
    </div>
  );
};

export default EmpresasListMobile;
