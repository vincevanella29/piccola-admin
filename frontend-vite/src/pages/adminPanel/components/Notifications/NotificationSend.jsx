import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const NotificationSend = ({ appState, notificationTypes, sendNotification, usersWithTokens, fetchUsersWithTokens, isLoading, setError, setSuccess }) => {
  const { t } = useTranslation();
  const didFetch = useRef(false);
  const [sendForm, setSendForm] = useState({
    notification_type_id: '',
    data: '',
    schedule_time: '',
    target_wallet: ''
  });
  const [testForm, setTestForm] = useState({
    notification_type_id: '',
    data: ''
  });
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (didFetch.current || appState.roleLevel > 4) return;
    if (appState.accessToken && appState.account) {
      fetchUsersWithTokens();
      didFetch.current = true;
    }
  }, [appState.accessToken, appState.account, appState.roleLevel, fetchUsersWithTokens]);

  const handleSendNotification = async (isTest = false) => {
    setFormError(null);
    const form = isTest ? testForm : sendForm;
    if (!form.notification_type_id) {
      setFormError(t('notifications.form.incomplete'));
      setError(t('notifications.form.incomplete'));
      return;
    }
    try {
      const data = JSON.parse(form.data || '{}');
      if (isTest) {
        // Enviar notificación de prueba a cada usuario con token
        for (const user of usersWithTokens) {
          const notificationType = notificationTypes.find((type) => type.id === form.notification_type_id);
          if (notificationType && notificationType.target_type === 'user') {
            await sendNotification({
              notification_type_id: form.notification_type_id,
              data,
              target_wallet: user.wallet
            });
          }
        }
        setTestForm({ notification_type_id: '', data: '' });
      } else {
        await sendNotification({
          ...sendForm,
          data,
          target_wallet: sendForm.target_wallet
        });
        setSendForm({ notification_type_id: '', data: '', schedule_time: '', target_wallet: '' });
      }
      setSuccess(t('notifications.notification_sent'));
    } catch (err) {
      setFormError(t('notifications.error_sending_notification'));
      setError(t('notifications.error_sending_notification'));
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
        <>
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
              {t('notifications.send_test_notification')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('notifications.notification_type')}
                </label>
                <select
                  value={testForm.notification_type_id}
                  onChange={(e) => setTestForm({ ...testForm, notification_type_id: e.target.value })}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                >
                  <option value="">{t('notifications.select_notification_type')}</option>
                  {notificationTypes.filter(type => type.target_type === 'user').map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.event_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('notifications.data')}
                </label>
                <textarea
                  value={testForm.data}
                  onChange={(e) => setTestForm({ ...testForm, data: e.target.value })}
                  placeholder={t('notifications.data_placeholder')}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                />
              </div>
              <div className="flex items-end">
                <motion.button
                  onClick={() => handleSendNotification(true)}
                  disabled={isLoading || !testForm.notification_type_id}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('notifications.send_test_button')}
                </motion.button>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
              {t('notifications.send_manual_notification')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('notifications.notification_type')}
                </label>
                <select
                  value={sendForm.notification_type_id}
                  onChange={(e) => setSendForm({ ...sendForm, notification_type_id: e.target.value })}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                >
                  <option value="">{t('notifications.select_notification_type')}</option>
                  {notificationTypes.filter(type => type.target_type === 'user').map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.event_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('notifications.target_user')}
                </label>
                <select
                  value={sendForm.target_wallet}
                  onChange={(e) => setSendForm({ ...sendForm, target_wallet: e.target.value })}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                >
                  <option value="">{t('notifications.select_user')}</option>
                  {usersWithTokens.map((user) => (
                    <option key={user.wallet} value={user.wallet}>
                      {user.wallet} ({user.device_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('notifications.data')}
                </label>
                <textarea
                  value={sendForm.data}
                  onChange={(e) => setSendForm({ ...sendForm, data: e.target.value })}
                  placeholder={t('notifications.data_placeholder')}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('notifications.schedule_time')}
                </label>
                <input
                  type="datetime-local"
                  value={sendForm.schedule_time}
                  onChange={(e) => setSendForm({ ...sendForm, schedule_time: e.target.value })}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                />
              </div>
              <div className="flex items-end">
                <motion.button
                  onClick={() => handleSendNotification(false)}
                  disabled={isLoading || !sendForm.notification_type_id || !sendForm.target_wallet}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('notifications.send_button')}
                </motion.button>
              </div>
            </div>
          </div>
        </>
      )}

      {appState.roleLevel <= 4 && (
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
            {t('notifications.users_with_tokens')}
          </h2>
          <button
            onClick={fetchUsersWithTokens}
            className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all disabled:opacity-50 transform hover:scale-105 mb-4 text-sm sm:text-base"
            disabled={isLoading}
          >
            {t('notifications.update_users')}
          </button>
          {usersWithTokens.length === 0 ? (
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
              {t('notifications.no_users_with_tokens')}
            </p>
          ) : (
            <div className="overflow-x-auto w-full max-w-full">
              <table className="w-full table-fixed border-collapse max-w-full">
                <thead>
                  <tr className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary">
                    <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                      {t('notifications.wallet')}
                    </th>
                    <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                      {t('notifications.device_type')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithTokens.map((user) => (
                    <tr
                      key={user.wallet}
                      className="border-b border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40"
                    >
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                        {user.wallet}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                        {user.device_type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationSend;