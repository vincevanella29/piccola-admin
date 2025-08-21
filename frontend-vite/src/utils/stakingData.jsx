import api from './api.jsx';

/**
 * Obtiene el last_updated global de los staking desde el backend
 * @returns {Promise<number>} last_updated global
 */
export async function getStakingLastUpdated() {
  const res = await api({
    method: 'GET',
    endpoint: '/staking/last-updated',
    withCredentials: false,
  });
  return res?.last_updated || 0;
}

/**
 * Obtiene todos los stakings disponibles con sus pools desde el backend
 * @returns {Promise<Array>} Lista de stakings con sus pools
 */
export async function getAllStakingData() {
  const res = await api({
    method: 'GET',
    endpoint: '/staking/all-data',
    withCredentials: false, // No credentials needed for public endpoint
  });
  return res || [];
}

/**
 * Obtiene los datos de staking de una sola compañía (y opcionalmente año) desde el backend
 * @param {number|string} companyId - ID de la compañía
 * @param {number|string} [year] - Año opcional
 * @returns {Promise<Object>} Datos de staking de la compañía
 */
export async function getCompanyStakingData(companyId) {
  const endpoint = `/staking/company-data/${companyId}`;
  const res = await api({
    method: 'GET',
    endpoint,
    withCredentials: false,
  });
  return res || {};
}

/**
 * Realiza stake vía backend
 * @param {Object} stakeData - Debe incluir encodedData, signature, plainData, wallet, token, etc.
 * @param {string} walletAddress
 * @param {string} token
 * @returns {Promise<Object>} Respuesta del backend (incluyendo la tx lista para firmar)
 */
export async function stakeApi(stakeData, walletAddress, token) {
  return api({
    method: 'POST',
    endpoint: '/staking/stake',
    data: stakeData,
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

/**
 * Realiza claimRewards vía backend
 * @param {Object} claimRewardsData - Debe incluir encodedData, signature, plainData, wallet, token, etc.
 * @param {string} walletAddress
 * @param {string} token
 * @returns {Promise<Object>} Respuesta del backend (incluyendo la tx lista para firmar)
 */
export async function claimRewardsApi(claimRewardsData, walletAddress, token) {
  return api({
    method: 'POST',
    endpoint: '/staking/claim_rewards',
    data: claimRewardsData,
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

/**
 * Realiza unstake vía backend
 * @param {Object} unstakeData - Debe incluir encodedData, signature, plainData, wallet, token, etc.
 * @param {string} walletAddress
 * @param {string} token
 * @returns {Promise<Object>} Respuesta del backend (incluyendo la tx lista para firmar)
 */
export async function unstakeApi(unstakeData, walletAddress, token) {
  return api({
    method: 'POST',
    endpoint: '/staking/unstake',
    data: unstakeData,
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}
