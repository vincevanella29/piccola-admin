// src/hooks/useRolesAccess.jsx
import { useMemo, useState } from 'react';
import {
  getMyPermissions as apiGetMyPermissions,
  getPermissionsOfWallet as apiGetPermissionsOfWallet,
  upsertScopes as apiUpsertScopes,
  clearScopes as apiClearScopes,
  getRoleLevelScope as apiGetRoleLevelScope,
  saveRoleLevelScope as apiSaveRoleLevelScope,
  clearRoleLevelScope as apiClearRoleLevelScope,
  getRolesMeta as apiGetRolesMeta,
  listPolicies as apiListPolicies,
  upsertPolicy as apiUpsertPolicy,
  deletePolicy as apiDeletePolicy,
  listApiAccessRules as apiListApiAccessRules,
  upsertApiAccessRule as apiUpsertApiAccessRule,
  toggleApiAccessRule as apiToggleApiAccessRule,
  deleteApiAccessRule as apiDeleteApiAccessRule,
} from '../utils/rolesAccess.jsx';

function getErrMessage(err, fallback) {
  // adapta según tu capa api.jsx si usas axios/fetch
  const d = err?.response?.data;
  return (
    d?.detail?.message ||
    d?.detail ||
    d?.error ||
    err?.message ||
    (typeof fallback === 'string' ? fallback : undefined)
  );
}

