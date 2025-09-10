import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const PrettyJson = ({ data }) => (
  <div className="rounded-2xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/30 dark:border-dark-border/30">
    <pre className="w-full overflow-auto p-4 rounded-2xl text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

const CTConfig = ({ loading, error, config, providersById, onRefresh }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      {/* Error banner */}
      <AnimatePresence>
        {!!error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="max-w-3xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={18} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base whitespace-pre-line">{String(error?.message || error)}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <motion.button
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold shadow-neon disabled:opacity-60"
          onClick={onRefresh}
          disabled={loading}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {loading ? t('conversion_tracker.config.refreshing') : t('conversion_tracker.config.refresh')}
        </motion.button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">{t('conversion_tracker.config.public_config')}</h3>
        <PrettyJson data={config || {}} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">{t('conversion_tracker.config.providers_by_id')}</h3>
        <PrettyJson data={providersById || {}} />
      </div>
    </div>
  );
};

export default CTConfig;
