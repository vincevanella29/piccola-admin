// OrderDetailModal.jsx — Shared order detail modal for Kanban, History, Dispatch
import React, { useState, useEffect } from 'react';
import useDeliveryOrders from '../../../hooks/delivery/useDeliveryOrders';
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

// ── Shared UI ──────────────────────────────────────────────

const Stars = ({ count = 0, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <FaStar key={i} size={size} className={i <= count ? 'text-amber-400' : 'text-light-border/20 dark:text-dark-border/20'} />
    ))}
  </div>
);

const Section = ({ icon: Icon, title, color = 'text-light-text-secondary dark:text-dark-text-secondary', bgColor = 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50', borderColor = 'border-light-border/40 dark:border-dark-border/40', children }) => (
  <div className={`${bgColor} rounded-2xl p-5 border shadow-sm ${borderColor}`}>
    <h4 className={`text-xs font-bold uppercase tracking-widest ${color} mb-4 flex items-center gap-2`}>
      <Icon size={12} /> {title}
    </h4>
    {children}
  </div>
);

const Row = ({ label, value, mono, bold, color }) => (
  <div className="flex justify-between items-center text-sm py-1.5 border-b border-light-border/5 dark:border-dark-border/5 last:border-0">
    <span className="text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
    <span className={`${bold ? 'font-bold' : 'font-medium'} ${color || 'text-light-text-primary dark:text-dark-text-primary'} ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

// ── Contact Pill ───────────────────────────────────────────
const ContactPill = ({ icon: Icon, text, href, colorCls }) => {
  const content = (
    <>
      <Icon size={10} className="shrink-0" />
      <span className="truncate">{text}</span>
    </>
  );
  const baseCls = `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors max-w-full overflow-hidden ${colorCls}`;
  
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={baseCls}>{content}</a>;
  }
  return <div className={baseCls}>{content}</div>;
};

// ── Main Modal ─────────────────────────────────────────────

const OrderDetailModal = ({ order, statusesMap = {}, allStatuses = [], pickupStatuses = [], onUpdateStatus, canEdit, onClose, locations = [], appState }) => {
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'history', 'review'
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const deliveryApi = useDeliveryOrders(appState);

  useEffect(() => {
    if (activeTab === 'history' && order?.customer?.phone && appState) {
      const loadHistory = async () => {
        setLoadingHistory(true);
        try {
          const res = await deliveryApi.fetchOrders({ 
            customerPhone: order.customer.phone,
            limit: 10
          });
          setHistoryOrders(res?.orders || []);
        } catch (err) {
          console.error('Error fetching customer history', err);
        } finally {
          setLoadingHistory(false);
        }
      };
      loadHistory();
    }
  }, [activeTab, order, appState, deliveryApi.fetchOrders]);
  if (!order) return null;

  const items = order.items || [];
  const ci = order.courier_info;
  const review = order.review;
  const statusMeta = statusesMap[order.status] || {};
  const statusColor = statusMeta.color || '#6b7280';
  
  const availableStatuses = order.order_type === 'pickup' ? pickupStatuses : allStatuses;
  
  const locationName = locations.find(l => String(l._id) === String(order.location_id))?.nombre || order.location_name || 'Sucursal';
  const isPickup = order.order_type === 'pickup';
  const deliveryAddress = order?.delivery_info?.address || order?.delivery_info?.street || 'Dirección de envío no especificada';
  const deliveryDepto = order.delivery_info?.depto || order.customer?.depto;

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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Contenedor Flex para centrado perfecto */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        {/* Panel - Ensanchado a 850px para 2 columnas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="pointer-events-auto w-full md:w-[850px] max-h-[85vh] lg:max-h-[calc(100vh-140px)] bg-light-surface dark:bg-dark-surface rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-light-border/20 dark:border-dark-border/20"
        >
        {/* Dynamic Header Banner */}
        <div className="relative px-6 py-5 flex items-center justify-between border-b border-light-border/10 dark:border-dark-border/10 overflow-hidden">
          {/* Subtle colored background based on status */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: statusColor }} />
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-light-surface dark:bg-dark-surface shadow-sm border border-light-border/10 dark:border-dark-border/10">
              <FaFileInvoiceDollar size={24} style={{ color: statusColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-2xl text-light-text-primary dark:text-dark-text-primary font-mono tracking-tight">
                  #{(order.order_number || order._id || '').slice(-8).toUpperCase()}
                </span>
                {order.order_type && (
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${order.order_type === 'pickup' ? 'bg-purple-500/20 text-purple-500' : 'bg-cyan-500/20 text-cyan-500'}`}>
                    {order.order_type === 'pickup' ? <><FaStore className="inline mr-1 mb-0.5" />Pickup</> : <><FaTruck className="inline mr-1 mb-0.5" />Delivery</>}
                  </span>
                )}
                <span className="text-[10px] font-bold text-matrix-green px-2 py-1 rounded bg-matrix-green/10 truncate max-w-[150px]">
                  {locationName}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <select
                    value={order.status}
                    onChange={handleStatusChange}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border-none appearance-none outline-none cursor-pointer shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: statusColor, color: '#fff' }}
                  >
                    {availableStatuses.map(s => (
                      <option key={s.key} value={s.key} className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary">
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
                    style={{ backgroundColor: statusColor, color: '#fff' }}>
                    {statusMeta.label || order.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="relative z-10 p-2.5 rounded-xl bg-light-surface/50 dark:bg-dark-surface/50 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary backdrop-blur border border-light-border/10 dark:border-dark-border/10 transition-colors">
            <FaTimes className="text-light-text-secondary dark:text-dark-text-secondary" size={16} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-light-border/10 dark:border-dark-border/10">
          <button 
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'details' ? 'border-matrix-green text-matrix-green' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
          >
            Detalles
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'history' ? 'border-matrix-green text-matrix-green' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
          >
            Historial
          </button>
          <button 
            onClick={() => setActiveTab('review')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'review' ? 'border-matrix-green text-matrix-green' : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
          >
            Reseña
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* LEFT COLUMN: Logistics & Customer */}
            <div className="space-y-6">
              
              {/* Premium Address Card */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-matrix-green/10 to-transparent border border-matrix-green/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FaMapMarkerAlt size={64} className="text-matrix-green" />
                </div>
                
                <h4 className="text-xs font-bold uppercase tracking-widest text-matrix-green mb-3 flex items-center gap-2 relative z-10">
                  <FaUser size={12} /> Cliente & Dirección
                </h4>
                
                <div className="relative z-10">
                  <p className="text-lg font-black text-light-text-primary dark:text-dark-text-primary mb-3">
                    {order.customer?.name || 'Cliente sin nombre'}
                  </p>
                  
                  {!isPickup ? (
                    <a href={mapsUrl(deliveryAddress)} target="_blank" rel="noopener noreferrer"
                      className="group flex items-start gap-3 p-3 rounded-xl bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/10 dark:border-dark-border/10 hover:border-matrix-green/50 transition-colors mb-4">
                      <div className="mt-0.5 p-2 rounded-full bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <FaMapMarkerAlt size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-tight group-hover:text-matrix-green transition-colors">
                          {deliveryAddress}
                        </p>
                        {deliveryDepto && (
                          <p className="text-xs text-light-text-tertiary mt-1 flex items-center gap-1">
                            <FaBuilding size={10} /> Depto/Oficina: {deliveryDepto}
                          </p>
                        )}
                        {order.delivery_info?.instructions && (
                          <p className="text-xs text-amber-500 font-medium mt-1 flex items-center gap-1">
                            <FaStickyNote size={10} /> {order.delivery_info.instructions}
                          </p>
                        )}
                      </div>
                      <FaExternalLinkAlt size={12} className="text-light-text-tertiary group-hover:text-matrix-green transition-colors opacity-0 group-hover:opacity-100 mt-1" />
                    </a>
                  ) : (
                    <div className="group flex items-start gap-3 p-3 rounded-xl bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/10 dark:border-dark-border/10 mb-4">
                      <div className="mt-0.5 p-2 rounded-full bg-matrix-green/10 text-matrix-green">
                        <FaStore size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-tight">
                          Retiro en {locationName}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {order.customer?.phone && (
                      <ContactPill 
                        icon={FaPhone} text={order.customer.phone} href={`tel:${order.customer.phone}`}
                        colorCls="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500 hover:text-white"
                      />
                    )}
                    {order.customer?.email && (
                      <ContactPill 
                        icon={FaEnvelope} text={order.customer.email} href={`mailto:${order.customer.email}`}
                        colorCls="bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500 hover:text-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Carrier */}
              {order.carrier_slug && (
                <Section icon={FaMotorcycle} title="Información del Repartidor" color="text-cyan-500" bgColor="bg-cyan-500/5" borderColor="border-cyan-500/20">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-500">
                      <FaMotorcycle size={20} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-light-text-primary dark:text-dark-text-primary capitalize">{order.carrier_slug}</p>
                      {order.carrier_status && (
                        <p className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 inline-block mt-1">
                          {order.carrier_status}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {ci?.name && (
                    <div className="mt-4 pt-4 border-t border-cyan-500/10 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-light-text-secondary uppercase font-bold tracking-wider mb-1">Nombre</p>
                        <p className="text-sm font-semibold text-cyan-500">{ci.name}</p>
                      </div>
                      {ci.phone && (
                        <div>
                          <p className="text-[10px] text-light-text-secondary uppercase font-bold tracking-wider mb-1">Teléfono</p>
                          <a href={`tel:${ci.phone}`} className="text-sm font-semibold text-light-text-primary hover:text-cyan-500">{ci.phone}</a>
                        </div>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* Timeline */}
              <Section icon={FaCalendarAlt} title="Trazabilidad">
                <div className="space-y-1">
                  <Row label="Recibido" value={`${fmtDate(order.created_at)} ${fmtTime(order.created_at)}`} />
                  {order.dispatched_at && <Row label="Despachado" value={`${fmtDate(order.dispatched_at)} ${fmtTime(order.dispatched_at)}`} color="text-amber-500" />}
                  {order.delivered_at && <Row label="Entregado" value={`${fmtDate(order.delivered_at)} ${fmtTime(order.delivered_at)}`} color="text-matrix-green" />}
                  {order.delivered_at && (
                    <Row label="Tiempo Total" value={elapsed(order.created_at, order.delivered_at)} bold color="text-matrix-green" mono />
                  )}
                </div>
              </Section>
            </div>

            {/* RIGHT COLUMN: Items & Summary */}
            <div className="space-y-6">
              
              {/* Items List */}
              <Section icon={FaBoxOpen} title={`Detalle del Pedido (${items.length} ítems)`}>
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {items.map((item, i) => {
                    const imgUrl = item.image_url || item.image || item.photo;
                    return (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-light-surface/50 dark:hover:bg-dark-surface/50 transition-colors border border-transparent hover:border-light-border/10 dark:hover:border-dark-border/10 group">
                        {/* Image with Quantity Badge */}
                        <div className="relative w-14 h-14 shrink-0 rounded-lg bg-light-surface-tertiary dark:bg-dark-surface-tertiary border border-light-border/10 dark:border-dark-border/10 flex items-center justify-center overflow-hidden">
                          {imgUrl ? (
                            <img src={imgUrl} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <FaBoxOpen className="text-light-text-tertiary opacity-50" size={20} />
                          )}
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-matrix-green text-dark-bg text-xs font-bold flex items-center justify-center shadow-md border-2 border-light-surface dark:border-dark-surface">
                            {item.quantity}
                          </div>
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{item.nombre || item.codigo}</p>
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            {fmt(item.unit_price)} c/u
                          </p>
                        </div>
                        
                        {/* Subtotal */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-light-text-primary dark:text-dark-text-primary font-mono">
                            {fmt(item.unit_price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="pt-3 border-t border-light-border/10 dark:border-dark-border/10 space-y-1">
                  {order.delivery_fee > 0 && (
                    <Row label="Costo de Envío" value={fmt(order.delivery_fee)} />
                  )}
                  <div className="flex justify-between items-center pt-3 pb-1 mt-2 border-t border-light-border/10 dark:border-dark-border/10">
                    <span className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">Total a Pagar</span>
                    <span className="text-2xl font-black text-matrix-green font-mono">{fmt(order.total_amount)}</span>
                  </div>
                </div>
              </Section>

              {/* Payment & Notes */}
              <div className="grid grid-cols-2 gap-4">
                {(order.payment_method || order.payment_status) && (
                  <Section icon={FaCreditCard} title="Pago">
                    <div className="flex flex-col gap-2">
                      {order.payment_status && (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg text-center ${order.payment_status === 'paid' ? 'bg-matrix-green/10 text-matrix-green border border-matrix-green/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                          {order.payment_status === 'paid' ? '✅ Pagado' : order.payment_status.toUpperCase()}
                        </span>
                      )}
                      {order.payment_method && (
                        <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary capitalize text-center">
                          {order.payment_method}
                        </span>
                      )}
                    </div>
                  </Section>
                )}

                {order.notes ? (
                  <Section icon={FaStickyNote} title="Notas" color="text-amber-500" bgColor="bg-amber-500/5" borderColor="border-amber-500/20">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400 italic line-clamp-3">"{order.notes}"</p>
                  </Section>
                ) : (
                  <div className="rounded-2xl p-5 border border-dashed border-light-border/20 dark:border-dark-border/20 flex flex-col items-center justify-center opacity-50">
                    <FaStickyNote size={16} className="mb-2 text-light-text-tertiary" />
                    <span className="text-xs font-medium">Sin notas adicionales</span>
                  </div>
                )}
              </div>

              {/* Review in Details removed, moved to its own tab */}
            </div>
          </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">
                  Historial de Pedidos ({historyOrders.length})
                </h3>
                <span className="text-xs font-mono bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-2 py-1 rounded">
                  {order.customer?.phone}
                </span>
              </div>
              
              {loadingHistory ? (
                <div className="text-center p-8 text-sm opacity-50">Cargando historial...</div>
              ) : historyOrders.length === 0 ? (
                <div className="text-center p-8 text-sm opacity-50">No hay pedidos anteriores.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {historyOrders.map((histOrder) => {
                    const isCurrent = histOrder._id === order._id;
                    const meta = statusesMap[histOrder.status] || {};
                    return (
                      <div key={histOrder._id} className={`p-4 rounded-xl border flex items-center justify-between ${isCurrent ? 'bg-matrix-green/5 border-matrix-green/30' : 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border-light-border/10 dark:border-dark-border/10 hover:border-light-border/30 dark:hover:border-dark-border/30'}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-sm">#{histOrder.order_number?.slice(-8).toUpperCase()}</span>
                            {isCurrent && <span className="text-[9px] font-black uppercase tracking-wider bg-matrix-green text-black px-1.5 py-0.5 rounded">Actual</span>}
                          </div>
                          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {fmtDate(histOrder.created_at)} a las {fmtTime(histOrder.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-sm">{fmt(histOrder.total_amount)}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: meta.color ? `${meta.color}15` : '#6663', color: meta.color || '#666' }}>
                              {meta.label || histOrder.status}
                            </span>
                          </div>
                          {histOrder.review?.overall_stars && (
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
                              ⭐ {histOrder.review.overall_stars}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* REVIEW TAB */}
          {activeTab === 'review' && (
            <div className="max-w-xl mx-auto mt-4">
              {review ? (
                <div className="bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/20 rounded-3xl p-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <FaStar size={120} className="text-amber-500" />
                  </div>
                  <h3 className="text-lg font-bold text-amber-500 mb-6 uppercase tracking-wider relative z-10">Evaluación del Cliente</h3>
                  <div className="flex justify-center mb-6 relative z-10">
                    <Stars count={review.overall_stars || 0} size={40} />
                  </div>
                  <p className="text-5xl font-black text-amber-400 mb-8 relative z-10">{review.overall_stars || 0}<span className="text-xl text-amber-400/50">/5</span></p>
                  
                  {review.comment && (
                    <div className="bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur rounded-2xl p-6 shadow-sm border border-amber-500/10 relative z-10 text-left">
                      <FaStickyNote className="text-amber-500 mb-2 opacity-50" />
                      <p className="text-base text-light-text-primary dark:text-dark-text-primary font-medium italic">"{review.comment}"</p>
                    </div>
                  )}
                  
                  <div className="flex justify-center gap-8 mt-8 relative z-10">
                    {review.food_stars && (
                      <div className="text-center">
                        <div className="text-2xl mb-1">🍔</div>
                        <div className="text-xs font-bold text-light-text-secondary uppercase tracking-wider">Comida</div>
                        <div className="text-lg font-black text-amber-400">{review.food_stars}/5</div>
                      </div>
                    )}
                    {review.delivery_stars && (
                      <div className="text-center">
                        <div className="text-2xl mb-1">🛵</div>
                        <div className="text-xs font-bold text-light-text-secondary uppercase tracking-wider">Envío</div>
                        <div className="text-lg font-black text-amber-400">{review.delivery_stars}/5</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-12 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-3xl border border-light-border/10 dark:border-dark-border/10">
                  <FaStar size={48} className="text-light-text-tertiary mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">Sin Evaluación</h3>
                  <p className="text-sm text-light-text-tertiary">El cliente aún no ha dejado una reseña para este pedido.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
      </div>
    </>
  );
};

export default OrderDetailModal;
