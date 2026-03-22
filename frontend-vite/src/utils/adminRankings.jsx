// src/utils/adminRankings.js
import api from './api.jsx';

const buildAuthHeaders = (appState) => {
  const token = appState?.token;
  const wallet = appState?.account;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (wallet) headers['X-Wallet-Address'] = wallet;
  return headers;
};

const toParams = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    p.append(k, String(v));
  });
  return p;
};

/**
 * Fetches employee rankings from the backend (auth desde appState).
 * @param {object} appState - Global app state con token y account.
 * @param {object} params
 * @param {string} params.periodo_start - YYYY-MM
 * @param {string} params.periodo_end   - YYYY-MM
 * @param {'previous_period'|'previous_year'|null} [params.compare_to]
 * @param {'total_venta'|'promedio_mesa'|'total_mesas'|'personas_atendidas'|'promedio_por_persona'|'promedio_venta_diaria'} [params.sort_by]
 * @param {string|null} [params.sucursal]
 * @param {string|null} [params.cargo]
 * @param {number} [params.skip=0]
 * @param {number} [params.limit=50]
 */
export async function getRankings(
  appState,
  {
    periodo_start,
    periodo_end,
    compare_to = null,
    sort_by = 'total_venta',
    sucursal = null,
    cargo = null,
    skip = 0,
    limit = 50,
  } = {}
) {
  if (!periodo_start || !periodo_end) {
    throw new Error('Start and end periods are required');
  }

  const params = toParams({
    periodo_start,
    periodo_end,
    sort_by,
    skip,
    limit,
    compare_to,
    sucursal,
    cargo,
  });

  return api({
    method: 'GET',
    endpoint: `/admin/rankings/empleados?${params.toString()}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}


/**
 * Fetches support data: workers with sales roles missing KPI data.
 */
export async function getSupportMissing(appState, { periodo_start, periodo_end, sucursal = null } = {}) {
  if (!periodo_start || !periodo_end) throw new Error('Start and end periods are required');

  const params = toParams({ periodo_start, periodo_end, sucursal });
  return api({
    method: 'GET',
    endpoint: `/admin/rankings/support?${params.toString()}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}