export function useRolesAccess(appState, t) {
  const setError = appState?.setError;
  const setSuccess = appState?.setSuccess;
  const wallet = appState?.account;
  const token = appState?.token;

  const [isLoading, setIsLoading] = useState(false);
  const [myPermissions, setMyPermissions] = useState(null);
  const [permissionsByWallet, setPermissionsByWallet] = useState({});

  // NUEVO: meta + policies
  const [rolesMeta, setRolesMeta] = useState({ cargos: [], secciones: [], sucursales: [], empresas: [] });
  const [policies, setPolicies] = useState([]); // items de cargo_access_policies

  // ------- helpers derivados que ya tenías -------
  const hasAllSucursales = useMemo(
    () => Boolean(myPermissions?.can_view_all_sucursales),
    [myPermissions]
  );
  const allowedSucursalIds = useMemo(
    () => myPermissions?.sucursal_ids || [],
    [myPermissions]
  );
  const allowedEmpresaIds = useMemo(
    () => myPermissions?.empresa_ids || [],
    [myPermissions]
  );
  const canSeeSucursal = (id) => {
    const n = Number(id);
    return hasAllSucursales || allowedSucursalIds.includes(n);
  };

  // ------- API ACCESS RULES (prefix /api) -------
  const listApiAccessRules = async ({ path_prefix } = {}) => {
    try {
      const resp = await apiListApiAccessRules({ path_prefix, walletAddress: wallet, token });
      return resp?.items || [];
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.api_rules_load_error')));
      throw err;
    }
  };

  const upsertApiAccessRule = async (payload) => {
    try {
      const resp = await apiUpsertApiAccessRule({ ...payload, walletAddress: wallet, token });
      setSuccess?.(t?.('empresa.api_rule_saved'));
      return resp?.rule || null;
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.api_rule_save_error')));
      throw err;
    }
  };

  const toggleApiAccessRule = async ({ path_prefix, enabled }) => {
    try {
      const resp = await apiToggleApiAccessRule({ path_prefix, enabled, walletAddress: wallet, token });
      setSuccess?.(t?.('empresa.api_rule_toggled'));
      return resp?.rule || null;
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.api_rule_toggle_error')));
      throw err;
    }
  };

  const deleteApiAccessRule = async ({ path_prefix }) => {
    try {
      await apiDeleteApiAccessRule({ path_prefix, walletAddress: wallet, token });
      setSuccess?.(t?.('empresa.api_rule_deleted'));
      return { ok: true };
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.api_rule_delete_error')));
      throw err;
    }
  };

  // ------- actions (existentes) -------
  const fetchMyPermissions = async () => {
    setIsLoading(true);
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet'));
      const resp = await apiGetMyPermissions({ walletAddress: wallet, token });
      const perms = resp?.permissions || null;
      setMyPermissions(perms);
      return perms;
    } catch (err) {
      const msg = getErrMessage(err, t?.('empresa.my_perms_load_error'));
      setError?.(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPermissionsOfWallet = async ({ targetWallet }) => {
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet'));
      if (!targetWallet) throw new Error(t?.('empresa.target_wallet_required'));
      const resp = await apiGetPermissionsOfWallet({ targetWallet, walletAddress: wallet, token });
      const perms = resp?.permissions || null;
      setPermissionsByWallet((prev) => ({ ...prev, [targetWallet.toLowerCase()]: perms }));
      return perms;
    } catch (err) {
      const msg = getErrMessage(err, t?.('empresa.wallet_perms_load_error'));
      setError?.(msg);
      throw err;
    }
  };

  const saveScopes = async ({ targetWallet, role_level, empresa_ids, sucursal_ids }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet'));
      if (!targetWallet) throw new Error(t?.('empresa.target_wallet_required'));
      const resp = await apiUpsertScopes({ targetWallet, role_level, empresa_ids, sucursal_ids, walletAddress: wallet, token });
      const perms = resp?.permissions || null;
      setPermissionsByWallet((prev) => ({ ...prev, [targetWallet.toLowerCase()]: perms }));
      setSuccess?.(t?.('empresa.scopes_saved'));
      if (targetWallet?.toLowerCase?.() === wallet?.toLowerCase?.()) setMyPermissions(perms);
      return perms;
    } catch (err) {
      const msg = getErrMessage(err, t?.('empresa.scopes_save_error'));
      setError?.(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeScopes = async ({ targetWallet }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet'));
      if (!targetWallet) throw new Error(t?.('empresa.target_wallet_required'));
      await apiClearScopes({ targetWallet, walletAddress: wallet, token });
      setPermissionsByWallet((prev) => {
        const copy = { ...prev };
        delete copy[targetWallet.toLowerCase()];
        return copy;
      });
      setSuccess?.(t?.('empresa.scopes_cleared'));
      if (targetWallet?.toLowerCase?.() === wallet?.toLowerCase?.()) await fetchMyPermissions();
      return { ok: true };
    } catch (err) {
      const msg = getErrMessage(err, t?.('empresa.scopes_clear_error'));
      setError?.(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getCachedPermissionsOfWallet = (targetWallet) =>
    targetWallet ? (permissionsByWallet[targetWallet.toLowerCase()] || null) : null;

  const primeMyPermissions = async () => {
    if (myPermissions) return myPermissions;
    try { return await fetchMyPermissions(); } catch { return null; }
  };

  // ------- ROLE LEVEL SCOPES (3/4/5) -------
  const getRoleLevelScope = async ({ role_level }) => {
    if (!role_level) throw new Error('role_level requerido');
    const resp = await apiGetRoleLevelScope({ role_level, walletAddress: wallet, token });
    return resp;
  };

  const saveRoleLevelScope = async ({
    role_level,
    allow_all_companies,
    allow_all_sucursales,
    empresa_ids,
    sucursal_ids,
  }) => {
    const resp = await apiSaveRoleLevelScope({
      role_level, allow_all_companies, allow_all_sucursales, empresa_ids, sucursal_ids,
      walletAddress: wallet, token,
    });
    if (resp?.permissions && wallet) setMyPermissions(resp.permissions);
    return resp?.scope || null;
  };

  const clearRoleLevelScope = async ({ role_level }) => {
    const out = await apiClearRoleLevelScope({ role_level, walletAddress: wallet, token });
    return out;
  };

  // ------- NUEVO: meta/policies -------
  const fetchRolesMeta = async () => {
    try {
      const resp = await apiGetRolesMeta({ walletAddress: wallet, token });
      setRolesMeta({
        cargos: resp?.cargos || [],
        secciones: resp?.secciones || [],
        sucursales: resp?.sucursales || [],
        empresas: resp?.empresas || [],
      });
      return resp;
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.roles_meta_load_error')));
      throw err;
    }
  };

  const fetchPolicies = async ({ type, key } = {}) => {
    try {
      const resp = await apiListPolicies({ type, key, walletAddress: wallet, token });
      const items = resp?.items || [];
      setPolicies(items);
      return items;
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.policies_load_error')));
      throw err;
    }
  };

  const savePolicy = async (payload) => {
    try {
      const resp = await apiUpsertPolicy({ ...payload, walletAddress: wallet, token });
      setSuccess?.(t?.('empresa.policy_saved'));
      await fetchPolicies(); // refresca listado
      return resp?.policy;
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.policy_save_error')));
      throw err;
    }
  };

  const removePolicy = async (policy_id) => {
    try {
      await apiDeletePolicy({ policy_id, walletAddress: wallet, token });
      setSuccess?.(t?.('empresa.policy_deleted'));
      await fetchPolicies();
      return { ok: true };
    } catch (err) {
      setError?.(getErrMessage(err, t?.('empresa.policy_delete_error')));
      throw err;
    }
  };

  return {
    // state
    isLoading,
    myPermissions,
    permissionsByWallet,
    rolesMeta,
    policies,

    // derived
    hasAllSucursales,
    allowedSucursalIds,
    allowedEmpresaIds,
    canSeeSucursal,

    // actions
    fetchMyPermissions,
    fetchPermissionsOfWallet,
    saveScopes,
    removeScopes,
    getCachedPermissionsOfWallet,
    primeMyPermissions,

    // ROLE LEVEL
    getRoleLevelScope,
    saveRoleLevelScope,
    clearRoleLevelScope,

    // NUEVO
    fetchRolesMeta,
    fetchPolicies,
    savePolicy,
    removePolicy,

    // API rules
    listApiAccessRules,
    upsertApiAccessRule,
    toggleApiAccessRule,
    deleteApiAccessRule,
  };
}

export default useRolesAccess;
