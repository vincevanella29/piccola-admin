// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/utils/tokensData.jsx
import api from './api';

// Obtiene todos los pares de tokens (con filtros opcionales)
export async function fetchTokenPairs({ companyId = null, exists = null } = {}) {
  const params = {};
  if (companyId !== null) params.companyId = companyId;
  if (exists !== null) params.exists = exists;
  return await api({ method: 'GET', endpoint: '/token_pairs', params });
}

// Obtiene todos los tokens de plataforma
export async function fetchPlatformTokens() {
  return await api({ method: 'GET', endpoint: '/platform_tokens' });
}

// Obtiene el mapping de rutas de swap: para cada token, a qué payment tokens tiene par
export async function fetchSwapTokenRoutes() {
  return await api({ method: 'GET', endpoint: '/swap_tokens_routes' });
}

// Obtiene reserves de un par UniswapV2 dado el pairAddress (solo reserves, no metadata extra)
/**
 * Consulta reserves de un par UniswapV2 en el backend
 * @param {string} pairAddress
 * @returns {Promise<Object>} reserves { reserve0, reserve1, timestamp }
 */
export async function fetchPairReserves(pairAddress) {
  if (!pairAddress) throw new Error('pairAddress requerido');
  return await api({
    method: 'GET',
    endpoint: '/pair_reserves',
    params: { pairAddress }
  });
}


// Remover liquidez de un pool existente
/**
 * Remover liquidez de un pool existente
 * @param {Object} liquidityData - Debe incluir encodedData, wallet, pairId
 * @param {string} walletAddress
 * @param {string} token
 * @returns {Promise<Object>} Respuesta del backend (incluyendo la tx lista para firmar)
 */
export async function removeLiquidityPool(liquidityData, walletAddress, token) {
  console.log('[tokensData.removeLiquidityPool] called', { ...liquidityData, walletAddress, token });
  return api({
    method: 'POST',
    endpoint: '/remove_liquidity',
    data: liquidityData,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

// Crear un nuevo pool de liquidez
/**
 * Crear un nuevo pool de liquidez
 * @param {Object} poolData - Debe incluir encodedData, wallet, pairId
 * @param {string} walletAddress
 * @param {string} token
 * @returns {Promise<Object>} Respuesta del backend (incluyendo la tx lista para firmar)
 */
export async function createNewPool(poolData, walletAddress, token) {
  console.log('[tokensData.createPool] called', { ...poolData, walletAddress, token });
  return api({
    method: 'POST',
    endpoint: '/create_pool',
    data: poolData,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

// Añadir liquidez a un pool existente
/**
 * Añadir liquidez a un pool existente
 * @param {Object} liquidityData - Debe incluir encodedData, signature, plainData, wallet, pairId
 * @param {string} walletAddress
 * @param {string} token
 * @returns {Promise<Object>} Respuesta del backend (incluyendo la tx lista para firmar)
 */
export async function addLiquidityPool(liquidityData, walletAddress, token) {
  console.log('[tokensData.addLiquidity] called', { ...liquidityData, walletAddress, token });
  return api({
    method: 'POST',
    endpoint: '/add_liquidity',
    data: liquidityData,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

export const fetchSwap = async (FetchSwapParams, walletAddress, token) => {
  return await api({
      method: 'POST',
      endpoint: '/swap',
      data: FetchSwapParams,
      withCredentials: true,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
      }
    });
};