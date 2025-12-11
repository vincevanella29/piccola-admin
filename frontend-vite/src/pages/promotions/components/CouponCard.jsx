// src/components/promotions/CouponCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FaClock, FaCheckCircle, FaHistory, FaGift, FaTicketAlt } from 'react-icons/fa';
import QRCode from 'react-qr-code';
import CountdownTimer from './CountdownTimer';
import { getDiscountText } from './PromotionCard';

const CouponCard = ({ coupon, t, onOpenModal, statusText, targetDate, isCountdown }) => {
  
  // --- 1. Lógica Visual del Contenido (Imagen vs Texto) ---
  let imageContent;
  const hasImage = !!coupon.menu_item?.media_r2;

  // Preparamos datos de descuento para el fallback visual
  const discountText = getDiscountText(coupon.promotion, t);
  const { discount, type } = coupon.promotion.reward_details || {};
  let amountDisplay = '';
  
  if (type === 'fixed') amountDisplay = `$${discount?.toLocaleString('es-CL') || 0}`;
  else if (type === 'percentage') amountDisplay = `${discount || 0}%`;
  
  if (hasImage) {
    imageContent = (
      <img
        src={coupon.menu_item.media_r2}
        alt={coupon.menu_item.nombre}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
    );
  } else {
    // Generador de Patrón Abstracto (Apple Style Abstract)
    imageContent = (
      <div className="w-full h-full bg-gradient-to-br from-light-surface-secondary to-light-surface-tertiary dark:from-dark-surface-secondary dark:to-dark-surface-tertiary flex flex-col items-center justify-center relative overflow-hidden">
        {/* Fondo animado sutil */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-matrix-green to-transparent" />
        
        <motion.span
          className="text-5xl font-futurist font-bold text-matrix-green z-10 drop-shadow-sm tracking-tighter"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        >
          {amountDisplay || <FaGift size={40} />}
        </motion.span>
        
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary mt-2 z-10 px-4 text-center">
          {discountText || t('promotion-front.special_coupon')}
        </span>
      </div>
    );
  }

  // --- 2. Configuración de Estado (Badges) ---
  const getStatusConfig = () => {
    switch (statusText) {
      case 'active':
        return { 
          bg: 'bg-matrix-green', 
          text: 'text-white', 
          icon: <QRCode value={coupon.coupon_code} size={20} />, 
          label: t('promotion-front.ready_to_use') 
        };
      case 'upcoming':
        return { 
          bg: 'bg-yellow-500', 
          text: 'text-white', 
          icon: <FaClock />, 
          label: t('promotion-front.coming_soon') 
        };
      case 'redeemed':
        return { 
          bg: 'bg-purple-500', 
          text: 'text-white', 
          icon: <FaCheckCircle />, 
          label: t('promotion-front.redeemed') 
        };
      default: // expired
        return { 
          bg: 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary', 
          text: 'text-light-text-secondary dark:text-dark-text-secondary', 
          icon: <FaHistory />, 
          label: t('promotion-front.expired') 
        };
    }
  };

  const status = getStatusConfig();

  return (
    <motion.div
      className="group relative bg-light-surface dark:bg-dark-surface rounded-3xl shadow-sm border border-light-border/20 dark:border-dark-border/20 overflow-hidden cursor-pointer hover:shadow-neon hover:border-matrix-green/30 transition-all duration-300 flex flex-col h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onOpenModal}
    >
      {/* SECCIÓN SUPERIOR: MEDIA */}
      <div className="relative h-44 overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary">
        {imageContent}
        
        {/* Gradiente para legibilidad del badge si hay imagen clara */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

        {/* Badge de Estado Flotante */}
        <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-full ${status.bg} ${status.text} text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-md backdrop-blur-sm bg-opacity-90`}>
          {status.icon}
          {status.label}
        </div>
      </div>

      {/* EFECTO DE CORTE (TICKET) */}
      <div className="relative h-px bg-light-surface dark:bg-dark-surface z-10">
         {/* Círculos laterales para simular corte de ticket */}
         <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-light-background dark:bg-dark-background z-20" />
         <div className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-full bg-light-background dark:bg-dark-background z-20" />
         {/* Línea punteada */}
         <div className="absolute left-2 right-2 top-0 border-t border-dashed border-light-border/40 dark:border-dark-border/40" />
      </div>

      {/* SECCIÓN INFERIOR: DETALLES */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-1 line-clamp-1 group-hover:text-matrix-green transition-colors">
          {coupon.promotion.name}
        </h3>
        
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4 line-clamp-2 leading-relaxed">
          {coupon.promotion.description}
        </p>

        <div className="mt-auto flex items-end justify-between">
           {/* ID Técnico */}
           <div className="flex flex-col">
             <span className="text-[9px] font-bold text-light-text-secondary/50 dark:text-dark-text-secondary/50 uppercase tracking-wider">
               Coupon ID
             </span>
             <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary">
               #{coupon.coupon_code.slice(0,8)}
             </span>
           </div>
           
           {/* Timer o Acción */}
           <div className="text-right">
             {targetDate ? (
               <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
                  <FaClock size={10} className={isCountdown ? "text-yellow-500" : "text-matrix-green"} />
                  <CountdownTimer 
                    targetDate={targetDate} 
                    label={null} 
                    compact={true} 
                    textClass="text-xs font-mono font-medium text-light-text-primary dark:text-dark-text-primary"
                  />
               </div>
             ) : (
               <div className="flex items-center gap-1 text-xs font-bold text-matrix-green uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-300">
                 {t('promotion-front.view_details')} <FaTicketAlt />
               </div>
             )}
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CouponCard;