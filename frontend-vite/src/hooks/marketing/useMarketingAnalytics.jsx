import { useState, useCallback } from 'react';
import conversionTrackerApi from '../../utils/conversionTracker/api.jsx';

export const useMarketingAnalytics = ({ token, account }) => {
  const [cache, setCache] = useState({
    realtimeGA4: null,
    historicalGA4: null,
    providerEvents: null,
    ecosystemMap: null
  });

  const cacheTimeLimit = 5 * 60 * 1000; // 5 mins

  const updateCache = useCallback((key, updates) => {
    setCache(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...updates }
    }));
  }, []);

  const isCacheValid = useCallback((key, additionalChecks = {}) => {
    const entry = cache[key];
    if (!entry || !entry.data || !entry.lastFetched) return false;
    if (Date.now() - entry.lastFetched > cacheTimeLimit) return false;
    for (const [prop, value] of Object.entries(additionalChecks)) {
      if (entry[prop] !== value) return false;
    }
    return true;
  }, [cache, cacheTimeLimit]);

  // Abstracted Fetchers
  const fetchRealtime = useCallback(async (pid) => {
    if (!pid) return;
    if (cache.realtimeGA4?.loading && cache.realtimeGA4?.providerId === pid) return;
    if (isCacheValid('realtimeGA4', { providerId: pid })) return;

    updateCache('realtimeGA4', { loading: true, error: null, providerId: pid });
    try {
      const res = await conversionTrackerApi.getRealtimeAnalytics({ providerId: pid, token, account });
      updateCache('realtimeGA4', { data: res, loading: false, lastFetched: Date.now() });
    } catch (err) {
      updateCache('realtimeGA4', { error: err.message || 'Failed to fetch realtime data', loading: false });
    }
  }, [token, account, isCacheValid, updateCache, cache.realtimeGA4?.loading, cache.realtimeGA4?.providerId]);

  const fetchHistorical = useCallback(async (pid, days) => {
    if (!pid) return;
    if (cache.historicalGA4?.loading && cache.historicalGA4?.providerId === pid && cache.historicalGA4?.days === days) return;
    if (isCacheValid('historicalGA4', { providerId: pid, days })) return;

    updateCache('historicalGA4', { loading: true, error: null, providerId: pid, days });
    try {
      const res = await conversionTrackerApi.getHistoricalAnalytics({ providerId: pid, days, token, account });
      updateCache('historicalGA4', { data: res, loading: false, lastFetched: Date.now() });
    } catch (err) {
      updateCache('historicalGA4', { error: err.message || 'Failed to fetch historical data', loading: false });
    }
  }, [token, account, isCacheValid, updateCache, cache.historicalGA4?.loading, cache.historicalGA4?.providerId, cache.historicalGA4?.days]);

  const fetchEventsCatalog = useCallback(async () => {
    if (cache.providerEvents?.loading) return;
    if (isCacheValid('providerEvents')) return;

    updateCache('providerEvents', { loading: true, error: null });
    try {
      const res = await conversionTrackerApi.getEventsCatalog({ token, account });
      updateCache('providerEvents', { data: res?.events || [], loading: false, lastFetched: Date.now() });
    } catch (err) {
      updateCache('providerEvents', { error: err.message || 'Failed to fetch events catalog', loading: false });
    }
  }, [token, account, isCacheValid, updateCache, cache.providerEvents?.loading]);

  return {
    cache,
    updateCache,
    isCacheValid,
    fetchRealtime,
    fetchHistorical,
    fetchEventsCatalog
  };
};

export default useMarketingAnalytics;
