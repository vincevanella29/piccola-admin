import { useState, useCallback } from 'react';
import { fetchAvailableWorkers, executeWorkers } from '../utils/workersApi';

export function useWorkersApi(appState) {
  const [workers, setWorkers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionResults, setExecutionResults] = useState([]);

  // Obtener la lista de workers disponibles
  const getWorkers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetchAvailableWorkers({ appState });
      setWorkers(resp?.workers || []);
      return resp?.workers || [];
    } catch (err) {
      setError(err.message || 'Error fetching workers');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [appState]);

  // Ejecutar uno, varios o todos los workers
  const runWorkers = useCallback(async ({ mesano, include, exclude } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await executeWorkers({ mesano, include, exclude, appState });
      setExecutionResults(resp || []);
      return resp || [];
    } catch (err) {
      setError(err.message || 'Error executing workers');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [appState]);

  return {
    workers,
    isLoading,
    error,
    executionResults,
    getWorkers,
    runWorkers,
    setWorkers, // opcional, por si necesitas manipular manualmente
    setExecutionResults,
  };
}
