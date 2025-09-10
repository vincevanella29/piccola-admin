import api, { apiform } from './api.jsx';

// Conversion Tracker Admin/Config API client
// Mirrors style of utils/appData.jsx
// All endpoints are under /api/conversion-tracker/* (see backend/apis/conversion_tracker.py)

const conversionTrackerApi = {
  // Rules discovery to drive admin forms
  listServices: async ({ token, account } = {}) => {
    return await api({
      method: 'get',
      endpoint: '/conversion-tracker/services',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  getServiceRules: async ({ service, token, account }) => {
    if (!service) throw new Error('service is required');
    return await api({
      method: 'get',
      endpoint: `/conversion-tracker/services/${service}/rules`,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },
  // Frontend config: active providers (public config only) + active events mapping
  fetchConfig: async ({ token, account } = {}) => {
    return await api({
      method: 'get',
      endpoint: '/conversion-tracker/config',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  // Providers CRUD
  createProvider: async ({ body, token, account }) => {
    // body: { service, name?, is_active?, credentials }
    return await api({
      method: 'post',
      endpoint: '/conversion-tracker/providers',
      data: body,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  listProviders: async ({ token, account } = {}) => {
    return await api({
      method: 'get',
      endpoint: '/conversion-tracker/providers',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  updateProvider: async ({ providerId, body, token, account }) => {
    // body may include: { service?, name?, is_active?, credentials? }
    if (!providerId) throw new Error('providerId is required');
    return await api({
      method: 'patch',
      endpoint: `/conversion-tracker/providers/${providerId}`,
      data: body,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  // Admin Providers CRUD (includes credentials)
  adminCreateProvider: async ({ body, token, account }) => {
    return await api({
      method: 'post',
      endpoint: '/admin/conversion-tracker/providers',
      data: body,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  adminListProviders: async ({ token, account } = {}) => {
    return await api({
      method: 'get',
      endpoint: '/admin/conversion-tracker/providers',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  adminUpdateProvider: async ({ providerId, body, token, account }) => {
    if (!providerId) throw new Error('providerId is required');
    return await api({
      method: 'patch',
      endpoint: `/admin/conversion-tracker/providers/${providerId}`,
      data: body,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  // Upload JSON credentials (e.g., Firebase service account) via multipart/form-data
  adminUploadCredentialsJson: async ({ providerId, file, key = 'service_account', token, account }) => {
    if (!providerId) throw new Error('providerId is required');
    if (!file) throw new Error('file is required');
    const form = new FormData();
    form.append('key', key);
    form.append('file', file);
    return await apiform({
      method: 'post',
      endpoint: `/admin/conversion-tracker/providers/${providerId}/credentials-json`,
      data: form,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },
};

export default conversionTrackerApi;
