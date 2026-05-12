// src/pages/delivery/dispatch/DispatchStatusBar.jsx
// Bottom status bar with real-time dispatch KPIs
import React, { useMemo } from 'react';
import { FaCircle, FaTruck, FaClock, FaCheckCircle, FaHourglassHalf } from 'react-icons/fa';

const DispatchStatusBar = ({ orders = [], statuses = [], t }) => {
  const stats = useMemo(() => {
    const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const enRoute = active.filter((o) => o.status === 'dispatched');
    // Waiting = all active statuses except dispatched (derived from MongoDB pipeline)
    const waitingKeys = new Set(
      statuses
        .filter(s => !['delivered', 'cancelled', 'dispatched'].includes(s.key))
        .map(s => s.key)
    );
    const waiting = active.filter((o) => waitingKeys.has(o.status));

    // Today's delivered
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const deliveredToday = orders.filter(
      (o) => o.status === 'delivered' && o.delivered_at && new Date(o.delivered_at) >= todayStart
    );

    // Avg delivery time (for today's delivered orders)
    let avgMin = 0;
    if (deliveredToday.length > 0) {
      const times = deliveredToday
        .filter((o) => o.created_at && o.delivered_at)
        .map((o) => (new Date(o.delivered_at) - new Date(o.created_at)) / 60000);
      avgMin = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    }

    return {
      active: active.length,
      enRoute: enRoute.length,
      waiting: waiting.length,
      deliveredToday: deliveredToday.length,
      avgMin,
    };
  }, [orders]);

  const items = [
    {
      label: t?.('delivery.dispatch_active') || 'Active',
      value: stats.active,
      icon: FaCircle,
      color: 'text-matrix-green',
      pulse: stats.active > 0,
    },
    {
      label: t?.('delivery.dispatch_en_route') || 'En route',
      value: stats.enRoute,
      icon: FaTruck,
      color: 'text-cyan-400',
    },
    {
      label: t?.('delivery.dispatch_waiting') || 'Waiting',
      value: stats.waiting,
      icon: FaHourglassHalf,
      color: stats.waiting > 3 ? 'text-red-400' : 'text-amber-400',
    },
    {
      label: t?.('delivery.dispatch_delivered_today') || 'Delivered today',
      value: stats.deliveredToday,
      icon: FaCheckCircle,
      color: 'text-emerald-400',
    },
    {
      label: t?.('delivery.dispatch_avg_time') || 'Avg time',
      value: stats.avgMin ? `${stats.avgMin}m` : '—',
      icon: FaClock,
      color: 'text-violet-400',
    },
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-3 px-3 py-2.5 bg-light-surface/40 dark:bg-dark-surface/40 backdrop-blur-xl rounded-xl border border-white/5 overflow-x-auto">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 whitespace-nowrap"
        >
          <item.icon
            size={10}
            className={`${item.color} ${item.pulse ? 'animate-pulse' : ''}`}
          />
          <span className={`text-sm sm:text-base font-bold ${item.color}`}>
            {item.value}
          </span>
          <span className="text-[10px] sm:text-xs text-dark-text-secondary hidden sm:inline">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default DispatchStatusBar;
