import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const PendingState = ({ partner }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-light-surface dark:bg-dark-surface p-8 rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-xl text-center"
      >
        <div className="w-20 h-20 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
          {t('b2b.pending_title')}
        </h2>
        <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
          {t('b2b.pending_desc')} <strong>{partner?.company_name}</strong>. {t('b2b.pending_desc_suffix')}
        </p>
      </motion.div>
    </div>
  );
};

export default PendingState;
