import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const NotificationTypes = ({ appState, fetchNotificationTypes, notificationTypes, createNotificationType, isLoading, apiConfigs, setError, setSuccess }) => {
  const { t } = useTranslation();
  const didFetch = useRef(false);
  const [formData, setFormData] = useState({
    event_name: '',
    title_template: '',
    body_template: '',
    image_url: '',
    target_type: 'user',
    target_value: '',
    api_config_id: ''
  });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (didFetch.current || appState.roleLevel > 4) return;
    if (appState.accessToken && appState.account) {
      fetchNotificationTypes();
      didFetch.current = true;
    }
  }, [appState.accessToken, appState.account, appState.roleLevel, fetchNotificationTypes]);

  const handleCreateType = async () => {
    setFormError(null);
    if (!formData.event_name || !formData.title_template || !formData.body_template || !formData.target_type || !formData.target_value || !formData.api_config_id) {
      setFormError(t('notifications.form.incomplete'));
      setError(t('notifications.form.incomplete'));
      return;
    }
    try {
      await createNotificationType(formData);
      setFormData({
        event_name: '',
        title_template: '',
        body_template: '',
        image_url: '',
        target_type: 'user',
        target_value: '',
        api_config_id: ''
      });
      setSuccess(t('notifications.type_created'));
    } catch (err) {
      setFormError(t('notifications.error_creating_type'));
      setError(t('notifications.error_creating_type'));
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
            {t('notifications.create_type')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.event_name')}
              </label>
              <input
                type="text"
                value={formData.event_name}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                placeholder={t('notifications.event_name_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.title_template')}
              </label>
              <input
                type="text"
                value={formData.title_template}
                onChange={(e) => setFormData({ ...formData, title_template: e.target.value })}
                placeholder={t('notifications.title_template_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.body_template')}
              </label>
              <textarea
                value={formData.body_template}
                onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                placeholder={t('notifications.body_template_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.image_url')}
              </label>
              <input
                type="text"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder={t('notifications.image_url_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.target_type')}
              </label>
              <select
                value={formData.target_type}
                onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              >
                <option value="user">{t('notifications.target_user')}</option>
                <option value="topic">{t('notifications.target_topic')}</option>
                <option value="all">{t('notifications.target_all')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.target_value')}
              </label>
              <input
                type="text"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                placeholder={t('notifications.target_value_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('notifications.api_config')}
              </label>
              <select
                value={formData.api_config_id}
                onChange={(e) => setFormData({ ...formData, api_config_id: e.target.value })}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
              >
                <option value="">{t('notifications.select_api_config')}</option>
                {apiConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.project_id} ({config.service})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <motion.button
                onClick={handleCreateType}
                disabled={isLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('notifications.create_type_button')}
              </motion.button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
          {t('notifications.types_list')}
        </h2>
        <button
          onClick={fetchNotificationTypes}
          className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all disabled:opacity-50 transform hover:scale-105 mb-4 text-sm sm:text-base"
          disabled={isLoading}
        >
          {t('notifications.update_types')}
        </button>
        {notificationTypes.length === 0 ? (
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
            {t('notifications.no_types')}
          </p>
        ) : (
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full table-fixed border-collapse max-w-full">
              <thead>
                <tr className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary">
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('notifications.event_name')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('notifications.title_template')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('notifications.target_type')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {notificationTypes.map((type) => (
                  <tr
                    key={type.id}
                    className="border-b border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40"
                  >
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {type.event_name}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {type.title_template}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {type.target_type}
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

export default NotificationTypes;