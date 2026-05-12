// src/pages/delivery/components/TestOrderPanel.jsx
// Panel for creating test delivery orders and monitoring status with carrier mapping
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaFlask, FaPlus, FaSync, FaTruck, FaCheckCircle,
  FaTimesCircle, FaSpinner, FaMapMarkerAlt, FaClock,
  FaArrowRight, FaExchangeAlt,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as deliveryApi from '../../../utils/deliveryData';

// Status colors by key (for tailwind classes)
const STATUS_STYLES = {
  pending:    { color: 'text-gray-400', bg: 'bg-gray-400/10' },
  confirmed:  { color: 'text-blue-400', bg: 'bg-blue-400/10' },
  preparing:  { color: 'text-violet-400', bg: 'bg-violet-400/10' },
  ready:      { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  dispatched: { color: 'text-amber-400', bg: 'bg-amber-400/10' },
  delivered:  { color: 'text-green-400', bg: 'bg-green-400/10' },
  cancelled:  { color: 'text-red-400', bg: 'bg-red-400/10' },
};

const getStatusStyle = (key) => STATUS_STYLES[key] || { color: 'text-gray-400', bg: 'bg-gray-400/10' };

const StatusBadge = ({ carrierStatus, internalStatus, statuses }) => {
  const internal = statuses.find(s => s.key === internalStatus);
  const style = getStatusStyle(internalStatus);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">
        {carrierStatus}
      </span>
      <FaArrowRight size={8} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
        {internal?.label || internalStatus}
      </span>
    </div>
  );
};

const StatusTimeline = ({ history = [], statuses }) => (
  <div className="flex flex-wrap gap-1 items-center">
    {history.map((h, i) => {
      const style = getStatusStyle(h.internal);
      return (
        <React.Fragment key={i}>
          {i > 0 && <FaArrowRight size={6} className="text-light-text-tertiary dark:text-dark-text-tertiary mx-0.5" />}
          <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${style.bg} ${style.color}`} title={h.at}>
            {h.status}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

const TestOrderPanel = ({ appState, carriers = [] }) => {
  const [testOrders, setTestOrders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pollingId, setPollingId] = useState(null);
  const [selectedCarrier, setSelectedCarrier] = useState('');

  const getAuth = useCallback(() => ({
    token: appState?.token,
    walletAddress: appState?.account,
  }), [appState]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await deliveryApi.listTestOrders(getAuth());
      setTestOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load test orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuth]);

  // Fetch statuses from MongoDB
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const res = await deliveryApi.fetchDeliveryStatuses(getAuth());
        if (res?.statuses) setStatuses(res.statuses);
      } catch (err) {
        console.error('Failed to load statuses:', err);
      }
    };
    loadStatuses();
  }, [getAuth]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleCreateTestOrder = async () => {
    if (!selectedCarrier) return toast.error('Selecciona un carrier');
    setIsCreating(true);
    try {
      const res = await deliveryApi.createTestOrder({
        ...getAuth(),
        data: { carrier_slug: selectedCarrier },
      });
      if (res.success) {
        toast.success(`✅ Orden de test creada: ${res.carrier_delivery_id}`);
        await fetchOrders();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePollStatus = async (orderId) => {
    setPollingId(orderId);
    try {
      const res = await deliveryApi.pollTestOrderStatus({
        ...getAuth(),
        testOrderId: orderId,
      });
      if (res.changed) {
        toast.info(`Estado actualizado: ${res.carrier_status} → ${res.internal_status}`);
      } else {
        toast.info(`Sin cambios: ${res.carrier_status}`);
      }
      await fetchOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPollingId(null);
    }
  };

  const activeCarriers = carriers.filter(c => c.status === 'active');

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaFlask className="text-amber-500" /> Órdenes de Test
          </h2>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
            Crea órdenes sandbox para verificar flujo de estados y webhooks
          </p>
        </div>
        <button onClick={fetchOrders} className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors">
          <FaSync size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Create test order */}
      <div className="flex gap-2 mb-4">
        <select
          value={selectedCarrier}
          onChange={(e) => setSelectedCarrier(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/40"
        >
          <option value="">Seleccionar carrier...</option>
          {activeCarriers.map(c => (
            <option key={c._id} value={c.slug}>{c.name} ({c.mode})</option>
          ))}
        </select>
        <button
          onClick={handleCreateTestOrder}
          disabled={isCreating || !selectedCarrier}
          className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-500/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm whitespace-nowrap"
        >
          {isCreating ? <FaSpinner size={12} className="animate-spin" /> : <FaPlus size={12} />}
          Crear Test Order
        </button>
      </div>

      {/* Status mapping reference */}
      <div className="mb-4 p-3 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10">
        <p className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 flex items-center gap-1">
          <FaExchangeAlt size={8} /> Mapeo de estados (carrier → nuestro)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s => {
            const style = getStatusStyle(s.key);
            return (
              <span key={s.key} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${style.bg} ${style.color}`}>
                {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Test orders list */}
      {testOrders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-light-border/20 dark:border-dark-border/20 rounded-xl">
          <FaFlask className="mx-auto text-light-text-tertiary dark:text-dark-text-tertiary mb-3" size={32} />
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">No hay órdenes de test</p>
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-1">Crea una para verificar la integración</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {testOrders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                        {order.carrier_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-mono">
                        TEST
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-light-text-tertiary dark:text-dark-text-tertiary">
                      ID: {order.carrier_delivery_id}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePollStatus(order._id)}
                    disabled={pollingId === order._id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary border border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary transition-colors flex items-center gap-1.5"
                  >
                    {pollingId === order._id ? (
                      <FaSpinner size={10} className="animate-spin" />
                    ) : (
                      <FaSync size={10} />
                    )}
                    Poll Status
                  </button>
                </div>

                {/* Current status */}
                <div className="mb-2">
                  <StatusBadge carrierStatus={order.status} internalStatus={order.internal_status} statuses={statuses} />
                </div>

                {/* Timeline */}
                {order.status_history?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary mb-1 uppercase tracking-wider">Timeline</p>
                    <StatusTimeline history={order.status_history} statuses={statuses} />
                  </div>
                )}

                {/* Quote info */}
                {order.quote && (
                  <div className="flex items-center gap-3 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                    <span>💰 ${order.quote.total?.toLocaleString()} {order.quote.currency}</span>
                    {order.quote.pickUpTime && <span>🕐 Pickup: {new Date(order.quote.pickUpTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {order.quote.deliveryTime && <span>📍 Entrega: {new Date(order.quote.deliveryTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                  Creado: {order.created_at ? new Date(order.created_at).toLocaleString('es-CL') : '–'}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default TestOrderPanel;
