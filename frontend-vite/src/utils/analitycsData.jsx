// utils/analitycsData.js
import api from './api.jsx';

// --- Gastos ---

export async function getGastosTotals({
  start_date,
  end_date,
  by = 'resumen2',
  include_daily = true,
  exclude_cuentas = [],
  include_resumen2 = [],
  exclude_resumen2 = [],
  include_sucursales_ids = [],
  include_siglas = [],
  walletAddress,
  token,
  skip = 0,
  limit = null,
}) {
  if (!start_date || !end_date) throw new Error('Las fechas son obligatorias');
  const params = new URLSearchParams({ start_date, end_date, by, include_daily: String(include_daily), skip });
  if (limit) params.append('limit', limit);
  if (Array.isArray(exclude_cuentas) && exclude_cuentas.length) {
    params.append('exclude_cuentas', exclude_cuentas.join(','));
  }
  if (Array.isArray(include_resumen2) && include_resumen2.length) {
    params.append('include_resumen2', include_resumen2.join(','));
  }
  if (Array.isArray(exclude_resumen2) && exclude_resumen2.length) {
    params.append('exclude_resumen2', exclude_resumen2.join(','));
  }
  if (Array.isArray(include_sucursales_ids) && include_sucursales_ids.length) {
    params.append('include_sucursales_ids', include_sucursales_ids.join(','));
  }
  if (Array.isArray(include_siglas) && include_siglas.length) {
    params.append('include_siglas', include_siglas.join(','));
  }
  console.log(params.toString());
  return api({
    method: 'GET',
    endpoint: `/gastos/totals?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function getClima({ start_date, end_date, permalink_slug = null, walletAddress, token, skip = 0, limit = null }) {
  if (!start_date || !end_date) throw new Error('Las fechas son obligatorias');
  const params = new URLSearchParams({ start_date, end_date, skip });
  if (limit) params.append('limit', limit);
  if (permalink_slug) params.append('permalink_slug', permalink_slug);
  return api({
    method: 'GET',
    endpoint: `/clima?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function getGastosSummary({ start_date, end_date, walletAddress, token, skip = 0, limit = null }) {
  if (!start_date || !end_date) throw new Error('Las fechas son obligatorias');
  const params = new URLSearchParams({ start_date, end_date, skip });
  if (limit) params.append('limit', limit);
  return api({
    method: 'GET',
    endpoint: `/gastos/summary?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function getAvailableGastosDates() {
  return api({
    method: 'GET',
    endpoint: '/gastos/available-dates',
    withCredentials: true,
  });
}

// --- Ventas ---

export async function getVentasSummary({ start_date, end_date, include_local = [], walletAddress, token, skip = 0, limit = null }) {
  if (!start_date || !end_date) throw new Error('Las fechas son obligatorias');
  const params = new URLSearchParams({ start_date, end_date, skip });
  if (limit) params.append('limit', limit);
  if (Array.isArray(include_local) && include_local.length) {
    params.append('include_local', include_local.join(','));
  }
  return api({
    method: 'GET',
    endpoint: `/ventas/summary?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function getAvailableVentasDates() {
  return api({
    method: 'GET',
    endpoint: '/ventas/available-dates',
    withCredentials: true,
  });
}

// --- Trabajadores ---

export async function getTrabajadoresActivos({
  sucursal = null,
  cargo = null,
  q = null,
  skip = 0,
  limit = 100,
  walletAddress,
  token,
}) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (sucursal) params.append('sucursal', sucursal);
  if (cargo) params.append('cargo', cargo);
  if (q) params.append('q', q);
  return api({
    method: 'GET',
    endpoint: `/trabajadores/activos?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function getTrabajadorByRut({ rut, walletAddress, token }) {
  if (!rut && rut !== 0) throw new Error('rut es obligatorio');
  return api({
    method: 'GET',
    endpoint: `/trabajadores/${encodeURIComponent(String(rut))}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// --- Asistencia ---

export async function getAsistenciaDiaria({
  start_date,
  end_date,
  rut = null,
  id_sucursal = null,
  tipo_marca = null,
  sucursal_slug = null,
  sucursal_activa = null,
  walletAddress,
  token,
  skip = 0,
  limit = null,
}) {
  if (!start_date || !end_date) throw new Error('Las fechas son obligatorias');
  const params = new URLSearchParams({ start_date, end_date, skip });
  if (limit) params.append('limit', limit);
  if (rut) params.append('rut', rut);
  if (id_sucursal) params.append('id_sucursal', id_sucursal);
  if (tipo_marca) params.append('tipo_marca', tipo_marca);
  if (sucursal_slug) params.append('sucursal_slug', sucursal_slug);
  if (sucursal_activa !== null && sucursal_activa !== undefined) {
    params.append('sucursal_activa', String(sucursal_activa));
  }
  return api({
    method: 'GET',
    endpoint: `/asistencia/diaria?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function getAsistenciaPorSucursal({
  start_date,
  end_date,
  rut = null,
  id_sucursal = null,
  tipo_marca = null,
  sucursal_slug = null,
  sucursal_activa = null,
  walletAddress,
  token,
  skip = 0,
  limit = null,
}) {
  if (!start_date || !end_date) throw new Error('Las fechas son obligatorias');
  const params = new URLSearchParams({ start_date, end_date, skip });
  if (limit) params.append('limit', limit);
  if (rut) params.append('rut', rut);
  if (id_sucursal) params.append('id_sucursal', id_sucursal);
  if (tipo_marca) params.append('tipo_marca', tipo_marca);
  if (sucursal_slug) params.append('sucursal_slug', sucursal_slug);
  if (sucursal_activa !== null && sucursal_activa !== undefined) {
    params.append('sucursal_activa', String(sucursal_activa));
  }
  return api({
    method: 'GET',
    endpoint: `/asistencia/diaria/por-sucursal?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// --- Sueldos ---

export async function getSueldos({
  rut = null,
  periodo = null,
  periodo_start = null,
  periodo_end = null,
  centro_costo = null,
  walletAddress,
  token,
  skip = 0,
  limit = 100,
}) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (rut !== null && rut !== undefined) params.append('rut', String(rut));
  if (periodo) params.append('periodo', periodo);
  if (periodo_start) params.append('periodo_start', periodo_start);
  if (periodo_end) params.append('periodo_end', periodo_end);
  if (centro_costo !== null && centro_costo !== undefined) params.append('centro_costo', String(centro_costo));
  return api({
    method: 'GET',
    endpoint: `/sueldos?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}
