// frontend-vite/src/utils/empresas.js
// Helper API functions for Empresas, similar style to utils/analitycsData.jsx

import api from './api.jsx';

// Crear empresa
export async function createEmpresa({
  nombre,
  slug = null,
  descripcion = null,
  sucursales = null,
  cuentas_include = null,
  cuentas_exclude = null,
  walletAddress,
  token,
}) {
  if (!nombre) throw new Error('nombre es obligatorio');
  const payload = { nombre };
  if (slug) payload.slug = slug;
  if (descripcion) payload.descripcion = descripcion;
  if (Array.isArray(sucursales)) payload.sucursales = sucursales;
  if (Array.isArray(cuentas_include)) payload.cuentas_include = cuentas_include;
  if (Array.isArray(cuentas_exclude)) payload.cuentas_exclude = cuentas_exclude;

  return api({
    method: 'POST',
    endpoint: '/empresas',
    data: payload,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Actualizar empresa (PATCH)
export async function updateEmpresa({ empresaId, data = {}, walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  // data puede contener: nombre, slug, descripcion, sucursales, cuentas_include, cuentas_exclude, resumen2_include, resumen2_exclude
  return api({
    method: 'PATCH',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}`,
    data,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Obtener empresa
export async function getEmpresa({ empresaId, walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  return api({
    method: 'GET',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Asignar sucursales a empresa
export async function assignSucursales({ empresaId, id_sucursales = [], walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  if (!Array.isArray(id_sucursales) || id_sucursales.length === 0) {
    throw new Error('id_sucursales debe ser un arreglo no vacío');
  }
  return api({
    method: 'POST',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/sucursales`,
    data: { id_sucursales },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Desasignar sucursal de empresa
export async function unassignSucursal({ empresaId, id_sucursal, walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  if (id_sucursal === null || id_sucursal === undefined) throw new Error('id_sucursal es obligatorio');
  return api({
    method: 'DELETE',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/sucursales/${encodeURIComponent(String(id_sucursal))}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Incluir cuentas en empresa
export async function includeCuentas({ empresaId, cuentas = [], walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  if (!Array.isArray(cuentas) || cuentas.length === 0) throw new Error('cuentas debe ser un arreglo no vacío');
  return api({
    method: 'POST',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/cuentas/include`,
    data: { cuentas },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Excluir cuentas en empresa
export async function excludeCuentas({ empresaId, cuentas = [], walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  if (!Array.isArray(cuentas) || cuentas.length === 0) throw new Error('cuentas debe ser un arreglo no vacío');
  return api({
    method: 'POST',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/cuentas/exclude`,
    data: { cuentas },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Incluir cuentas por resumen2
export async function includeCuentasByResumen2({ empresaId, resumen2 = [], walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  if (!Array.isArray(resumen2) || resumen2.length === 0) throw new Error('resumen2 debe ser un arreglo no vacío');
  return api({
    method: 'POST',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/cuentas/include-by-resumen2`,
    data: { resumen2 },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Excluir cuentas por resumen2
export async function excludeCuentasByResumen2({ empresaId, resumen2 = [], walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  if (!Array.isArray(resumen2) || resumen2.length === 0) throw new Error('resumen2 debe ser un arreglo no vacío');
  return api({
    method: 'POST',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/cuentas/exclude-by-resumen2`,
    data: { resumen2 },
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Listar cuentas derivadas de empresa
export async function getEmpresaCuentas({ empresaId, only_ids = false, walletAddress, token }) {
  if (!empresaId) throw new Error('empresaId es obligatorio');
  const params = new URLSearchParams();
  if (only_ids) params.append('only_ids', String(only_ids));
  return api({
    method: 'GET',
    endpoint: `/empresas/${encodeURIComponent(String(empresaId))}/cuentas${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Listar cuentas refs con filtros
export async function listCuentasRefs({ page = 1, limit = 50, q = '', resumen2 = [], es_operacional = null, es_cuenta = null, walletAddress, token }) {
  const params = new URLSearchParams();
  const safeLimit = limit || 50;
  const skip = Math.max(0, (Number(page) - 1) * Number(safeLimit));
  params.append('skip', String(skip));
  params.append('limit', String(safeLimit));
  if (q) params.append('q', q);
  if (Array.isArray(resumen2)) resumen2.forEach((r) => params.append('resumen2', r));
  if (es_operacional === 0 || es_operacional === 1) params.append('es_operacional', String(es_operacional));
  if (es_cuenta === 0 || es_cuenta === 1) params.append('es_cuenta', String(es_cuenta));
  return api({
    method: 'GET',
    endpoint: `/empresas-refs/cuentas?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Listar sucursales refs
export async function listSucursalesRefs({ page = 1, limit = 200, q = '', walletAddress, token }) {
  const params = new URLSearchParams();
  const safeLimit = limit || 200;
  const skip = Math.max(0, (Number(page) - 1) * Number(safeLimit));
  params.append('skip', String(skip));
  params.append('limit', String(safeLimit));
  if (q) params.append('q', q);
  return api({
    method: 'GET',
    endpoint: `/empresas/refs/sucursales?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Listar empresas (paginado + búsqueda)
export async function listEmpresas({ page = 1, limit = 20, q = '', walletAddress, token }) {
  const params = new URLSearchParams();
  const safeLimit = limit || 20;
  const skip = Math.max(0, (Number(page) - 1) * Number(safeLimit));
  params.append('skip', String(skip));
  params.append('limit', String(safeLimit));
  if (q) params.append('q', q);
  return api({
    method: 'GET',
    endpoint: `/empresas?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export default {
  createEmpresa,
  getEmpresa,
  updateEmpresa,
  assignSucursales,
  unassignSucursal,
  includeCuentas,
  excludeCuentas,
  includeCuentasByResumen2,
  excludeCuentasByResumen2,
  getEmpresaCuentas,
  listCuentasRefs,
  listSucursalesRefs,
  listEmpresas,
};
