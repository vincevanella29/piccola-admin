import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
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

  return (
    <div className="w-full space-y-4">
      {/* toolbar mobile */}
      <div className="space-y-2">
        <div className="relative">
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
        <div className="flex items-center justify-between gap-2">
          <button
            className="px-4 py-2 rounded-md text-white
                       bg-light-accent hover:bg-light-accent-hover
                       dark:bg-dark-accent dark:hover:bg-dark-accent-hover"
            onClick={() => onRefresh?.()}
          >
            {t('common.search')}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs opacity-80">{t('common.per_page') || 'Por pág.'}</span>
            <select
              className="px-2 py-1 rounded-md border bg-transparent
                         border-light-border dark:border-dark-border
                         focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
              value={limit}
              onChange={(e) => onChangeLimit?.(Number(e.target.value))}
            >
              {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="text-xs opacity-80">{t('common.total')}: {total}</div>
      </div>

      {/* cards */}
      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="px-4 py-6 text-center rounded-md border border-light-border dark:border-dark-border">
            {t('common.loading')}
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center rounded-md border border-light-border dark:border-dark-border text-light-error dark:text-dark-error">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center rounded-md border border-light-border dark:border-dark-border">
            {t('common.no_results')}
          </div>
        ) : (
          items.map((it) => {
            const incCount = Array.isArray(it.cuentas_include) ? it.cuentas_include.length : 0;
            const excCount = Array.isArray(it.cuentas_exclude) ? it.cuentas_exclude.length : 0;
            const r2iCount = Array.isArray(it.resumen2_include) ? it.resumen2_include.length : 0;
            const r2eCount = Array.isArray(it.resumen2_exclude) ? it.resumen2_exclude.length : 0;

            return (
              <div
                key={it._id}
                className="rounded-xl border border-light-border dark:border-dark-border
                           bg-light-surface dark:bg-dark-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono opacity-70">{it._id}</div>
                    <div className="text-base font-semibold">{it.nombre}</div>
                    <div className="text-xs opacity-70">{it.slug || '-'}</div>
                  </div>
                  <button
                    className="px-3 py-1 rounded-md border
                               border-light-border hover:bg-light-surface-secondary/60
                               dark:border-dark-border dark:hover:bg-dark-surface-secondary/60"
                    onClick={() => onSelectEmpresa?.(it)}
                  >
                    {t('common.edit') || 'Editar'}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">
                    {t('empresa.sucursales')}: <b>{Array.isArray(it.sucursales) ? it.sucursales.length : 0}</b>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">+Ctas: <b>{incCount}</b></span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">-Ctas: <b>{excCount}</b></span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">+R2: <b>{r2iCount}</b></span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-light-border dark:border-dark-border">-R2: <b>{r2eCount}</b></span>
                </div>

                <div className="mt-3">
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md
                               border border-light-border hover:bg-light-surface-secondary/60
                               dark:border-dark-border dark:hover:bg-dark-surface-secondary/60"
                    onClick={() => setSheetFor(it)}
                  >
                    <Wrench className="h-4 w-4" />
                    {t('common.configure') || 'Configurar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
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
