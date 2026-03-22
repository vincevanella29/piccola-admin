import { useState, useCallback, useEffect } from 'react';
// Asegúrate de que la ruta a tu archivo de API sea correcta
import { getRankings, getSupportMissing } from '../utils/adminRankings'; 
import { useTranslation } from 'react-i18next';

// Helper para obtener el inicio y fin del mes actual en formato YYYY-MM
const getCurrentMonthPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
};

export default function useAdminRankings(appState) {
  const { t } = useTranslation();
  
  // --- Estados del Hook ---
  const [data, setData] = useState(null);
  const [supportData, setSupportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    periodo_start: getCurrentMonthPeriod(),
    periodo_end: getCurrentMonthPeriod(),
    compare_to: null,
    sort_by: 'total_venta',
    sucursal: null,
    cargo: null,
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 1000,
    totalItems: 0,
  });

  const wallet = appState?.account;
  const token = appState?.token;

  // --- Función Principal de Fetching ---
  const fetchRankings = useCallback(async (currentFilters, currentPage) => {
    if (!wallet || !token) {
        setError(t('wallet.connect_wallet', 'Conecta tu wallet'));
        return;
    }
    setLoading(true);
    setError(null);
    
    try {
        // Pedimos TODO en 1 llamada y paginamos en el cliente
        const response = await getRankings(
          appState,
          {
            periodo_start: currentFilters.periodo_start,
            periodo_end: currentFilters.periodo_end,
            compare_to: currentFilters.compare_to,
            sort_by: currentFilters.sort_by,
            sucursal: currentFilters.sucursal,
            cargo: currentFilters.cargo,
            skip: 0,
            limit: 100000, // gran límite para traer todo
          }
        );

        const rows = response.ranking || [];
        setData(rows);
        setPagination(prev => ({
          ...prev,
          totalItems: (typeof response.total_count === 'number' ? response.total_count : rows.length)
        }));

    } catch (err) {
        console.error("Error fetching admin rankings:", err);
        setError(err.message || t('errors.fetch_rankings', 'Error al obtener los rankings.'));
        setData([]); // Limpiar datos en caso de error
    } finally {
        setLoading(false);
    }
  }, [appState, wallet, token, pagination.itemsPerPage, t]);

  // --- Fetch de soporte (workers sin ventas) ---
  const fetchSupport = useCallback(async (currentFilters) => {
    if (!wallet || !token) return;
    try {
      const res = await getSupportMissing(appState, {
        periodo_start: currentFilters.periodo_start,
        periodo_end: currentFilters.periodo_end,
      });
      setSupportData(res);
    } catch (err) {
      console.error('Error fetching support data:', err);
      setSupportData(null);
    }
  }, [appState, wallet, token]);

  // --- Efecto para recargar datos cuando cambian los filtros o la página ---
  // Se gatilla cuando el componente llama a applyFilters o goToPage
  // (Este enfoque evita recargas automáticas por cada cambio en un input)

  // --- Handlers para la UI ---

  // Actualiza el estado de los filtros sin hacer fetch
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };
  
  // Aplica los filtros actuales, resetea la paginación y hace el fetch
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchRankings(filters, 1);
    fetchSupport(filters);
  };

  // Cambia de página y hace el fetch
  const goToPage = (pageNumber) => {
    setPagination(prev => ({ ...prev, currentPage: pageNumber }));
    fetchRankings(filters, pageNumber);
  };

  // Carga inicial de datos al montar el componente
  useEffect(() => {
    applyFilters();
  }, []); // El array vacío asegura que se ejecute solo una vez al inicio.

  
  // --- Valor de Retorno del Hook ---
  return {
    data,
    supportData,
    loading,
    error,
    filters,
    pagination,
    handleFilterChange,
    applyFilters,
    goToPage,
  };
}