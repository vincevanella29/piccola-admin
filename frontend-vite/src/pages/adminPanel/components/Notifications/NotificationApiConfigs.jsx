import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const NotificationApiConfigs = ({ appState, fetchApiConfigs, apiConfigs, createApiConfig, isLoading, setError, setSuccess }) => {
  const { t } = useTranslation();
  const didFetch = useRef(false);
  const [apiConfigForm, setApiConfigForm] = useState({
    service: 'fcm',
    api_key: '',
    project_id: 'vanellix-adcf0'
  });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (didFetch.current || appState.roleLevel > 4) return;
    if (appState.accessToken && appState.account) {
      fetchApiConfigs();
      didFetch.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateApiConfig = async () => {
    setFormError(null);
    if (!apiConfigForm.service || !apiConfigForm.api_key || !apiConfigForm.project_id) {
      setFormError(t('notifications.form.incomplete'));
      setError(t('notifications.form.incomplete'));
      return;
    }
    try {
      await createApiConfig(apiConfigForm);
      setApiConfigForm({ service: 'fcm', api_key: '', project_id: 'vanellix-adcf0' });
      setSuccess(t('notifications.api_config_created'));
    } catch (err) {
      setFormError(t('notifications.error_creating_api_config'));
      setError(t('notifications.error_creating_api_config'));
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

      {appState.roleLevel <= 4 && (
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
            {t('notifications.create_api_config')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.service')}
              </label>
              <select
                value={apiConfigForm.service}
                onChange={(e) => setApiConfigForm({ ...apiConfigForm, service: e.target.value })}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              >
                <option value="fcm">Firebase Cloud Messaging</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.api_key')}
              </label>
              <input
                type="text"
                value={apiConfigForm.api_key}
                onChange={(e) => setApiConfigForm({ ...apiConfigForm, api_key: e.target.value })}
                placeholder={t('notifications.api_key_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.project_id')}
              </label>
              <input
                type="text"
                value={apiConfigForm.project_id}
                onChange={(e) => setApiConfigForm({ ...apiConfigForm, project_id: e.target.value })}
                placeholder={t('notifications.project_id_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div className="flex items-end">
              <motion.button
                onClick={handleCreateApiConfig}
                disabled={isLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('notifications.create_api_config_button')}
              </motion.button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
          {t('notifications.api_configs_list')}
        </h2>
        <button
          onClick={fetchApiConfigs}
          className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all disabled:opacity-50 transform hover:scale-105 mb-4 text-sm sm:text-base"
          disabled={isLoading}
        >
          {t('notifications.update_api_configs')}
        </button>
        {apiConfigs.length === 0 ? (
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
            {t('notifications.no_api_configs')}
          </p>
        ) : (
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full table-fixed border-collapse max-w-full">
              <thead>
                <tr className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary">
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('notifications.service')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('notifications.project_id')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiConfigs.map((config) => (
                  <tr
                    key={config.id}
                    className="border-b border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40"
                  >
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {config.service}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {config.project_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationApiConfigs;