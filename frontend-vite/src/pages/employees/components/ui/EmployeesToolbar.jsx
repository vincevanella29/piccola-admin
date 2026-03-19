import React from 'react';
import { Search, X, RefreshCw, Loader2 } from 'lucide-react';

const EmployeesToolbar = ({
  t,
  q, setQ,
  sucursal, setSucursal, sucursalOptions,
  cargo, setCargo, cargoOptions,
  seccion, setSeccion, seccionOptions,
  loading, error, onRefresh,
}) => {
  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-3 mb-4 flex flex-wrap items-center gap-2.5">
      {/* Search */}
      <div className="relative flex-[2_1_240px] min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
        <input
          type="text"
          placeholder={t('employees.filters.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-9 pr-8 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/60 dark:placeholder:text-dark-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-light-accent/30 dark:focus:ring-dark-accent/30 transition"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/30 transition">
            <X className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        )}
      </div>

      {/* Sucursal */}
      <select
        value={sucursal}
        onChange={(e) => setSucursal(e.target.value)}
        className="flex-[1_1_160px] px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-primary dark:text-dark-text-primary"
      >
        <option value="">{t('employees.filters.all_f')} — {t('employees.filters.sucursal')}</option>
        {sucursalOptions.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Cargo */}
      <select
        value={cargo}
        onChange={(e) => setCargo(e.target.value)}
        className="flex-[1_1_160px] px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-primary dark:text-dark-text-primary"
      >
        <option value="">{t('employees.filters.all')} — {t('employees.filters.cargo')}</option>
        {cargoOptions.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Sección */}
      <select
        value={seccion}
        onChange={(e) => setSeccion(e.target.value)}
        className="flex-[1_1_160px] px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-primary dark:text-dark-text-primary"
      >
        <option value="">{t('employees.filters.all')} — {t('employees.filters.seccion')}</option>
        {seccionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Active filter chips + actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        {sucursal && (
          <button onClick={() => setSucursal('')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-xs font-semibold text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition">
            {sucursal} <X className="w-3 h-3" />
          </button>
        )}
        {cargo && (
          <button onClick={() => setCargo('')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-xs font-semibold text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition">
            {cargo} <X className="w-3 h-3" />
          </button>
        )}
        {seccion && (
          <button onClick={() => setSeccion('')} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-xs font-semibold text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition">
            {seccion} <X className="w-3 h-3" />
          </button>
        )}

        <button
          onClick={onRefresh}
          disabled={loading}
          title={t('employees.actions.refresh')}
          className="p-2 rounded-xl hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/30 transition text-light-text-secondary dark:text-dark-text-secondary disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>

        {loading && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500">
            {t('employees.status.loading')}
          </span>
        )}
        {error && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500">
            {error?.message || t('employees.status.error')}
          </span>
        )}
      </div>
    </div>
  );
};

export default EmployeesToolbar;
