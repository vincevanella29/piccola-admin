// src/pages/delivery/components/DeliveryStats.jsx
// Stats/KPI cards for delivery dashboard
import React from 'react';
import { motion } from 'framer-motion';
import { FaBoxOpen, FaClock, FaChartLine, FaDollarSign, FaTruck, FaCheckCircle } from 'react-icons/fa';

const formatCurrency = (amount) => {
  if (amount == null) return '$0';
  return '$' + Math.round(amount).toLocaleString('es-CL');
};

const StatCard = ({ icon: Icon, label, value, subValue, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-4 hover:shadow-lg transition-shadow"
  >
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{label}</p>
        <p className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{value}</p>
        {subValue && (
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">{subValue}</p>
        )}
      </div>
    </div>
  </motion.div>
);

const DeliveryStats = ({ stats, t, expanded = false }) => {
  // Use empty stats if null — show zeros instead of nothing
  const s = stats || {};
  const byStatus = s.by_status || {};

  const cards = [
    {
      icon: FaClock,
      label: t?.('delivery.stats_active') || 'Activos',
      value: s.active || 0,
      subValue: `${byStatus.pending || 0} pendientes`,
      color: '#f59e0b',
    },
    {
      icon: FaBoxOpen,
      label: t?.('delivery.stats_today') || 'Hoy',
      value: s.today || 0,
      color: '#3b82f6',
    },
    {
      icon: FaDollarSign,
      label: t?.('delivery.stats_revenue') || 'Revenue Hoy',
      value: formatCurrency(s.today_revenue),
      color: '#10b981',
    },
    {
      icon: FaChartLine,
      label: t?.('delivery.stats_week') || 'Semana',
      value: s.week || 0,
      color: '#8b5cf6',
    },
  ];

  // Expanded: show additional stats
  if (expanded) {
    cards.push(
      {
        icon: FaTruck,
        label: t?.('delivery.stats_month') || 'Mes',
        value: s.month || 0,
        color: '#06b6d4',
      },
      {
        icon: FaCheckCircle,
        label: t?.('delivery.stats_delivered') || 'Entregados',
        value: byStatus.delivered || 0,
        subValue: `${byStatus.cancelled || 0} cancelados`,
        color: '#22c55e',
      }
    );
  }

  return (
    <div className={`grid gap-3 mb-6 ${expanded ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'}`}>
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} delay={i * 0.05} />
      ))}
    </div>
  );
};

export default DeliveryStats;
