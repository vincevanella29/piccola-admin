// frontend-vite/src/utils/rolesAccess.js
// Helper API functions for Roles & Scopes
// Mantiene los nombres para no romper hooks:
//  - getMyPermissions
//  - getPermissionsOfWallet
//  - upsertScopes          -> guarda scopes POR NIVEL (3/4/5)
//  - clearScopes           -> limpia scopes POR NIVEL (3/4/5)
//  - getRolesMeta
//  - listPolicies
//  - upsertPolicy
//  - deletePolicy

import api from './api.jsx';

/**
 * Mis permisos efectivos (según sesión).
 * GET /roles/scopes/my
 */
export async function getMyPermissions({ walletAddress, token }) {
  return api({
    method: 'GET',
    endpoint: '/roles/scopes/my',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/**
 * Permisos efectivos de un wallet (solo admin 3/4).
 * GET /roles/scopes/wallet/{wallet}
 */
export async function getPermissionsOfWallet({ targetWallet, walletAddress, token }) {
  if (!targetWallet) throw new Error('targetWallet es obligatorio');
  return api({
    method: 'GET',
    endpoint: `/roles/scopes/wallet/${encodeURIComponent(String(targetWallet))}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/**
 * Obtener configuración POR NIVEL DE ROL (3/4/5).
 * GET /roles/level-scopes/{role_level}
 */
export async function getRoleLevelScope({ role_level, walletAddress, token }) {
  if (role_level === undefined || role_level === null) {
    throw new Error('role_level es obligatorio (3/4/5)');
  }
  return api({
    method: 'GET',
    endpoint: `/roles/level-scopes/${encodeURIComponent(String(role_level))}` ,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}`  } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/**
 * Guardar scopes POR NIVEL DE ROL (3/4/5).
 * POST /roles/level-scopes/save
 *
 * Compat con tu hook:
 *  - targetWallet: ignorado (pero lo aceptamos para no romper)
 *  - role_level: requerido (3/4/5)
 *  - empresa_ids/sucursal_ids opcionales (se ignoran si allow_all_* = true)
 * Devuelve { ok, scope, permissions } donde permissions viene de GET /roles/scopes/my
 */
export async function upsertScopes({
  targetWallet, // ignorado (legacy)
  role_level,
  empresa_ids = undefined,
  sucursal_ids = undefined,
  allow_all_companies = false,
  allow_all_sucursales = false,
  walletAddress,
  token,
}) {
  if (role_level === undefined || role_level === null) {
    throw new Error('role_level es obligatorio (3/4/5)');
  }

  const payload = {
    role_level,
    allow_all_companies: !!allow_all_companies,
    allow_all_sucursales: !!allow_all_sucursales,
  };
  if (!payload.allow_all_companies && Array.isArray(empresa_ids)) {
    payload.empresa_ids = empresa_ids;
  }
  if (!payload.allow_all_sucursales && Array.isArray(sucursal_ids)) {
    payload.sucursal_ids = sucursal_ids;
  }

  const saveResp = await api({
    method: 'POST',
    endpoint: '/roles/level-scopes/save',
    data: payload,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });

  // Para que tu hook reciba `permissions` como siempre:
  let myResp = null;
  try {
    myResp = await api({
      method: 'GET',
      endpoint: '/roles/scopes/my',
      withCredentials: true,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
      },
    });
  } catch (_) {
    // si falla, devolvemos igual ok/scope
  }

  return {
    ok: saveResp?.ok ?? true,
    scope: saveResp?.scope ?? null,
    permissions: myResp?.permissions ?? null,
  };
}

/** Alias legible por el Tab: saveRoleLevelScope -> upsertScopes */
export async function saveRoleLevelScope({
  role_level,
  allow_all_companies = false,
  allow_all_sucursales = false,
  empresa_ids = [],
  sucursal_ids = [],
  walletAddress,
  token,
}) {
  return upsertScopes({
    role_level,
    allow_all_companies,
    allow_all_sucursales,
    empresa_ids,
    sucursal_ids,
    walletAddress,
    token,
  });
}

/**
 * Limpiar scopes POR NIVEL DE ROL.
 * POST /roles/level-scopes/clear/{role_level}
 *
 * Compat con tu hook:
 *  - targetWallet: ignorado (legacy)
 *  - role_level: requerido (3/4/5)
 */
export async function clearScopes({
  targetWallet, // ignorado (legacy)
  role_level,
  walletAddress,
  token,
}) {
  if (role_level === undefined || role_level === null) {
    throw new Error('role_level es obligatorio (3/4/5) para limpiar la configuración del nivel');
  }
  return api({
    method: 'POST',
    endpoint: `/roles/level-scopes/clear/${encodeURIComponent(String(role_level))}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/** Alias legible por el Tab: clearRoleLevelScope -> clearScopes */
export async function clearRoleLevelScope({
  role_level,
  walletAddress,
  token,
}) {
  return clearScopes({ role_level, walletAddress, token });
}

/**
 * Meta para selects (cargos, secciones, empresas, sucursales).
 * GET /roles/meta
 */
export async function getRolesMeta({ walletAddress, token }) {
  return api({
    method: 'GET',
    endpoint: '/roles/meta',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/**
 * Listado de políticas (cargo/sección).
 * GET /roles/policies?type=&key=
 */
export async function listPolicies({ type, key, walletAddress, token }) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (key) params.set('key', key);
  return api({
    method: 'GET',
    endpoint: `/roles/policies${params.toString() ? `?${params}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/**
 * Upsert de política (cargo/sección).
 * POST /roles/policies/upsert
 */
export async function upsertPolicy({
  type, key,
  allow_all_companies = false,
  allow_all_sucursales = false,
  allow_own_sucursal = false,
  empresa_ids_allow = [],
  sucursal_ids_allow = [],
  empresa_ids_block = [],
  sucursal_ids_block = [],
  active_required = true,
  // nuevos campos soportados por tu back:
  own_sucursal_grants_all = false,
  own_sucursal_ids_grant_all = [],
  walletAddress, token,
}) {
  if (!type || !key) throw new Error('type y key son obligatorios');
  return api({
    method: 'POST',
    endpoint: '/roles/policies/upsert',
    data: {
      type, key,
      allow_all_companies,
      allow_all_sucursales,
      allow_own_sucursal,
      empresa_ids_allow,
      sucursal_ids_allow,
      empresa_ids_block,
      sucursal_ids_block,
      active_required,
      own_sucursal_grants_all,
      own_sucursal_ids_grant_all,
    },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

/**
 * Eliminar política.
 * DELETE /roles/policies/{policy_id}
 */
export async function deletePolicy({ policy_id, walletAddress, token }) {
  if (!policy_id) throw new Error('policy_id es obligatorio');
  return api({
    method: 'DELETE',
    endpoint: `/roles/policies/${encodeURIComponent(String(policy_id))}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export default {
  getMyPermissions,
  getPermissionsOfWallet,
  upsertScopes,
  clearScopes,
  getRoleLevelScope,
  saveRoleLevelScope,
  clearRoleLevelScope,
  getRolesMeta,
  listPolicies,
  upsertPolicy,
  deletePolicy,
};
