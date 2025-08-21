import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const NotificationPermissions = ({ appState, saveNotificationToken, isLoading, notificationPermission, setError }) => {
  const { t } = useTranslation();
  const [formError, setFormError] = useState(null);

  const handleNotificationPermission = async () => {
    try {
      await saveNotificationToken();
    } catch (err) {
      setFormError(t('notifications.error_saving_token'));
      setError(t('notifications.error_saving_token'));
    }
  };

  return (
    <div>
      <AnimatePresence>
        {formError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={20} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base">{formError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
          {t('notifications.permissions')}
        </h2>
        <p className="text-sm sm:text-base text-light-text-secondary dark:text-dark-text-secondary mb-4">
          {t('notifications.current_permission')}: <span className="font-semibold">{notificationPermission}</span>
        </p>
        <motion.button
          onClick={handleNotificationPermission}
          disabled={isLoading || notificationPermission === 'granted'}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('notifications.request_permission')}
        </motion.button>
      </div>
    </div>
  );
};

export default NotificationPermissions;