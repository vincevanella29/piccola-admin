// src/pages/menus/components/ProductCard.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';
import { useTranslation } from 'react-i18next';
import ProductKPIs from './ProductKPIs';

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
  
  // Logic: Current Price Calculation
  const { price, isSpecial } = getCurrentPrice(dish, 'dinein', chileTime, t);
  
  // Logic: Image Resolution
  let imgUrl = dish.media_r2 || dish.media_local || dish.media_url || null;
  if (!imgUrl && dish.media_id && mediaMap?.[String(dish.media_id)]) {
    imgUrl = mediaMap[String(dish.media_id)];
  }

  // Unique ID for Tooltips (passed down)
  const uidBase = useMemo(() => String(dish?.id || dish?._id || dish?.codigo || Math.random().toString(36).slice(2)), [dish]);

  const handleOnClick = () => {
    if (window.gtag) {
      window.gtag('event', 'view_item', { items: [{ item_id: dish._id, item_name: dish.nombre, price: price, quantity: 1 }] });
    }
    onClick?.(dish);
  };

  // --- Render ---
  const containerClasses = `
    group relative bg-light-surface dark:bg-dark-surface rounded-2xl p-4 
    border border-light-border/20 dark:border-dark-border/20 shadow-sm 
    hover:shadow-neon hover:border-matrix-green/30 transition-all duration-300 cursor-pointer overflow-hidden
    ${isSpecial ? 'ring-1 ring-light-error/30 dark:ring-dark-error/30' : ''}
  `;

  if (isHorizontal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${containerClasses} flex flex-row gap-4`}
        onClick={handleOnClick}
      >
        {/* Image Section */}
        <div className="w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 relative">
          {imgUrl ? (
            <img 
              src={imgUrl} 
              alt={dish.nombre} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              loading="lazy" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-light-text-tertiary dark:text-dark-text-tertiary">
              <span className="text-[10px] font-bold uppercase opacity-50">{t('menus.kpis.no_image')}</span>
            </div>
          )}
          {isSpecial && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-light-error text-white text-[8px] font-bold uppercase rounded shadow-sm">
              Special
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary truncate mb-1" title={dish.nombre}>
            {dish.nombre || t('menus.kpis.no_name')}
          </h4>
          
          {/* Imported Logic Component */}
          <ProductKPIs 
            dish={dish} 
            currentPrice={price} 
            uidBase={uidBase} 
          />
        </div>
      </motion.div>
    );
  }

  // Vertical Layout (Default)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${containerClasses} flex flex-col`}
      onClick={handleOnClick}
    >
      {/* Image Section */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 mb-3">
        {imgUrl ? (
          <img 
            src={imgUrl} 
            alt={dish.nombre} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-light-text-tertiary dark:text-dark-text-tertiary">
            <span className="text-xs font-bold uppercase opacity-50">{t('menus.kpis.no_image')}</span>
          </div>
        )}
        {/* Special Badge Overlay */}
        {isSpecial && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-light-error text-white text-[9px] font-bold uppercase rounded-full shadow-sm backdrop-blur-sm bg-opacity-90">
            Special
          </div>
        )}
      </div>

      {/* Header */}
      <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-1 truncate leading-tight" title={dish.nombre}>
        {dish.nombre || t('menus.kpis.no_name')}
      </h4>

      {/* Imported Logic Component */}
      <ProductKPIs 
        dish={dish} 
        currentPrice={price} 
        uidBase={uidBase} 
      />
    </motion.div>
  );
};

export default ProductCard;