import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const SwapFooter = ({
  t,
  needsApproval,
  approveLoading,
  handleApprove,
  isValidInput,
  swapLoading,
  loadingPrice,
  handleSwap,
}) => {
  return (
    <div className="mt-6 space-y-3">
      {needsApproval && (
        <motion.button
          className="w-full py-3 rounded-xl bg-gradient-to-r from-light-accent to-dark-accent text-white font-semibold disabled:opacity-50 shadow-neon transition-all"
          whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(0, 146, 70, 0.5)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleApprove}
          disabled={approveLoading || !isValidInput()}
        >
          {approveLoading
            ? t('swap.approving_token', { symbol: '' })
            : t('swap.approve_token')}
        </motion.button>
      )}
      <motion.button
        className="w-full py-3 rounded-xl bg-gradient-to-r from-light-accent to-dark-accent text-white font-semibold disabled:opacity-50 shadow-neon transition-all"
        whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(0, 146, 70, 0.5)' }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSwap}
        disabled={swapLoading || needsApproval || !isValidInput() || loadingPrice}
      >
        {swapLoading
          ? t('swap.swapping')
          : loadingPrice
          ? t('swap.loading_price')
          : t('swap.confirm_swap')}
      </motion.button>
    </div>
  );
};

export default SwapFooter;