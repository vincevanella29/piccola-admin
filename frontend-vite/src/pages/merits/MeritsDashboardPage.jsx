import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';

// Hooks
import useAdminRankings from '../../hooks/useAdminRankings';

// Componentes
import { DashboardToolbar } from './components/DashboardToolbar';
import { SummaryCards } from './components/SummaryCards';
import { EmployeeTable } from './components/EmployeeTable';
// Al importar del directorio, automáticamente resuelve a /EmployeeDetailPanel/index.jsx
import { EmployeeDetailPanel } from './components/EmployeeDetailPanel'; 

const MeritsDashboardPage = ({ appState }) => {
  const { t } = useTranslation();
  
  // --- HOOK DEL BACKEND ---
  // Maneja la carga, errores y los filtros que requieren una nueva llamada a la API
  const { 
    data, 
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

  console.log("filteredAndSortedEmployees", filteredAndSortedEmployees);

  // Opciones para los selectores de filtro (se calculan dinámicamente)
  const clientFilterOptions = useMemo(() => {
    const locales = new Set(allEmployees.map(e => e.local).filter(Boolean));
    const cargos = new Set(allEmployees.map(e => e.cargo).filter(Boolean));
    return {
      locales: ['all', ...Array.from(locales).sort()],
      cargos: ['all', ...Array.from(cargos).sort()],
    };
  }, [allEmployees]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
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
      
      <SummaryCards data={filteredAndSortedEmployees} />
      
      <EmployeeTable
        employees={filteredAndSortedEmployees}
        onSort={handleSort}
        sortConfig={sortConfig}
        onSelectEmployee={setSelectedEmployee}
        loading={loading}
      />

      <AnimatePresence>
        {selectedEmployee && (
          <EmployeeDetailPanel
            employee={selectedEmployee}
            allEmployees={filteredAndSortedEmployees} // <-- AÑADIR ESTA LÍNEA
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
  path: '/app/kpis',
  label: 'kpis.label',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 2,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'kpis.description',
  icon: 'FaTrophy',
  isMainPage: false,
  isSearchable: true,
};
