// src/hooks/useKDS.jsx
// Hook for Kitchen Display System — WebSocket real-time with polling fallback
// Uses refs for WS event handler to avoid stale closure bugs
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { fetchDeliveryStatuses } from '../utils/deliveryData.jsx';

const POLL_INTERVAL = 30000; // 30s fallback polling (only when WS disconnected)
const WS_PING_INTERVAL = 25000; // Keep-alive ping every 25s
const WS_RECONNECT_DELAY = 3000; // Reconnect after 3s

const useKDS = (appState) => {
  const [orders, setOrders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pickupStatuses, setPickupStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const prevOrderIdsRef = useRef(new Set());
  const audioRef = useRef(null);
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Keep statuses in a ref so WS handler always has fresh data (no stale closure)
  const statusesRef = useRef(statuses);
  const pickupStatusesRef = useRef(pickupStatuses);
  useEffect(() => { statusesRef.current = statuses; }, [statuses]);
  useEffect(() => { pickupStatusesRef.current = pickupStatuses; }, [pickupStatuses]);

  // ── Audio alert ──────────────────────────────────────
  useEffect(() => {
    audioRef.current = {
      play: () => {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          [800, 1200].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.3);
          });
        } catch (e) {
          console.warn('[KDS] Audio alert failed:', e);
        }
      }
    };
    return () => { mountedRef.current = false; };
  }, []);

  // ── Auth headers ─────────────────────────────────────
  const headers = useCallback(() => ({
    Authorization: `Bearer ${appState?.token}`,
    ...(appState?.account ? { 'X-Wallet-Address': appState.account } : {}),
  }), [appState?.token, appState?.account]);

  // ── REST Fetch (initial load + fallback) ─────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await api({
        method: 'GET',
        endpoint: '/delivery/orders/kds',
        headers: headers(),
        withCredentials: true,
      });

      if (res?.success && mountedRef.current) {
        const newOrders = res.orders || [];

        // Detect new orders for sound alert
        const newIds = new Set(newOrders.map(o => o._id));
        const prevIds = prevOrderIdsRef.current;
        if (prevIds.size > 0) {
          const brandNew = [...newIds].filter(id => !prevIds.has(id));
          if (brandNew.length > 0) audioRef.current?.play();
        }
        prevOrderIdsRef.current = newIds;

        setOrders(newOrders);
        setLastFetch(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('[KDS] Fetch error:', err);
      if (mountedRef.current) setError(err.message || 'Error loading orders');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [headers]);

  // ── Fetch statuses from MongoDB ──────────────────────────
  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetchDeliveryStatuses({
        token: appState?.token,
        walletAddress: appState?.account,
      });
      if (mountedRef.current) {
        if (res?.statuses) setStatuses(res.statuses);
        if (res?.pickup_statuses) setPickupStatuses(res.pickup_statuses);
      }
    } catch (err) {
      console.error('[KDS] Statuses error:', err);
    }
  }, [appState?.token, appState?.account]);

  // ── Toggle item done ─────────────────────────────────
  const toggleItemDone = useCallback(async (orderId, codigo, done) => {
    try {
      await api({
        method: 'PATCH',
        endpoint: `/delivery/orders/${orderId}/items/${codigo}/done`,
        data: { done },
        headers: headers(),
        withCredentials: true,
      });
      // Optimistic update (WS will confirm)
      setOrders(prev => prev.map(order => {
        if (order._id !== orderId) return order;
        return {
          ...order,
          items: order.items.map(item =>
            item.codigo === codigo ? { ...item, done } : item
          ),
          all_items_done: order.items.every(item =>
            item.codigo === codigo ? done : item.done
          ),
        };
      }));
    } catch (err) {
      console.error('[KDS] Toggle item done error:', err);
      fetchOrders();
    }
  }, [headers, fetchOrders]);

  // ── Update order status ──────────────────────────────
  const updateStatus = useCallback(async (orderId, status) => {
    try {
      await api({
        method: 'PATCH',
        endpoint: `/delivery/orders/${orderId}/status`,
        data: { status },
        headers: headers(),
        withCredentials: true,
      });
      // Optimistic: remove from KDS if status is not kds_controllable
      const allStatuses = [...statusesRef.current, ...pickupStatusesRef.current];
      const targetStatus = allStatuses.find(s => s.key === status);
      if (targetStatus && targetStatus.kds_controllable === false) {
        setOrders(prev => prev.filter(o => o._id !== orderId));
      } else {
        setOrders(prev => prev.map(o =>
          o._id === orderId ? { ...o, status } : o
        ));
      }
    } catch (err) {
      console.error('[KDS] Status update error:', err);
      fetchOrders();
    }
  }, [headers, fetchOrders]);

  // ── Handle WS events (uses refs to avoid stale closure) ──
  const handleWSEventRef = useRef(null);
  handleWSEventRef.current = (data) => {
    const { type } = data;

    if (type === 'pong') return; // keep-alive response

    if (type === 'new_order') {
      // New order arrived — refetch to get full enriched data
      audioRef.current?.play();
      fetchOrders();
    }

    if (type === 'status_change') {
      const { order_id, status } = data;
      const allStatuses = [...statusesRef.current, ...pickupStatusesRef.current];
      const targetStatus = allStatuses.find(s => s.key === status);
      if (targetStatus && targetStatus.kds_controllable === false) {
        setOrders(prev => prev.filter(o => o._id !== order_id));
      } else {
        setOrders(prev => prev.map(o =>
          o._id === order_id ? { ...o, status } : o
        ));
      }
      setLastFetch(new Date());
    }

    if (type === 'item_done') {
      const { order_id, codigo, done } = data;
      setOrders(prev => prev.map(o => {
        if (o._id !== order_id) return o;
        const items = o.items.map(item =>
          item.codigo === codigo ? { ...item, done } : item
        );
        return { ...o, items, all_items_done: items.every(i => i.done) };
      }));
      setLastFetch(new Date());
    }
  };

  // ── Fallback polling ─────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(fetchOrders, POLL_INTERVAL);
  }, [fetchOrders]);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // ── WebSocket connection ─────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Build WS URL from API URL
    const apiUrl = import.meta.env.VITE_DEV === 'true' && !window.env?.VITE_API_URL
      ? import.meta.env.VITE_API_URL_DEV
      : window.env?.VITE_API_URL || import.meta.env.VITE_API_URL;

    if (!apiUrl) return;

    const wsUrl = apiUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:')
      .replace(/\/api\/?$/, '');

    const locationId = 'all'; // TODO: filter by user's location when level 6/7
    const fullUrl = `${wsUrl}/api/ws/kds/${locationId}`;

    console.log('[KDS-WS] Connecting to:', fullUrl);

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[KDS-WS] ✅ Connected');
        if (mountedRef.current) setWsConnected(true);

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, WS_PING_INTERVAL);

        // Stop polling — WS is live
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Use ref to always call the latest handler (no stale closure)
          handleWSEventRef.current?.(data);
        } catch (e) {
          console.warn('[KDS-WS] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[KDS-WS] ❌ Disconnected');
        if (mountedRef.current) {
          setWsConnected(false);
          cleanup();
          // Reconnect after delay
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) connectWS();
          }, WS_RECONNECT_DELAY);
          // Start fallback polling
          startPolling();
        }
      };

      ws.onerror = (err) => {
        console.warn('[KDS-WS] Error:', err);
        ws.close();
      };
    } catch (e) {
      console.error('[KDS-WS] Connection failed:', e);
      startPolling();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lifecycle ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true; // Reset for StrictMode re-mount

    // Initial fetch
    fetchOrders();
    loadStatuses();
    // Connect WebSocket (small delay to avoid StrictMode double-connect noise)
    const wsTimeout = setTimeout(() => {
      if (mountedRef.current) connectWS();
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(wsTimeout);
      cleanup();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    orders,
    statuses,
    pickupStatuses,
    isLoading,
    error,
    lastFetch,
    wsConnected,
    fetchOrders,
    toggleItemDone,
    updateStatus,
  };
};

export default useKDS;
