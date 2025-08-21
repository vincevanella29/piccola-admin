import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import InfoTooltip from '../../../components/common/Tools/InfoTooltip';

const SwapInfoPanel = ({
  t,
  inputAmount,
  outputAmount,
  inputToken,
  outputToken,
  liquidity,
  percentOfPool,
  minReceived,
  loadingInfo,
}) => {
  const { t: translate } = useTranslation();
  const price = inputAmount && outputAmount && Number(inputAmount) > 0
    ? (Number(outputAmount) / Number(inputAmount)).toFixed(6)
    : '-';

    const Shimmer = () => (
      <div className="relative overflow-hidden bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-light-accent/30 dark:via-dark-accent/30 to-transparent animate-shimmer" />
        <div className="h-5 w-3/4 bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/80 rounded mb-3" />
        <div className="h-5 w-1/2 bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/80 rounded mb-3" />
        <div className="h-5 w-2/3 bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/80 rounded mb-3" />
        <div className="h-5 w-3/4 bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/80 rounded mb-3" />
        <div className="h-5 w-1/2 bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/80 rounded" />
      </div>
    );
    
    return (
      <motion.div
        className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary p-4 rounded-xl border border-light-accent/40 dark:border-dark-accent/40 shadow-neon"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <AnimatePresence mode="wait">
          {loadingInfo ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Shimmer />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('swap.price')}
                  <InfoTooltip text={t('swap.price_tooltip')} />
                </span>
                <motion.span
                  className="text-sm font-mono text-light-accent dark:text-dark-accent"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {inputToken && outputToken && price !== '-'
                    ? `${price} ${outputToken.symbol} per ${inputToken.symbol}`
                    : '-'}
                </motion.span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('swap.liquidity')}
                  <InfoTooltip text={t('swap.liquidity_tooltip')} />
                </span>
                <motion.span
                  className="text-sm font-mono text-light-accent dark:text-dark-accent"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  {liquidity && outputToken ? `${liquidity} ${outputToken.symbol}` : '-'}
                </motion.span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('swap.percent_of_pool')}
                  <InfoTooltip text={t('swap.percent_of_pool_tooltip')} />
                </span>
                <motion.span
                  className="text-sm font-mono text-light-accent dark:text-dark-accent"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  {percentOfPool ? `${percentOfPool}%` : '-'}
                </motion.span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('swap.slippage')}
                  <InfoTooltip text={t('swap.slippage_tooltip')} />
                </span>
                <motion.span
                  className="text-sm font-mono text-light-accent dark:text-dark-accent"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  1%
                </motion.span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('swap.minimum_received')}
                  <InfoTooltip text={t('swap.minimum_received_tooltip')} />
                </span>
                <motion.span
                  className="text-sm font-mono text-light-accent dark:text-dark-accent"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  {`${minReceived} ${outputToken?.symbol || ''}`}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
};

export default SwapInfoPanel;