// src/utils/miFicha.jsx

import api from './api.jsx';

export async function getMiFicha({ walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  return api({
    method: 'GET',
    endpoint: '/mi/ficha',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getSueldos({ periodoStart, periodoEnd, walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  const params = new URLSearchParams();
  if (periodoStart) params.append('periodo_start', String(periodoStart));
  if (periodoEnd) params.append('periodo_end', String(periodoEnd));
  return api({
    method: 'GET',
    endpoint: `/mi/sueldos${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getLiquidacionDetalle({ liquidationId, idTalanaSueldo, walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  if (!liquidationId && idTalanaSueldo == null) throw new Error('liquidationId o idTalanaSueldo es obligatorio');
  const params = new URLSearchParams();
  if (liquidationId) params.append('liquidation_id', String(liquidationId));
  if (idTalanaSueldo != null) params.append('id_talana_sueldo', String(idTalanaSueldo));
  return api({
    method: 'GET',
    endpoint: `/mi/ficha/liquidacion?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getAsistenciaKpis({ startPeriodo, endPeriodo, walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  if (!startPeriodo || !endPeriodo) throw new Error('startPeriodo y endPeriodo son obligatorios');
  const params = new URLSearchParams();
  params.append('periodo_start', String(startPeriodo));
  params.append('periodo_end', String(endPeriodo));
  return api({
    method: 'GET',
    endpoint: `/mi/asistencia-kpis?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getMeritos({ ym, walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  const params = new URLSearchParams();
  if (ym) params.append('ym', ym);
  return api({
    method: 'GET',
    endpoint: `/mi/meritos${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getVentasTotal({ walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  return api({
    method: 'GET',
    endpoint: '/mi/ventas/total',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getVentasPorPeriodo({ periodoStart, periodoEnd, walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  const params = new URLSearchParams();
  if (periodoStart) params.append('periodo_start', String(periodoStart));
  if (periodoEnd) params.append('periodo_end', String(periodoEnd));
  return api({
    method: 'GET',
    endpoint: `/mi/ventas/por-periodo${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export async function getVentasKpisUltimos({ walletAddress, token }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  return api({
    method: 'GET',
    endpoint: '/mi/ventas/kpis-ultimos',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

// Nuevo: análisis detallado de ventas de productos (Últimos 3 meses vs Año Anterior)
export async function getVentasDetalleProductos({ walletAddress, token, periodo_start, periodo_end }) {
  if (!walletAddress) throw new Error('walletAddress es obligatorio');
  const params = new URLSearchParams();
  if (periodo_start) params.append('periodo_start', String(periodo_start));
  if (periodo_end) params.append('periodo_end', String(periodo_end));
  return api({
    method: 'GET',
    endpoint: `/mi/ventas/detalle-productos${params.toString() ? `?${params.toString()}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Wallet-Address': walletAddress,
    },
  });
}

export default {
  getMiFicha,
  getSueldos,
  getLiquidacionDetalle,
  getAsistenciaKpis,
  getMeritos,
  getVentasTotal,
  getVentasPorPeriodo,
  getVentasKpisUltimos,
  getVentasDetalleProductos,
};