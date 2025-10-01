// src/utils/meritRankings.jsx
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
 * Ranking público de méritos (solo últimos N meses).
 * Filtros: sucursal, cargo. Paginación server opcional (skip/limit).
 */
export async function getPublicMeritRankings(
  appState,
  { months = 3, sucursal = null, cargo = null, rank_mode = undefined, skip = 0, limit = 100000 } = {}
) {
  const params = toParams({ months, sucursal, cargo, rank_mode, skip, limit });
  return api({
    method: 'GET',
    endpoint: `/public/merits/rankings?${params.toString()}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

/**
 * Historial público de méritos (para modal).
 * Debe venir rut o wallet.
 */
export async function getPublicEmployeeMeritHistory(
  appState,
  { rut = undefined, wallet = undefined, include_profile = true } = {}
) {
  if (!rut && !wallet) throw new Error('Debe proporcionar rut o wallet');
  const params = toParams({ rut, wallet, include_profile });
  return api({
    method: 'GET',
    endpoint: `/public/merits/history?${params.toString()}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

