import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const Balance = ({ nativeBalance, nativeSymbol, nativeUsd, totalTokens }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="flex flex-col items-center py-2 gap-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        className="text-xl font-bold text-light-accent dark:text-dark-accent"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {nativeBalance.toFixed(4)} {nativeSymbol}
      </motion.span>
      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
        ${nativeUsd.toFixed(2)} USD
      </span>
      <span className="text-[11px] text-light-text-secondary/70 dark:text-dark-text-secondary/70">
        {totalTokens} {t('wallet.tokens_accepted')}
      </span>
    </motion.div>
  );
};

export default Balance;