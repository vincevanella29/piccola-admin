// OrderDetailModal.jsx — Shared order detail modal for Kanban, History, Dispatch
import React from 'react';
import { motion } from 'framer-motion';
import {
  FaTimes, FaUser, FaMapMarkerAlt, FaPhone, FaEnvelope, FaBuilding,
  FaCalendarAlt, FaMotorcycle, FaBoxOpen, FaStickyNote, FaCreditCard,
  FaStar, FaExternalLinkAlt, FaFileInvoiceDollar, FaTruck, FaStore,
} from 'react-icons/fa';

// ── Helpers ────────────────────────────────────────────────

const fmt = (amount) => amount == null ? '$0' : '$' + Math.round(amount).toLocaleString('es-CL');

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

const elapsed = (from, to) => {
  if (!from || !to) return '—';
  const min = Math.round((new Date(to) - new Date(from)) / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

const mapsUrl = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

// ── Stars ──────────────────────────────────────────────────

const Stars = ({ count = 0, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <FaStar key={i} size={size} className={i <= count ? 'text-amber-400' : 'text-light-border/20 dark:text-dark-border/20'} />
    ))}
  </div>
);

// ── Section ────────────────────────────────────────────────

const Section = ({ icon: Icon, title, color = 'text-light-text-secondary dark:text-dark-text-secondary', bgColor = 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50', borderColor = '', children }) => (
  <div className={`${bgColor} rounded-xl p-4 ${borderColor}`}>
    <h4 className={`text-[10px] font-bold uppercase tracking-wider ${color} mb-3 flex items-center gap-2`}>
      <Icon size={10} /> {title}
    </h4>
    {children}
  </div>
);

// ── Row ────────────────────────────────────────────────────

const Row = ({ label, value, mono, bold, color }) => (
  <div className="flex justify-between text-xs py-0.5">
    <span className="text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
    <span className={`${bold ? 'font-bold' : 'font-medium'} ${color || 'text-light-text-primary dark:text-dark-text-primary'} ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

// ── Main Modal ─────────────────────────────────────────────

const OrderDetailModal = ({ order, statusesMap = {}, allStatuses = [], pickupStatuses = [], onUpdateStatus, canEdit, onClose }) => {
  if (!order) return null;

  const items = order.items || [];
  const ci = order.courier_info;
  const review = order.review;
  const statusMeta = statusesMap[order.status] || {};
  const statusColor = statusMeta.color || '#6b7280';
  
  const availableStatuses = order.order_type === 'pickup' ? pickupStatuses : allStatuses;

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus !== order.status && onUpdateStatus) {
      onUpdateStatus(order._id, newStatus);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
        className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-light-surface dark:bg-dark-surface border-l border-light-border/10 dark:border-dark-border/10 shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-light-border/10 dark:border-dark-border/10">
          <div className="flex items-center gap-3">
            <FaFileInvoiceDollar className="text-matrix-green" />
            <span className="font-bold text-light-text-primary dark:text-dark-text-primary font-mono">
              #{(order.order_number || order._id || '').slice(-8).toUpperCase()}
            </span>
            {canEdit ? (
              <select
                value={order.status}
                onChange={handleStatusChange}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border-none appearance-none outline-none cursor-pointer"
                style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
              >
                {availableStatuses.map(s => (
                  <option key={s.key} value={s.key} className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary">
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                {statusMeta.label || order.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.order_type && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${order.order_type === 'pickup' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                {order.order_type === 'pickup' ? <><FaStore size={8} className="inline mr-1" />Pickup</> : <><FaTruck size={8} className="inline mr-1" />Delivery</>}
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
              <FaTimes className="text-light-text-secondary dark:text-dark-text-secondary" size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Customer */}
          <Section icon={FaUser} title="Cliente">
            <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
              {order.customer?.name || '—'}
            </p>

            {order.customer?.phone && (
              <a href={`tel:${order.customer.phone}`}
                className="flex items-center gap-2 text-xs text-matrix-green hover:underline mb-1.5">
                <FaPhone size={9} /> {order.customer.phone}
              </a>
            )}

            {order.customer?.email && (
              <a href={`mailto:${order.customer.email}`}
                className="flex items-center gap-2 text-xs text-blue-400 hover:underline mb-1.5">
                <FaEnvelope size={9} /> {order.customer.email}
              </a>
            )}

            {order.customer?.address && (
              <a href={mapsUrl(order.customer.address)} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green transition-colors group mt-2">
                <FaMapMarkerAlt size={10} className="mt-0.5 shrink-0 text-red-400" />
                <span className="flex-1">{order.customer.address}</span>
                <FaExternalLinkAlt size={8} className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
              </a>
            )}

            {order.customer?.depto && (
              <p className="flex items-center gap-2 text-xs text-light-text-tertiary mt-1">
                <FaBuilding size={9} /> Depto: {order.customer.depto}
              </p>
            )}
          </Section>

          {/* Location */}
          {order.location_name && (
            <div className="flex items-center gap-2 px-3 py-2 bg-matrix-green/5 rounded-xl border border-matrix-green/10">
              <FaStore size={10} className="text-matrix-green" />
              <span className="text-xs font-semibold text-matrix-green">{order.location_name}</span>
              {order.location_slug && <span className="text-[9px] text-light-text-tertiary ml-auto font-mono">{order.location_slug}</span>}
            </div>
          )}

          {/* Timeline */}
          <Section icon={FaCalendarAlt} title="Tiempos">
            <div className="space-y-1.5">
              <Row label="Creado" value={`${fmtDate(order.created_at)} ${fmtTime(order.created_at)}`} />
              {order.dispatched_at && <Row label="Despachado" value={`${fmtDate(order.dispatched_at)} ${fmtTime(order.dispatched_at)}`} />}
              {order.delivered_at && <Row label="Entregado" value={`${fmtDate(order.delivered_at)} ${fmtTime(order.delivered_at)}`} />}
              {order.delivered_at && (
                <div className="pt-2 mt-1 border-t border-light-border/10 dark:border-dark-border/10">
                  <Row label="Tiempo total" value={elapsed(order.created_at, order.delivered_at)} bold color="text-matrix-green" />
                </div>
              )}
            </div>
          </Section>

          {/* Payment */}
          {(order.payment_method || order.payment_status) && (
            <Section icon={FaCreditCard} title="Pago">
              <div className="flex items-center gap-3">
                {order.payment_method && (
                  <span className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary capitalize">{order.payment_method}</span>
                )}
                {order.payment_status && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${order.payment_status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {order.payment_status === 'paid' ? '✅ Pagado' : order.payment_status}
                  </span>
                )}
              </div>
            </Section>
          )}

          {/* Carrier */}
          {order.carrier_slug && (
            <Section icon={FaMotorcycle} title="Carrier" color="text-cyan-400" bgColor="bg-cyan-500/5" borderColor="border border-cyan-500/10">
              <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary capitalize">{order.carrier_slug}</p>
              {order.carrier_status && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 font-mono">{order.carrier_status}</p>}
              {ci?.name && (
                <div className="mt-2 pt-2 border-t border-cyan-500/10">
                  <p className="text-xs font-medium text-cyan-400">🏍️ {ci.name}</p>
                  {ci.phone && <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{ci.phone}</p>}
                </div>
              )}
            </Section>
          )}

          {/* Items */}
          <Section icon={FaBoxOpen} title={`Productos (${items.length})`}>
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-light-border/5 dark:border-dark-border/5 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary shrink-0">{item.quantity}x</span>
                    <span className="text-light-text-primary dark:text-dark-text-primary font-medium truncate">{item.nombre || item.codigo}</span>
                  </div>
                  <span className="text-light-text-secondary dark:text-dark-text-secondary shrink-0 ml-2">{fmt(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {order.delivery_fee > 0 && (
              <Row label="Envío" value={fmt(order.delivery_fee)} />
            )}
            <div className="flex justify-between text-sm font-bold text-light-text-primary dark:text-dark-text-primary pt-2 mt-1 border-t border-light-border/10 dark:border-dark-border/10">
              <span>Total</span><span>{fmt(order.total_amount)}</span>
            </div>
          </Section>

          {/* Notes */}
          {order.notes && (
            <Section icon={FaStickyNote} title="Notas" color="text-amber-400" bgColor="bg-amber-500/5" borderColor="border border-amber-500/10">
              <p className="text-xs text-amber-200">{order.notes}</p>
            </Section>
          )}

          {/* Review */}
          {review && (
            <Section icon={FaStar} title="Calificación" color="text-amber-400" bgColor="bg-amber-500/5" borderColor="border border-amber-500/10">
              <div className="flex items-center gap-3 mb-2">
                <Stars count={review.overall_stars || 0} size={16} />
                <span className="text-lg font-bold text-amber-400">{review.overall_stars || 0}/5</span>
              </div>
              {review.comment && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">"{review.comment}"</p>}
              {review.food_stars && <Row label="Comida" value={`${'⭐'.repeat(review.food_stars)} ${review.food_stars}/5`} />}
              {review.delivery_stars && <Row label="Delivery" value={`${'⭐'.repeat(review.delivery_stars)} ${review.delivery_stars}/5`} />}
            </Section>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default OrderDetailModal;
