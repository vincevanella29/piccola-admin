// src/pages/delivery/components/OrderKanban.jsx
// Kanban board for delivery orders grouped by status
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBoxOpen } from 'react-icons/fa';
import OrderCard from './OrderCard';

const OrderKanban = ({
  orders = [],
  statuses = [],
  pickupStatuses = [],
  onStatusChange,
  onSelectOrder,
  isLoading,
  t,
}) => {
  // Build merged columns from both pipelines
  // Use delivery statuses as primary, add any pickup-only statuses
  const columns = useMemo(() => {
    // Collect all unique status keys, preserving order from delivery then pickup
    const seen = new Set();
    const allStatuses = [];
    for (const s of statuses) {
      if (!seen.has(s.key)) { seen.add(s.key); allStatuses.push(s); }
    }
    for (const s of pickupStatuses) {
      if (!seen.has(s.key)) { seen.add(s.key); allStatuses.push(s); }
    }

    // Build lookup maps for next-status per pipeline
    const deliveryMap = {};
    statuses.forEach((s, i) => { deliveryMap[s.key] = i < statuses.length - 1 ? statuses[i + 1] : null; });
    const pickupMap = {};
    pickupStatuses.forEach((s, i) => { pickupMap[s.key] = i < pickupStatuses.length - 1 ? pickupStatuses[i + 1] : null; });

    return allStatuses.map((statusCfg) => {
      const items = orders.filter((o) => o.status === statusCfg.key);
      return {
        ...statusCfg,
        items,
        // Each order gets its own nextStatus based on order_type (resolved per-card)
        deliveryNext: deliveryMap[statusCfg.key] || null,
        pickupNext: pickupMap[statusCfg.key] || null,
      };
    });
  }, [orders, statuses, pickupStatuses]);

  if (isLoading && orders.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statuses.map((s) => (
          <div key={s.key} className="space-y-3">
            <div className="h-8 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-lg animate-pulse" />
            <div className="h-32 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-xl animate-pulse" />
            <div className="h-24 bg-light-surface-secondary/10 dark:bg-dark-surface-secondary/10 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state — data loaded, zero orders
  if (!isLoading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 border-2 border-dashed border-light-border/20 dark:border-dark-border/20 rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50">
          <FaBoxOpen className="mx-auto text-light-text-tertiary dark:text-dark-text-tertiary mb-4" size={48} />
          <p className="text-light-text-secondary dark:text-dark-text-secondary font-semibold text-lg">
            {t?.('delivery.no_orders') || 'No hay pedidos'}
          </p>
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-2 max-w-md mx-auto">
            Los pedidos aparecerán aquí cuando lleguen desde tus proveedores configurados
          </p>
        </div>

        {/* Still show the kanban structure so it's clear what the pipeline looks like */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {columns.map((col) => (
            <div key={col.key} className="min-w-[180px]">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: `${col.color}15` }}
              >
                <span className="text-base">{col.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>
                  {col.label}
                </span>
                <span
                  className="ml-auto flex items-center justify-center min-w-[22px] h-5 px-1 text-[10px] font-bold rounded-full"
                  style={{ color: col.color, border: `1px solid ${col.color}40` }}
                >
                  0
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
      {columns.map((col) => (
        <div
          key={col.key}
          className="min-w-[180px] flex flex-col"
        >
          {/* Column Header */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 sticky top-0 z-10"
            style={{ backgroundColor: `${col.color}15` }}
          >
            <span className="text-base">{col.icon}</span>
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: col.color }}
            >
              {col.label}
            </span>
            <span
              className="ml-auto flex items-center justify-center min-w-[22px] h-5 px-1 text-[10px] font-bold rounded-full"
              style={{
                backgroundColor: col.items.length > 0 ? col.color : 'transparent',
                color: col.items.length > 0 ? '#fff' : col.color,
                border: col.items.length > 0 ? 'none' : `1px solid ${col.color}40`,
              }}
            >
              {col.items.length}
            </span>
          </div>

          {/* Column Body */}
          <div className="flex-1 space-y-2 min-h-[120px] max-h-[calc(100vh-380px)] overflow-y-auto p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <AnimatePresence>
              {col.items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="flex items-center justify-center h-24 border-2 border-dashed rounded-xl text-xs text-light-text-tertiary dark:text-dark-text-tertiary"
                  style={{ borderColor: `${col.color}30` }}
                >
                  Sin pedidos
                </motion.div>
              ) : (
                col.items.map((order) => {
                  const nextStatus = order.order_type === 'pickup'
                    ? col.pickupNext
                    : col.deliveryNext;
                  return (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onSelect={onSelectOrder}
                      onStatusChange={onStatusChange}
                      nextStatus={nextStatus}
                      statusColor={col.color}
                    />
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderKanban;
