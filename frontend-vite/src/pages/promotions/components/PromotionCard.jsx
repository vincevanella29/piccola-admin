// src/components/promotions/PromotionCard.jsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaTrophy, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationCircle,
  FaArrowRight,
  FaGift
} from 'react-icons/fa';
import CountdownTimer from './CountdownTimer';

// --- Utility Functions ---
const calculateDiscountedPrice = (price, discount, type) => {
  if (type === 'percentage') {
    return price * (1 - discount / 100);
  } else if (type === 'fixed') {
    return Math.max(0, price - discount);
  }
  return price;
};

export const getDiscountText = (promo, t) => {
  if (promo.reward_type === 'discount' || promo.promotion_type === 'P') {
    const { discount, type } = promo.reward_details || {};
    if (!discount) return '';
    if (type === 'fixed') {
      return t('promotion-front.discount_fixed', { amount: discount.toLocaleString('es-CL') });
    }
    if (type === 'percentage') {
      return `${discount}% OFF`;
    }
  }
  return '';
};

// --- Sub-components ---
const StatusIndicator = ({ met, total }) => {
  const isComplete = met === total && total > 0;
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${isComplete ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/20' : 'bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 text-light-text-secondary dark:text-dark-text-secondary border-light-border/20 dark:border-dark-border/20'}`}>
      {isComplete ? <FaCheckCircle size={10} /> : <div className="w-2 h-2 rounded-full border-2 border-current" />}
      <span>{met}/{total} REQ</span>
    </div>
  );
};

