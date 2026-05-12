// src/pages/delivery/Delivery.jsx
// Operational delivery page — orders + stats (lvl 3-6, including sucursales)
// Admin config (carriers, providers) lives in separate pages with their own metadata.
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaTruck, FaBoxOpen, FaChartBar, FaSync, FaMapMarkerAlt, FaStoreAlt, FaHistory, FaBoxes,
} from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Hook
import useDeliveryOrders from '../../hooks/useDeliveryOrders';

// Components
import OrderKanban from './orders/OrderKanban';
import OrderHistory from './orders/OrderHistory';
import DeliveryStats from './orders/DeliveryStats';
import DispatchMap from './dispatch/DispatchMap';
import DispatchSidebar from './dispatch/DispatchSidebar';
import DispatchStatusBar from './dispatch/DispatchStatusBar';
import OrderDetailModal from './orders/OrderDetailModal';
import DeliveryStock from './stock/DeliveryStock';

// ─── Tab Config ──────────────────────────────────────────────
const TABS = [
  { id: 'orders', label: 'delivery.tab_orders', icon: FaBoxOpen },
  { id: 'stock', label: 'delivery.tab_stock', icon: FaBoxes },
  { id: 'history', label: 'delivery.tab_history', icon: FaHistory },
  { id: 'dispatch', label: 'delivery.tab_dispatch', icon: FaMapMarkerAlt },
  { id: 'stats', label: 'delivery.tab_stats', icon: FaChartBar },
];


