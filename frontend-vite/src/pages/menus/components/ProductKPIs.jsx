// src/pages/menus/components/ProductKPIs.jsx
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { FaCheck, FaTimes, FaMagic } from 'react-icons/fa';

// --- Utility Functions ---
const isNum = (n) => typeof n === 'number' && isFinite(n);

// Formateador Compacto (Apple Style: 1.5M, 250k)
const fmtCompact = (n, symbol = '$') => {
  if (!isNum(n)) return '—';
  const abs = Math.abs(n);
  
  if (abs >= 1_000_000) {
    return `${symbol}${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10_000) {
    return `${symbol}${(n / 1_000).toFixed(0)}k`;
  }
  if (abs >= 1_000) {
    return `${symbol}${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${symbol}${n.toLocaleString('es-CL')}`;
};

// Formateador Preciso (Para Tooltips)
const fmtFull = (n, symbol = '$') => (isNum(n) ? `${symbol}${n.toLocaleString('es-CL')}` : '—');
const fmtInt = (n) => (isNum(n) ? n.toLocaleString('es-CL') : '—');

const hasData = (o) => {
  if (!o || typeof o !== 'object') return false;
  // Debe tener al menos venta, margen o cantidad válida
  return [o.total_venta, o.total_margen, o.cantidad].some(isNum);
};

const pctDelta = (curr, prev) => {
  if (!isNum(curr) || !isNum(prev) || prev === 0) return null;
  return (curr - prev) / Math.abs(prev);
};

// --- Micro UI Components ---

const TrendIndicator = ({ delta }) => {
  if (delta === null || !isNum(delta)) return <span className="text-[10px] text-light-text-secondary/30 dark:text-dark-text-secondary/30 font-mono">—</span>;
  
  const pct = Math.round(delta * 100);
  const isPositive = pct > 0;
  const isNeutral = pct === 0;
  
  const colorClass = isNeutral 
    ? 'text-light-text-secondary dark:text-dark-text-secondary' 
    : isPositive 
      ? 'text-matrix-green' 
      : 'text-light-error dark:text-dark-error';

  return (
    <span className={`text-[9px] font-bold ${colorClass} flex items-center gap-0.5`}>
      {isNeutral ? '•' : isPositive ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
};

const StatBox = ({ label, value, fullValue, delta, tooltip, extraBadge }) => (
  <div 
    className="flex flex-col p-2 rounded-lg bg-light-surface-tertiary/20 dark:bg-dark-surface-tertiary/20 border border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40 transition-colors group/stat"
    data-tooltip-id={`tt-box-${label}`}
    data-tooltip-content={`${tooltip || label}: ${fullValue}`}
  >
    <div className="flex justify-between items-start mb-0.5">
      <div className="flex items-center gap-1">
        <span className="text-[8px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[60px]">
          {label}
        </span>
        {extraBadge}
      </div>
      <TrendIndicator delta={delta} />
    </div>
    <div className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary truncate font-mono tracking-tight group-hover/stat:text-matrix-green transition-colors">
      {value}
    </div>
    <ReactTooltip id={`tt-box-${label}`} place="top" className="z-50 text-xs font-mono" />
  </div>
);

const ProductKPIs = ({ dish, currentPrice, uidBase }) => {
  const { t } = useTranslation();

  // --- 1. Definición de Periodos y Fallbacks ---
  const R = dish?.rentabilidad || {};
  const P = R.anterior || {}; // Base: Mes Pasado (Referencia Principal)

  // Lógica de Comparación:
  // 1. AA (Año Anterior - Mismo Mes) -> Ideal para estacionalidad
  // 2. AP (Antepasado - Mes Previo al Anterior) -> Tendencia corto plazo
  // 3. AY (Año Anterior - Promedio) -> Fallback general
  const AA = R.anterior_anio_anterior || {};
  const AP = R.antepasado || {};
  const AY = R.anio_anterior || {};

  let C = {}; // Comparador
  let compShort = ''; // Etiqueta (AA, AP, AY)
  let compTipKey = '';

  if (hasData(AA)) {
    C = AA;
    compShort = 'AA';
    compTipKey = 'menus.kpis.compare_aa_tip';
  } else if (hasData(AP)) {
    C = AP;
    compShort = 'AP'; // Antepasado
    compTipKey = 'menus.kpis.compare_ap_tip';
  } else if (hasData(AY)) {
    C = AY;
    compShort = 'AY';
    compTipKey = 'menus.kpis.compare_ay_tip';
  }
  // Si no hay nada, C queda vacío y los deltas serán null (dash)

  const compExplain = compTipKey ? t(compTipKey) : '';

  // --- 2. Lógica de Precios (Manual / Especial) ---
  const hasSpecialActive = !!(dish?.especial?.special_status && isNum(dish?.especial?.special_price));
  const normalListPrice = isNum(dish?.precio) ? dish.precio : currentPrice;
  
  const [useSpecialCalc, setUseSpecialCalc] = useState(hasSpecialActive);
  const [useManualCalc, setUseManualCalc] = useState(false);
  const [appliedManualPrice, setAppliedManualPrice] = useState(null);
  const manualInputRef = useRef(null);

  // Precio final para cálculos
  const selectedUnitPrice = useManualCalc && isNum(appliedManualPrice)
    ? appliedManualPrice
    : (useSpecialCalc && hasSpecialActive ? dish.especial.special_price : normalListPrice);

  const priceDeltaPct = (isNum(selectedUnitPrice) && isNum(normalListPrice) && normalListPrice !== 0)
    ? (selectedUnitPrice - normalListPrice) / Math.abs(normalListPrice)
    : null;

  // --- 3. Cálculos de Rentabilidad (Simulación) ---
  // Base (P)
  const unidades = isNum(P.cantidad) ? P.cantidad : null;
  const cupro = isNum(P.cupro) ? P.cupro : null;
  
  const totalVenta = isNum(selectedUnitPrice) && isNum(unidades) ? selectedUnitPrice * unidades : (isNum(P.total_venta) ? P.total_venta : null);
  const totalCosto = isNum(cupro) && isNum(unidades) ? cupro * unidades : (isNum(P.total_costo) ? P.total_costo : null);
  const utilidadTotal = isNum(totalVenta) && isNum(totalCosto) ? totalVenta - totalCosto : (isNum(P.total_margen) ? P.total_margen : null);
  const utilidadUnid = isNum(selectedUnitPrice) && isNum(cupro) ? selectedUnitPrice - cupro : (isNum(P.margen) ? P.margen : null);

  // Comparador (C) - Simulado con el MISMO precio seleccionado para comparar peras con peras
  const unidadesCmp = isNum(C.cantidad) ? C.cantidad : null;
  const ventaCmp = isNum(selectedUnitPrice) && isNum(unidadesCmp) ? selectedUnitPrice * unidadesCmp : (isNum(C.total_venta) ? C.total_venta : null);
  const costoCmp = isNum(C.cupro) && isNum(unidadesCmp) ? C.cupro * unidadesCmp : (isNum(C.total_costo) ? C.total_costo : null);
  const utilidadTotalCmp = isNum(ventaCmp) && isNum(costoCmp) ? ventaCmp - costoCmp : (isNum(C.total_margen) ? C.total_margen : null);
  const utilidadUnidCmp = isNum(selectedUnitPrice) && isNum(C.cupro) ? selectedUnitPrice - C.cupro : (isNum(C.margen) ? C.margen : null);

  // Deltas (Variación %)
  const deltaUnidades = pctDelta(unidades, unidadesCmp);
  const deltaVenta = pctDelta(totalVenta, ventaCmp);
  const deltaUtilidadUnid = pctDelta(utilidadUnid, utilidadUnidCmp);
  const deltaUtilidadTotal = pctDelta(utilidadTotal, utilidadTotalCmp);

  // Margen %
  const margenPct = isNum(utilidadTotal) && isNum(totalVenta) && totalVenta !== 0 ? utilidadTotal / totalVenta : null;
  const margenPctCmp = isNum(utilidadTotalCmp) && isNum(ventaCmp) && ventaCmp !== 0 ? utilidadTotalCmp / ventaCmp : null;
  const deltaMargenPct = isNum(margenPct) && isNum(margenPctCmp) ? pctDelta(margenPct, margenPctCmp) : null;
  const margenPctInt = isNum(margenPct) ? Math.round(margenPct * 100) : null;

  // Color Semántico para el Margen Principal
  const margenColor = isNum(margenPctInt)
    ? (margenPctInt < 60 ? 'text-light-error dark:text-dark-error' : margenPctInt < 70 ? 'text-yellow-500' : 'text-matrix-green')
    : 'text-light-text-primary dark:text-dark-text-primary';

  return (
    <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      
      {/* --- BARRA DE CONTROL (Compacta) --- */}
      <div className="flex items-center justify-between p-1 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-lg border border-light-border/10 dark:border-dark-border/10">
        
        {/* Input Precio Manual */}
        <div className="flex items-center gap-1">
          <div className="relative flex items-center group/input">
            <span className="absolute left-1.5 text-[9px] text-light-text-secondary font-bold group-focus-within/input:text-matrix-green transition-colors">$</span>
            <input
              ref={manualInputRef}
              type="number"
              inputMode="decimal"
              placeholder="Manual"
              className="pl-3 pr-1 py-1 w-16 bg-light-surface dark:bg-dark-surface rounded-md text-[10px] font-mono border border-transparent focus:border-matrix-green/50 outline-none text-light-text-primary dark:text-dark-text-primary transition-all placeholder:text-light-text-tertiary"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseFloat(e.target.value);
                  if (Number.isFinite(val)) { setAppliedManualPrice(val); setUseManualCalc(true); }
                }
              }}
            />
          </div>
          {!useManualCalc ? (
            <button 
              onClick={() => {
                const val = parseFloat(manualInputRef.current?.value);
                if (Number.isFinite(val)) { setAppliedManualPrice(val); setUseManualCalc(true); }
              }}
              className="p-1 rounded-md bg-light-surface dark:bg-dark-surface text-light-text-secondary hover:text-matrix-green hover:bg-matrix-green/10 transition-colors"
              title={t('common.apply')}
            >
              <FaCheck size={10} />
            </button>
          ) : (
            <button 
              onClick={() => { setUseManualCalc(false); setAppliedManualPrice(null); if (manualInputRef.current) manualInputRef.current.value = ''; }}
              className="p-1 rounded-md bg-light-error/10 text-light-error hover:bg-light-error/20 transition-colors"
              title={t('common.reset')}
            >
              <FaTimes size={10} />
            </button>
          )}
        </div>

        {/* Toggle Especial */}
        {hasSpecialActive && (
          <button
            onClick={() => setUseSpecialCalc(!useSpecialCalc)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold transition-all ${useSpecialCalc ? 'bg-matrix-green/10 text-matrix-green ring-1 ring-matrix-green/20' : 'text-light-text-secondary hover:bg-light-surface-secondary'}`}
          >
            <FaMagic size={8} />
            {t('menus.modal.special')}
          </button>
        )}
      </div>

      {/* --- DASHBOARD PRINCIPAL --- */}
      <div className="grid grid-cols-2 gap-2">
        
        {/* KPI Hero: Margen % */}
        <div className="col-span-2 p-2.5 rounded-xl bg-gradient-to-r from-light-surface-secondary/50 to-white/50 dark:from-dark-surface-secondary/50 dark:to-dark-surface/50 border border-light-border/30 dark:border-dark-border/30 flex items-center justify-between shadow-sm backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span 
                className="text-[9px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary"
                data-tooltip-id={`tt-margen-${uidBase}`}
                data-tooltip-content={t('menus.kpis.margin_percent_last_month_tip')}
              >
                {t('menus.kpis.margin_percent_last_month')}
              </span>
              <ReactTooltip id={`tt-margen-${uidBase}`} place="top" />
              
              {/* Badge de Comparador Dinámico */}
              {compShort && (
                <span 
                  className="px-1.5 py-px rounded text-[8px] font-bold bg-light-text-primary/5 text-light-text-secondary border border-light-border/20 cursor-help"
                  data-tooltip-id={`tt-comp-${uidBase}`}
                  data-tooltip-content={compExplain}
                >
                  VS {compShort}
                </span>
              )}
              <ReactTooltip id={`tt-comp-${uidBase}`} place="top" />
            </div>
            <div className={`text-2xl font-futurist font-bold leading-none tracking-tight ${margenColor}`}>
              {isNum(margenPct) ? `${margenPctInt}%` : '—'}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
             <TrendIndicator delta={deltaMargenPct} />
             {isNum(margenPctCmp) && (
               <span className="text-[8px] text-light-text-secondary mt-1 font-mono opacity-70">
                 Ref: {Math.round(margenPctCmp * 100)}%
               </span>
             )}
          </div>
        </div>

        {/* Grid de Métricas Secundarias */}
        <StatBox 
          label={t('menus.kpis.sales')} 
          value={fmtCompact(totalVenta, dish.currency || '$')} 
          fullValue={fmtFull(totalVenta, dish.currency || '$')}
          delta={deltaVenta}
          tooltip={t('menus.kpis.sales_last_month_tip')}
        />
        <StatBox 
          label={t('menus.kpis.profit')} 
          value={fmtCompact(utilidadTotal, dish.currency || '$')} 
          fullValue={fmtFull(utilidadTotal, dish.currency || '$')}
          delta={deltaUtilidadTotal}
          tooltip={t('menus.kpis.total_profit_last_month_tip')}
        />
        <StatBox 
          label={t('menus.kpis.units')} 
          value={fmtCompact(unidades, '')} 
          fullValue={fmtInt(unidades)}
          delta={deltaUnidades} 
          tooltip={t('menus.kpis.units_last_month_tip')}
        />
        <StatBox 
          label={t('menus.kpis.unit_profit')} 
          value={fmtCompact(utilidadUnid, dish.currency || '$')} 
          fullValue={fmtFull(utilidadUnid, dish.currency || '$')}
          delta={deltaUtilidadUnid} 
          tooltip={t('menus.kpis.profit_per_unit_last_month_tip')}
        />
      </div>

      {/* --- FOOTER: Contexto Financiero --- */}
      <div className="flex items-center justify-between text-[9px] pt-2 border-t border-light-border/10 dark:border-dark-border/10 font-mono text-light-text-secondary dark:text-dark-text-secondary">
        <span 
          className="cursor-help transition-colors hover:text-light-text-primary dark:hover:text-dark-text-primary"
          data-tooltip-id={`tt-cupro-${uidBase}`} 
          data-tooltip-content={`${t('menus.kpis.cupro_tip')}: ${fmtFull(cupro, '$')}`}
        >
          CUPRO: <span className="font-bold">{fmtCompact(cupro, '$')}</span>
        </span>
        <ReactTooltip id={`tt-cupro-${uidBase}`} place="top" />

        <div className="flex items-center gap-1.5">
          <span
             className="cursor-help transition-colors hover:text-light-text-primary dark:hover:text-dark-text-primary"
             data-tooltip-id={`tt-price-${uidBase}`} 
             data-tooltip-content={`${t('menus.kpis.price_tip')}: ${fmtFull(selectedUnitPrice, '$')}`}
          >
            Precio: <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{fmtCompact(selectedUnitPrice, '$')}</span>
          </span>
          <ReactTooltip id={`tt-price-${uidBase}`} place="top" />
          
          {priceDeltaPct !== null && priceDeltaPct !== 0 && (
             <span className={`${priceDeltaPct > 0 ? 'text-light-error' : 'text-matrix-green'} font-bold`}>
               {priceDeltaPct > 0 ? '▲' : '▼'} {Math.round(Math.abs(priceDeltaPct) * 100)}%
             </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductKPIs;