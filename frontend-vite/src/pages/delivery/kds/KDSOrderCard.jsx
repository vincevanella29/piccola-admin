// src/pages/delivery/kds/KDSOrderCard.jsx
// Individual order card for Kitchen Display System — premium design
import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { FaClock, FaCheck, FaCheckDouble, FaArrowRight, FaUser, FaStickyNote, FaMotorcycle, FaStore } from 'react-icons/fa';

const PROVIDER_EMOJI = {
  vanellix: '🟢', uber_direct: '🔵', pedidosya: '🟠', getjusto: '🟣', unknown: '⚪',
};

// Timer hook — returns elapsed minutes and urgency level (updates every 15s for responsiveness)
const useTimer = (createdAt) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - new Date(createdAt).getTime();
      setElapsed(Math.floor(diff / 60000));
    };
    calc();
    const interval = setInterval(calc, 15000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const urgency = elapsed < 10 ? 'green' : elapsed < 20 ? 'yellow' : 'red';
  const display = elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;

  return { elapsed, urgency, display };
};

const URGENCY_STYLES = {
  green:  { badge: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30', glow: '' },
  yellow: { badge: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30', glow: '' },
  red:    { badge: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40', glow: 'animate-pulse' },
};

const KDSOrderCard = forwardRef(({ order, statuses = [], onToggleItem, onStatusChange, t }, ref) => {
  const timer = useTimer(order.created_at);
  const urgency = URGENCY_STYLES[timer.urgency];
  const allDone = order.items.every(i => i.done);
  const doneCount = order.items.filter(i => i.done).length;
  const totalItems = order.items.length;
  const progress = totalItems > 0 ? (doneCount / totalItems) * 100 : 0;

  // Derive next status from the mongo-driven pipeline
  const currentIdx = statuses.findIndex(s => s.key === order.status);
  const currentStatus = statuses.find(s => s.key === order.status);
  const isCurrentControllable = currentStatus?.kds_controllable !== false;

  const candidateNext = isCurrentControllable && currentIdx >= 0 && currentIdx < statuses.length - 1
    ? statuses[currentIdx + 1]
    : null;
  const nextStatus = candidateNext?.kds_controllable !== false ? candidateNext : null;

  const statusLabel = currentStatus?.label || order.status;
  const statusColor = currentStatus?.color || '#22c55e';
  const nextLabel = nextStatus?.label || '';
  const isPickup = order.order_type === 'pickup';

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -30, transition: { duration: 0.4, ease: 'easeInOut' } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`rounded-2xl overflow-hidden flex flex-col transition-shadow duration-300 ${
        allDone
          ? 'shadow-[0_0_20px_rgba(34,197,94,0.15)] ring-1 ring-emerald-500/30'
          : timer.urgency === 'red'
            ? 'shadow-[0_0_20px_rgba(239,68,68,0.1)] ring-1 ring-red-500/20'
            : 'ring-1 ring-light-border/15 dark:ring-dark-border/15'
      }`}
      style={{
        background: allDone
          ? 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(16,185,129,0.03) 100%)'
          : undefined,
      }}
    >
      {/* ── Progress bar (top edge) ── */}
      <div className="h-1 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-r-full"
          style={{ backgroundColor: allDone ? '#22c55e' : statusColor }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      </div>

      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-center justify-between bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{PROVIDER_EMOJI[order.provider_slug] || '⚪'}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-mono font-bold text-light-text-primary dark:text-dark-text-primary">
                #{order._id.slice(-6).toUpperCase()}
              </p>
              {isPickup && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20">
                  <FaStore size={7} className="inline mr-0.5" />pickup
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FaUser size={7} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
              <span className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[120px]">
                {order.customer_name || t('delivery.kds_customer')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor, boxShadow: `0 0 8px ${statusColor}15` }}
          >
            {statusLabel}
          </span>
          {/* Timer */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${urgency.badge} ${urgency.glow}`}>
            <FaClock size={8} />
            <span className="text-[10px] font-bold font-mono">{timer.display}</span>
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-none bg-light-background/50 dark:bg-dark-background/50">
        {order.items.map((item, idx) => (
          <motion.button
            key={`${item.codigo}-${idx}`}
            onClick={() => onToggleItem(order._id, item.codigo, !item.done)}
            layout
            animate={item.done ? { opacity: 0.55, scale: 0.98 } : { opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left group ${
              item.done
                ? 'bg-emerald-500/5 dark:bg-emerald-500/8'
                : 'bg-light-surface/60 dark:bg-dark-surface/60 hover:bg-light-surface dark:hover:bg-dark-surface'
            }`}
          >
            {/* Checkbox */}
            <motion.div
              animate={item.done
                ? { scale: [1, 1.3, 1], backgroundColor: '#22c55e' }
                : { scale: 1, backgroundColor: 'rgba(0,0,0,0)' }
              }
              transition={{ duration: 0.2 }}
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                item.done
                  ? 'shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                  : 'border-2 border-light-border/25 dark:border-dark-border/25 group-hover:border-matrix-green/50'
              }`}
            >
              {item.done && <FaCheck size={10} className="text-white" />}
            </motion.div>

            {/* Image */}
            {item.image_url ? (
              <img src={item.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 shrink-0 flex items-center justify-center text-[10px]">
                🍽️
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold truncate ${
                item.done
                  ? 'text-light-text-tertiary dark:text-dark-text-tertiary line-through decoration-emerald-500/50'
                  : 'text-light-text-primary dark:text-dark-text-primary'
              }`}>
                {item.nombre}
              </p>
              {item.modifiers?.length > 0 && (
                <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary truncate mt-0.5">
                  {item.modifiers.map(m => m.value_id || m.name || m.label).join(' · ')}
                </p>
              )}
              {(item.notes || item.comment || item.nota) && (
                <p className={`text-[10px] font-bold mt-0.5 flex items-start gap-1 ${item.done ? 'text-emerald-500/50' : 'text-amber-500'}`}>
                  <FaStickyNote size={9} className="mt-0.5 shrink-0" />
                  <span className="italic leading-tight">{item.notes || item.comment || item.nota}</span>
                </p>
              )}
            </div>

            {/* Quantity badge */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
              item.done
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 text-light-text-primary dark:text-dark-text-primary'
            }`}>
              {item.quantity}
            </div>
          </motion.button>
        ))}
      </div>

      {/* ── Notes ── */}
      {order.notes && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
          <div className="flex items-start gap-1.5">
            <FaStickyNote size={8} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-500 dark:text-amber-400 leading-relaxed">{order.notes}</p>
          </div>
        </div>
      )}

      {/* ── Footer Action ── */}
      {nextStatus && (
        <div className="px-3 pb-3 pt-1">
          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[9px] font-mono text-light-text-tertiary dark:text-dark-text-tertiary">
              {doneCount}/{totalItems} items
            </span>
            {allDone && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[9px] font-bold text-emerald-400"
              >
                ✅ Todo listo
              </motion.span>
            )}
          </div>
          <motion.button
            onClick={() => onStatusChange(order._id, nextStatus.key)}
            disabled={!allDone && currentIdx >= 1}
            whileHover={allDone ? { scale: 1.02 } : undefined}
            whileTap={allDone ? { scale: 0.97 } : undefined}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              allDone
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_4px_20px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_25px_rgba(34,197,94,0.4)]'
                : currentIdx >= 1
                  ? 'bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 text-light-text-tertiary dark:text-dark-text-tertiary cursor-not-allowed'
                  : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'
            }`}
          >
            {allDone ? <FaCheckDouble size={14} /> : <FaArrowRight size={11} />}
            {allDone ? `${nextLabel}` : nextLabel}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
});

KDSOrderCard.displayName = 'KDSOrderCard';

export default KDSOrderCard;
