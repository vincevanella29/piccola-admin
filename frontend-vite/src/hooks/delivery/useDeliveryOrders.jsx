// hooks/delivery/useDeliveryOrders.jsx
// Hook for operational delivery — orders, stats, dispatch
// Used by: pages/delivery/Delivery.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as deliveryApi from '../../utils/deliveryData.jsx';

const useDeliveryOrders = (appState, t) => {
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stats, setStats] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [pickupStatuses, setPickupStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

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
      await fetchOrders();
      // Optimistic update for the modal
      setSelectedOrder(prev => (prev && prev._id === orderId ? { ...prev, status } : prev));
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
      console.error('[useDeliveryOrders] Stats error:', err);
      return null;
    }
  }, [getAuth]);

  // ─── Statuses (mongo-driven) ─────────────────────────────────

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchDeliveryStatuses(getAuth());
      setStatuses(res.statuses || []);
      setPickupStatuses(res.pickup_statuses || []);
      return res.statuses || [];
    } catch (err) {
      console.error('[useDeliveryOrders] Statuses error:', err);
      return [];
    }
  }, [getAuth]);

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

  // ─── Locations (for dispatch map) ─────────────────────────

  const [locations, setLocations] = useState([]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchDeliveryLocations(getAuth());
      setLocations(res.locations || []);
      return res.locations || [];
    } catch (err) {
      console.error('[useDeliveryOrders] Locations error:', err);
      return [];
    }
  }, [getAuth]);

  // ─── Carriers (for manual dispatch picker) ────────────────

  const [carriers, setCarriers] = useState([]);

  const fetchCarriers = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchCarriers({ ...getAuth(), status: 'active' });
      setCarriers(res.carriers || []);
      return res.carriers || [];
    } catch (err) {
      console.error('[useDeliveryOrders] Carriers error:', err);
      return [];
    }
  }, [getAuth]);

  return {
    orders, totalOrders, selectedOrder, setSelectedOrder,
    stats, statuses, pickupStatuses, isLoading, isLoadingDetail, error,
    fetchOrders, fetchOrderDetail, updateOrderStatus, fetchStats, fetchStatuses,
    requestQuote, dispatchOrder, cancelDispatch,
    locations, fetchLocations,
    carriers, fetchCarriers,
  };
};

export default useDeliveryOrders;
