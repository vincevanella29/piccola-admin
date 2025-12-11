// src/pages/menus/components/ProductModal.jsx
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaChartLine, FaBoxOpen, FaDollarSign, FaPercentage, FaArrowUp, FaArrowDown, FaMinus, FaInfoCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';
import { Tooltip as ReactTooltip } from 'react-tooltip';

// --- Utility Functions ---
const isNum = (n) => typeof n === 'number' && isFinite(n);
const fmtMoney = (n, symbol = '$') => (isNum(n) ? `${symbol}${Math.round(n).toLocaleString('es-CL')}` : '—');
const fmtNum = (n) => (isNum(n) ? n.toLocaleString('es-CL') : '—');
const pct = (num, den) => (isNum(num) && isNum(den) && den !== 0 ? (num / den) * 100 : 0);

// --- Sub-Components ---

const TrendBadge = ({ current, previous, inverse = false }) => {
  if (!isNum(current) || !isNum(previous) || previous === 0) return <span className="text-gray-400 text-xs">—</span>;
  
  const diff = current - previous;
  const percentage = (diff / Math.abs(previous)) * 100;
  const isPositive = percentage > 0;
  const isNeutral = percentage === 0;
  
  // Logic: Higher sales/margin is good (green), Higher cost is bad (red) - unless inverse
  const isGood = inverse ? !isPositive : isPositive;
  
  const colorClass = isNeutral 
    ? 'text-gray-500 bg-gray-100 dark:bg-gray-800' 
    : isGood 
      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' 
      : 'text-red-600 bg-red-50 dark:bg-red-900/20';

  const Icon = isNeutral ? FaMinus : isPositive ? FaArrowUp : FaArrowDown;

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colorClass}`}>
      <Icon size={8} />
      <span>{Math.abs(percentage).toFixed(1)}%</span>
    </div>
  );
};

const MetricCard = ({ label, value, subValue, trend, icon: Icon, color = "blue", tooltip }) => {
  const colorMap = {
    blue: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
    green: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
    purple: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
    orange: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
  };

  return (
    <div className="flex flex-col p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 shadow-sm relative overflow-hidden group hover:border-light-border/40 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${colorMap[color]} transition-colors`}>
          <Icon size={16} />
        </div>
        {trend}
      </div>
      <div className="mt-auto">
        <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
          {label}
          {tooltip && (
             <FaInfoCircle 
               className="text-gray-300 hover:text-gray-500 cursor-help" 
               size={10} 
               data-tooltip-id={`tt-${label}`} 
               data-tooltip-content={tooltip}
             />
          )}
        </p>
        <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mt-0.5 tracking-tight">
          {value}
        </h3>
        {subValue && (
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-1 font-mono">
            {subValue}
          </p>
        )}
      </div>
      {tooltip && <ReactTooltip id={`tt-${label}`} place="top" className="z-50 text-xs" />}
    </div>
  );
};

