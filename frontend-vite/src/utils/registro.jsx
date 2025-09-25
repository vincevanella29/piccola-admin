// frontend-vite/src/utils/registro.jsx
// Helper API functions for Registro de Empleados (RUT + verificación facial)
// Estilo similar a utils/empresas.jsx y utils/analitycsData.jsx

import api, { apiFetchBinary } from './api.jsx';

// Verificar existencia de RUT y disponibilidad de foto (no mostrar foto en UI)
export async function consultaRegistro({ rut, walletAddress, token }) {
  if (!rut) throw new Error('rut es obligatorio');
  const params = new URLSearchParams();
  params.append('rut', String(rut));
  return api({
    method: 'GET',
    endpoint: `/registro/consulta?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Iniciar registro: el usuario ingresa RUT y obtenemos session_id + challenge + (opcional) foto_url
export async function solicitarRegistro({ rut, walletAddress, token }) {
  if (!rut) throw new Error('rut es obligatorio');
  const data = { rut };
  return api({
    method: 'POST',
    endpoint: '/registro/solicitar',
    data,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Validar registro: enviar descriptores y flags de liveness
// liveDescriptor: float[] (128D)
// referenceDescriptor: float[] opcional (si el cliente lo calculó desde foto_url)
// liveDescriptorAlt: float[] opcional (para self-match si no hay referencia)
// liveness: { blink: bool, turn_left: bool, turn_right: bool }
export async function validarRegistro({
  sessionId,
  rut,
  liveDescriptor,
  referenceDescriptor = null,
  liveDescriptorAlt = null,
  liveness = {},
  walletAddress,
  token,
}) {
  if (!sessionId) throw new Error('sessionId es obligatorio');
  if (!rut) throw new Error('rut es obligatorio');
  if (!Array.isArray(liveDescriptor)) throw new Error('liveDescriptor debe ser un arreglo (float[])');

  const data = {
    session_id: sessionId,
    rut,
    live_descriptor: liveDescriptor,
  };
  if (Array.isArray(referenceDescriptor)) data.reference_descriptor = referenceDescriptor;
  if (Array.isArray(liveDescriptorAlt)) data.live_descriptor = liveDescriptorAlt;
  if (liveness && typeof liveness === 'object') data.liveness = liveness;

  return api({
    method: 'POST',
    endpoint: '/registro/validar',
    data,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Consultar estado del registro para un RUT
export async function getRegistroEstado({ rut, walletAddress, token }) {
  if (!rut) throw new Error('rut es obligatorio');
  const params = new URLSearchParams();
  params.append('rut', String(rut));
  return api({
    method: 'GET',
    endpoint: `/registro/estado?${params.toString()}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Construir URL del proxy de imagen de perfil (mismo origen)
export function buildFotoProxyUrl(imageUrl) {
  if (!imageUrl) throw new Error('imageUrl es obligatorio');
  const params = new URLSearchParams();
  params.append('url', String(imageUrl));
  return `/registro/foto_proxy?${params.toString()}`;
}

// Descargar la foto de referencia vía proxy (con headers y cookies)
export async function fetchFotoProxyBlob({ imageUrl, walletAddress, token }) {
  const endpoint = buildFotoProxyUrl(imageUrl);
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
  };
  return apiFetchBinary({ method: 'GET', endpoint, headers, withCredentials: true });
}

export default {
  consultaRegistro,
  solicitarRegistro,
  validarRegistro,
  getRegistroEstado,
  buildFotoProxyUrl,
  fetchFotoProxyBlob,
};
