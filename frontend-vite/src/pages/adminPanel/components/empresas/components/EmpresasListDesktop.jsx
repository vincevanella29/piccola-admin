import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
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

  return (
    <div className="w-full space-y-4">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-[420px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-md border bg-transparent
                         border-light-border dark:border-dark-border
                         focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
              placeholder={t('common.search_placeholder')}
              value={q}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onRefresh?.(); }}
            />
          </div>
          <button
            className="px-4 py-2 rounded-md text-white
                       bg-light-accent hover:bg-light-accent-hover
                       dark:bg-dark-accent dark:hover:bg-dark-accent-hover"
            onClick={() => onRefresh?.()}
          >
            {t('common.search')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm opacity-80">{t('common.total')}: {total}</div>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-80">{t('common.per_page') || 'Por pág.'}</span>
            <select
              className="px-2 py-1 rounded-md border bg-transparent
                         border-light-border dark:border-dark-border
                         focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
              value={limit}
              onChange={(e) => onChangeLimit?.(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="min-w-full divide-y divide-light-border dark:divide-dark-border text-sm">
          <thead className="bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/40">
            <tr>
              <th className="px-4 py-2 text-left">{t('empresa.id')}</th>
              <th className="px-4 py-2 text-left">{t('empresa.nombre')}</th>
              <th className="px-4 py-2 text-left">{t('empresa.slug')}</th>
              <th className="px-4 py-2 text-left">{t('empresa.sucursales')}</th>
              <th className="px-4 py-2 text-left">{t('empresa.rules') || 'Reglas'}</th>
              <th className="px-4 py-2 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border dark:divide-dark-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center">{t('common.loading')}</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-light-error dark:text-dark-error">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center">{t('common.no_results')}</td></tr>
            ) : (
              items.map((it, idx) => {
                const incCount = Array.isArray(it.cuentas_include) ? it.cuentas_include.length : 0;
                const excCount = Array.isArray(it.cuentas_exclude) ? it.cuentas_exclude.length : 0;
                const r2iCount = Array.isArray(it.resumen2_include) ? it.resumen2_include.length : 0;
                const r2eCount = Array.isArray(it.resumen2_exclude) ? it.resumen2_exclude.length : 0;

                return (
                  <tr key={it._id} className="hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40">
                    <td className="px-4 py-2 align-top font-mono text-xs opacity-80">{it._id}</td>
                    <td className="px-4 py-2 align-top font-medium">{it.nombre}</td>
                    <td className="px-4 py-2 align-top">{it.slug || '-'}</td>
                    <td className="px-4 py-2 align-top">{Array.isArray(it.sucursales) ? it.sucursales.length : 0}</td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">+Ctas: <b>{incCount}</b></span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">-Ctas: <b>{excCount}</b></span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">+R2: <b>{r2iCount}</b></span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">-R2: <b>{r2eCount}</b></span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="px-3 py-1 rounded-md border
                                     border-light-border hover:bg-light-surface-secondary/60
                                     dark:border-dark-border dark:hover:bg-dark-surface-secondary/60"
                          onClick={() => onSelectEmpresa?.(it)}
                        >
                          {t('common.edit') || 'Editar'}
                        </button>
                        <button
                          ref={(el) => { btnRefs.current[idx] = el; }}
                          className="px-3 py-1 rounded-md border
                                     border-light-border hover:bg-light-surface-secondary/60
                                     dark:border-dark-border dark:hover:bg-dark-surface-secondary/60 inline-flex items-center gap-2"
                          onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                        >
                          <Wrench className="h-4 w-4" />
                          <span className="hidden lg:inline">{t('common.configure') || 'Configurar'}</span>
                        </button>
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm">{t('common.page')} {page} / {totalPages}</div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded-md border border-light-border dark:border-dark-border disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="px-3 py-1 rounded-md border border-light-border dark:border-dark-border disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange?.(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmpresasListDesktop;
