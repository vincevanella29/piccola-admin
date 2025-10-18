import React from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PublicToolbar({
  isLoading,
  backendFilters,
  onBackendFilterChange,
  onApplyBackendFilters,
  clientFilterOptions,
}) {
  const { t } = useTranslation();
  const locales = (clientFilterOptions?.locales || ['all']).filter((v) => v !== 'all');
  const cargos = (clientFilterOptions?.cargos || ['all']).filter((v) => v !== 'all');
  const secciones = (clientFilterOptions?.secciones || ['all']).filter((v) => v !== 'all');

  const clearBackend = () => {
    onBackendFilterChange({ sucursal: null });
    onBackendFilterChange({ cargo: null });
  };

  return (
    <div className="space-y-4 p-4 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/20 dark:border-dark-border/20">
      {/* Filtros backend (llaman al servidor) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.backend_sucursal')}</span>
          <select
            className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
            value={backendFilters?.sucursal || ''}
            onChange={(e) => onBackendFilterChange({ sucursal: e.target.value || null })}
          >
            <option value="">{t('merits.filters.all_branches')}</option>
            {locales.map((v) => (
              <option key={`bkl-${v}`} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.backend_cargo')}</span>
          <select
            className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
            value={backendFilters?.cargo || ''}
            onChange={(e) => onBackendFilterChange({ cargo: e.target.value || null })}
          >
            <option value="">{t('merits.filters.all_roles')}</option>
            {cargos.map((v) => (
              <option key={`bkc-${v}`} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('merits.toolbar.backend_seccion', 'Sección')}</span>
          <select
            className="px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20"
            value={backendFilters?.seccion || ''}
            onChange={(e) => onBackendFilterChange({ seccion: e.target.value || null })}
          >
            <option value="">{t('merits.filters.all_sections', 'Todas')}</option>
            {secciones.map((v) => (
              <option key={`bks-${v}`} value={v}>{v}</option>
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
