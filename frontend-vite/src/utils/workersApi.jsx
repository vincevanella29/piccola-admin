import api from './api.jsx';

// Obtener la lista de workers disponibles
export async function fetchAvailableWorkers({ appState }) {
  return api({
    method: 'get',
    endpoint: '/workers/list',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${appState.accessToken}`,
      'X-Wallet-Address': appState.account,
    },
  });
}

// Ejecutar uno, varios o todos los workers con un mesano específico
export async function executeWorkers({ mesano, include, exclude, appState }) {
  return api({
    method: 'post',
    endpoint: '/workers/execute',
    data: {
      mesano,
      include,
      exclude,
    },
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${appState.accessToken}`,
      'X-Wallet-Address': appState.account,
    },
  });
}