const PromotionCard = ({ 
  promo, 
  onOpenModal, 
  t, 
  account 
}) => {
  // --- Data Prep ---
  const hasItems = promo.menu_items && promo.menu_items.length > 0;
  const images = hasItems ? promo.menu_items.map(item => item.media_r2).filter(Boolean) : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Timing & Status
  const totalRemaining = promo.max_coupon_per_promo - promo.total_claimed;
  const isSoldOut = totalRemaining <= 0;
  const userRemaining = promo.max_claims - promo.user_claimed;
  
  const claimStart = new Date(promo.claim_start);
  const claimEnd = new Date(promo.claim_end);
  const now = new Date();
  const isClaimActive = now >= claimStart && now <= claimEnd && !isSoldOut;
  const countdownTarget = isClaimActive ? claimEnd : claimStart;

  // Image Carousel Effect
  useEffect(() => {
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [images.length]);

  // Pricing Logic
  const selectedItem = hasItems ? promo.menu_items[currentIndex] : null;
  const normalPrice = selectedItem ? selectedItem.precio : 0;
  const discount = promo.reward_details?.discount || 0;
  const discountType = promo.reward_details?.type || null;
  const discountedPrice = calculateDiscountedPrice(normalPrice, discount, discountType);

  // Ranking Logic
  const rankingRule = (promo.rules || []).find((r) => r.rule_type === 'merit_rule_fulfilled');
  const rankingPeriodKey = rankingRule?.ranking_period || null;
  const rankingPeriodLabelMap = {
    current_month: 'Mes actual',
    last_month: 'Mes anterior',
    current_year: 'Año actual',
    last_year: 'Año anterior',
  };
  const rankingPeriodLabel = rankingPeriodKey ? (rankingPeriodLabelMap[rankingPeriodKey] || rankingPeriodKey) : null;

  // --- Visual Content Builders ---
  let imageContent;
  if (images.length === 0) {
    // Fallback / Text Mode
    const { discount: dVal, type: dType } = promo.reward_details || {};
    let amountDisplay = '';
    
    if (dType === 'fixed') amountDisplay = `$${dVal?.toLocaleString('es-CL')}`;
    else if (dType === 'percentage') amountDisplay = `${dVal}%`;
    else amountDisplay = <FaGift className="w-12 h-12" />;

    imageContent = (
      <div className="w-full h-44 bg-gradient-to-br from-light-surface-secondary to-light-surface-tertiary dark:from-dark-surface-secondary dark:to-dark-surface-tertiary flex flex-col items-center justify-center relative overflow-hidden">
         <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-matrix-green to-transparent" />
         <motion.span 
           className="text-4xl font-futurist font-bold text-matrix-green z-10 drop-shadow-sm"
           initial={{ scale: 0.9 }}
           animate={{ scale: 1 }}
           transition={{ duration: 0.5 }}
         >
           {amountDisplay}
         </motion.span>
         <span className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mt-2 z-10">
           {dType === 'percentage' ? 'Descuento' : 'Recompensa'}
         </span>
      </div>
    );
  } else {
    // Image Mode
    imageContent = (
      <div className="relative w-full h-44 overflow-hidden bg-dark-surface-secondary">
        <AnimatePresence mode='wait'>
          <motion.img
            key={images[currentIndex]}
            src={images[currentIndex]}
            alt={promo.name}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          />
        </AnimatePresence>
        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {/* Price Tag Overlay */}
        {hasItems && (
           <div className="absolute bottom-3 left-3 flex flex-col items-start z-10">
              {discountType && (
                <span className="text-[10px] text-white/70 line-through decoration-light-error decoration-2 font-mono">
                  ${normalPrice.toLocaleString('es-CL')}
                </span>
              )}
              <span className="text-xl font-bold text-white leading-none drop-shadow-md font-futurist">
                ${discountedPrice.toLocaleString('es-CL')}
              </span>
           </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      className="group relative bg-light-surface dark:bg-dark-surface rounded-3xl overflow-hidden border border-light-border/20 dark:border-dark-border/20 shadow-sm hover:shadow-neon hover:border-matrix-green/30 transition-all duration-300 cursor-pointer flex flex-col h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      onClick={onOpenModal}
    >
      {/* 1. STATUS BADGES (Absolute) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 items-start">
         {isSoldOut ? (
           <span className="px-2 py-1 bg-light-error dark:bg-dark-error text-white text-[10px] font-bold uppercase rounded-lg shadow-sm backdrop-blur-sm">
             {t('promotion-front.sold_out')}
           </span>
         ) : userRemaining <= 0 ? (
           <span className="px-2 py-1 bg-vanellix-purple text-white text-[10px] font-bold uppercase rounded-lg shadow-sm backdrop-blur-sm">
             Canjeado
           </span>
         ) : rankingRule ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-dark-surface/80 backdrop-blur-md text-white text-[10px] font-mono rounded-lg border border-white/10 shadow-sm">
               <FaTrophy className="text-yellow-400" size={10} />
               <span className="truncate max-w-[120px]">{rankingRule.merit_rule_name}</span>
            </div>
         ) : null}
      </div>

      {/* 2. MEDIA SECTION */}
      {imageContent}

      {/* 3. CONTENT SECTION */}
      <div className="p-5 flex flex-col flex-1">
        {/* Title & Desc */}
        <div className="mb-4 flex-1">
          <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary leading-tight mb-1.5 line-clamp-1 group-hover:text-matrix-green transition-colors">
            {promo.name}
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 leading-relaxed">
            {promo.description}
          </p>
        </div>

        {/* Requirements & Timer Row */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-light-border/10 dark:border-dark-border/10">
           <StatusIndicator met={promo.rulesMetCount} total={promo.totalRules} />
           
           {/* Minimal Timer */}
           <div className="flex items-center gap-1.5 text-[11px] font-mono text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-2 py-1 rounded-md">
              <FaClock className={isClaimActive ? "text-matrix-green animate-pulse" : "text-yellow-500"} />
              <CountdownTimer 
                targetDate={countdownTarget} 
                compact={true} 
                label={isClaimActive ? "Expira:" : "Inicia:"}
              />
           </div>
        </div>
      </div>

      {/* 4. HOVER ACTION OVERLAY (Desktop only effect) */}
      <div className="absolute inset-0 bg-dark-surface/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 backdrop-blur-[2px]">
         <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 flex flex-col items-center gap-3">
            <span className="text-white font-bold text-lg tracking-wide">
              {isClaimActive ? t('promotion-front.view_more') : 'Ver detalles'}
            </span>
            <div className="p-3 bg-matrix-green rounded-full text-white shadow-neon">
               <FaArrowRight />
            </div>
         </div>
      </div>

    </motion.div>
  );
};

export default PromotionCard;