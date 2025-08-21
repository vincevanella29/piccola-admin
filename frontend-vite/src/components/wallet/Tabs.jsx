import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const Tabs = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="flex justify-center gap-1.5 border-b border-light-border/5 dark:border-dark-border/5 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 px-3 pt-1.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.button
        onClick={() => setActiveTab('tokens')}
        className={`relative px-3 py-1 text-[11px] font-semibold transition-colors ${
          activeTab === 'tokens'
            ? 'text-light-accent dark:text-dark-accent'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent'
        }`}
        whileHover={{ scale: 1.05 }}
      >
        {t('wallet.tokens_tab')}
        {activeTab === 'tokens' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-light-accent dark:bg-dark-accent rounded-t"
            layoutId="underline"
            transition={{ duration: 0.2 }}
          />
        )}
      </motion.button>
      <motion.button
        onClick={() => setActiveTab('transfer')}
        className={`relative px-3 py-1 text-[11px] font-semibold transition-colors ${
          activeTab === 'transfer'
            ? 'text-light-accent dark:text-dark-accent'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent'
        }`}
        whileHover={{ scale: 1.05 }}
      >
        {t('wallet.transfer_tab')}
        {activeTab === 'transfer' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-light-accent dark:bg-dark-accent rounded-t"
            layoutId="underline"
            transition={{ duration: 0.2 }}
          />
        )}
      </motion.button>
    </motion.div>
  );
};

export default Tabs;