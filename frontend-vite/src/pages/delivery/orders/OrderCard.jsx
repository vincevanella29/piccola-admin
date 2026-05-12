// src/pages/delivery/components/OrderCard.jsx
// Individual order card for the kanban board
import React from 'react';
import { motion } from 'framer-motion';
import { FaClock, FaUser, FaMapMarkerAlt, FaShippingFast } from 'react-icons/fa';

const formatTime = (isoStr) => {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ${diffMin % 60}m`;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
};

const formatCurrency = (amount) => {
  if (amount == null) return '$0';
  return '$' + Math.round(amount).toLocaleString('es-CL');
};

const PROVIDER_EMOJI = {
  vanellix: '🟢',
  uber_direct: '🔵',
  pedidosya: '🟠',
  getjusto: '🟣',
  unknown: '⚪',
};

const OrderCard = ({ order, onSelect, onStatusChange, nextStatus, statusColor }) => {
  const itemCount = (order.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-3 cursor-pointer hover:shadow-lg transition-shadow group"
      onClick={() => onSelect?.(order._id)}
    >
      {/* Header: provider + time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{PROVIDER_EMOJI[order.provider_slug] || '⚪'}</span>
          <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
            {order.provider_slug || 'unknown'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
          <FaClock size={10} />
          <span>{formatTime(order.created_at)}</span>
        </div>
      </div>

      {/* Customer */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5 text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">
          <FaUser size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary shrink-0" />
          {order.customer?.name || 'Cliente'}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
          <FaMapMarkerAlt size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary shrink-0" />
          {order.customer?.address || '—'}
        </div>
      </div>

      {/* Items summary + total */}
      <div className="flex items-center justify-between border-t border-light-border/10 dark:border-dark-border/10 pt-2 mt-2">
        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
          {formatCurrency(order.total_amount)}
        </span>
      </div>

      {/* Carrier badge (if dispatched) */}
      {order.dispatch_failed && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-red-500/10 rounded-lg border border-red-500/20">
          <span className="text-xs">⚠️</span>
          <span className="text-xs font-bold text-red-500">Dispatch falló</span>
          <span className="text-[10px] text-red-400/70 ml-auto">Manual requerido</span>
        </div>
      )}
      {!order.dispatch_failed && order.order_type === 'delivery' && !order.carrier_delivery_id && order.dispatch_retries > 0 && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20 animate-pulse">
          <span className="text-xs">🔍</span>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Buscando moto...</span>
          <span className="text-[10px] text-amber-500/70 ml-auto">Intento {order.dispatch_retries}/5</span>
        </div>
      )}
      {/* Carrier status badge — shows raw Uber/PedidosYa status */}
      {order.carrier_status && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg border border-light-border/8 dark:border-dark-border/8">
          <span className="text-[10px]">📡</span>
          <span className="text-[10px] font-mono font-semibold text-light-text-secondary dark:text-dark-text-secondary truncate">
            {order.carrier_status}
          </span>
          {order.carrier_slug && (
            <span className="text-[9px] text-light-text-secondary/50 dark:text-dark-text-secondary/50 ml-auto shrink-0">
              {order.carrier_slug === 'uber_direct' ? 'Uber' : order.carrier_slug === 'pedidosya' ? 'PYa' : order.carrier_slug}
            </span>
          )}
        </div>
      )}
      {order.carrier_slug && order.carrier_delivery_id && (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-cyan-500/10 rounded-lg">
          <FaShippingFast size={10} className="text-cyan-500" />
          <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
            {order.carrier_slug === 'uber_direct' ? 'Uber Direct' : order.carrier_slug === 'pedidosya' ? 'PedidosYa' : order.carrier_slug}
          </span>
          {order.courier_info?.name && (
            <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary ml-auto truncate">
              {order.courier_info.name}
            </span>
          )}
        </div>
      )}

      {/* Quick action button */}
      {nextStatus && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange?.(order._id, nextStatus.key);
          }}
          className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100"
          style={{
            backgroundColor: `${nextStatus.color}15`,
            color: nextStatus.color,
            border: `1px solid ${nextStatus.color}30`,
          }}
        >
          {nextStatus.icon} → {nextStatus.label}
        </button>
      )}
    </motion.div>
  );
};

export default OrderCard;
