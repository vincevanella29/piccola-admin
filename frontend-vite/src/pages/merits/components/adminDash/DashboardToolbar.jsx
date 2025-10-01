// src/pages/merits/components/adminDash/DashboardToolbar.jsx
import React from 'react';
import { Search } from 'lucide-react';

export const DashboardToolbar = ({
  backendFilters,
  onBackendFilterChange,
  onApplyBackendFilters,
  isLoading,
  searchTerm,
  setSearchTerm,
  clientFilters,
  setClientFilters,
  clientFilterOptions
}) => {
  const handleClientFilterChange = (key, value) => {
    setClientFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4 p-4 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/20 dark:border-dark-border/20">
      {/* SECCIÓN 1: FILTROS DE BACKEND (con botón Aplicar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Input
          label="Inicio (YYYY-MM)"
          value={backendFilters.periodo_start}
          onChange={(v) => onBackendFilterChange({ periodo_start: v })}
          placeholder="2025-09"
        />
        <Input
          label="Fin (YYYY-MM)"
          value={backendFilters.periodo_end}
          onChange={(v) => onBackendFilterChange({ periodo_end: v })}
          placeholder="2025-09"
        />
        <Select
          label="Comparar con"
          value={backendFilters.compare_to || ''}
          onChange={(v) => onBackendFilterChange({ compare_to: v || null })}
          options={[
            { value: 'previous_period', label: 'Periodo anterior' },
            { value: 'previous_year', label: 'Mismo periodo año anterior' },
          ]}
          allowEmpty
        />
        <div className="self-end">
          <button 
            onClick={onApplyBackendFilters}
            disabled={isLoading}
            className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-matrix-green text-white disabled:bg-matrix-green/40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Cargando...' : 'Aplicar Filtros'}
          </button>
        </div>
      </div>
      
      {/* DIVISOR */}
      <div className="border-t border-light-border/20 dark:border-dark-border/20"></div>

      {/* SECCIÓN 2: FILTROS RÁPIDOS (CLIENT-SIDE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" size={18} />
          <input
            type="text"
            placeholder="Buscar en resultados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/50"
          />
        </div>
        
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Filtrar por Local"
            value={clientFilters.local}
            onChange={(e) => handleClientFilterChange('local', e.target.value)}
            options={clientFilterOptions.locales.map(l => ({ value: l, label: l === 'all' ? 'Todos los Locales' : l }))}
          />
          <Select
            label="Filtrar por Cargo"
            value={clientFilters.cargo}
            onChange={(e) => handleClientFilterChange('cargo', e.target.value)}
            options={clientFilterOptions.cargos.map(c => ({ value: c, label: c === 'all' ? 'Todos los Cargos' : c }))}
          />
        </div>
      </div>
    </div>
  );
};


// --- Componentes de UI reusables (Input, Select) ---
const Input = ({ label, value, onChange, placeholder }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
    <input
      className="px-3 py-2 rounded-lg outline-none border text-sm bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border-light-border/20 dark:border-dark-border/20 focus:ring-2 focus:ring-matrix-green/50"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </label>
);

const Select = ({ label, value, onChange, options, allowEmpty = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
    <select
      className="px-3 py-2 rounded-lg outline-none border text-sm bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border-light-border/20 dark:border-dark-border/20 appearance-none focus:ring-2 focus:ring-matrix-green/50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">— Sin Comparación —</option>}
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </label>
);