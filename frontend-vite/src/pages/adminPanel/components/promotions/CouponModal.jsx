// src/pages/adminPanel/components/promotions/CouponModal.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaCheckCircle, FaRedo, FaCalendarAlt, FaWallet, FaGift, FaHistory, FaCoins } from 'react-icons/fa';
import QRCode from 'react-qr-code';

const CouponModal = ({ coupon, onClose, onReactivate, t }) => {
  const formatDate = (date) => date ? new Date(date).toLocaleString() : 'N/A';
  const abbreviateAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A';

  const getRuleDisplay = (rule) => {
    return `${rule.rule_type.replace('_', ' ').toUpperCase()}: ${rule.amount} tokens at ${abbreviateAddress(rule.token_address)}`;
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-2xl shadow-2xl w-full max-w-2xl mx-auto p-8 max-h-[90vh] overflow-y-auto border border-matrix-green/20 shadow-neon"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, type: 'spring' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-light-text-secondary dark:text-dark-text-secondary hover:text-vanellix-purple transition-colors"
          title={t('promotion.close')}
        >
          <FaTimes size={24} />
        </button>
        <h2 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2">
          <FaGift className="text-matrix-green" /> {t('promotion.coupon_details')} - {coupon.coupon_code}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="flex flex-col items-center">
            <QRCode value={coupon.coupon_code} size={160} className="bg-white p-2 rounded-lg shadow-neon" />
            <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.scan_qr')}</p>
          </div>
          <div className="space-y-3">
            <p className="flex items-center gap-2"><FaWallet className="text-vanellix-cyan" /><strong>{t('promotion.wallet')}:</strong> {abbreviateAddress(coupon.wallet)}</p>
            <p className="flex items-center gap-2"><FaCalendarAlt className="text-vanellix-cyan" /><strong>{t('promotion.claimed_at')}:</strong> {formatDate(coupon.timestamp)}</p>
            <p className="flex items-center gap-2"><FaCalendarAlt className="text-vanellix-cyan" /><strong>{t('promotion.valid_from')}:</strong> {formatDate(coupon.valid_from)}</p>
            <p className="flex items-center gap-2"><FaCalendarAlt className="text-vanellix-cyan" /><strong>{t('promotion.valid_until')}:</strong> {formatDate(coupon.valid_until)}</p>
            <p className="flex items-center gap-2"><FaRedo className="text-vanellix-cyan" /><strong>{t('promotion.redeemed_at')}:</strong> {formatDate(coupon.redeemed_at)}</p>
            <p className="flex items-center gap-2"><FaCoins className="text-vanellix-cyan" /><strong>{t('promotion.points_used')}:</strong> {coupon.points_used} ({abbreviateAddress(coupon.points_token_address)})</p>
            <p className="flex items-center gap-2"><strong>{t('promotion.pos_order_id')}:</strong> {coupon.pos_order_id || 'N/A'}</p>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
            <FaGift className="text-matrix-green" /> {t('promotion.promotion_details')}
          </h3>
          <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-4 rounded-lg space-y-2">
            <p><strong>{t('promotion.name')}:</strong> {coupon.promotion?.name || 'N/A'}</p>
            <p><strong>{t('promotion.description')}:</strong> {coupon.promotion?.description || 'N/A'}</p>
            <p><strong>{t('promotion.reward_type')}:</strong> {coupon.promotion?.reward_type.toUpperCase()}</p>
            <p><strong>{t('promotion.reward')}:</strong> {getRewardDisplay(coupon.promotion)}</p>
            <p><strong>{t('promotion.token_rule')}:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              {coupon.promotion?.rules.map((rule, idx) => (
                <li key={idx} className="text-sm">{getRuleDisplay(rule)}</li>
              ))}
            </ul>
            <p><strong>{t('promotion.max_claims')}:</strong> {coupon.promotion?.max_claims}</p>
            <p><strong>{t('promotion.locations')}:</strong> {coupon.promotion?.locations.join(', ') || 'All'}</p>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
            <FaHistory className="text-matrix-green" /> {t('promotion.history')}
          </h3>
          {coupon.history.length === 0 ? (
            <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.no_history')}</p>
          ) : (
            <ul className="space-y-2">
              {coupon.history.map((entry, idx) => (
                <li key={idx} className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-3 rounded-lg flex items-center gap-2">
                  <FaCheckCircle className="text-green-500" />
                  <span>{entry.action.toUpperCase()} at {formatDate(entry.timestamp)} {entry.discount_amount ? `(${entry.discount_amount})` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {coupon.status === 'redeemed' && (
          <motion.button
            className="w-full py-3 rounded-lg bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary font-semibold hover:opacity-90 shadow-neon"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onReactivate(coupon.coupon_code)}
          >
            <FaRedo className="inline mr-2" /> {t('promotion.reactivate')}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
};

const getRewardDisplay = (promotion) => {
  if (!promotion) return 'N/A';
  if (promotion.reward_type === 'discount') {
    return `${promotion.reward_details.discount} ${promotion.reward_details.type === 'percentage' ? '%' : '$'} off`;
  } else if (promotion.reward_type === 'product') {
    return `Free products: ${promotion.menu_item_skus.join(', ')}`;
  }
  return 'N/A';
};

export default CouponModal;