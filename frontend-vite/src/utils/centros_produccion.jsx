// frontend-vite/src/utils/centros_produccion.jsx
// API helpers for Centros de Producción (meta + configuración de cargos/secciones)

import api from './api.jsx';

// ------------------------------------------------------------
// Meta (centros, cargos, secciones)
// ------------------------------------------------------------
export async function listProductionCentersMeta({ walletAddress, token } = {}) {
  return api({
    method: 'GET',
    endpoint: '/centros-produccion/meta',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// ------------------------------------------------------------
// Configuración por Centro de Producción
// ------------------------------------------------------------

// Listar TODAS las configuraciones existentes
export async function listProductionCenterConfigs({ walletAddress, token } = {}) {
  return api({
    method: 'GET',
    endpoint: '/centros-produccion/config/list',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Obtener configuración de un centro (por _id o slug)
export async function getProductionCenterConfig({ idOrSlug, walletAddress, token } = {}) {
  if (!idOrSlug) throw new Error('idOrSlug es obligatorio');
  return api({
    method: 'GET',
    endpoint: `/centros-produccion/${encodeURIComponent(idOrSlug)}/config`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Upsert (REEMPLAZA listas completas de cargo_ids y secciones)
export async function upsertProductionCenterConfig({
  idOrSlug,
  cargoIds,
  secciones,
  active = true,
  notes,
  walletAddress,
  token,
} = {}) {
  if (!idOrSlug) throw new Error('idOrSlug es obligatorio');
  return api({
    method: 'POST',
    endpoint: `/centros-produccion/${encodeURIComponent(idOrSlug)}/config`,
    data: {
      cargo_ids: Array.isArray(cargoIds) ? cargoIds : [],
      secciones: Array.isArray(secciones) ? secciones : [],
      active: !!active,
      notes: notes ?? null,
    },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Agregar cargos/secciones a la configuración existente (merge incremental)
export async function addToProductionCenterConfig({
  idOrSlug,
  cargoIds,
  secciones,
  active, // opcional: puedes togglear activo en el mismo patch
  notes,  // opcional
  walletAddress,
  token,
} = {}) {
  if (!idOrSlug) throw new Error('idOrSlug es obligatorio');
  return api({
    method: 'PATCH',
    endpoint: `/centros-produccion/${encodeURIComponent(idOrSlug)}/config/add`,
    data: {
      ...(Array.isArray(cargoIds) ? { cargo_ids: cargoIds } : {}),
      ...(Array.isArray(secciones) ? { secciones } : {}),
      ...(typeof active === 'boolean' ? { active } : {}),
      ...(typeof notes === 'string' ? { notes } : {}),
    },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Quitar cargos/secciones de la configuración existente (merge incremental)
export async function removeFromProductionCenterConfig({
  idOrSlug,
  cargoIds,
  secciones,
  active, // opcional: puedes togglear activo en el mismo patch
  notes,  // opcional
  walletAddress,
  token,
} = {}) {
  if (!idOrSlug) throw new Error('idOrSlug es obligatorio');
  return api({
    method: 'PATCH',
    endpoint: `/centros-produccion/${encodeURIComponent(idOrSlug)}/config/remove`,
    data: {
      ...(Array.isArray(cargoIds) ? { cargo_ids: cargoIds } : {}),
      ...(Array.isArray(secciones) ? { secciones } : {}),
      ...(typeof active === 'boolean' ? { active } : {}),
      ...(typeof notes === 'string' ? { notes } : {}),
    },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Eliminar la configuración de un centro
export async function deleteProductionCenterConfig({ idOrSlug, walletAddress, token } = {}) {
  if (!idOrSlug) throw new Error('idOrSlug es obligatorio');
  return api({
    method: 'DELETE',
    endpoint: `/centros-produccion/${encodeURIComponent(idOrSlug)}/config`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// ------------------------------------------------------------
// Default export (organized)
// ------------------------------------------------------------
export default {
  // Meta
  listProductionCentersMeta,
  // Config
  listProductionCenterConfigs,
  getProductionCenterConfig,
  upsertProductionCenterConfig,
  addToProductionCenterConfig,
  removeFromProductionCenterConfig,
  deleteProductionCenterConfig,
};
