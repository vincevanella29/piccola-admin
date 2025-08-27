// utils/apikeys.jsx
// Mismo estilo que utils/analitycsData.jsx
import api from './api.jsx';

// Crear API key (solo roles 3 o 4)
export async function createApiKey({ name, expiryMonths = null, token, walletAddress }) {
  if (!name) throw new Error('name es obligatorio');
  return api({
    method: 'POST',
    endpoint: `/apikeys`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
    data: { name, expiry_months: expiryMonths },
  });
}

// Listar mis API keys
export async function listApiKeys({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: `/apikeys`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Revocar API key por id
export async function revokeApiKey({ keyId, token, walletAddress }) {
  if (!keyId) throw new Error('keyId es obligatorio');
  return api({
    method: 'DELETE',
    endpoint: `/apikeys/${encodeURIComponent(keyId)}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}
