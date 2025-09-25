// src/utils/adminRankings.js
import api from './api.jsx';

/**
 * Fetches employee rankings from the backend.
 * @param {object} params - The query parameters.
 * @param {string} params.periodo_start - Start period in YYYY-MM format.
 * @param {string} params.periodo_end - End period in YYYY-MM format.
 * @param {string|null} params.compare_to - Comparison period ('previous_period' or 'previous_year').
 * @param {string|null} params.sort_by - Metric to sort by.
 * @param {string|null} params.sucursal - Filter by branch.
 * @param {string|null} params.cargo - Filter by role.
 * @param {string} params.walletAddress - The user's wallet address for authentication.
 * @param {string} params.token - The session token.
 * @param {number} params.skip - Number of items to skip for pagination.
 * @param {number|null} params.limit - Number of items per page.
 * @returns {Promise<object>} The API response with ranking data.
 */
export async function getRankings({
  periodo_start,
  periodo_end,
  compare_to = null,
  sort_by = 'total_venta',
  sucursal = null,
  cargo = null,
  walletAddress,
  token,
  skip = 0,
  limit = 50,
}) {
  if (!periodo_start || !periodo_end) throw new Error('Start and end periods are required');
  
  const params = new URLSearchParams({ periodo_start, periodo_end, sort_by, skip, limit });
  
  if (compare_to) params.append('compare_to', compare_to);
  if (sucursal) params.append('sucursal', sucursal);
  if (cargo) params.append('cargo', cargo);

  return api({
    method: 'GET',
    // --- CORRECTION: Endpoint updated to match the backend router ---
    endpoint: `/admin/rankings/empleados?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}