// src/utils/cameras.js
import api, { apiform } from './api.jsx';

const buildAuthHeaders = (appState) => {
  const token = appState?.token;
  const wallet = appState?.account;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (wallet) headers['X-Wallet-Address'] = wallet;
  return headers;
};

// Listar configuraciones
export async function listCameras(appState) {
  return api({
    method: 'GET',
    endpoint: `/cameras/configs`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// Registrar cámara (local o vpn)
export async function registerCamera(appState, body) {
  return api({
    method: 'POST',
    endpoint: `/cameras/configs`,
    withCredentials: true,
    headers: { ...buildAuthHeaders(appState), 'Content-Type': 'application/json' },
    data: JSON.stringify(body),
  });
}

// Detalle de una cámara
export async function getCamera(appState, cid) {
  return api({
    method: 'GET',
    endpoint: `/cameras/configs/${cid}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// Eliminar cámara
export async function deleteCamera(appState, cid) {
  return api({
    method: 'DELETE',
    endpoint: `/cameras/configs/${cid}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// Subir archivo OVPN
export async function uploadOvpn(appState, cid, file) {
  const headers = buildAuthHeaders(appState);
  const form = new FormData();
  form.append('file', file, file.name || 'config.ovpn');
  return apiform({
    method: 'POST',
    endpoint: `/cameras/configs/${cid}/ovpn`,
    withCredentials: true,
    headers,
    data: form,
  });
}

// Actualizar credenciales de VPN
export async function updateVpnCreds(appState, cid, { username, password }) {
  return api({
    method: 'POST',
    endpoint: `/cameras/configs/${cid}/vpn-creds`,
    withCredentials: true,
    headers: { ...buildAuthHeaders(appState), 'Content-Type': 'application/json' },
    data: JSON.stringify({ username, password }),
  });
}

// Actualizar configuración local (IP/RTSP)
export async function updateLocal(appState, cid, payload) {
  return api({
    method: 'POST',
    endpoint: `/cameras/configs/${cid}/local`,
    withCredentials: true,
    headers: { ...buildAuthHeaders(appState), 'Content-Type': 'application/json' },
    data: JSON.stringify(payload),
  });
}

// Iniciar procesos (grabador y/o HLS)
export async function startCamera(appState, cid) {
  return api({
    method: 'POST',
    endpoint: `/cameras/${cid}/start`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// Detener procesos
export async function stopCamera(appState, cid) {
  return api({
    method: 'POST',
    endpoint: `/cameras/${cid}/stop`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// Estado de procesos
export async function cameraStatus(appState, cid) {
  return api({
    method: 'GET',
    endpoint: `/cameras/${cid}/status`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// Listo para reproducir (HLS tiene segmentos vivos)
export async function cameraReady(appState, cid, timeoutMs = 0) {
  const t = Math.max(0, parseInt(timeoutMs || 0, 10));
  return api({
    method: 'GET',
    endpoint: `/cameras/${cid}/ready${t ? `?timeout=${t}` : ''}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
}

// PTZ control
export async function ptzControl(appState, cid, command, duration_ms) {
  return api({
    method: 'POST',
    endpoint: `/cameras/${cid}/ptz`,
    withCredentials: true,
    headers: { ...buildAuthHeaders(appState), 'Content-Type': 'application/json' },
    data: JSON.stringify({ command, duration_ms }),
  });
}

// Activar/desactivar HLS en vivo
export async function toggleLive(appState, cid, enabled) {
  return api({
    method: 'POST',
    endpoint: `/cameras/configs/${cid}/live`,
    withCredentials: true,
    headers: { ...buildAuthHeaders(appState), 'Content-Type': 'application/json' },
    data: JSON.stringify({ enabled }),
  });
}

// Listar grabaciones VOD
export async function listRecordings(appState, cid, { start, end }) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const response = await api({ // <-- Captura la respuesta completa
    method: 'GET',
    endpoint: `/cameras/${cid}/recordings?${params.toString()}`,
    withCredentials: true,
    headers: buildAuthHeaders(appState),
  });
  return response.segments || []; // <-- Devuelve el array de segmentos
}