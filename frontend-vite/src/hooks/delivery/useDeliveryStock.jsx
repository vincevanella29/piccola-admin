// hooks/delivery/useDeliveryStock.jsx
// Shared hook for delivery product stock control
// Used by KDS StockDrawer and Delivery Stock tab
import { useState, useCallback, useRef } from 'react';
import api from '../../utils/api';

const useDeliveryStock = (appState) => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const mountedRef = useRef(true);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${appState?.token}`,
    ...(appState?.account ? { 'X-Wallet-Address': appState.account } : {}),
  }), [appState?.token, appState?.account]);

  // ── Fetch stock for a location ─────────────────────
  const fetchStock = useCallback(async (locationSlug, onlyUnavailable = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (locationSlug) params.set('location_slug', locationSlug);
      if (onlyUnavailable) params.set('only_unavailable', 'true');

      const res = await api({
        method: 'GET',
        endpoint: `/delivery/stock?${params.toString()}`,
        headers: headers(),
        withCredentials: true,
      });

      if (res?.success && mountedRef.current) {
        setProducts(res.products || []);
        setUnavailableCount(res.unavailable_count || 0);
      }
      return res;
    } catch (err) {
      console.error('[Stock] Fetch error:', err);
      if (mountedRef.current) setError(err.message || 'Error loading stock');
      return null;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [headers]);

  // ── Toggle stock (optimistic) ──────────────────────
  const toggleStock = useCallback(async (codigo, locationSlug, available, reason = null) => {
    // Optimistic update
    setProducts(prev => prev.map(p => {
      if (p.codigo !== codigo) return p;
      return {
        ...p,
        overrides: {
          ...p.overrides,
          [locationSlug]: {
            available,
            updated_at: new Date().toISOString(),
            updated_by: appState?.account || 'unknown',
          },
        },
      };
    }));
    setUnavailableCount(prev => available ? Math.max(0, prev - 1) : prev + 1);

    try {
      const res = await api({
        method: 'PATCH',
        endpoint: `/delivery/stock/${encodeURIComponent(codigo)}`,
        data: { location_slug: locationSlug, available, reason },
        headers: headers(),
        withCredentials: true,
      });
      return res;
    } catch (err) {
      console.error('[Stock] Toggle error:', err);
      // Rollback
      setProducts(prev => prev.map(p => {
        if (p.codigo !== codigo) return p;
        return {
          ...p,
          overrides: {
            ...p.overrides,
            [locationSlug]: {
              available: !available, // revert
            },
          },
        };
      }));
      setUnavailableCount(prev => available ? prev + 1 : Math.max(0, prev - 1));
      throw err;
    }
  }, [headers, appState?.account]);

  // ── Bulk toggle ────────────────────────────────────
  const bulkToggle = useCallback(async (items, locationSlug) => {
    try {
      const res = await api({
        method: 'PATCH',
        endpoint: '/delivery/stock/bulk',
        data: { location_slug: locationSlug, items },
        headers: headers(),
        withCredentials: true,
      });
      // Refetch after bulk
      await fetchStock(locationSlug);
      return res;
    } catch (err) {
      console.error('[Stock] Bulk toggle error:', err);
      throw err;
    }
  }, [headers, fetchStock]);

  // ── History ────────────────────────────────────────
  const fetchHistory = useCallback(async (locationSlug, codigo = null) => {
    try {
      const params = new URLSearchParams();
      if (locationSlug) params.set('location_slug', locationSlug);
      if (codigo) params.set('codigo', codigo);

      const res = await api({
        method: 'GET',
        endpoint: `/delivery/stock/history?${params.toString()}`,
        headers: headers(),
        withCredentials: true,
      });

      if (res?.success && mountedRef.current) {
        setHistory(res.history || []);
      }
      return res;
    } catch (err) {
      console.error('[Stock] History error:', err);
      return null;
    }
  }, [headers]);

  // ── Analytics ──────────────────────────────────────
  const fetchAnalytics = useCallback(async (locationSlug = null) => {
    try {
      const params = new URLSearchParams();
      if (locationSlug) params.set('location_slug', locationSlug);

      const res = await api({
        method: 'GET',
        endpoint: `/delivery/stock/analytics?${params.toString()}`,
        headers: headers(),
        withCredentials: true,
      });

      if (res?.success && mountedRef.current) {
        setAnalytics(res);
      }
      return res;
    } catch (err) {
      console.error('[Stock] Analytics error:', err);
      return null;
    }
  }, [headers]);

  return {
    products,
    isLoading,
    error,
    unavailableCount,
    history,
    analytics,
    fetchStock,
    toggleStock,
    bulkToggle,
    fetchHistory,
    fetchAnalytics,
  };
};

export default useDeliveryStock;
