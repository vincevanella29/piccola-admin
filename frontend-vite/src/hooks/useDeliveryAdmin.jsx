// hooks/useDeliveryAdmin.jsx
// Central hook for delivery admin — manages orders, providers, carriers, dispatch, and stats
// Follows the same pattern as hooks/useApiKeysAdmin.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as deliveryApi from '../utils/deliveryData.jsx';

const useDeliveryAdmin = (appState, t) => {
  // ─── State ──────────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [providers, setProviders] = useState([]);
  const [providerPresets, setProviderPresets] = useState({});
  const [carriers, setCarriers] = useState([]);
  const [carrierPresets, setCarrierPresets] = useState({});
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Prevent stale closures
  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  // ─── Orders ─────────────────────────────────────────────────

  const fetchOrders = useCallback(async (filters = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await deliveryApi.fetchDeliveryOrders({ ...getAuth(), ...filters });
      setOrders(res.orders || []);
      setTotalOrders(res.total || 0);
      return res;
    } catch (err) {
      setError(err.message);
      toast.error(t?.('delivery.error_loading_orders') || err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [getAuth, t]);

  const fetchOrderDetail = useCallback(async (orderId) => {
    setIsLoadingDetail(true);
    try {
      const res = await deliveryApi.fetchOrderDetail({ ...getAuth(), orderId });
      setSelectedOrder(res.order || null);
      return res.order;
    } catch (err) {
      toast.error(err.message);
      throw err;
    } finally {
      setIsLoadingDetail(false);
    }
  }, [getAuth]);

  const updateOrderStatus = useCallback(async (orderId, status) => {
    try {
      await deliveryApi.updateOrderStatus({ ...getAuth(), orderId, status });
      toast.success(t?.('delivery.status_updated') || `Estado actualizado a: ${status}`);
      // Refresh orders list
      await fetchOrders();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchOrders, t]);

  const fetchStats = useCallback(async (locationId) => {
    try {
      const res = await deliveryApi.fetchDeliveryStats({ ...getAuth(), locationId });
      setStats(res.stats || null);
      return res.stats;
    } catch (err) {
      console.error('[useDeliveryAdmin] Stats error:', err);
      return null;
    }
  }, [getAuth]);

  // ─── Providers ──────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchProviders({ ...getAuth() });
      setProviders(res.providers || []);
      return res.providers;
    } catch (err) {
      toast.error(err.message);
      return [];
    }
  }, [getAuth]);

  const fetchProviderPresets = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchProviderPresets({ ...getAuth() });
      setProviderPresets(res.presets || {});
      return res.presets;
    } catch (err) {
      console.error('[useDeliveryAdmin] Presets error:', err);
      return {};
    }
  }, [getAuth]);

  const createProvider = useCallback(async (data) => {
    try {
      const res = await deliveryApi.createProvider({ ...getAuth(), data });
      toast.success(t?.('delivery.provider_created') || 'Proveedor creado');
      await fetchProviders();
      return res;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth, fetchProviders, t]);

  const updateProvider = useCallback(async (providerId, data) => {
    try {
      await deliveryApi.updateProvider({ ...getAuth(), providerId, data });
      toast.success(t?.('delivery.provider_updated') || 'Proveedor actualizado');
      await fetchProviders();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchProviders, t]);

  const deleteProvider = useCallback(async (providerId) => {
    try {
      await deliveryApi.deleteProvider({ ...getAuth(), providerId });
      toast.success(t?.('delivery.provider_disabled') || 'Proveedor desactivado');
      await fetchProviders();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchProviders, t]);

  // ─── Carriers ───────────────────────────────────────────────

  const fetchCarriers = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchCarriers({ ...getAuth() });
      setCarriers(res.carriers || []);
      return res.carriers;
    } catch (err) {
      toast.error(err.message);
      return [];
    }
  }, [getAuth]);

  const fetchCarrierPresets = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchCarrierPresets({ ...getAuth() });
      setCarrierPresets(res.presets || {});
      return res.presets;
    } catch (err) {
      console.error('[useDeliveryAdmin] Carrier presets error:', err);
      return {};
    }
  }, [getAuth]);

  const createCarrier = useCallback(async (data) => {
    try {
      const res = await deliveryApi.createCarrier({ ...getAuth(), data });
      toast.success(t?.('delivery.carrier_created') || 'Carrier creado');
      await fetchCarriers();
      return res;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth, fetchCarriers, t]);

  const updateCarrier = useCallback(async (carrierId, data) => {
    try {
      await deliveryApi.updateCarrier({ ...getAuth(), carrierId, data });
      toast.success(t?.('delivery.carrier_updated') || 'Carrier actualizado');
      await fetchCarriers();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchCarriers, t]);

  const deleteCarrier = useCallback(async (carrierId) => {
    try {
      await deliveryApi.deleteCarrier({ ...getAuth(), carrierId });
      toast.success(t?.('delivery.carrier_disabled') || 'Carrier desactivado');
      await fetchCarriers();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchCarriers, t]);

  // ─── Dispatch ───────────────────────────────────────────────

  const requestQuote = useCallback(async (orderId, carrierSlug) => {
    try {
      const res = await deliveryApi.requestQuote({ ...getAuth(), orderId, carrierSlug });
      return res.quote;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth]);

  const dispatchOrder = useCallback(async (orderId, carrierSlug, quoteId) => {
    try {
      const res = await deliveryApi.dispatchToCarrier({ ...getAuth(), orderId, carrierSlug, quoteId });
      toast.success(t?.('delivery.dispatched') || 'Pedido despachado al carrier');
      await fetchOrders();
      return res;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth, fetchOrders, t]);

  const cancelDispatch = useCallback(async (orderId) => {
    try {
      await deliveryApi.cancelDispatch({ ...getAuth(), orderId });
      toast.success(t?.('delivery.dispatch_cancelled') || 'Dispatch cancelado');
      await fetchOrders();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchOrders, t]);

  // ─── Return ─────────────────────────────────────────────────

  return {
    // State
    orders,
    totalOrders,
    selectedOrder,
    setSelectedOrder,
    providers,
    providerPresets,
    carriers,
    carrierPresets,
    stats,
    isLoading,
    isLoadingDetail,
    error,
    // Orders
    fetchOrders,
    fetchOrderDetail,
    updateOrderStatus,
    fetchStats,
    // Providers
    fetchProviders,
    fetchProviderPresets,
    createProvider,
    updateProvider,
    deleteProvider,
    // Carriers
    fetchCarriers,
    fetchCarrierPresets,
    createCarrier,
    updateCarrier,
    deleteCarrier,
    // Dispatch
    requestQuote,
    dispatchOrder,
    cancelDispatch,
  };
};

export default useDeliveryAdmin;
