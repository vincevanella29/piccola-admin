// src/components/promotions/PromotionModal.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTimes,
  FaArrowLeft,
  FaArrowRight,
  FaWallet,
  FaChevronDown,
  FaChevronUp,
  FaTrophy,
  FaCheckCircle,
  FaClock,
  FaFire,
  FaPlusCircle
} from 'react-icons/fa';
import RuleRequirement from './RuleRequirement';
import CountdownTimer from './CountdownTimer';
import InfoTooltip from '../../../components/common/Tools/InfoTooltip';

// --- Utility Functions ---
const calculateDiscountedPrice = (price, discount, type) => {
  if (type === 'percentage') {
    return price * (1 - discount / 100);
  } else if (type === 'fixed') {
    return Math.max(0, price - discount);
  }
  return price;
};

const getDiscountText = (promo, t) => {
  if (promo.reward_type === 'discount' || promo.promotion_type === 'P') {
    const { discount, type } = promo.reward_details || {};
    if (!discount) return '';
    if (type === 'fixed') {
      return t('promotion-front.discount_fixed', { amount: discount.toLocaleString('es-CL') });
    }
    if (type === 'percentage') {
      return `${discount}% ${t('promotion-front.off_bill')}`;
    }
  }
  return '';
};

const PromotionModal = ({
  promo,
  onClose,
  onClaim,
  t,
  account,
  appState,
  tokenBalances,
  burnBalances,
  meritSegments,
  meritBalances,
  meritos,
  segmentMap
}) => {
  // --- Portal Setup ---
  const modalRoot = document.getElementById('modal-root') || document.createElement('div');
  if (!document.getElementById('modal-root')) {
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  }

  // --- Early Returns ---
  // Only block fully unauthenticated users (no token at all).
  // Authenticated users without a wallet will see the modal with a "Create Wallet" CTA.
  const isAuthenticated = Boolean(appState?.token || appState?.isAuthenticated);
  const hasWallet = Boolean(appState?.account);

  if (!isAuthenticated) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-light-surface dark:bg-dark-surface p-8 rounded-2xl shadow-neon text-center">
          <p className="text-light-text-primary dark:text-dark-text-primary mb-4 font-bold">
            {t ? t('wallet.connect') : 'Please connect your wallet.'}
          </p>
          <button onClick={onClose} className="px-4 py-2 bg-light-surface-tertiary rounded-lg">Close</button>
        </div>
      </div>,
      modalRoot
    );
  }

  const safeT = t || ((key, opts) => key + (opts ? JSON.stringify(opts) : ''));

  // --- Logic & Data Prep ---
  const hasItems = Array.isArray(promo.menu_items) && promo.menu_items.length > 0;
  const claimStart = promo.claim_start ? new Date(promo.claim_start) : new Date(0);
  const claimEnd = promo.claim_end ? new Date(promo.claim_end) : new Date(8640000000000000);
  const now = new Date();
  const totalRemaining = (promo.max_coupon_per_promo ?? 0) - (promo.total_claimed ?? 0);
  const isSoldOut = totalRemaining <= 0;
  const isClaimActive = now >= claimStart && now <= claimEnd && !isSoldOut;
  const countdownTarget = isClaimActive ? claimEnd : claimStart;

  const recurringEvery = promo.coupon_validity?.recurring_every ?? [];
  const days = Array.isArray(recurringEvery) && recurringEvery.length > 0
    ? recurringEvery.map((day) => safeT(`days.${day}`)).join(', ')
    : safeT('promotion-front.all_days');

  // --- States ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSku, setSelectedSku] = useState(hasItems ? promo.menu_items[0]?.codigo : null);
  // Default to showing requirements if rules exist, feels more "Pro" to see what's needed immediately
  const [showRequirements, setShowRequirements] = useState(true);

  // --- Merit / Ranking Logic ---
  // La data de merit_progress viene directamente en rule.merit_progress del backend
  const rankingRuleIndex = (promo.rules || []).findIndex((r) => r.rule_type === 'merit_rule_fulfilled');
  const rankingRule = rankingRuleIndex !== -1 ? promo.rules[rankingRuleIndex] : null; // eslint-disable-line no-unused-vars

  // --- Effects ---
  useEffect(() => {
    if (hasItems) {
      setSelectedSku(promo.menu_items[currentIndex]?.codigo);
    }
  }, [currentIndex, hasItems, promo.menu_items]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // --- Handlers ---
  const handlePrev = () => setCurrentIndex((prev) => (prev === 0 ? promo.menu_items.length - 1 : prev - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev === promo.menu_items.length - 1 ? 0 : prev + 1));

  const handleClaimWithBurn = async () => {
    if (!promo.allRequirementsMet || !account || promo.user_claimed >= promo.max_claims) return;
    await onClaim(promo, selectedSku);
  };

  // --- Derived Values ---
  const selectedItem = hasItems && promo.menu_items[currentIndex] ? promo.menu_items[currentIndex] : null;
  const normalPrice = selectedItem && typeof selectedItem.precio === 'number' ? selectedItem.precio : 0;
  const discount = promo.reward_details?.discount || 0;
  const discountType = promo.reward_details?.type || null;
  const discountedPrice = calculateDiscountedPrice(normalPrice, discount, discountType);
  const userRemaining = promo.max_claims - promo.user_claimed;

  // Progress calculations
  const rulesProgress = promo.totalRules > 0 ? (promo.rulesMetCount / promo.totalRules) * 100 : 100;
  const userProgress = (promo.user_claimed / promo.max_claims) * 100;
  const totalProgress = (promo.total_claimed / promo.max_coupon_per_promo) * 100;

  // --- Render ---
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-light-surface dark:bg-dark-surface sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-md mx-auto max-h-[90vh] flex flex-col border border-light-border/20 dark:border-dark-border/20 overflow-hidden"
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* HEADER */}
        <div className="relative z-20 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-md border-b border-light-border/20 dark:border-dark-border/20 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-futurist font-bold text-light-text-primary dark:text-dark-text-primary truncate pr-8">
            {promo.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 hover:bg-light-error/20 dark:hover:bg-dark-error/20 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">

          {/* 1. HERO SECTION (Product or Text) */}
          <div className="relative">
            {hasItems ? (
              <div className="relative group">
                <div className="relative overflow-hidden rounded-2xl shadow-lg border border-light-border/10 dark:border-dark-border/10">
                  {selectedItem.media_r2 ? (
                    <img src={selectedItem.media_r2} alt={selectedItem.nombre} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-matrix-green/20 to-vanellix-cyan/20 flex items-center justify-center">
                      <span className="text-4xl">🍕</span>
                    </div>
                  )}
                  {/* Navigation Arrows */}
                  {promo.menu_items.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm transition-all z-10">
                        <FaArrowLeft size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm transition-all z-10">
                        <FaArrowRight size={14} />
                      </button>
                    </>
                  )}
                  {/* Price Tag Overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 text-white pointer-events-none">
                    <h5 className="text-lg font-bold leading-tight">{selectedItem.nombre}</h5>
                    <div className="flex items-baseline gap-2 mt-1">
                      {discountType && (
                        <span className="text-sm text-white/70 line-through">
                          ${normalPrice.toLocaleString('es-CL')}
                        </span>
                      )}
                      <span className="text-xl font-bold text-matrix-green shadow-black drop-shadow-sm">
                        ${discountedPrice.toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary mt-2 flex items-center justify-center gap-1">
                  {selectedItem.descripcion}
                  <InfoTooltip text={selectedItem.descripcion} />
                </div>
              </div>
            ) : (
              <div className="py-8 px-4 rounded-2xl bg-gradient-to-br from-matrix-green/10 to-vanellix-cyan/10 border border-matrix-green/20 text-center">
                {!isSoldOut ? (
                  <>
                    <p className="text-sm font-bold uppercase tracking-widest text-matrix-green mb-1">
                      {safeT('promotion-front.reward')}
                    </p>
                    <p className="text-3xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary">
                      {getDiscountText(promo, safeT)}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-red-500 uppercase tracking-widest">
                    {safeT('promotion-front.sold_out')}
                  </p>
                )}
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2 px-4">
                  {promo.description}
                </p>
              </div>
            )}
          </div>

          {/* 2. REQUIREMENTS & RULES SECTION */}
          <div className="space-y-3">
            <button
              onClick={() => setShowRequirements(!showRequirements)}
              className="w-full flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  {promo.allRequirementsMet ? (
                    <FaCheckCircle className="text-matrix-green w-5 h-5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-light-text-secondary/40 dark:border-dark-text-secondary/40" />
                  )}
                </div>
                <h4 className="font-bold text-light-text-primary dark:text-dark-text-primary">
                  {safeT('promotion-front.requirements')}
                </h4>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                <span>{promo.rulesMetCount}/{promo.totalRules}</span>
                {showRequirements ? <FaChevronUp /> : <FaChevronDown />}
              </div>
            </button>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary rounded-full overflow-hidden">
              <motion.div
                className="bg-matrix-green h-full"
                initial={{ width: 0 }}
                animate={{ width: `${rulesProgress}%` }}
                transition={{ duration: 0.6, ease: "circOut" }}
              />
            </div>

            {/* Rules List (Integrated Ranking Card) */}
            <AnimatePresence>
              {showRequirements && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2 overflow-hidden"
                >
                  {promo.rules.length === 0 ? (
                    <p className="text-sm text-center text-green-500 py-2 bg-green-500/10 rounded-lg">
                      {safeT('promotion-front.no_requirements')}
                    </p>
                  ) : (
                    promo.rules.map((rule, idx) => {
                      // ALL RULES (including merit_rule_fulfilled) via RuleRequirement
                      // merit_progress comes already populated in rule from the backend
                      return (
                        <RuleRequirement
                          key={idx}
                          rule={rule}
                          index={idx}
                          account={account}
                          t={safeT}
                          met={promo.metStatus[idx]}
                          profile={appState?.profile}
                          appState={{ ...appState, tokenBalances }}
                          meritSegments={meritSegments}
                          meritBalances={meritBalances}
                          burnedBalance={rule.rule_type === 'burn_tokens' ? burnBalances?.[rule.token_address] : null}
                        />
                      );

                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. AVAILABILITY & TIMING */}
          <div className="grid grid-cols-2 gap-4">
            {/* Timing */}
            <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 p-3 rounded-xl border border-light-border/10 dark:border-dark-border/10">
              <div className="flex items-center gap-2 mb-1 text-light-text-secondary dark:text-dark-text-secondary">
                <FaClock size={12} />
                <span className="text-xs font-bold uppercase">{safeT('promotion-front.validity')}</span>
              </div>
              <p className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary line-clamp-1">
                {days}
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                {promo.coupon_validity.recurring_from_time || 'Open'} - {promo.coupon_validity.recurring_to_time || 'Close'}
              </p>
            </div>

            {/* Countdown */}
            <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 p-3 rounded-xl border border-light-border/10 dark:border-dark-border/10 flex flex-col justify-center items-center">
              <span className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">
                {isClaimActive ? 'Termina en' : 'Comienza en'}
              </span>
              <CountdownTimer targetDate={countdownTarget} />
            </div>
          </div>

          {/* 4. CLAIM STATUS (Global & User) */}
          <div className="space-y-4 pt-2 border-t border-light-border/10 dark:border-dark-border/10">

            {/* User Limit */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">Tu límite de canje</span>
                <span className={`font-bold ${userRemaining <= 1 ? 'text-red-500' : 'text-matrix-green'}`}>
                  {promo.user_claimed} / {promo.max_claims}
                </span>
              </div>
              <div className="h-1.5 w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${userRemaining <= 0 ? 'bg-red-500' : 'bg-vanellix-cyan'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${userProgress}%` }}
                />
              </div>
            </div>

            {/* Global Supply */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">Disponibilidad Global</span>
                <span className="font-mono text-xs">{promo.total_claimed} / {promo.max_coupon_per_promo}</span>
              </div>
              <div className="h-1.5 w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
                <motion.div
                  className="bg-purple-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${totalProgress}%` }}
                />
              </div>
            </div>

            {/* Warnings */}
            {totalRemaining <= 10 && !isSoldOut && (
              <p className="text-xs font-bold text-orange-500 text-center flex items-center justify-center gap-1">
                <FaFire /> ¡Quedan pocos cupones! ({totalRemaining})
              </p>
            )}
          </div>

        </div>

        {/* STICKY FOOTER ACTION */}
        <div className="p-6 pt-4 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-lg border-t border-light-border/10 dark:border-dark-border/10 z-30">
          {!isAuthenticated ? (
            <button
              className="w-full py-4 rounded-xl bg-light-text-primary dark:bg-white text-light-surface dark:text-black font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              onClick={() => appState?.connectWallet?.()}
            >
              <FaWallet />
              {safeT('wallet.connect')}
            </button>
          ) : !hasWallet ? (
            /* Authenticated but no wallet — CTA to create wallet */
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 border border-light-accent/20 dark:border-dark-accent/20">
                <div className="p-2 rounded-full bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent animate-pulse">
                  <FaWallet size={16} />
                </div>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-snug flex-1">
                  {safeT('promotion-front.create_wallet_hint')}
                </p>
              </div>
              <button
                className="w-full py-4 rounded-xl bg-gradient-to-r from-light-accent to-dark-accent text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-light-accent/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={async () => {
                  try {
                    await appState?.createWalletOnDemand?.();
                    appState?.openWalletModal?.();
                  } catch (e) {
                    console.error('Error creating wallet:', e);
                  }
                }}
              >
                <FaPlusCircle />
                {safeT('promotion-front.create_wallet_cta')}
              </button>
            </div>
          ) : (
            <button
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all
                 ${isClaimActive && promo.allRequirementsMet && (!hasItems || selectedSku) && userRemaining > 0
                  ? 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-matrix-green/20 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary cursor-not-allowed opacity-70'
                }
               `}
              onClick={handleClaimWithBurn}
              disabled={!isClaimActive || isSoldOut || !promo.allRequirementsMet || (hasItems && !selectedSku) || userRemaining <= 0}
            >
              {isSoldOut
                ? safeT('promotion-front.sold_out')
                : userRemaining <= 0
                  ? safeT('promotion-front.no_claims_left')
                  : isClaimActive && promo.allRequirementsMet
                    ? safeT('promotion-front.redeem_now')
                    : safeT('promotion-front.not_available')}
            </button>
          )}
        </div>

      </motion.div>
    </motion.div>,
    modalRoot
  );
};

export default PromotionModal;