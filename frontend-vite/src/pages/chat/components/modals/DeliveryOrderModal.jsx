import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, MapPin, Phone, Car, Clock, StickyNote, Calendar, User } from 'lucide-react';

export default function DeliveryOrderModal({ open, onClose, order, customerName }) {
  if (!open) return null;

  const orderNumber = order?.order_number || order?._id || 'Pedido';
  const shortOrderNum = orderNumber.length > 8 ? orderNumber.slice(-8) : orderNumber;
  
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return `$${Number(amount).toLocaleString('es-CL')}`;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'confirmed': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'preparing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'ready': return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
      case 'dispatching': return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="absolute inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full max-w-lg bg-light-surface dark:bg-dark-surface rounded-[24px] shadow-modal overflow-hidden pointer-events-auto border border-light-border dark:border-dark-border flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* --- HEADER --- */}
              <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-dark-border bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20">
                      <Package size={20} />
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-light-text-primary dark:text-dark-text-primary leading-tight uppercase">#{shortOrderNum}</h3>
                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-bold uppercase tracking-wide">
                        Detalle del Pedido
                      </span>
                   </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* --- CONTENT AREA --- */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-light-surface/50 dark:bg-dark-surface/50 scrollbar-thin scrollbar-thumb-light-border dark:scrollbar-thumb-dark-border space-y-6">
                
                {/* 1. Estado y Cliente */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
                      <div>
                        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{customerName || order?.customer?.name || 'Cliente'}</p>
                        {order?.customer?.phone && (
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{order.customer.phone}</p>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-lg border ${getStatusColor(order?.status)}`}>
                      {order?.status_label || order?.status || 'ACTIVO'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 bg-light-surface dark:bg-black/20 p-3 rounded-xl border border-light-border dark:border-dark-border">
                    <MapPin size={16} className="text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-light-text-primary dark:text-dark-text-primary font-medium">{order?.dropoff_address || order?.address || order?.customer?.address || 'Sin dirección'}</p>
                      {order?.customer?.depto && (
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Depto: {order.customer.depto}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Información del Repartidor */}
                {order?.carrier ? (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Car size={18} className="text-cyan-600 dark:text-cyan-400" />
                        <span className="font-bold text-sm text-cyan-700 dark:text-cyan-300 capitalize">{order.carrier.replace('_', ' ')}</span>
                      </div>
                      {order.carrier_status && (
                        <span className="text-[10px] font-bold text-cyan-600/70 dark:text-cyan-400/70 uppercase tracking-wider bg-cyan-500/10 px-2 py-0.5 rounded">
                          {order.carrier_status}
                        </span>
                      )}
                    </div>
                    
                    {order.courier_info && order.courier_info.name && (
                      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                        <p className="text-sm font-bold text-cyan-800 dark:text-cyan-200">{order.courier_info.name}</p>
                        {order.courier_info.phone && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-cyan-700 dark:text-cyan-300">
                            <Phone size={12} />
                            <span>{order.courier_info.phone}</span>
                          </div>
                        )}
                        {order.courier_info.vehicle && (
                          <p className="text-xs text-cyan-700/70 dark:text-cyan-300/70 mt-1 uppercase tracking-wider">{order.courier_info.vehicle}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                    <Car size={16} />
                    <span>Sin repartidor asignado</span>
                  </div>
                )}

                {/* 3. Lista de Productos */}
                <div className="border border-light-border dark:border-dark-border rounded-xl bg-light-surface dark:bg-black/20 overflow-hidden">
                  <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-4 py-2 border-b border-light-border dark:border-dark-border">
                    <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Productos</h4>
                  </div>
                  <div className="px-4 py-2 flex flex-col divide-y divide-light-border/50 dark:divide-dark-border/50">
                    {Array.isArray(order?.items) && order.items.length > 0 ? (
                      order.items.map((item, i) => (
                        <div key={i} className="py-2 flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 text-light-text-primary dark:text-dark-text-primary font-medium">
                            <span className="text-light-text-secondary dark:text-dark-text-secondary font-bold text-xs">{item.quantity}x</span>
                            <span>{item.nombre || item.codigo || 'Producto'}</span>
                          </div>
                          <span className="text-light-text-secondary dark:text-dark-text-secondary">
                            {formatCurrency((item.unit_price || 0) * (item.quantity || 1))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-light-text-tertiary">
                        No hay detalle de productos
                      </div>
                    )}
                  </div>
                  
                  {/* Totales */}
                  <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 px-4 py-3 border-t border-light-border dark:border-dark-border flex flex-col gap-1.5">
                    {order?.delivery_fee > 0 && (
                      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                        <span>Envío</span>
                        <span>{formatCurrency(order.delivery_fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm font-black text-light-text-primary dark:text-dark-text-primary pt-1">
                      <span>Total</span>
                      <span>{formatCurrency(order?.total_amount || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Notas y Extras */}
                {(order?.notes || order?.scheduled_for) && (
                  <div className="flex flex-col gap-2">
                    {order.notes && (
                      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                        <StickyNote size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-800 dark:text-amber-200">{order.notes}</p>
                      </div>
                    )}
                    {order.scheduled_for && (
                      <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 p-3 rounded-xl text-violet-600 dark:text-violet-400">
                        <Calendar size={14} />
                        <span className="text-xs font-bold uppercase tracking-wide">
                          Programado: {new Date(order.scheduled_for).toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
