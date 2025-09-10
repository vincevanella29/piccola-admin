import { useCallback, useEffect, useMemo, useState } from 'react';
import conversionTrackerApi from '../utils/conversionTrackerApi.jsx';

// Admin hook to manage Conversion Tracker configuration
// - Providers CRUD
// - Events CRUD
// - Read frontend config (providers + event mappings)
// Uses the same auth header pattern as appData.jsx

const useConversionTrackerAdmin = ({ token, account, autoLoad = true } = {}) => {
  const [providers, setProviders] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headers = useMemo(() => ({ token, account }), [token, account]);

  const fetchConfig = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await conversionTrackerApi.fetchConfig(headers);
      setConfig(data || null);
      return data;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const listProviders = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await conversionTrackerApi.adminListProviders(headers);
      setProviders(Array.isArray(data) ? data : []);
      return data;
    } catch (e) {
      setError(e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const createProvider = useCallback(async (body) => {
    setLoading(true); setError(null);
    try {
      const data = await conversionTrackerApi.adminCreateProvider({ body, ...headers });
      // optimistic add only if valid
      if (data && typeof data === 'object' && data.id) {
        setProviders(prev => [data, ...prev.filter(Boolean)]);
      } else {
        // if response is unexpected, refresh the list to stay consistent
        listProviders();
      }
      // Refresh config to reflect public exposure
      fetchConfig();
      return data;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [headers, fetchConfig, listProviders]);

  const updateProvider = useCallback(async (providerId, body) => {
    setLoading(true); setError(null);
    try {
      const data = await conversionTrackerApi.adminUpdateProvider({ providerId, body, ...headers });
      // merge
      setProviders(prev => prev.map(p => (p.id === data.id ? { ...p, ...data } : p)));
      // Refresh config
      fetchConfig();
      return data;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [headers, fetchConfig]);

  const refreshAll = useCallback(async () => {
    await Promise.all([listProviders(), fetchConfig()]);
  }, [listProviders, fetchConfig]);

  // Service rules for dynamic forms
  const listServices = useCallback(async () => {
    try {
      const res = await conversionTrackerApi.listServices(headers);
      return Array.isArray(res?.data) ? res.data : (res || []);
    } catch (e) {
      setError(e);
      return [];
    }
  }, [headers]);

  const getServiceRules = useCallback(async (service) => {
    if (!service) return null;
    try {
      const res = await conversionTrackerApi.getServiceRules({ service, ...headers });
      return res?.data || res;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [headers]);

  const uploadCredentialsJson = useCallback(async ({ providerId, file, key = 'service_account' }) => {
    if (!providerId || !file) return null;
    try {
      const res = await conversionTrackerApi.adminUploadCredentialsJson({ providerId, file, key, ...headers });
      // Refresh lists because credentials changed
      await Promise.all([listProviders(), fetchConfig()]);
      return res;
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [headers, listProviders, fetchConfig]);

  useEffect(() => {
    if (autoLoad && (token || account)) {
      refreshAll();
    }
  }, [autoLoad, token, account, refreshAll]);

  // Utility maps for UI
  const providersById = useMemo(() => {
    const map = {};
    (config?.providers || []).forEach(p => { map[p.id] = p; });
    return map;
  }, [config]);

  const eventToProviders = useMemo(() => ({}), []);

  return {
    // data
    providers,
    config,
    providersById,
    eventToProviders,
    // state
    loading,
    error,
    // actions
    fetchConfig,
    listProviders,
    createProvider,
    updateProvider,
    refreshAll,
    listServices,
    getServiceRules,
    uploadCredentialsJson,
  };
};

export default useConversionTrackerAdmin;
