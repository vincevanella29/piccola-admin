// src/hooks/useEmpresaAdmin.jsx
// React hook para administrar Empresas, similar en estilo a usePromotionAdmin

import { useState } from 'react';
import {
  createEmpresa as apiCreateEmpresa,
  getEmpresa as apiGetEmpresa,
  updateEmpresa as apiUpdateEmpresa,
  assignSucursales as apiAssignSucursales,
  unassignSucursal as apiUnassignSucursal,
  includeCuentas as apiIncludeCuentas,
  excludeCuentas as apiExcludeCuentas,
  getEmpresaCuentas as apiGetEmpresaCuentas,
  listEmpresas as apiListEmpresas,
  listCuentasRefs as apiListCuentasRefs,
  listSucursalesRefs as apiListSucursalesRefs,
  includeCuentasByResumen2 as apiIncludeCuentasByResumen2,
  excludeCuentasByResumen2 as apiExcludeCuentasByResumen2,
  auditWorkers as apiAuditWorkers,
} from '../utils/empresas.jsx';

export function useEmpresaAdmin(appState, t) {
  const setError = appState?.setError;
  const [isLoading, setIsLoading] = useState(false);
  const [empresa, setEmpresa] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [empresasCache, setEmpresasCache] = useState([]);
  const [empresasById, setEmpresasById] = useState({});

  const wallet = appState?.account;
  const token = appState?.token;

  // Crear empresa
  const create = async ({ nombre, slug = null, descripcion = null, sucursales = null, cuentas_include = null, cuentas_exclude = null }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiCreateEmpresa({
        nombre,
        slug,
        descripcion,
        sucursales,
        cuentas_include,
        cuentas_exclude,
        walletAddress: wallet,
        token,
      });
      setEmpresa(resp);
      appState?.setSuccess?.(t?.('empresa.created_success', { name: nombre }) || 'Empresa creada');
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_create', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar empresa (PATCH)
  const update = async ({ empresaId, data }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiUpdateEmpresa({ empresaId, data, walletAddress: wallet, token });
      setEmpresa(resp);
      appState?.setSuccess?.(t?.('empresa.updated_success') || 'Empresa actualizada');
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_update', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Listar cuentas refs (para selección)
  const listCuentasRefs = async ({ page = 1, limit = 50, q = '', resumen2 = [], es_operacional = null, es_cuenta = null } = {}) => {
    try {
      if (!wallet || !token) {
        throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      }
      const data = await apiListCuentasRefs({ page, limit, q, resumen2, es_operacional, es_cuenta, walletAddress: wallet, token });
      return { items: data?.items || [], total: data?.total || 0 };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Listar sucursales refs (para selección)
  const listSucursalesRefs = async ({ page = 1, limit = 200, q = '' } = {}) => {
    try {
      if (!wallet || !token) {
        throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      }
      const data = await apiListSucursalesRefs({ page, limit, q, walletAddress: wallet, token });
      return { items: data?.items || [], total: data?.total || 0 };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Incluir cuentas por resumen2
  const includeCuentasByResumen2 = async ({ empresaId, resumen2 = [] }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiIncludeCuentasByResumen2({ empresaId, resumen2, walletAddress: wallet, token });
      appState?.setSuccess?.(t?.('empresa.cuentas_included') || 'Cuentas incluidas');
      // refrescar empresa opcional
      const refreshed = await apiGetEmpresa({ empresaId, walletAddress: wallet, token });
      setEmpresa(refreshed);
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_include_cuentas', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Excluir cuentas por resumen2
  const excludeCuentasByResumen2 = async ({ empresaId, resumen2 = [] }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiExcludeCuentasByResumen2({ empresaId, resumen2, walletAddress: wallet, token });
      appState?.setSuccess?.(t?.('empresa.cuentas_excluded') || 'Cuentas excluidas');
      // refrescar empresa opcional
      const refreshed = await apiGetEmpresa({ empresaId, walletAddress: wallet, token });
      setEmpresa(refreshed);
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_exclude_cuentas', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Prime/cache empresas list to avoid extra network on selection
  const primeEmpresas = async ({ page = 1, limit = 200, q = '' } = {}) => {
    try {
      if (!wallet || !token) {
        throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      }
      const cappedLimit = Math.min(Number(limit) || 200, 200);
      const data = await apiListEmpresas({ page, limit: cappedLimit, q, walletAddress: wallet, token });
      const items = data?.items || [];
      setEmpresasCache(items);
      const byId = {};
      for (const it of items) {
        const id = it?._id || it?.id || it?.empresa_id;
        if (id) byId[String(id)] = it;
      }
      setEmpresasById(byId);
      return { items, total: data?.total || items.length };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Listar empresas (paginado + búsqueda) y actualizar cache
  const listEmpresas = async ({ page = 1, limit = 20, q = '' } = {}) => {
    try {
      if (!wallet || !token) {
        throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
      }
      const data = await apiListEmpresas({ page, limit, q, walletAddress: wallet, token });
      const items = data?.items || [];
      // merge/update cache
      const byId = { ...empresasById };
      for (const it of items) {
        const id = it?._id || it?.id || it?.empresa_id;
        if (id) byId[String(id)] = { ...(byId[String(id)] || {}), ...it };
      }
      setEmpresasById(byId);
      // keep a simple union array (dedup by id)
      const seen = new Set();
      const merged = [...empresasCache, ...items].filter((it) => {
        const id = it?._id || it?.id || it?.empresa_id;
        if (!id) return false;
        const k = String(id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((it) => byId[String(it?._id || it?.id || it?.empresa_id)] || it);
      setEmpresasCache(merged);
      return { items, total: data?.total || items.length };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getEmpresaFromCache = (empresaId) => {
    if (!empresaId) return null;
    const key = String(empresaId);
    return empresasById[key] || null;
  };

  // Obtener empresa por ID
  const refetchEmpresa = async ({ empresaId }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiGetEmpresa({ empresaId, walletAddress: wallet, token });
      setEmpresa(resp);
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_fetch', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Asignar sucursales
  const assignSucursales = async ({ empresaId, id_sucursales }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiAssignSucursales({ empresaId, id_sucursales, walletAddress: wallet, token });
      // la API devuelve la empresa actualizada
      setEmpresa(resp);
      appState?.setSuccess?.(t?.('empresa.sucursales_assigned') || 'Sucursales asignadas');
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_assign_sucursales', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Desasignar sucursal
  const unassignSucursal = async ({ empresaId, id_sucursal }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      await apiUnassignSucursal({ empresaId, id_sucursal, walletAddress: wallet, token });
      // Refrescar empresa luego de desasignar
      const refreshed = await apiGetEmpresa({ empresaId, walletAddress: wallet, token });
      setEmpresa(refreshed);
      appState?.setSuccess?.(t?.('empresa.sucursal_unassigned') || 'Sucursal desasignada');
      return { ok: true };
    } catch (err) {
      setError(t?.('empresa.error_unassign_sucursal', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Incluir cuentas
  const includeCuentas = async ({ empresaId, cuentas: cuentasToInclude = [] }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiIncludeCuentas({ empresaId, cuentas: cuentasToInclude, walletAddress: wallet, token });
      appState?.setSuccess?.(t?.('empresa.cuentas_included') || 'Cuentas incluidas');
      // opcional: refrescar empresa
      const refreshed = await apiGetEmpresa({ empresaId, walletAddress: wallet, token });
      setEmpresa(refreshed);
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_include_cuentas', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Excluir cuentas
  const excludeCuentas = async ({ empresaId, cuentas: cuentasToExclude = [] }) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return null;
      }
      const resp = await apiExcludeCuentas({ empresaId, cuentas: cuentasToExclude, walletAddress: wallet, token });
      appState?.setSuccess?.(t?.('empresa.cuentas_excluded') || 'Cuentas excluidas');
      // opcional: refrescar empresa
      const refreshed = await apiGetEmpresa({ empresaId, walletAddress: wallet, token });
      setEmpresa(refreshed);
      return resp;
    } catch (err) {
      setError(t?.('empresa.error_exclude_cuentas', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Listar cuentas derivadas
  const refetchEmpresaCuentas = async ({ empresaId, only_ids = false } = {}) => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return { cuentas: [], count: 0 };
      }
      const resp = await apiGetEmpresaCuentas({ empresaId, only_ids, walletAddress: wallet, token });
      if (only_ids) {
        setCuentas(resp || []);
        return { cuentas: resp || [], count: Array.isArray(resp) ? resp.length : 0 };
      }
      setCuentas(resp?.cuentas || []);
      return { cuentas: resp?.cuentas || [], count: resp?.count || 0 };
    } catch (err) {
      setError(t?.('empresa.error_fetch_cuentas', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Auditoria de Empleados
  const fetchAuditWorkers = async () => {
    setIsLoading(true);
    try {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
        return { audit: [], total: 0 };
      }
      return await apiAuditWorkers({ walletAddress: wallet, token });
    } catch (err) {
      setError(t?.('empresa.error_fetch_audit', { message: err.message }) || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // state
    isLoading,
    empresa,
    cuentas,
    empresasCache,
    // actions
    create,
    update,
    refetchEmpresa,
    assignSucursales,
    unassignSucursal,
    includeCuentas,
    excludeCuentas,
    includeCuentasByResumen2,
    excludeCuentasByResumen2,
    refetchEmpresaCuentas,
    listEmpresas,
    primeEmpresas,
    getEmpresaFromCache,
    listCuentasRefs,
    listSucursalesRefs,
    fetchAuditWorkers,
  };
}

export default useEmpresaAdmin;
