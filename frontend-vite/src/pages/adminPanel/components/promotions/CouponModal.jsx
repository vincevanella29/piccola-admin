// src/pages/adminPanel/components/promotions/CouponModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import { 
  XMarkIcon, 
  QrCodeIcon, 
  WalletIcon, 
  CalendarIcon, 
  ClockIcon, 
  ArrowPathIcon, 
  BanknotesIcon,
  TicketIcon,
  ClipboardDocumentCheckIcon,
  FireIcon,
  TrophyIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

// Sub-componente para Badges de Estado (Reutilizado para consistencia)
const StatusBadge = ({ status, t }) => {
  const styles = {
    claimed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    redeemed: 'bg-matrix-green/10 text-matrix-green border-matrix-green/20',
    reactivated: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    expired: 'bg-light-text-secondary/10 text-light-text-secondary border-light-text-secondary/20',
  };
  const defaultStyle = 'bg-light-surface-secondary/50 text-light-text-secondary border-light-border/20';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || defaultStyle} uppercase tracking-wide`}>
      {t ? t(`promotion.${status}`) : status}
    </span>
  );
};

// Sub-componente para una fila de información
const InfoRow = ({ icon: Icon, label, value, subValue }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
    <div className="p-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg text-light-text-secondary dark:text-dark-text-secondary">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
        {value}
      </p>
      {subValue && (
        <p className="text-xs text-light-text-secondary/70 dark:text-dark-text-secondary/70 font-mono mt-0.5">
          {subValue}
        </p>
      )}
    </div>
  </div>
);

// Sub-componente para renderizar reglas visualmente
const RuleCard = ({ rule }) => {
  const abbreviateAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  let icon = <ClipboardDocumentCheckIcon className="h-5 w-5" />;
  let title = "Regla General";
  let detail = "";
  let colorClass = "text-light-text-primary dark:text-dark-text-primary";
  let bgClass = "bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50";

  switch (rule.rule_type) {
    case 'hold_tokens':
      icon = <BanknotesIcon className="h-5 w-5" />;
      title = "Hold Tokens";
      detail = `${rule.amount} tokens (${abbreviateAddress(rule.token_address)})`;
      colorClass = "text-blue-500";
      bgClass = "bg-blue-500/10 border-blue-500/20";
      break;
    case 'burn_tokens':
      icon = <FireIcon className="h-5 w-5" />;
      title = "Burn Tokens";
      detail = `${rule.amount} tokens (${abbreviateAddress(rule.token_address)})`;
      colorClass = "text-orange-500";
      bgClass = "bg-orange-500/10 border-orange-500/20";
      break;
    case 'merit_rule_fulfilled':
      icon = <TrophyIcon className="h-5 w-5" />;
      title = "Regla de Mérito";
      detail = rule.merit_rule_name || rule.rule_name || 'N/A';
      colorClass = "text-purple-500";
      bgClass = "bg-purple-500/10 border-purple-500/20";
      break;
    case 'require_min_liked_products':
      icon = <HeartIcon className="h-5 w-5" />;
      title = "Likes Mínimos";
      detail = `${rule.min_count} productos`;
      colorClass = "text-pink-500";
      bgClass = "bg-pink-500/10 border-pink-500/20";
      break;
    default:
      detail = rule.rule_type?.replace(/_/g, ' ') || 'N/A';
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgClass}`}>
      <div className={`${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className={`text-xs font-bold uppercase ${colorClass}`}>{title}</p>
        <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">{detail}</p>
      </div>
    </div>
  );
};

const CouponModal = ({ coupon, onClose, onReactivate, onRedeem, t }) => {
  const formatDate = (date) => date ? new Date(date).toLocaleString() : 'N/A';
  const abbreviateAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A';

  if (!coupon) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative bg-light-surface dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-light-border/20 dark:border-dark-border/20 overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER (Sticky) */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-light-border/20 dark:border-dark-border/20 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-xl z-10">
            <div>
              <h2 className="text-xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <TicketIcon className="h-6 w-6 text-matrix-green" />
                {t('promotion.coupon_details')}
              </h2>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono mt-1">
                ID: {coupon.coupon_code}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* SCROLLABLE CONTENT */}
          <div className="overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-light-border dark:scrollbar-thumb-dark-border">
            
            {/* HERO SECTION: QR & STATUS */}
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 p-6 rounded-2xl border border-light-border/10 dark:border-dark-border/10">
              <div className="flex-shrink-0 bg-white p-3 rounded-2xl shadow-sm border border-neutral-100">
                <QRCode 
                  value={coupon.coupon_code} 
                  size={140} 
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  viewBox={`0 0 256 256`}
                />
              </div>
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                     {coupon.promotion?.name || t('common.unknown_promotion')}
                   </h3>
                   <StatusBadge status={coupon.status} t={t} />
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary line-clamp-2">
                  {coupon.promotion?.description || t('common.no_description')}
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                   {coupon.wallet && (
                     <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
                        <WalletIcon className="h-4 w-4 text-matrix-green" />
                        <span className="text-xs font-mono font-medium text-light-text-primary dark:text-dark-text-primary">
                          {abbreviateAddress(coupon.wallet)}
                        </span>
                     </div>
                   )}
                   {coupon.pos_order_id && (
                     <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
                        <QrCodeIcon className="h-4 w-4 text-vanellix-purple" />
                        <span className="text-xs font-mono font-medium text-light-text-primary dark:text-dark-text-primary">
                          POS: {coupon.pos_order_id}
                        </span>
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* INFO GRID: DATES & METADATA */}
            <div>
              <h4 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-3 px-1">
                {t('promotion.details_timeline')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoRow 
                  icon={CalendarIcon} 
                  label={t('promotion.claimed_at')} 
                  value={formatDate(coupon.timestamp)} 
                />
                <InfoRow 
                  icon={ClockIcon} 
                  label={t('promotion.valid_until')} 
                  value={formatDate(coupon.valid_until)}
                  subValue={t('promotion.valid_from') + ': ' + formatDate(coupon.valid_from)}
                />
                {coupon.redeemed_at && (
                  <InfoRow 
                    icon={ArrowPathIcon} 
                    label={t('promotion.redeemed_at')} 
                    value={formatDate(coupon.redeemed_at)} 
                    subValue={coupon.points_used ? `${coupon.points_used} pts used` : null}
                  />
                )}
              </div>
            </div>

            {/* RULES SECTION */}
            {coupon.promotion?.rules && coupon.promotion.rules.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-3 px-1">
                  {t('promotion.rules_title')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coupon.promotion.rules.map((rule, idx) => (
                    <RuleCard key={idx} rule={rule} />
                  ))}
                </div>
              </div>
            )}

            {/* HISTORY TIMELINE */}
            {coupon.history && coupon.history.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-3 px-1">
                  {t('promotion.history')}
                </h4>
                <div className="relative pl-4 border-l-2 border-light-border/30 dark:border-dark-border/30 space-y-6">
                  {coupon.history.map((entry, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-matrix-green border-2 border-light-surface dark:border-dark-surface" />
                      <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                        {entry.action.toUpperCase()}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {formatDate(entry.timestamp)}
                      </p>
                      {entry.discount_amount && (
                        <p className="text-xs font-mono text-matrix-green mt-0.5">
                          -{entry.discount_amount}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          {(coupon.status === 'redeemed' || coupon.status === 'claimed' || coupon.status === 'reactivated') && (
            <div className="p-4 border-t border-light-border/20 dark:border-dark-border/20 bg-light-surface/50 dark:bg-dark-surface/50 backdrop-blur-md flex gap-3">
              {coupon.status === 'redeemed' ? (
                <motion.button
                  onClick={() => onReactivate(coupon.coupon_code)}
                  className="w-full py-3.5 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary font-bold rounded-xl shadow-neon hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  {t('promotion.reactivate')}
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => onRedeem(coupon.coupon_code)}
                  className="w-full py-3.5 bg-gradient-to-r from-matrix-green to-green-600 text-white font-bold rounded-xl shadow-neon hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <TicketIcon className="h-5 w-5" />
                  Canjear Manualmente
                </motion.button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CouponModal;