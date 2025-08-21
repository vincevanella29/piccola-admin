import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const TokensTab = ({ tokensWithBalances, totalUsd }) => {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <h4 className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2.5">
        {t('wallet.tokens_title') || t('wallet.tokens_title_fallback')}
      </h4>
      <div className="flex flex-col gap-2">
        {tokensWithBalances.map((token) => (
          <motion.div
            key={token.symbol}
            className="flex items-center justify-between bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-xl border border-light-border/5 dark:border-dark-border/5 p-2.5 shadow-sm backdrop-blur-sm"
            variants={itemVariants}
          >
            <div className="flex items-center gap-2">
              <img
                src={token.imagePath || `/token-logos/${token.symbol.toLowerCase() || 'fallback'}.png`}
                alt={t('wallet.token_logo_alt', { symbol: token.symbol })}
                className="w-6 h-6 rounded-full shadow-sm"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/token-logos/fallback.png';
                }}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[13px] text-light-text-primary dark:text-dark-text-primary">
                  {t('wallet.token_symbol', { symbol: token.symbol })}
                </span>
                <span className="text-[11px] text-light-text-secondary/70 dark:text-dark-text-secondary/70 truncate max-w-[120px]">
                  {t('wallet.token_name', { name: token.name })}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end min-w-[80px]">
              <span className="font-mono text-[12px] font-bold text-light-accent dark:text-dark-accent">
                {token.balance
                ? `${new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                  }).format(Number(token.balance))} ${token.symbol}`
                : '0.00'}
              </span>
              <span className="text-[11px] text-light-text-secondary/70 dark:text-dark-text-secondary/70">
                ${token.usd.toFixed(2)} USD
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div className="flex justify-end mt-2.5" variants={itemVariants}>
        <span className="text-[12px] font-bold text-light-accent dark:text-dark-accent">
          Total: ${totalUsd.toFixed(2)} USD
        </span>
      </motion.div>
    </motion.div>
  );
};

export default TokensTab;