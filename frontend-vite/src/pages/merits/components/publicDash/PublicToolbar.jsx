import React from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PublicToolbar({
  backendFilters,
  onBackendFilterChange,
  onApplyBackendFilters,
  isLoading,
  searchTerm,
  setSearchTerm,
  clientFilters,
  setClientFilters,
  clientFilterOptions,
}) {
  const { t } = useTranslation();
  const locales = clientFilterOptions?.locales || ['all'];
  const cargos  = clientFilterOptions?.cargos  || ['all'];

  const clearClient = () => setClientFilters({ local: 'all', cargo: 'all' });
  const clearBackend = () => {
    onBackendFilterChange({ sucursal: null });
    onBackendFilterChange({ cargo: null });
  };

  return (
    <div className="space-y-4 p-4 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/20 dark:border-dark-border/20">
      {/* Búsqueda + filtros rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" size={18} />
          <input
            type="text"
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/50"
            placeholder={t('merits.toolbar.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.local_label')}</span>
            <select
              className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
              value={clientFilters.local}
              onChange={(e) => setClientFilters((p) => ({ ...p, local: e.target.value }))}
            >
              {locales.map((v) => (
                <option key={v} value={v}>{v === 'all' ? t('merits.filters.all') : v}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.cargo_label')}</span>
            <select
              className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
              value={clientFilters.cargo}
              onChange={(e) => setClientFilters((p) => ({ ...p, cargo: e.target.value }))}
            >
              {cargos.map((v) => (
                <option key={v} value={v}>{v === 'all' ? t('merits.filters.all') : v}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={clearClient}
            className="px-3 py-2 rounded-lg border border-dark-border/30 text-dark-text-secondary hover:bg-dark-surface-secondary transition-colors"
            title={t('merits.toolbar.clear_filters')}
          >
            {t('merits.toolbar.clear_filters')}
          </button>
        </div>
      </div>

      {/* Filtros backend */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.backend_sucursal')}</span>
          <select
            className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
            value={backendFilters.sucursal || ''}
            onChange={(e) => onBackendFilterChange({ sucursal: e.target.value || null })}
          >
            <option value="">{t('merits.filters.all_branches')}</option>
            {locales.filter((v) => v !== 'all').map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.backend_cargo')}</span>
          <select
            className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
            value={backendFilters.cargo || ''}
            onChange={(e) => onBackendFilterChange({ cargo: e.target.value || null })}
          >
            <option value="">{t('merits.filters.all_roles')}</option>
            {cargos.filter((v) => v !== 'all').map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            onClick={onApplyBackendFilters}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-matrix-green text-white disabled:bg-matrix-green/40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '…' : t('merits.toolbar.apply_backend')}
          </button>
          <button
            type="button"
            onClick={clearBackend}
            className="px-3 py-2 rounded-lg border border-dark-border/30 text-dark-text-secondary hover:bg-dark-surface-secondary transition-colors"
            title={t('merits.toolbar.clear_backend')}
          >
            {t('merits.toolbar.clear_backend')}
          </button>
        </div>
      </div>
    </div>
  );
}
