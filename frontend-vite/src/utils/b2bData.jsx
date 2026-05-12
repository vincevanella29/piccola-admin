// src/utils/b2bData.jsx — API calls for B2B partner portal
// Follows the same auth pattern as marketingData.jsx
import api from './api.jsx';

// =====================================================================
// Helper — common auth headers
// =====================================================================
const authHeaders = ({ token, walletAddress }) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
});

// ── Partner (self-service) ─────────────────────────────────
export async function fetchMyCompany({ token, walletAddress }) {
  return api({
    method: 'GET', endpoint: '/b2b/my-company',
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function registerCompany({ token, walletAddress, data }) {
  return api({
    method: 'POST', endpoint: '/b2b/register',
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function generateCredentials({ token, walletAddress }) {
  return api({
    method: 'POST', endpoint: '/b2b/credentials',
    data: {}, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function recoverCredentials({ token, walletAddress, message, signature }) {
  return api({
    method: 'POST', endpoint: '/b2b/credentials/recover',
    data: { message, signature }, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── Admin ──────────────────────────────────────────────────
export async function fetchPartners({ token, walletAddress }) {
  return api({
    method: 'GET', endpoint: '/admin/b2b/partners',
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function updatePartnerStatus({ token, walletAddress, partnerId, status }) {
  return api({
    method: 'PUT', endpoint: `/admin/b2b/partners/${partnerId}/status`,
    data: { status }, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function createB2BPromotion({ token, walletAddress, partnerId, data }) {
  return api({
    method: 'POST', endpoint: `/admin/b2b/partners/${partnerId}/promotions`,
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function fetchPartnerPromotions({ token, walletAddress, partnerId }) {
  return api({
    method: 'GET', endpoint: `/admin/b2b/partners/${partnerId}/promotions`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function toggleB2BPromotion({ token, walletAddress, allocationId }) {
  return api({
    method: 'PUT', endpoint: `/admin/b2b/allocations/${allocationId}/toggle`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}
