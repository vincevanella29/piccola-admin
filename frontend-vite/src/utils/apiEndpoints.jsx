import api from './api.jsx';

export async function getCollections({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: `/endpoints/collections`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function createEndpoint({ data, token, walletAddress }) {
  return api({
    method: 'POST',
    endpoint: `/endpoints`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
    data,
  });
}

export async function listEndpoints({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: `/endpoints`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function updateEndpoint({ slug, data, token, walletAddress }) {
  return api({
    method: 'PUT',
    endpoint: `/endpoints/${slug}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
    data,
  });
}

export async function deleteEndpoint({ slug, token, walletAddress }) {
  return api({
    method: 'DELETE',
    endpoint: `/endpoints/${slug}`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}
