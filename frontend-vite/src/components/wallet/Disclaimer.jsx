import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Disclaimer = ({ isOpen, toggle }) => {
  const { t } = useTranslation();

  return (
    <div>
      <motion.button
        className="flex items-center gap-1.5 text-[11px] text-light-accent dark:text-dark-accent font-semibold hover:underline focus:outline-none mb-1.5"
        onClick={toggle}
        aria-expanded={isOpen}
        whileHover={{ scale: 1.05 }}
      >
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {isOpen ? t('wallet.hide_disclaimer') : t('wallet.show_disclaimer')}
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden text-[11px] text-light-text-secondary/80 dark:text-dark-text-secondary/80 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-xl p-2.5 shadow-sm backdrop-blur-lg space-y-1.5 max-h-32 overflow-y-auto"
          >
            <p>{t('disclaimer.disclaimer')}</p>
            <p>{t('wallet.embedded_wallet_info')}</p>
            <p>{t('wallet.liquidity_info_description')}</p>
            <p>
              {t('token_utility_description.token_utility_description')}{' '}
              <a href="/terms" className="text-light-accent dark:text-dark-accent hover:underline">
                {t('learn_more.learn_more')}
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Disclaimer;