// src/utils/marketingData.jsx — API calls for marketing/mailing
// Follows the same auth pattern as deliveryData.jsx
import api from './api.jsx';

// =====================================================================
// Helper — common auth headers
// =====================================================================
const authHeaders = ({ token, walletAddress }) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
});

// ── Templates ──────────────────────────────────────────────
export async function fetchTemplates({ token, walletAddress, type }) {
  const params = {};
  if (type) params.type = type;
  return api({
    method: 'GET', endpoint: '/mailing/templates',
    params, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function createTemplate({ token, walletAddress, data }) {
  return api({
    method: 'POST', endpoint: '/mailing/templates',
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function updateTemplate({ token, walletAddress, id, data }) {
  return api({
    method: 'PUT', endpoint: `/mailing/templates/${id}`,
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function deleteTemplate({ token, walletAddress, id }) {
  return api({
    method: 'DELETE', endpoint: `/mailing/templates/${id}`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function previewTemplate({ token, walletAddress, id, data }) {
  return api({
    method: 'POST', endpoint: `/mailing/templates/${id}/preview`,
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function sendTestEmail({ token, walletAddress, id }) {
  return api({
    method: 'POST', endpoint: `/mailing/templates/${id}/send-test`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── Campaigns ──────────────────────────────────────────────
export async function fetchCampaigns({ token, walletAddress, status }) {
  const params = {};
  if (status) params.status = status;
  return api({
    method: 'GET', endpoint: '/mailing/campaigns',
    params, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function createCampaign({ token, walletAddress, data }) {
  return api({
    method: 'POST', endpoint: '/mailing/campaigns',
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function updateCampaign({ token, walletAddress, id, data }) {
  return api({
    method: 'PUT', endpoint: `/mailing/campaigns/${id}`,
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function sendCampaign({ token, walletAddress, id }) {
  return api({
    method: 'POST', endpoint: `/mailing/campaigns/${id}/send`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function campaignStats({ token, walletAddress, id }) {
  return api({
    method: 'GET', endpoint: `/mailing/campaigns/${id}/stats`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function cancelCampaign({ token, walletAddress, id }) {
  return api({
    method: 'POST', endpoint: `/mailing/campaigns/${id}/cancel`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function deleteCampaign({ token, walletAddress, id }) {
  return api({
    method: 'DELETE', endpoint: `/mailing/campaigns/${id}`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── Automations ────────────────────────────────────────────
export async function fetchAutomations({ token, walletAddress }) {
  return api({
    method: 'GET', endpoint: '/mailing/automations',
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function createAutomation({ token, walletAddress, data }) {
  return api({
    method: 'POST', endpoint: '/mailing/automations',
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function updateAutomation({ token, walletAddress, id, data }) {
  return api({
    method: 'PUT', endpoint: `/mailing/automations/${id}`,
    data, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function toggleAutomation({ token, walletAddress, id }) {
  return api({
    method: 'PATCH', endpoint: `/mailing/automations/${id}/toggle`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function deleteAutomation({ token, walletAddress, id }) {
  return api({
    method: 'DELETE', endpoint: `/mailing/automations/${id}`,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── AI Assistant ───────────────────────────────────────────
export async function marketingAIChat({ token, walletAddress, message, history, context }) {
  return api({
    method: 'POST', endpoint: '/mailing/ai/chat',
    data: { message, history, context },
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── Products (for template editor) ────────────────────────
export async function searchProducts({ token, walletAddress, search, limit = 20 }) {
  const params = { limit };
  if (search) params.search = search;
  return api({
    method: 'GET', endpoint: '/mailing/products',
    params, headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function getBestsellers({ token, walletAddress, limit = 6, days = 30 }) {
  return api({
    method: 'GET', endpoint: '/mailing/products/bestsellers',
    params: { limit, days },
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── AI Marketing Image ────────────────────────────────────
export async function generateMarketingImage({ token, walletAddress, productIds = [], style = 'banner', prompt = '', referenceUrl = null }) {
  return api({
    method: 'POST', endpoint: '/carta/ai-imagen/generate-marketing',
    data: {
      product_ids: productIds,
      style,
      prompt_extra: prompt,
      reference_image_url: referenceUrl,
    },
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── Marketing Asset Library ───────────────────────────────
export async function fetchMarketingAssets({ token, walletAddress, limit = 50 }) {
  return api({
    method: 'GET', endpoint: '/carta/ai-imagen/marketing-assets',
    params: { limit },
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

// ── Mail Settings (encrypted provider config) ─────────────
export async function fetchMailSettings({ token, walletAddress }) {
  return api({
    method: 'GET', endpoint: '/mailing/settings',
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function saveMailSettings({ token, walletAddress, data }) {
  return api({
    method: 'POST', endpoint: '/mailing/settings',
    data,
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function testMailSettings({ token, walletAddress, to }) {
  return api({
    method: 'POST', endpoint: '/mailing/settings/test',
    data: { to },
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}

export async function deleteMailSettings({ token, walletAddress }) {
  return api({
    method: 'DELETE', endpoint: '/mailing/settings',
    headers: authHeaders({ token, walletAddress }), withCredentials: true,
  });
}
