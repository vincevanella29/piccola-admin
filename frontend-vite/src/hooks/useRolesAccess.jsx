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
} from '../utils/rolesAccess.jsx';

function getErrMessage(err, fallback = 'Error') {
  // adapta según tu capa api.jsx si usas axios/fetch
  const d = err?.response?.data;
  return (
    d?.detail?.message ||
    d?.detail ||
    d?.error ||
    err?.message ||
    fallback
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

  // ------- actions (existentes) -------
  const fetchMyPermissions = async () => {
    setIsLoading(true);
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      const resp = await apiGetMyPermissions({ walletAddress: wallet, token });
      const perms = resp?.permissions || null;
      setMyPermissions(perms);
      return perms;
    } catch (err) {
      const msg = getErrMessage(err, 'No se pudieron obtener tus permisos');
      setError?.(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPermissionsOfWallet = async ({ targetWallet }) => {
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      if (!targetWallet) throw new Error(t?.('roles.target_wallet_required') || 'targetWallet es obligatorio');
      const resp = await apiGetPermissionsOfWallet({ targetWallet, walletAddress: wallet, token });
      const perms = resp?.permissions || null;
      setPermissionsByWallet((prev) => ({ ...prev, [targetWallet.toLowerCase()]: perms }));
      return perms;
    } catch (err) {
      const msg = getErrMessage(err, 'No se pudieron obtener permisos del wallet objetivo');
      setError?.(msg);
      throw err;
    }
  };

  const saveScopes = async ({ targetWallet, role_level, empresa_ids, sucursal_ids }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      if (!targetWallet) throw new Error(t?.('roles.target_wallet_required') || 'targetWallet es obligatorio');
      const resp = await apiUpsertScopes({ targetWallet, role_level, empresa_ids, sucursal_ids, walletAddress: wallet, token });
      const perms = resp?.permissions || null;
      setPermissionsByWallet((prev) => ({ ...prev, [targetWallet.toLowerCase()]: perms }));
      setSuccess?.(t?.('roles.scopes_saved') || 'Scopes guardados');
      if (targetWallet?.toLowerCase?.() === wallet?.toLowerCase?.()) setMyPermissions(perms);
      return perms;
    } catch (err) {
      const msg = getErrMessage(err, 'No se pudieron guardar los scopes');
      setError?.(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeScopes = async ({ targetWallet }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      if (!targetWallet) throw new Error(t?.('roles.target_wallet_required') || 'targetWallet es obligatorio');
      await apiClearScopes({ targetWallet, walletAddress: wallet, token });
      setPermissionsByWallet((prev) => {
        const copy = { ...prev };
        delete copy[targetWallet.toLowerCase()];
        return copy;
      });
      setSuccess?.(t?.('roles.scopes_cleared') || 'Scopes eliminados');
      if (targetWallet?.toLowerCase?.() === wallet?.toLowerCase?.()) await fetchMyPermissions();
      return { ok: true };
    } catch (err) {
      const msg = getErrMessage(err, 'No se pudieron eliminar los scopes');
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
      setError?.(getErrMessage(err, 'No se pudo cargar metadata de roles'));
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
      setError?.(getErrMessage(err, 'No se pudieron cargar políticas'));
      throw err;
    }
  };

  const savePolicy = async (payload) => {
    try {
      const resp = await apiUpsertPolicy({ ...payload, walletAddress: wallet, token });
      setSuccess?.(t?.('roles.policy_saved') || 'Política guardada');
      await fetchPolicies(); // refresca listado
      return resp?.policy;
    } catch (err) {
      setError?.(getErrMessage(err, 'No se pudo guardar la política'));
      throw err;
    }
  };

  const removePolicy = async (policy_id) => {
    try {
      await apiDeletePolicy({ policy_id, walletAddress: wallet, token });
      setSuccess?.(t?.('roles.policy_deleted') || 'Política eliminada');
      await fetchPolicies();
      return { ok: true };
    } catch (err) {
      setError?.(getErrMessage(err, 'No se pudo eliminar la política'));
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
  };
}

export default useRolesAccess;
