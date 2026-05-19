// utils/deliveryData.jsx
// API layer for delivery admin — all network calls go through here
// Follows the same pattern as utils/apikeys.jsx
import api from './api.jsx';

// =====================================================================
// Helper — common auth headers
// =====================================================================

const authHeaders = ({ token, walletAddress }) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
});

// =====================================================================
// Orders
// =====================================================================

export async function fetchDeliveryOrders({ token, walletAddress, status, provider, carrier, locationId, dateFrom, dateTo, customerPhone, skip = 0, limit = 50 }) {
  const params = {};
  if (status) params.status = status;
  if (provider) params.provider = provider;
  if (carrier) params.carrier = carrier;
  if (locationId) params.location_id = locationId;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (customerPhone) params.customer_phone = customerPhone;
  params.skip = skip;
  params.limit = limit;

  return api({
    method: 'GET',
    endpoint: '/delivery/orders',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params,
  });
}

export async function fetchOrderDetail({ token, walletAddress, orderId }) {
  if (!orderId) throw new Error('orderId es obligatorio');
  return api({
    method: 'GET',
    endpoint: `/delivery/orders/${encodeURIComponent(orderId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateOrderStatus({ token, walletAddress, orderId, status }) {
  if (!orderId || !status) throw new Error('orderId y status son obligatorios');
  return api({
    method: 'PATCH',
    endpoint: `/delivery/orders/${encodeURIComponent(orderId)}/status`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { status },
  });
}

export async function fetchDeliveryStats({ token, walletAddress, locationId }) {
  const params = {};
  if (locationId) params.location_id = locationId;
  return api({
    method: 'GET',
    endpoint: '/delivery/orders/stats',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params,
  });
}

export async function fetchAdvancedAnalytics({ token, walletAddress, locationId, dateFrom, dateTo }) {
  const params = {};
  if (locationId) params.location_id = locationId;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  return api({
    method: 'GET',
    endpoint: '/delivery/orders/analytics/advanced',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params,
  });
}

export async function fetchReviewStats({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/reviews/stats',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function fetchReviews({ token, walletAddress, stars, locationId, skip = 0, limit = 20 }) {
  const params = { skip, limit };
  if (stars) params.stars = stars;
  if (locationId) params.location_id = locationId;
  return api({
    method: 'GET',
    endpoint: '/delivery/reviews',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params,
  });
}

export async function fetchDeliveryStatuses({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/statuses',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Order Providers
// =====================================================================

export async function fetchProviders({ token, walletAddress, status }) {
  const params = { ecosystem_type: 'delivery' };
  if (status) params.status = status;
  return api({
    method: 'GET',
    endpoint: '/ecosystem/providers',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params,
  });
}

export async function fetchProviderPresets({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/ecosystem/providers/presets',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { ecosystem_type: 'delivery' },
  });
}

export async function createProvider({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/ecosystem/providers',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { ...data, ecosystem_type: 'delivery' },
  });
}

export async function autoLinkProvider({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/ecosystem/providers/auto-link',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { ...data, ecosystem_type: 'delivery' },
  });
}

export async function probeDeliveryDomain({ token, walletAddress, domain }) {
  return api({
    method: 'POST',
    endpoint: '/ecosystem/providers/probe',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { domain, ecosystem_type: 'delivery' },
  });
}

export async function updateProvider({ token, walletAddress, providerId, data }) {
  if (!providerId) throw new Error('providerId es obligatorio');
  return api({
    method: 'PATCH',
    endpoint: `/ecosystem/providers/${encodeURIComponent(providerId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function deleteProvider({ token, walletAddress, providerId }) {
  if (!providerId) throw new Error('providerId es obligatorio');
  return api({
    method: 'DELETE',
    endpoint: `/ecosystem/providers/${encodeURIComponent(providerId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function resyncProvider({ token, walletAddress, providerId }) {
  if (!providerId) throw new Error('providerId es obligatorio');
  return api({
    method: 'POST',
    endpoint: `/ecosystem/providers/${encodeURIComponent(providerId)}/resync`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Last-Mile Carriers
// =====================================================================

export async function fetchCarriers({ token, walletAddress, status }) {
  const params = {};
  if (status) params.status = status;
  return api({
    method: 'GET',
    endpoint: '/delivery/carriers',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params,
  });
}

export async function fetchCarrierPresets({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/carriers/presets',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function createCarrier({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/carriers',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function updateCarrier({ token, walletAddress, carrierId, data }) {
  if (!carrierId) throw new Error('carrierId es obligatorio');
  return api({
    method: 'PATCH',
    endpoint: `/delivery/carriers/${encodeURIComponent(carrierId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function deleteCarrier({ token, walletAddress, carrierId }) {
  if (!carrierId) throw new Error('carrierId es obligatorio');
  return api({
    method: 'DELETE',
    endpoint: `/delivery/carriers/${encodeURIComponent(carrierId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function testCarrierConnection({ token, walletAddress, carrierId, auth }) {
  const data = {};
  if (carrierId) data.carrier_id = carrierId;
  if (auth) data.auth = auth;
  return api({
    method: 'POST',
    endpoint: '/delivery/carriers/test-connection',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

// =====================================================================
// Last-Mile Dispatch
// =====================================================================

export async function requestQuote({ token, walletAddress, orderId, carrierSlug }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/last-mile/quote',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { order_id: orderId, carrier_slug: carrierSlug },
  });
}

export async function dispatchToCarrier({ token, walletAddress, orderId, carrierSlug, quoteId }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/last-mile/dispatch',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { order_id: orderId, carrier_slug: carrierSlug, quote_id: quoteId },
  });
}

export async function cancelDispatch({ token, walletAddress, orderId }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/last-mile/cancel',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { order_id: orderId },
  });
}

export async function getDispatchStatus({ token, walletAddress, orderId }) {
  return api({
    method: 'GET',
    endpoint: `/delivery/last-mile/status/${encodeURIComponent(orderId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Test Orders
// =====================================================================

export async function testInjectOrder({ token, walletAddress, locationId }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/orders/test-inject',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { location_id: locationId },
  });
}

export async function createTestOrder({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/last-mile/test-order',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function listTestOrders({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/last-mile/test-orders',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function pollTestOrderStatus({ token, walletAddress, testOrderId }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/last-mile/test-orders/${encodeURIComponent(testOrderId)}/poll`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function cancelTestOrder({ token, walletAddress, testOrderId }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/last-mile/test-order/${encodeURIComponent(testOrderId)}/cancel`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Webhooks
// =====================================================================

export async function registerWebhook({ token, walletAddress, carrierSlug }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/last-mile/register-webhook',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { carrier_slug: carrierSlug },
  });
}

export async function getWebhookStatus({ token, walletAddress, carrierSlug }) {
  return api({
    method: 'GET',
    endpoint: `/delivery/last-mile/webhook-status/${encodeURIComponent(carrierSlug)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function disableWebhook({ token, walletAddress, carrierSlug }) {
  return api({
    method: 'DELETE',
    endpoint: `/delivery/last-mile/webhook/${encodeURIComponent(carrierSlug)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Outgoing Webhooks (order forwarding)
// =====================================================================

export async function fetchOutgoingWebhooks({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/webhooks',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function createOutgoingWebhook({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/webhooks',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function updateOutgoingWebhook({ token, walletAddress, webhookId, data }) {
  return api({
    method: 'PUT',
    endpoint: `/delivery/webhooks/${encodeURIComponent(webhookId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function deleteOutgoingWebhook({ token, walletAddress, webhookId }) {
  return api({
    method: 'DELETE',
    endpoint: `/delivery/webhooks/${encodeURIComponent(webhookId)}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function testOutgoingWebhook({ token, walletAddress, webhookId }) {
  return api({
    method: 'POST',
    endpoint: `/delivery/webhooks/${encodeURIComponent(webhookId)}/test`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function fetchWebhookLogs({ token, walletAddress, webhookId, limit = 20 }) {
  return api({
    method: 'GET',
    endpoint: `/delivery/webhooks/${encodeURIComponent(webhookId)}/logs`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { limit },
  });
}

export async function previewWebhookTemplate({ token, walletAddress, template, event }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/webhooks/preview',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { template, event },
  });
}

// =====================================================================
// Delivery Config
// =====================================================================

export async function getDeliveryConfig({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/config',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateStatuses({ token, walletAddress, statuses, pipelineType = 'delivery' }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/statuses',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { statuses, pipeline_type: pipelineType },
  });
}

export async function updateSchedule({ token, walletAddress, schedule }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/schedule',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { schedule },
  });
}

export async function updatePayments({ token, walletAddress, paymentMethods }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/payments',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { payment_methods: paymentMethods },
  });
}

export async function updateCarrierMapping({ token, walletAddress, carrierId, statusMapping }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/carrier-mapping',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { carrier_id: carrierId, status_mapping: statusMapping },
  });
}

export async function updateChatAccess({ token, walletAddress, allowedCargos, allowedSecciones, kdsAllowedCargos = [], kdsAllowedSecciones = [] }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/chat-access',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { 
      chat_allowed_cargos: allowedCargos, 
      chat_allowed_secciones: allowedSecciones,
      kds_allowed_cargos: kdsAllowedCargos,
      kds_allowed_secciones: kdsAllowedSecciones
    },
  });
}

// =====================================================================
// Scheduling Config
// =====================================================================

export async function getSchedulingConfig({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/config/scheduling',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateSchedulingConfig({ token, walletAddress, data }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/scheduling',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

// =====================================================================
// Delivery AI Chat
// =====================================================================

export async function deliveryAIChat({ token, walletAddress, message, history, context }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/ai/chat',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { message, history, context },
  });
}

// =====================================================================
// Transbank OneClick
// =====================================================================

export async function getTransbankConfig({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/config/transbank',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateTransbankConfig({ token, walletAddress, target, commerce_code, api_key, environment }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/transbank',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { target, commerce_code, api_key, environment },
  });
}

export async function switchTransbankEnv({ token, walletAddress, environment }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/transbank/environment',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { environment },
  });
}

// =====================================================================
// Transbank OneClick — Test Flow
// =====================================================================

export async function startInscription({ token, walletAddress, username, email, return_url }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/transbank/inscription/start',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { username, email, return_url },
  });
}

export async function getInscriptionStatus({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/transbank/inscription/status',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function testAuthorize({ token, walletAddress, amount, buy_order }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/transbank/test-authorize',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { amount, buy_order },
  });
}

export async function getTestTransactions({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/transbank/test-transactions',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Config Sync — Push to delivery providers
// =====================================================================

export async function pushConfigToDelivery({ token, walletAddress }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/config/push-to-providers',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function triggerCatalogSync({ token, walletAddress }) {
  return api({
    method: 'POST',
    endpoint: '/carta/trigger-public-sync',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Coverage Testing
// =====================================================================

export async function testCoverageArea({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/last-mile/coverage-test',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function fetchLocations({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/locations',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function fetchDeliveryLocations({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/locations',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Delivery Fee Config
// =====================================================================

export async function fetchDeliveryFeeConfig({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/config/delivery-fee',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateDeliveryFeeConfig({ token, walletAddress, data }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/config/delivery-fee',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

// =====================================================================
// Commissions
// =====================================================================

export async function fetchProviderCommissions({ token, walletAddress, providerId }) {
  return api({
    method: 'GET',
    endpoint: `/ecosystem/providers/${providerId}/commissions`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateProviderCommissions({ token, walletAddress, providerId, data }) {
  return api({
    method: 'PUT',
    endpoint: `/ecosystem/providers/${providerId}/commissions`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

// =====================================================================
// Finance — closings, entries, summary
// =====================================================================

export async function fetchFinanceSummary({ token, walletAddress, providerSlug }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/finance/summary',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { provider_slug: providerSlug },
  });
}

export async function fetchFinanceClosings({ token, walletAddress, providerSlug }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/finance/closings',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { provider_slug: providerSlug },
  });
}

export async function fetchFinanceEntries({ token, walletAddress, providerSlug, page = 1 }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/finance/entries',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { provider_slug: providerSlug, page },
  });
}

export async function fetchClosingPreview({ token, walletAddress, providerSlug, periodFrom, periodTo }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/finance/closing-preview',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { provider_slug: providerSlug, period_from: periodFrom, period_to: periodTo },
  });
}

export async function generateClosing({ token, walletAddress, providerSlug, periodFrom, periodTo }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/finance/closing',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data: { provider_slug: providerSlug, period_from: periodFrom, period_to: periodTo },
  });
}

export async function updateClosingStatus({ token, walletAddress, closingId, status }) {
  return api({
    method: 'PUT',
    endpoint: `/delivery/finance/closings/${closingId}/status`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    params: { status },
  });
}

export async function deleteClosing({ token, walletAddress, closingId }) {
  return api({
    method: 'DELETE',
    endpoint: `/delivery/finance/closings/${closingId}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function createFinanceEntry({ token, walletAddress, data }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/finance/entry',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function deleteFinanceEntry({ token, walletAddress, entryId }) {
  return api({
    method: 'DELETE',
    endpoint: `/delivery/finance/entry/${entryId}`,
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

// =====================================================================
// Delivery Home Config
// =====================================================================

export async function fetchDeliveryHomeConfig({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/home-config',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function updateDeliveryHomeConfig({ token, walletAddress, data }) {
  return api({
    method: 'PUT',
    endpoint: '/delivery/home-config',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
    data,
  });
}

export async function uploadDeliveryHomeImage({ token, walletAddress, file }) {
  // Multipart upload — can't use api() wrapper, needs raw axios
  const axios = (await import('axios')).default;
  const API_URL = import.meta.env.VITE_DEV === 'true' && !window.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL_DEV
    : (window.env?.VITE_API_URL || import.meta.env.VITE_API_URL);

  const formData = new FormData();
  formData.append('file', file);

  const res = await axios.post(`${API_URL}/delivery/home-config/upload`, formData, {
    headers: {
      ...authHeaders({ token, walletAddress }),
      'Content-Type': 'multipart/form-data',
    },
    withCredentials: true,
  });
  return res.data;
}

export async function publishDeliveryHome({ token, walletAddress }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/home-config/publish',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function fetchDeliveryHomeTemplates({ token, walletAddress }) {
  return api({
    method: 'GET',
    endpoint: '/delivery/home-config/templates',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}

export async function uploadAllTemplatesToR2({ token, walletAddress }) {
  return api({
    method: 'POST',
    endpoint: '/delivery/home-config/templates/upload-all-to-r2',
    withCredentials: true,
    headers: authHeaders({ token, walletAddress }),
  });
}
