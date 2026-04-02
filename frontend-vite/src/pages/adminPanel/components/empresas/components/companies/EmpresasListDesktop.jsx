import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, Wrench, Edit3, Building2, Layers, Briefcase } from 'lucide-react';
import QuickActionsPopover from './QuickActionsPopover';

const EmpresasListDesktop = ({
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

  const [openIdx, setOpenIdx] = useState(null);
  const btnRefs = useRef({});

  const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-light-surface/40 dark:bg-dark-surface/40 p-3 sm:p-4 flex-wrap rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-sm hover:shadow transition-shadow">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-2xl">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              className="w-full pl-11 pr-4 py-2.5 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:outline-none backdrop-blur-md transition-all text-sm"
              placeholder={t('common.search_placeholder') || 'Buscar empresa...'}
              value={q}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onRefresh?.(); }}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 rounded-2xl text-white font-medium bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 shadow-md shadow-primary-500/20 transition-all flex items-center gap-2"
            onClick={() => onRefresh?.()}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.search')}</span>
          </motion.button>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-black/30 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800">
            {t('common.total')}: <span className="text-gray-900 dark:text-white ml-1 font-bold">{total}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/30 px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <span className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('common.per_page') || 'Por pág.'}</span>
            <select
              className="bg-transparent text-sm font-bold text-gray-900 dark:text-white focus:outline-none appearance-none pr-2 cursor-pointer"
              value={limit}
              onChange={(e) => onChangeLimit?.(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n} className="dark:bg-gray-900">{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white/40 dark:bg-black/20 backdrop-blur-xl">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
          <thead className="bg-gray-50/50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('empresa.nombre')}</th>
              <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('empresa.sucursales')}</th>
              <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('empresa.rules') || 'Reglas Activas'}</th>
              <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
            </tr>
          </thead>
          <motion.tbody 
            className="divide-y divide-gray-200 dark:divide-gray-800"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.05 } }
            }}
          >
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin shadow-primary-500/50 shadow-lg" />
                    <span className="font-medium animate-pulse">{t('common.loading')}...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-xl">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic bg-gray-50/30 dark:bg-gray-800/20">{t('common.no_results')}</td></tr>
            ) : (
              items.map((it, idx) => {
                const incCount = Array.isArray(it.cuentas_include) ? it.cuentas_include.length : 0;
                const excCount = Array.isArray(it.cuentas_exclude) ? it.cuentas_exclude.length : 0;
                const r2iCount = Array.isArray(it.resumen2_include) ? it.resumen2_include.length : 0;
                const r2eCount = Array.isArray(it.resumen2_exclude) ? it.resumen2_exclude.length : 0;

                return (
                  <motion.tr 
                    key={it._id} 
                    variants={rowVariants}
                    className="hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors group"
                  >
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center shadow-md shrink-0">
                           <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-base text-gray-900 dark:text-white capitalize">{it.nombre}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono tracking-tight text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded shadow-sm border border-gray-200 dark:border-gray-700">
                               {it._id}
                            </span>
                            {it.slug && (
                               <span className="text-[10px] uppercase font-black text-indigo-500 dark:text-indigo-400 tracking-wider">@{it.slug}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shadow-sm capitalize">
                            {Array.isArray(it.sucursales) ? it.sucursales.length : 0} {t('empresa.sucursales')}
                        </span>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        {incCount > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">INC CTA: {incCount}</span>}
                        {excCount > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">EXC CTA: {excCount}</span>}
                        {r2iCount > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">INC R2: {r2iCount}</span>}
                        {r2eCount > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">EXC R2: {r2eCount}</span>}
                        {incCount === 0 && excCount === 0 && r2iCount === 0 && r2eCount === 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">No aplicadas</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle text-right relative">
                      <div className="inline-flex items-center justify-end gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-300 transition-colors"
                          onClick={() => onSelectEmpresa?.(it)}
                          title={t('common.edit') || 'Editar'}
                        >
                          <Edit3 className="w-4 h-4" />
                        </motion.button>
                        <div className="relative">
                            <motion.button
                              ref={(el) => { btnRefs.current[idx] = el; }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`p-2 rounded-xl border flex items-center justify-center gap-2 shadow-sm transition-colors ${openIdx === idx ? 'bg-primary-500 text-white border-primary-600' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                              title={t('common.configure') || 'Configurar'}
                            >
                              <Wrench className="w-4 h-4" />
                            </motion.button>
                            {openIdx === idx && (
                              <QuickActionsPopover
                                anchorRef={{ current: btnRefs.current[idx] }}
                                empresa={it}
                                resumen2Options={resumen2Options}
                                onIncludeByResumen2={onIncludeByResumen2}
                                onExcludeByResumen2={onExcludeByResumen2}
                                onIncludeCuentas={onIncludeCuentas}
                                onExcludeCuentas={onExcludeCuentas}
                                onClose={() => setOpenIdx(null)}
                              />
                            )}
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </motion.tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-light-surface/40 dark:bg-dark-surface/40 p-4 rounded-3xl border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-sm">
        <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-black/30 px-4 py-2 rounded-2xl border border-gray-200 dark:border-gray-800">
            {t('common.page')} <span className="text-gray-900 dark:text-white mx-1">{page}</span> / <span className="text-gray-900 dark:text-white mx-1">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: page <= 1 ? 1 : 1.05 }}
            whileTap={{ scale: page <= 1 ? 1 : 0.95 }}
            className={`px-4 py-2 rounded-2xl border flex items-center justify-center transition-all ${page <= 1 ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 bg-transparent' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow text-gray-700 dark:text-gray-300'}`}
            disabled={page <= 1 || loading}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: page >= totalPages ? 1 : 1.05 }}
            whileTap={{ scale: page >= totalPages ? 1 : 0.95 }}
            className={`px-4 py-2 rounded-2xl border flex items-center justify-center transition-all ${page >= totalPages ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 bg-transparent' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow text-gray-700 dark:text-gray-300'}`}
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange?.(page + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default EmpresasListDesktop;
