// frontend-vite/src/utils/registro.jsx
// Helper API functions for Registro de Empleados (RUT + verificación facial)
// Estilo similar a utils/empresas.jsx y utils/analitycsData.jsx

import api, { apiFetchBinary, apiform } from './api.jsx';

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

// Escanear carnet (frente) para obtener descriptor de referencia (ArcFace)
export async function escanearCarnet({ rut, frontImageBlob, walletAddress, token }) {
  if (!rut) throw new Error('RUT es obligatorio');
  if (!frontImageBlob) throw new Error('Foto del carnet es obligatoria');

  const formData = new FormData();
  formData.append('rut', rut);
  formData.append('front_image', frontImageBlob, 'carnet_front.jpg');

  return apiform({
    method: 'POST',
    endpoint: '/registro/escanear_carnet',
    data: formData,
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

// Validar registro: enviar FOTO en vivo + descriptor de referencia (ArcFace)
// liveImageBlob: Blob/File de la captura final del rostro
// referenceDescriptor: float[] devuelto por /registro/escanear_carnet
// liveness: { turn_left: bool, turn_right: bool, look_forward: bool }
export async function validarRegistro({
  sessionId,
  rut,
  liveImageBlob,
  referenceDescriptor,
  liveness,
  walletAddress,
  token,
}) {
  if (!sessionId) throw new Error('sessionId es obligatorio');
  if (!rut) throw new Error('rut es obligatorio');
  if (!liveImageBlob) throw new Error('Falta la captura de imagen (liveImageBlob)');

  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('rut', rut);
  formData.append('live_image', liveImageBlob, 'capture.jpg');

  if (referenceDescriptor) {
    formData.append('reference_descriptor_json', JSON.stringify(referenceDescriptor));
  }

  if (liveness) {
    formData.append('liveness', JSON.stringify(liveness));
  }

  return apiform({
    method: 'POST',
    endpoint: '/registro/validar_arcface',
    data: formData,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
      // Importante: no establecer Content-Type; el navegador añadirá el boundary
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
  escanearCarnet,
};
