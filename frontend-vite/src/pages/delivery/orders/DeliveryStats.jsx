import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaBoxOpen, FaClock, FaChartLine, FaDollarSign, FaTruck, FaCheckCircle, FaSpinner, FaFire, FaMapMarkedAlt, FaSortAmountDown, FaSortAmountUp, FaUtensils, FaCalendarAlt } from 'react-icons/fa';
import { useDeliveryAnalytics } from '../../../hooks/delivery/useDeliveryAnalytics';
import HeatmapMap from './HeatmapMap';

const formatCurrency = (amount) => {
  if (amount == null) return '$0';
  return '$' + Math.round(amount).toLocaleString('es-CL');
};

const StatCard = ({ icon: Icon, label, value, subValue, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="bg-white/70 dark:bg-[#151515]/70 backdrop-blur-md border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-5 shadow-xl shadow-black/5 hover:shadow-2xl hover:-translate-y-1 transition-all"
  >
    <div className="flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
        style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)`, color }}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-light-text-tertiary uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">{value}</p>
        {subValue && (
          <p className="text-[10px] font-bold text-light-text-secondary mt-1 bg-light-surface-secondary dark:bg-[#222] px-2 py-0.5 rounded-full inline-block">{subValue}</p>
        )}
      </div>
    </div>
  </motion.div>
);

const DeliveryStats = ({ stats, appState, locationId, t, expanded = false }) => {
  const s = stats || {};
  const byStatus = s.by_status || {};

  const { data, loading, error, dateFrom, setDateFrom, dateTo, setDateTo, loadAnalytics } = useDeliveryAnalytics({ appState, locationId });
  const [sortField, setSortField] = useState('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const sortedSales = [...(data.sales_by_hour || [])].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

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

  // Centered on Santiago if no points
  const mapCenter = [-33.4489, -70.6693];

  return (
    <div className="space-y-8 pb-10">
      {/* Top Basic Metrics */}
      <div className={`grid gap-4 ${expanded ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'}`}>
        {cards.map((card, i) => (
          <StatCard key={card.label} {...card} delay={i * 0.05} />
        ))}
      </div>

      {expanded && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div>
                <h2 className="text-xl font-black text-light-text-primary dark:text-white flex items-center gap-2">
                   <FaChartLine className="text-matrix-green" /> Analíticas Avanzadas
                </h2>
                <p className="text-xs text-light-text-secondary mt-1">Explora ventas por hora y zonas calientes de despacho</p>
             </div>
             <div className="flex items-center gap-3 bg-light-surface dark:bg-[#151515] p-2 rounded-xl border border-light-border/10 dark:border-white/10 shadow-sm">
                <FaCalendarAlt className="text-light-text-tertiary ml-2" />
                <input 
                   type="date" 
                   value={dateFrom} 
                   onChange={e => setDateFrom(e.target.value)} 
                   className="bg-transparent border-none text-xs font-bold text-light-text-primary dark:text-white focus:ring-0 cursor-pointer"
                />
                <span className="text-light-text-tertiary font-bold">-</span>
                <input 
                   type="date" 
                   value={dateTo} 
                   onChange={e => setDateTo(e.target.value)} 
                   className="bg-transparent border-none text-xs font-bold text-light-text-primary dark:text-white focus:ring-0 cursor-pointer"
                />
             </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-light-surface dark:bg-[#151515] rounded-3xl border border-light-border/10 dark:border-white/10">
              <FaSpinner className="animate-spin text-3xl text-matrix-green mb-4" />
              <p className="text-sm font-bold text-light-text-secondary">Procesando analíticas...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-500/10 text-red-500 rounded-2xl border border-red-500/20 text-center font-bold">
               {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Heatmap Card */}
              <div className="bg-white/70 dark:bg-[#151515]/70 backdrop-blur-md rounded-3xl p-5 border border-light-border/20 dark:border-dark-border/20 shadow-xl shadow-black/5 flex flex-col">
                <h3 className="text-sm font-black text-light-text-primary dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                  <FaMapMarkedAlt className="text-blue-500" /> Zonas con mayor demanda
                </h3>
                <div className="flex-1 min-h-[400px] rounded-2xl overflow-hidden shadow-inner border border-light-border/10 dark:border-white/5 relative z-0">
                  <HeatmapMap points={data.heatmap} center={mapCenter} zoom={12} />
                </div>
              </div>

              {/* Sales by Hour Card */}
              <div className="bg-white/70 dark:bg-[#151515]/70 backdrop-blur-md rounded-3xl p-5 border border-light-border/20 dark:border-dark-border/20 shadow-xl shadow-black/5 flex flex-col">
                <h3 className="text-sm font-black text-light-text-primary dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
                  <FaFire className="text-amber-500" /> Top Ventas por Hora & Producto
                </h3>
                
                <div className="overflow-hidden rounded-2xl border border-light-border/10 dark:border-white/5 bg-light-surface-secondary/30 dark:bg-black/20 flex-1 flex flex-col">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-3 bg-light-surface dark:bg-[#222] border-b border-light-border/10 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-light-text-tertiary">
                    <div className="cursor-pointer hover:text-light-text-primary transition-colors flex items-center gap-1" onClick={() => handleSort('nombre')}>
                      Producto {sortField === 'nombre' && (sortAsc ? <FaSortAmountUp/> : <FaSortAmountDown/>)}
                    </div>
                    <div className="cursor-pointer hover:text-light-text-primary transition-colors flex items-center gap-1 text-right w-16 justify-end" onClick={() => handleSort('quantity')}>
                      Cant. {sortField === 'quantity' && (sortAsc ? <FaSortAmountUp/> : <FaSortAmountDown/>)}
                    </div>
                    <div className="cursor-pointer hover:text-light-text-primary transition-colors flex items-center gap-1 text-right w-24 justify-end" onClick={() => handleSort('revenue')}>
                      Revenue {sortField === 'revenue' && (sortAsc ? <FaSortAmountUp/> : <FaSortAmountDown/>)}
                    </div>
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar flex-1 max-h-[400px]">
                    {sortedSales.length === 0 ? (
                      <div className="p-8 text-center text-xs font-bold text-light-text-tertiary">No hay datos para este período.</div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {sortedSales.map((item, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-2 rounded-xl hover:bg-white/50 dark:hover:bg-[#333]/50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                               {item.image_url ? (
                                  <img src={item.image_url} alt={item.nombre} className="w-10 h-10 rounded-lg object-cover shadow-sm flex-shrink-0" />
                               ) : (
                                  <div className="w-10 h-10 rounded-lg bg-light-surface-tertiary dark:bg-[#444] flex items-center justify-center text-light-text-tertiary flex-shrink-0"><FaUtensils size={14} /></div>
                               )}
                               <div className="min-w-0">
                                  <p className="text-xs font-black text-light-text-primary dark:text-white truncate">{item.nombre}</p>
                                  <p className="text-[10px] font-bold text-light-text-secondary mt-0.5 bg-matrix-green/10 text-matrix-green px-2 py-0.5 rounded-full inline-flex">
                                    {item.hour}:00 - {item.hour + 1}:00
                                  </p>
                               </div>
                            </div>
                            <div className="text-xs font-black text-light-text-secondary w-16 text-right">
                              {item.quantity}
                            </div>
                            <div className="text-sm font-black text-light-text-primary dark:text-white w-24 text-right">
                              {formatCurrency(item.revenue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryStats;
