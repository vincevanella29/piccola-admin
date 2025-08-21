import React from 'react';
import { FaExchangeAlt } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const SwapHeader = ({ t, warningHighPercent, percentOfPool }) => {
  return (
    <div className="mb-6">
      <AnimatePresence>
        {warningHighPercent && (
          <motion.div
            className="mb-4 p-3 bg-light-error/30 dark:bg-dark-error/30 text-light-error dark:text-dark-error rounded-lg text-sm flex items-center gap-2 shadow-neon-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-5 h-5 text-light-error dark:text-dark-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('swap.warning_high_percent', { percent: percentOfPool })}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-3">
        <motion.div
          className="text-light-accent dark:text-dark-accent text-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <FaExchangeAlt />
        </motion.div>
        <h3 className="text-2xl font-bold text-vanellix-cyan dark:text-vanellix-cyan font-futurist tracking-tight">
          {t('swap.title')}
        </h3>
      </div>
    </div>
  );
};

export default SwapHeader;