const PeriodTab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      px-4 py-2 text-xs font-bold rounded-full transition-all border
      ${active 
        ? 'bg-light-text-primary dark:bg-white text-white dark:text-black border-transparent shadow-md' 
        : 'bg-transparent text-light-text-secondary dark:text-dark-text-secondary border-transparent hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'
      }
    `}
  >
    {label}
  </button>
);

const ProductModal = ({ product, mediaMap, onClose }) => {
  const { t } = useTranslation();
  const { price: basePrice } = getCurrentPrice(product, 'dinein', undefined, t);
  const [activeTab, setActiveTab] = useState('anterior'); // Default to last month
  const [isMounted, setIsMounted] = useState(false);

  // --- Logic & Data Prep ---
  let imgUrl = product?.media_r2 || product?.media_local || product?.media_url || null;
  if (!imgUrl && product?.media_id && mediaMap?.[String(product.media_id)]) {
    imgUrl = mediaMap[String(product.media_id)];
  }

  // Effect for animation mount
  useEffect(() => { setIsMounted(true); return () => setIsMounted(false); }, []);

  if (!isMounted) return null;

  // --- Data Extraction ---
  const R = product?.rentabilidad || {};
  const dataMap = {
    actual: { data: R.actual, label: t('menus.modal.p_now'), compare: R.anterior }, // This month vs Last month
    anterior: { data: R.anterior, label: t('menus.modal.p_prev'), compare: R.antepasado }, // Last month vs 2 months ago
    anio_anterior: { data: R.anio_anterior, label: t('menus.modal.p_year'), compare: R.anterior_anio_anterior }, // Last year
  };

  const currentPeriod = dataMap[activeTab];
  const D = currentPeriod?.data || {};
  const C = currentPeriod?.compare || {};

  // Metrics
  const sales = D.total_venta;
  const prevSales = C.total_venta;
  
  const profit = D.total_margen;
  const prevProfit = C.total_margen;
  
  const units = D.cantidad;
  const prevUnits = C.cantidad;
  
  const margin = pct(profit, sales);
  const prevMargin = pct(prevProfit, prevSales);

  const unitCost = D.cupro;
  const unitPrice = isNum(basePrice) ? basePrice : (isNum(D.margen) && isNum(D.cupro) ? D.margen + D.cupro : null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-light-surface/95 dark:bg-dark-surface/95 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-light-border/20 dark:border-dark-border/20 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-light-border/10 dark:border-dark-border/10 bg-light-surface/50 dark:bg-dark-surface/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 flex-shrink-0">
              {imgUrl ? (
                <img src={imgUrl} alt={product.nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">IMG</div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">
                {product.nombre}
              </h2>
              <div className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono mt-0.5">
                <span className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-1.5 py-0.5 rounded">
                  {product.codigo || 'NO-CODE'}
                </span>
                <span>•</span>
                <span>{fmtMoney(unitPrice)}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary hover:text-light-error transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* CONTROLS (Period Selector) */}
        <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-light-border/5 dark:border-dark-border/5">
          {Object.keys(dataMap).map((key) => (
            <PeriodTab 
              key={key} 
              label={dataMap[key].label} 
              active={activeTab === key} 
              onClick={() => setActiveTab(key)} 
            />
          ))}
        </div>

        {/* DASHBOARD CONTENT */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {/* 1. KEY METRICS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard 
              label={t('menus.kpis.sales')} 
              value={fmtMoney(sales)} 
              trend={<TrendBadge current={sales} previous={prevSales} />}
              icon={FaDollarSign}
              color="blue"
              tooltip="Ventas totales en este periodo"
            />
            <MetricCard 
              label={t('menus.kpis.profit')} 
              value={fmtMoney(profit)} 
              trend={<TrendBadge current={profit} previous={prevProfit} />}
              icon={FaChartLine}
              color="green"
              tooltip="Utilidad bruta (Ventas - Costos)"
            />
            <MetricCard 
              label={t('menus.kpis.units')} 
              value={fmtNum(units)} 
              trend={<TrendBadge current={units} previous={prevUnits} />}
              icon={FaBoxOpen}
              color="purple"
              tooltip="Unidades vendidas"
            />
            <MetricCard 
              label={t('menus.modal.margin_pct')} 
              value={`${margin.toFixed(1)}%`} 
              subValue={`Ref: ${prevMargin.toFixed(1)}%`}
              trend={<TrendBadge current={margin} previous={prevMargin} />}
              icon={FaPercentage}
              color="orange"
              tooltip="Margen porcentual sobre venta"
            />
          </div>

          {/* 2. UNIT ECONOMICS (Detail View) */}
          <div className="bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-2xl p-6 border border-light-border/10 dark:border-dark-border/10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-4 flex items-center gap-2">
              <FaInfoCircle /> Economía Unitaria
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
               {/* Visual Connector Lines (Desktop) */}
               <div className="hidden md:block absolute top-1/2 left-1/3 w-8 h-px bg-gray-300 dark:bg-gray-700 -translate-y-1/2 -translate-x-1/2" />
               <div className="hidden md:block absolute top-1/2 left-2/3 w-8 h-px bg-gray-300 dark:bg-gray-700 -translate-y-1/2 -translate-x-1/2" />

               {/* Price Breakdown */}
               <div className="text-center">
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Precio Venta</p>
                  <p className="text-2xl font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtMoney(unitPrice)}</p>
               </div>

               {/* Cost Breakdown */}
               <div className="text-center relative">
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Costo Unitario (CUPRO)</p>
                  <p className="text-2xl font-mono font-bold text-red-500">-{fmtMoney(unitCost)}</p>
               </div>

               {/* Profit Breakdown */}
               <div className="text-center">
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">Margen Unitario</p>
                  <p className="text-2xl font-mono font-bold text-emerald-500">
                    +{fmtMoney(isNum(unitPrice) && isNum(unitCost) ? unitPrice - unitCost : 0)}
                  </p>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full" 
                      style={{ width: `${Math.min(100, Math.max(0, margin))}%` }} 
                    />
                  </div>
               </div>
            </div>
          </div>

          {/* 3. ADDITIONAL INFO (Footer) */}
          <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-light-text-tertiary dark:text-dark-text-tertiary font-mono">
             <div>
               <span className="font-bold text-light-text-secondary dark:text-dark-text-secondary">ID Sistema:</span> {product.id || product._id}
             </div>
             <div className="text-right">
               <span className="font-bold text-light-text-secondary dark:text-dark-text-secondary">Categoría:</span> {(product.category_ids || []).join(', ') || 'N/A'}
             </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default ProductModal;