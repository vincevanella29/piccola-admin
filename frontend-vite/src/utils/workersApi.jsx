import api from './api.jsx';

/**
 * GET /workers/list
 * @returns {Promise<ListWorkersResponse>}
 * {
 *   workers: string[],
 *   total: number,
 *   by_category: {
 *     mtz: WorkerSummary[],
 *     intranet: WorkerSummary[],
 *     kpis: WorkerSummary[],
 *   }
 * }
 */
export async function fetchAvailableWorkers({ appState }) {
  return api({
    method: 'get',
    endpoint: '/workers/list',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${appState.accessToken}`,
      'X-Wallet-Address': appState.account,
    },
  });
}

/**
 * POST /workers/execute
 * @param {{ mesano: string, include?: string[], exclude?: string[], appState: object }} params
 * @returns {Promise<ExecuteWorkersResponse>}
 * {
 *   mesano: string,
 *   total: number,
 *   success_count: number,
 *   error_count: number,
 *   total_duration_ms: number,
 *   results: ExecuteWorkerResult[],
 * }
 *
 * ExecuteWorkerResult: {
 *   worker: string,
 *   status: 'ok' | 'error' | 'not_found' | 'no_handler',
 *   category: 'mtz' | 'intranet' | 'kpis',
 *   handler: 'run_worker' | 'process_period' | 'main' | null,
 *   duration_ms: number | null,
 *   detail: string | null,
 * }
 */
export async function executeWorkers({ mesano, include, exclude, appState }) {
  return api({
    method: 'post',
    endpoint: '/workers/execute',
    data: {
      mesano,
      ...(include && include.length > 0 ? { include } : {}),
      ...(exclude && exclude.length > 0 ? { exclude } : {}),
    },
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${appState.accessToken}`,
      'X-Wallet-Address': appState.account,
    },
  });
}
