// src/pages/delivery/dispatch/DispatchSidebar.jsx
// Command center sidebar — full order details, carrier info, manual dispatch, product list
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTruck, FaMapMarkerAlt, FaClock, FaUser, FaMotorcycle,
  FaPhone, FaBuilding, FaBoxOpen, FaStickyNote, FaCalendarAlt,
  FaChevronDown, FaChevronUp, FaPaperPlane, FaTimes
} from 'react-icons/fa';

// Derive status styling from the hex color in MongoDB
function statusStyle(color) {
  // Map hex colors to tailwind-compatible classes
  const colorMap = {
    '#f59e0b': { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
    '#3b82f6': { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
    '#8b5cf6': { bg: 'bg-violet-500/15', text: 'text-violet-400', dot: 'bg-violet-400' },
    '#10b981': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    '#06b6d4': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400' },
    '#22c55e': { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400' },
    '#ef4444': { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' },
  };
  return colorMap[color] || { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400' };
}

function elapsedMin(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return `$${Number(amount).toLocaleString('es-CL')}`;
}

// ─── Order Detail Card ──────────────────────────────────

const OrderCard = ({ order, isSelected, onSelect, carriers = [], onManualDispatch, statusesMap, t, canDispatch = false, locations = [] }) => {
  const [expanded, setExpanded] = useState(false);
  const [showCarrierPicker, setShowCarrierPicker] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const elapsed = elapsedMin(order.created_at);
  const statusMeta = statusesMap[order.status] || {};
  const sc = statusStyle(statusMeta.color);
  const statusLabel = statusMeta.label || order.status;
  const customerName = order.customer?.name || 'Cliente';
  const carrierName = order.carrier_slug || null;
  const ci = order.courier_info;
  const locationName = locations.find(l => String(l._id) === String(order.location_id))?.nombre || order.location_name || 'Sucursal';
  const deliveryAddress = order.delivery_info?.address || order.delivery_info?.street || order.dropoff_address || order.customer?.address || 'Retiro en local';

  const timeClass = elapsed > 45 ? 'text-red-400 font-bold animate-pulse' : elapsed > 25 ? 'text-amber-400 font-bold' : 'text-dark-text-secondary';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        group cursor-pointer rounded-xl transition-all border overflow-hidden
        ${isSelected
          ? 'bg-matrix-green/8 border-matrix-green/30 shadow-lg shadow-matrix-green/5'
          : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
        }
      `}
    >
      {/* Main row — always visible */}
      <div className="p-3" onClick={() => onSelect?.(order._id)}>
        {/* Header: ID + Status + Time */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-dark-text-primary">
              #{(order._id || '').slice(-8).toUpperCase()}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {statusLabel}
            </span>
          </div>
          <div className={`flex items-center gap-1 text-[11px] ${timeClass}`}>
            <FaClock size={9} />
            <span>{elapsed}m</span>
          </div>
        </div>

        {/* Customer */}
        <div className="flex items-center gap-1.5 text-xs text-dark-text-secondary mb-1">
          <FaUser size={9} className="opacity-50 shrink-0" />
          <span className="truncate font-medium">{customerName}</span>
          {order.customer?.phone && (
            <span className="text-[10px] opacity-40 ml-auto">{order.customer.phone}</span>
          )}
        </div>

        {/* Address & Location */}
        <div className="flex items-start gap-1.5 text-[11px] text-dark-text-secondary/70 mb-1.5">
          <FaMapMarkerAlt size={9} className="opacity-40 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{deliveryAddress}</span>
              <span className="text-[9px] font-bold text-matrix-green px-1.5 py-0.5 rounded bg-matrix-green/10 shrink-0">
                {locationName}
              </span>
            </div>
          </div>
        </div>
        {order.customer?.depto && (
          <div className="flex items-center gap-1.5 text-[10px] text-dark-text-secondary/60 mb-1">
            <FaBuilding size={8} className="opacity-30 shrink-0" />
            <span>Depto: {order.customer.depto}</span>
          </div>
        )}

        {/* Carrier + Total */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[11px]">
            {carrierName ? (
              <>
                <FaMotorcycle size={10} className="text-cyan-400" />
                <span className="text-cyan-400 font-semibold capitalize">{carrierName}</span>
              </>
            ) : (
              <span className="text-red-400/70 italic text-[10px]">
                {t?.('delivery.dispatch_no_carrier') || '⚠️ Sin carrier'}
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-dark-text-primary">{formatCurrency(order.total_amount)}</span>
        </div>

        {/* Courier info (if dispatched) */}
        {ci && ci.name && (
          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-cyan-500/8 border border-cyan-500/15">
            <span className="text-sm">🏍️</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-cyan-400 truncate">{ci.name}</div>
              {ci.phone && <div className="text-[10px] text-dark-text-secondary/50">{ci.phone}</div>}
            </div>
            {ci.eta && (
              <span className="text-[10px] font-bold text-cyan-400">{ci.eta}m</span>
            )}
          </div>
        )}

        {/* Scheduled badge */}
        {order.scheduled_for && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-violet-400">
            <FaCalendarAlt size={9} />
            <span className="font-medium">
              Programado: {new Date(order.scheduled_for).toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full py-1.5 flex items-center justify-center gap-1 text-[10px] text-dark-text-secondary/40 hover:text-dark-text-secondary/70 transition-colors border-t border-white/5 hover:bg-white/[0.03]"
      >
        {expanded ? <FaChevronUp size={8} /> : <FaChevronDown size={8} />}
        {expanded ? 'Ocultar' : 'Ver productos'}
      </button>

      {/* Expanded: Products */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-1.5 text-dark-text-secondary">
                    <FaBoxOpen size={8} className="opacity-30" />
                    <span>{item.quantity}x</span>
                    <span className="truncate max-w-[140px]">{item.nombre || item.codigo}</span>
                  </div>
                  <span className="text-dark-text-secondary/60 shrink-0">{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
              {order.delivery_fee > 0 && (
                <div className="flex justify-between text-[10px] text-dark-text-secondary/50 pt-1">
                  <span>Envío</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold text-dark-text-primary pt-1 border-t border-white/10">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>

              {order.notes && (
                <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
                  <FaStickyNote size={9} className="text-amber-400/60 mt-0.5 shrink-0" />
                  <span className="text-[10px] text-amber-300/80">{order.notes}</span>
                </div>
              )}

              {/* Manual dispatch — only for delivery orders and admin level 3-5 */}
              {canDispatch && order.order_type === 'delivery' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  {!showCarrierPicker ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowCarrierPicker(true); }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/25 transition-colors border border-cyan-500/20"
                    >
                      <FaPaperPlane size={10} />
                      {t?.('delivery.dispatch_manual') || 'Dispatch Manual'}
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-dark-text-secondary font-medium">Seleccionar carrier:</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowCarrierPicker(false); }}
                          className="text-dark-text-secondary/40 hover:text-dark-text-secondary p-0.5"
                        >
                          <FaTimes size={8} />
                        </button>
                      </div>
                      {carriers.length === 0 ? (
                        <p className="text-[10px] text-red-400/70 italic">No hay carriers activos</p>
                      ) : (
                        carriers.map((c) => (
                          <button
                            key={c._id}
                            disabled={dispatching}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (carrierName || order.carrier_delivery_id || order.carrier_status) {
                                const ok = window.confirm('⚠️ ALERTA FINANCIERA: Este pedido ya tiene un carrier asignado o está en proceso de búsqueda. Forzar un re-despacho manual generará un cobro adicional de Comisión de Delivery para el local. Además, podría causar doble envío de motoristas. ¿Estás absolutamente seguro de que quieres continuar?');
                                if (!ok) {
                                  setShowCarrierPicker(false);
                                  return;
                                }
                                console.warn(`[MANUAL DISPATCH FORCE] Administrador forzó dispatch manual en pedido ${order._id} hacia ${c.slug}. Carrier anterior: ${carrierName}`);
                              } else {
                                console.log(`[MANUAL DISPATCH] Iniciando dispatch manual para ${order._id} con ${c.slug}`);
                              }
                              
                              setDispatching(true);
                              try {
                                await onManualDispatch?.(order._id, c.slug);
                                setShowCarrierPicker(false);
                              } catch (err) {
                                console.error('Manual dispatch failed:', err);
                              } finally {
                                setDispatching(false);
                              }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/5 hover:border-cyan-500/20 transition-all text-left group"
                          >
                            <FaMotorcycle size={12} className="text-cyan-400/60 group-hover:text-cyan-400" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-semibold text-dark-text-primary capitalize">{c.name || c.slug}</div>
                              <div className="text-[9px] text-dark-text-secondary/50">{c.slug}</div>
                            </div>
                            {dispatching ? (
                              <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FaPaperPlane size={9} className="text-cyan-400/40 group-hover:text-cyan-400" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Sidebar ──────────────────────────────────────

const DispatchSidebar = ({ orders = [], statuses = [], selectedOrderId, onSelectOrder, statusFilter, setStatusFilter, carriers = [], locations = [], onManualDispatch, t, canDispatch = false }) => {
  // Build a lookup map from the mongo-driven statuses array
  const statusesMap = useMemo(() => {
    const map = {};
    statuses.forEach(s => { map[s.key] = s; });
    return map;
  }, [statuses]);

  const activeOrders = useMemo(
    () => orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)),
    [orders]
  );

  const filteredOrders = useMemo(
    () => statusFilter === 'all' ? activeOrders : activeOrders.filter((o) => o.status === statusFilter),
    [activeOrders, statusFilter]
  );

  // Build counts dynamically from the statuses array
  const counts = useMemo(() => {
    const c = { all: 0 };
    statuses.forEach(s => { if (s.key !== 'delivered' && s.key !== 'cancelled') c[s.key] = 0; });
    activeOrders.forEach((o) => { c.all++; if (c[o.status] !== undefined) c[o.status]++; });
    return c;
  }, [activeOrders, statuses]);

  // Build filter buttons from mongo statuses (exclude delivered/cancelled)
  const filters = useMemo(() => [
    { key: 'all', label: 'Todos', icon: '📋' },
    ...statuses
      .filter(s => !['delivered', 'cancelled'].includes(s.key))
      .map(s => ({ key: s.key, icon: s.icon, label: s.label })),
  ], [statuses]);

  return (
    <div className="flex flex-col h-full bg-light-surface/50 dark:bg-dark-surface/50 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <FaTruck className="text-matrix-green" size={14} />
        <h3 className="text-sm font-bold text-dark-text-primary flex-1">
          {t?.('delivery.dispatch_title') || 'Control de Despacho'}
        </h3>
        <span className="text-xs px-2 py-0.5 bg-matrix-green/15 text-matrix-green rounded-full font-bold tabular-nums">
          {counts.all}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-3 pb-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`
              flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-xs font-medium transition-all
              ${statusFilter === f.key
                ? 'bg-matrix-green/20 text-matrix-green shadow-sm shadow-matrix-green/10'
                : 'bg-white/5 text-dark-text-secondary hover:bg-white/10'
              }
            `}
          >
            <span className="text-sm">{f.icon}</span>
            {counts[f.key] > 0 && (
              <span className="text-[10px] tabular-nums opacity-70">({counts[f.key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        <AnimatePresence mode="sync">
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-dark-text-secondary"
            >
              <FaMapMarkerAlt size={28} className="opacity-20 mb-3" />
              <p className="text-sm">{t?.('delivery.dispatch_no_orders') || 'Sin pedidos activos'}</p>
              <p className="text-xs opacity-40 mt-1">{t?.('delivery.dispatch_no_orders_hint') || ''}</p>
            </motion.div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                isSelected={order._id === selectedOrderId}
                onSelect={onSelectOrder}
                carriers={carriers}
                onManualDispatch={onManualDispatch}
                statusesMap={statusesMap}
                t={t}
                canDispatch={canDispatch}
                locations={locations}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DispatchSidebar;