// ─── Tab Selector ────────────────────────────────────────────
const TabSelector = ({ activeTab, setActiveTab, t, orderCount }) => (
  <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl w-full mx-auto mb-6">
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all z-10
            ${isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}
          `}
        >
          {isActive && (
            <motion.div
              layoutId="deliveryTabBg"
              className="absolute inset-0 bg-white dark:bg-dark-surface rounded-lg shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <tab.icon className={isActive ? 'text-matrix-green' : ''} size={16} />
            <span className="hidden sm:inline">{t?.(tab.label) || tab.label.split('.').pop()}</span>
            {tab.id === 'orders' && orderCount > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] bg-red-500 text-white rounded-full shadow-sm animate-pulse">
                {orderCount}
              </span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Main Component ──────────────────────────────────────────
const Delivery = ({ appState }) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');

  // Level 3-5 can dispatch motos, level 6+ can only view
  const canDispatch = (appState?.roleLevel ?? 99) <= 5;

  const api = useDeliveryOrders(appState, t);

  // Initial data fetch
  useEffect(() => {
    api.fetchStatuses();
    api.fetchLocations();
    api.fetchOrders();
    api.fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when location filter changes
  useEffect(() => {
    const locationFilter = selectedLocation === 'all' ? {} : { locationId: selectedLocation };
    api.fetchOrders(locationFilter);
    api.fetchStats(selectedLocation === 'all' ? undefined : selectedLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  // Fetch tab-specific data
  useEffect(() => {
    if (activeTab === 'stats') api.fetchStats();
    if (activeTab === 'dispatch') {
      api.fetchOrders();
      api.fetchLocations();
      api.fetchCarriers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // KDS WebSocket for real-time order status updates (replaces 15-30s polling)
  useEffect(() => {
    if (activeTab !== 'orders' && activeTab !== 'dispatch') return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/ws/kds/all`;
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (['status_change', 'new_order', 'dispatch', 'courier_position'].includes(data.type)) {
            api.fetchOrders();
            if (data.type === 'status_change') api.fetchStats();
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    // Safety-net poll every 60s in case WS misses something
    const safetyPoll = setInterval(() => { api.fetchOrders(); }, 60000);

    return () => {
      clearInterval(safetyPoll);
      clearTimeout(reconnectTimer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Active order count (not delivered/cancelled)
  const activeOrderCount = useMemo(
    () => api.orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length,
    [api.orders]
  );

  // Kanban: only today's orders (active always visible + delivered/cancelled from today only)
  const todayOrders = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return api.orders.filter((o) => {
      // Active orders always show
      if (!['delivered', 'cancelled'].includes(o.status)) return true;
      // Delivered/cancelled: only if created today
      return o.created_at && new Date(o.created_at) >= todayStart;
    });
  }, [api.orders]);

  // Statuses map for detail modal
  const statusesMap = useMemo(() => {
    const m = {};
    (api.statuses || []).forEach(s => { m[s.key] = s; });
    (api.pickupStatuses || []).forEach(s => { if (!m[s.key]) m[s.key] = s; });
    return m;
  }, [api.statuses, api.pickupStatuses]);



  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 flex flex-col" style={{ height: 'calc(100vh - 64px - 64px)' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <FaTruck className="text-matrix-green" />
            {t?.('delivery.label') || 'Delivery'}
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            {t?.('delivery.subtitle') || 'Gestiona pedidos y despachos de última milla'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Location Selector */}
          <div className="relative">
            <FaStoreAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-matrix-green text-xs pointer-events-none" />
            <select
              id="delivery-location-filter"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="pl-8 pr-8 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-xl text-sm font-medium border border-light-border/10 dark:border-dark-border/10 appearance-none cursor-pointer hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors min-w-[160px]"
            >
              <option value="all">{t?.('delivery.all_locations') || 'Todas las sucursales'}</option>
              {api.locations.map((loc) => (
                <option key={loc._id} value={loc.permalink_slug || loc.slug}>
                  {loc.nombre || loc.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              const locationFilter = selectedLocation === 'all' ? {} : { locationId: selectedLocation };
              api.fetchOrders(locationFilter);
              api.fetchStats(selectedLocation === 'all' ? undefined : selectedLocation);
            }}
            className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium transition-colors text-sm flex items-center gap-2 border border-light-border/10 dark:border-dark-border/10"
          >
            <FaSync size={12} className={api.isLoading ? 'animate-spin' : ''} />
            {t?.('delivery.refresh') || 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <DeliveryStats stats={api.stats} t={t} />

      {/* Tabs */}
      <TabSelector
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        t={t}
        orderCount={activeOrderCount}
      />

      {/* Tab Content — flex-1 scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <OrderKanban
              orders={todayOrders}
              statuses={api.statuses}
              pickupStatuses={api.pickupStatuses}
              onStatusChange={api.updateOrderStatus}
              onSelectOrder={api.fetchOrderDetail}
              isLoading={api.isLoading}
              onDispatch={api.dispatchOrder}
              t={t}
            />
          </motion.div>
        )}

        {activeTab === 'dispatch' && (
          <motion.div
            key="dispatch"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3 h-full"
          >
            {/* Map + Sidebar */}
            <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
              {/* Map */}
              <div className="flex-1 min-h-[300px]">
                <DispatchMap
                  orders={api.orders}
                  locations={api.locations}
                  statuses={api.statuses}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  t={t}
                />
              </div>
              {/* Sidebar */}
              <div className="w-full lg:w-[340px] h-[350px] lg:h-full">
                <DispatchSidebar
                  orders={api.orders}
                  statuses={api.statuses}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  carriers={api.carriers}
                  onManualDispatch={api.dispatchOrder}
                  t={t}
                  canDispatch={canDispatch}
                />
              </div>
            </div>
            {/* Status Bar */}
            <DispatchStatusBar orders={api.orders} statuses={api.statuses} t={t} />
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DeliveryStats stats={api.stats} t={t} expanded />
          </motion.div>
        )}
        {activeTab === 'stock' && (
          <motion.div
            key="stock"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <DeliveryStock
              appState={appState}
              locations={api.locations}
              t={t}
            />
          </motion.div>
        )}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full flex flex-col"
          >
            <OrderHistory
              orders={api.orders}
              statuses={api.statuses}
              onSelectOrder={api.fetchOrderDetail}
              isLoading={api.isLoading}
              t={t}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Order Detail Modal (shared across all tabs) */}
      <AnimatePresence>
        {api.selectedOrder && (
          <OrderDetailModal
            order={api.selectedOrder}
            statusesMap={statusesMap}
            onClose={() => api.setSelectedOrder(null)}
          />
        )}
      </AnimatePresence>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </div>
  );
};

export default Delivery;

export const pageMetadata = {
    path: '/app/delivery',
    label: 'delivery.orders_label',
    category: 'delivery.category',
    minRoleLevel: 3,
    maxRoleLevel: 6,
    order: 1,
    locations: ['sidebar'],
    description: 'delivery.orders_description',
    icon: 'FaBoxOpen',
    isSearchable: true,
};
