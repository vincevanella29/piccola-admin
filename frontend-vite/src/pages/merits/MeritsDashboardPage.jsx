import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, AlertTriangle } from 'lucide-react';

// Hooks
import useAdminRankings from '../../hooks/useAdminRankings';

// Componentes
import { DashboardToolbar } from './components/adminDash/DashboardToolbar';
import { SummaryCards } from './components/adminDash/SummaryCards';
import { EmployeeTable } from './components/adminDash/EmployeeTable';
import { EmployeeDetailPanel } from './components/adminDash/EmployeeDetailPanel'; 
import SupportTable from './components/adminDash/SupportTable';

const TABS = [
  { id: 'ranking', label: 'Ranking', icon: TrendingUp },
  { id: 'support', label: 'Soporte', icon: AlertTriangle },
];

const MeritsDashboardPage = ({ appState }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('ranking');
  
  // --- HOOK DEL BACKEND ---
  const { 
    data, 
    supportData,
    loading, 
    error, 
    filters: backendFilters,
    handleFilterChange, 
    applyFilters 
  } = useAdminRankings(appState);

  // --- ESTADO PRINCIPAL (BASE DE DATOS PARA EL CLIENTE) ---
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // --- ESTADOS DE FILTROS Y ORDENACIÓN (CLIENT-SIDE) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilters, setClientFilters] = useState({ local: 'all', cargo: 'all' });
  const [sortConfig, setSortConfig] = useState({ key: 'puesto_empresa', direction: 'asc' });

  // Sincroniza la data del hook al estado local cuando esta cambia
  useEffect(() => {
    if (data) {
      setAllEmployees(data);
    }
  }, [data]);

  // Lógica memoizada para filtrar y ordenar la data en el cliente
  const filteredAndSortedEmployees = useMemo(() => {
    let result = [...allEmployees];

    // Búsqueda por texto
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(emp =>
        emp.nombre?.toLowerCase().includes(lowercasedTerm) ||
        emp.apellido?.toLowerCase().includes(lowercasedTerm) ||
        emp.rut?.includes(lowercasedTerm)
      );
    }

    // Filtros de cliente
    if (clientFilters.local !== 'all') {
      result = result.filter(emp => emp.local === clientFilters.local);
    }
    if (clientFilters.cargo !== 'all') {
      result = result.filter(emp => emp.cargo === clientFilters.cargo);
    }
    
    // Ordenamiento
    if (sortConfig.key) {
      result.sort((a, b) => {
        const getNestedValue = (obj, path) => path.split('.').reduce((o, k) => (o || {})[k], obj);
        const aValue = getNestedValue(a, sortConfig.key) ?? -1;
        const bValue = getNestedValue(b, sortConfig.key) ?? -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [allEmployees, searchTerm, clientFilters, sortConfig]);

  // Opciones para selectores
  const clientFilterOptions = useMemo(() => {
    const allowedEmpresas = Array.isArray(appState?.allowed?.empresas)
      ? appState.allowed.empresas
      : [];
    const allowedSiglas = new Set();
    for (const e of allowedEmpresas) {
      for (const s of (e?.sucursales ?? [])) {
        if (s?.sigla) allowedSiglas.add(String(s.sigla));
      }
    }
    if (allowedSiglas.size === 0) {
      allEmployees.forEach(e => e?.local && allowedSiglas.add(String(e.local)));
    }
    const cargos = new Set(allEmployees.map(e => e.cargo).filter(Boolean));
    return {
      locales: ['all', ...Array.from(allowedSiglas).sort()],
      cargos: ['all', ...Array.from(cargos).sort()],
    };
  }, [appState?.allowed?.empresas, allEmployees]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const supportCount = SupportTable.getPriorityCount(supportData);
  
  return (
    <div className="w-full max-w-full mx-auto p-4 md:p-6 space-y-6 bg-dark-background text-dark-text">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-dark-text-primary tracking-tight">
          Ranking de Meritocracia
        </h1>
        <p className="text-dark-text-secondary mt-1">
          Define un período y analiza el rendimiento y los méritos de los colaboradores.
        </p>
      </header>
      
      {error && (
        <div className="p-4 bg-dark-error/10 text-dark-error border border-dark-error/20 rounded-lg">
          <strong>Error:</strong> No se pudieron cargar los datos. {String(error)}
        </div>
      )}

      <DashboardToolbar
        backendFilters={backendFilters}
        onBackendFilterChange={handleFilterChange}
        onApplyBackendFilters={applyFilters}
        isLoading={loading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        clientFilters={clientFilters}
        setClientFilters={setClientFilters}
        clientFilterOptions={clientFilterOptions}
      />

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-dark-surface border border-dark-border/20 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isSupport = tab.id === 'support';
          const hasBadge = isSupport && supportCount > 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive
                  ? isSupport
                    ? 'bg-red-500/15 text-red-400 shadow-sm'
                    : 'bg-matrix-green/10 text-matrix-green shadow-sm'
                  : 'text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-surface-secondary/30'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {hasBadge && (
                <span className={`ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                  isActive ? 'bg-red-500/20 text-red-300' : 'bg-red-500/15 text-red-400 animate-pulse'
                }`}>
                  {supportCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'ranking' && (
          <motion.div
            key="ranking"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <SummaryCards data={filteredAndSortedEmployees} />
            
            <EmployeeTable
              employees={filteredAndSortedEmployees}
              onSort={handleSort}
              sortConfig={sortConfig}
              onSelectEmployee={setSelectedEmployee}
              loading={loading}
              allowedLocalOptions={['Todos', ...clientFilterOptions.locales.filter(v => v !== 'all')]}
            />
          </motion.div>
        )}

        {activeTab === 'support' && (
          <motion.div
            key="support"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <SupportTable supportData={supportData} loading={loading} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEmployee && (
          <EmployeeDetailPanel
            employee={selectedEmployee}
            allEmployees={filteredAndSortedEmployees}
            appState={appState}
            onClose={() => setSelectedEmployee(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MeritsDashboardPage;

// Metadata para el router
export const pageMetadata = {
  path: '/app/venta-garzones',
  label: 'kpis.label',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 6,
  order: 2,
  locations: ['sidebar', 'header', 'footer'],
  description: 'kpis.description',
  icon: 'FaTrophy',
  isMainPage: false,
  isSearchable: true,
};
