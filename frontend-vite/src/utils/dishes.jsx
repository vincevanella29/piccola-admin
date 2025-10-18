// src/utils/dishes.jsx
import api, { apiform } from './api.jsx';

const buildAuthHeaders = (appState) => {
  const token = appState?.token;
  const wallet = appState?.account;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (wallet) headers['X-Wallet-Address'] = wallet;
  return headers;
};

// Sincroniza catálogo (solo no sincronizados) contra Vanellix AI
export async function syncCatalog(appState) {
  return api({
    method: 'POST',
    endpoint: `/dishes/catalog/sync/`,
    withCredentials: true,
    headers: { ...buildAuthHeaders(appState), 'Content-Type': 'application/json' },
  });
}

/**
 * Clasifica una imagen contra el índice de platos.
 * Acepta:
 *  - file: Blob/File (preferido para frames de cámara)
 *  - image_url: string (el backend la descargará)
 * Si pasas ambos, prioriza `file`.
 */
export async function matchDish(appState, { file = null, image_url = null } = {}) {
  const headers = buildAuthHeaders(appState);
  if (file) {
    const form = new FormData();
    form.append('file', file, file.name || 'frame.jpg');
    return apiform({
      method: 'POST',
      endpoint: `/dishes/match`,
      withCredentials: true,
      headers, // NO seteamos Content-Type; el browser lo hace para multipart
      data: form,
    });
  }
  // JSON payload con image_url
  return api({
    method: 'POST',
    endpoint: `/dishes/match`,
    withCredentials: true,
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: JSON.stringify({ image_url }),
  });
}
