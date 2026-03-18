import { useState, useCallback } from 'react';
import { fetchAvailableWorkers, executeWorkers } from '../utils/workersApi';

/**
 * Hook para gestionar la API de workers.
 *
 * Expone:
 *  - workers: string[]              — nombres de todos los workers
 *  - workersByCategory: object      — workers agrupados por categoría { mtz, intranet, kpis }
 *  - workersMeta: WorkerSummary[]   — lista completa con { name, category, description }
 *  - totalWorkers: number
 *  - executionResults: ExecuteWorkerResult[]
 *  - executionSummary: { mesano, total, success_count, error_count, total_duration_ms } | null
 *  - isLoading: boolean
 *  - error: string | null
 */
export function useWorkersApi(appState) {
  const [workers, setWorkers] = useState([]);
  const [workersByCategory, setWorkersByCategory] = useState({ mtz: [], intranet: [], kpis: [] });
  const [workersMeta, setWorkersMeta] = useState([]);
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionResults, setExecutionResults] = useState([]);
  const [executionSummary, setExecutionSummary] = useState(null);

  // ── GET /workers/list ──────────────────────────────────────────────────────
  const getWorkers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetchAvailableWorkers({ appState });

      // Soporte respuesta nueva (by_category) y legada ({ workers: string[] })
      const names = resp?.workers ?? [];
      setWorkers(names);
      setTotalWorkers(resp?.total ?? names.length);

      if (resp?.by_category) {
        setWorkersByCategory(resp.by_category);
        // Construir workersMeta aplanado desde las categorías
        const allMeta = [
          ...(resp.by_category.mtz ?? []),
          ...(resp.by_category.intranet ?? []),
          ...(resp.by_category.kpis ?? []),
        ];
        setWorkersMeta(allMeta);
      }

      return names;
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err.message ?? 'Error fetching workers';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [appState]);

  // ── POST /workers/execute ──────────────────────────────────────────────────
  const runWorkers = useCallback(async ({ mesano, include, exclude } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await executeWorkers({ mesano, include, exclude, appState });

      // Respuesta nueva: resp tiene { results, success_count, error_count, ... }
      const results = resp?.results ?? (Array.isArray(resp) ? resp : []);
      setExecutionResults(results);

      if (resp?.results !== undefined) {
        // Guardar resumen de la ejecución
        setExecutionSummary({
          mesano: resp.mesano,
          total: resp.total,
          success_count: resp.success_count,
          error_count: resp.error_count,
          total_duration_ms: resp.total_duration_ms,
        });
      }

      return results;
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err.message ?? 'Error executing workers';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [appState]);

  return {
    // Datos de workers
    workers,
    workersByCategory,
    workersMeta,
    totalWorkers,
    // Estado de ejecución
    executionResults,
    executionSummary,
    // Estado general
    isLoading,
    error,
    // Acciones
    getWorkers,
    runWorkers,
    // Setters manuales
    setWorkers,
    setExecutionResults,
    setExecutionSummary,
  };
}
