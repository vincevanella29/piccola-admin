import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';
import { useTranslation } from 'react-i18next';
import { FaChevronRight, FaArrowUp, FaArrowDown, FaLeaf } from 'react-icons/fa';

// --- Helpers ---
const isNum = (n) => typeof n === 'number' && isFinite(n);
const formatNumberCL = (n) => (isNum(n) ? n.toLocaleString('es-CL') : '—');

// --- Subcomponents for Apple-like Cleanliness ---

const TrendIndicator = ({ delta }) => {
  if (!isNum(delta)) return null;
  const pct = Math.round(delta * 100);
  const isNeutral = pct === 0;
  const isUp = pct > 0;
  
  // Apple Stocks Colors mapped to project palette: matrix-green for up, error for down, secondary for neutral
  const colorClass = isNeutral 
    ? 'text-light-text-secondary dark:text-dark-text-secondary' 
    : isUp 
      ? 'text-matrix-green dark:text-matrix-green' 
      : 'text-light-error dark:text-dark-error';
  
  const Icon = isNeutral ? null : isUp ? FaArrowUp : FaArrowDown;

  return (
    <div className={`flex items-center gap-0.5 text-[10px] font-semibold ${colorClass} bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 px-1.5 py-0.5 rounded-md`}>
      {Icon && <Icon className="w-2 h-2" />}
      <span>{Math.abs(pct)}%</span>
    </div>
  );
};

const ProductCard = ({
  dish,
  mediaMap,
  onClick,
  chileTime,
  profile,
  account,
  isHorizontal = false,
}) => {
  const { t } = useTranslation();
  const { price, isSpecial } = getCurrentPrice(dish, 'dinein', chileTime, t);

  // Image Logic
  let imgUrl = dish.media_r2 || dish.media_local || dish.media_url || null;
  if (!imgUrl && dish.media_id && mediaMap?.[String(dish.media_id)]) {
    imgUrl = mediaMap[String(dish.media_id)];
  }

  // Sales Data Processing
  const sales = dish?.sales_units || {};
  const unitsActual = isNum(sales.actual) ? sales.actual : null;
  const unitsPrev = isNum(sales.anterior) ? sales.anterior : null;
  
  const unitsDeltaPct = useMemo(() => {
    if (!isNum(unitsActual) || !isNum(unitsPrev) || unitsPrev === 0) return null;
    return (unitsActual - unitsPrev) / Math.abs(unitsPrev);
  }, [unitsActual, unitsPrev]);

  // Handler
  const handleOnClick = () => {
    if (window.gtag && price) {
      window.gtag('event', 'view_item', {
        items: [{ item_id: dish._id, item_name: dish.nombre, price: price, quantity: 1 }],
      });
    }
    onClick?.(dish);
  };

  // --- Layout Classes ---
  // Apple Card style, using design tokens for backgrounds, borders and shadows
  const cardBaseClasses = `
    group relative overflow-hidden cursor-pointer
    bg-light-surface dark:bg-dark-surface
    rounded-[24px]
    border border-light-border/20 dark:border-dark-border/20
    shadow-md hover:shadow-neon
    transition-all duration-300 ease-out
  `;

  // --- Render Content Functions ---

  const renderImage = () => (
    <div className={`relative overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary ${isHorizontal ? 'w-24 h-24 rounded-2xl m-3 shrink-0' : 'w-full aspect-[4/3]'}`}>
      {imgUrl ? (
        <img 
          src={imgUrl} 
          alt={dish.nombre} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full text-light-text-tertiary dark:text-dark-text-secondary">
          <FaLeaf className="w-6 h-6 mb-1 opacity-50" />
          <span className="text-[9px] font-medium">{t('menus.kpis.no_image')}</span>
        </div>
      )}
      
      {/* Special Badge (iOS style blur) */}
      {isSpecial && (
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md border border-light-border/40 dark:border-dark-border/40 shadow-sm z-10">
          <span className="text-[9px] font-bold text-light-error dark:text-dark-error tracking-wide uppercase">
            {t('menus.modal.special')}
          </span>
        </div>
      )}
    </div>
  );

  const renderContent = () => (
    <div className={`flex flex-col ${isHorizontal ? 'py-3 pr-4 justify-center flex-grow min-w-0' : 'p-4 pt-3 flex-grow'}`}>
      
      {/* Title */}
      <div className="flex justify-between items-start gap-2 mb-1.5">
        <h3 className="text-[15px] font-semibold text-light-text-primary dark:text-dark-text-primary leading-tight font-sans tracking-tight group-hover:text-light-accent dark:group-hover:text-dark-accent transition-colors line-clamp-1">
          {dish.nombre}
        </h3>
      </div>

      {/* Description (Apple Style Text) */}
      {/* line-clamp-2 keeps it consistent. min-h ensures alignment even if empty. */}
      <div className="mb-3 h-[38px] overflow-hidden"> 
        <p className="text-[13px] leading-snug text-light-text-secondary dark:text-dark-text-secondary font-sans line-clamp-2">
          {dish.descripcion || t('menus.kpis.no_description', 'Sin descripción disponible.')}
        </p>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-light-border/30 dark:bg-dark-border/40 mb-3" />

      {/* Stats Footer */}
      <div className="flex items-center justify-between mt-auto">
        
        {/* Sales Stats */}
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary font-medium mb-0.5">
            {t('menus.kpis.units_last_month_short', 'Venta Mes')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono text-light-text-primary dark:text-dark-text-primary">
              {formatNumberCL(unitsPrev)}
            </span>
            <TrendIndicator delta={unitsDeltaPct} />
          </div>
        </div>

        {/* Action Button (iOS Style) */}
        <button className="flex items-center justify-center w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary group-hover:bg-light-accent group-hover:text-white dark:group-hover:bg-dark-accent transition-all duration-300 shadow-sm shrink-0">
          <FaChevronRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    </div>
  );

  // --- Main Render ---

  if (isHorizontal) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={`${cardBaseClasses} flex flex-row h-32`} // Fixed height for horizontal
        onClick={handleOnClick}
      >
        {renderImage()}
        {renderContent()}
      </motion.div>
    );
  }

  // Vertical (Grid) Layout
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`${cardBaseClasses} flex flex-col h-full`}
      onClick={handleOnClick}
    >
      {renderImage()}
      {renderContent()}
    </motion.div>
  );
};

export default ProductCard;