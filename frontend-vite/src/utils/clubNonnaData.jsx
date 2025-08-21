import api from './api';
import { apiform } from './api';

// Existing functions (fetchColors, fetchColorLevels, etc.)
export async function fetchColors() {
  return api({
    method: 'GET',
    endpoint: '/colors',
  });
}

export async function fetchColorLevels() {
  return api({
    method: 'GET',
    endpoint: '/color_levels',
  });
}

export async function fetchLocations() {
  return api({
    method: 'GET',
    endpoint: '/locations',
  });
}

export async function fetchMenus(walletAddress, token) {
  return api({
    method: 'GET',
    endpoint: '/menus',
    headers: {
      'X-Wallet-Address': walletAddress,
      Authorization: `Bearer ${token}`,
    },
  });
}

// New function to claim tokens
export async function fetchClaimTokens({ walletAddress, signature, plainData, token }) {
  return api({
    method: 'POST',
    endpoint: '/token/claim',
    data: {
      wallet: walletAddress,
      signature,
      plain_data: plainData,
    },
    headers: {
      'X-Wallet-Address': walletAddress,
      Authorization: `Bearer ${token}`,
    },
  });
}

// New function to check claim status
export async function fetchClaimStatus({ walletAddress, token }) {
  return api({
    method: 'GET',
    endpoint: '/token/claim/status',
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

export async function fetchRemainingClaims() {
  return api({
    method: 'GET',
    endpoint: '/token/claim/remaining',
  });
}

// Update a location (capacity, tables, chairs, description, media_urls)
export async function updateLocation({ locationId, data, walletAddress, token }) {
  return api({
    method: 'PATCH',
    endpoint: `/locations/${locationId}`,
    data,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Upload one or more photos to a location (multipart)
export async function uploadLocationPhotos({ locationId, files, walletAddress, token }) {
  const form = new FormData();
  (files || []).forEach((f) => form.append('files', f));
  return apiform({
    method: 'POST',
    endpoint: `/locations/${locationId}/photos`,
    data: form,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}