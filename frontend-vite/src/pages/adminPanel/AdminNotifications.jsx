import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Lock, List, Settings, Send } from 'lucide-react';
import NotificationPermissions from './components/Notifications/NotificationPermissions';
import NotificationTypes from './components/Notifications/NotificationTypes';
import NotificationApiConfigs from './components/Notifications/NotificationApiConfigs';
import NotificationSend from './components/Notifications/NotificationSend';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminNotifications = ({ appState }) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('permissions');

  const subTabs = [
    { key: 'permissions', label: t('notifications.permissions'), icon: Lock },
    { key: 'types', label: t('notifications.types_list'), icon: List },
    { key: 'api_configs', label: t('notifications.api_configs_list'), icon: Settings },
    { key: 'send', label: t('notifications.send_notification'), icon: Send },
  ];

  const handleSubTabClick = (tabKey) => {
    setActiveSubTab(tabKey);
  };

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2 sm:gap-3"
      >
        <Bell className="text-light-accent dark:text-dark-accent" size={24} sm={28} lg={36} />
        {t('notifications.label')}
      </motion.h1>

      <motion.div
        className="flex justify-center mb-6 sm:mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 bg-light-surface/50 dark:bg-dark-surface/50 p-2 sm:p-3 rounded-xl border border-light-border/20 dark:border-dark-border/20 w-full max-w-md sm:max-w-3xl">
          {subTabs.map((tab) => (
            <motion.button
              key={tab.key}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold ${
                activeSubTab === tab.key
                  ? 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary shadow-neon'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/10 dark:hover:bg-dark-accent/10'
              }`}
              onClick={() => handleSubTabClick(tab.key)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <tab.icon size={16} sm={18} />
              {tab.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mx-auto w-full max-w-4xl rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-4 sm:p-6 shadow-neon backdrop-blur-md bg-light-surface/90 dark:bg-dark-surface/90"
      >
        {activeSubTab === 'permissions' && (
          <NotificationPermissions
            appState={appState}
            saveNotificationToken={appState.useNotifications.saveNotificationToken}
            isLoading={appState.useNotifications.isLoading}
            notificationPermission={appState.useNotifications.notificationPermission}
            setError={appState.setError}
          />
        )}
        {activeSubTab === 'types' && (
          <NotificationTypes
            appState={appState}
            fetchNotificationTypes={appState.useNotifications.fetchNotificationTypes}
            notificationTypes={appState.useNotifications.notificationTypes}
            createNotificationType={appState.useNotifications.createNotificationType}
            isLoading={appState.useNotifications.isLoading}
            apiConfigs={appState.useNotifications.apiConfigs}
            setError={appState.setError}
            setSuccess={appState.setSuccess}
          />
        )}
        {activeSubTab === 'api_configs' && (
          <NotificationApiConfigs
            appState={appState}
            fetchApiConfigs={appState.useNotifications.fetchApiConfigs}
            apiConfigs={appState.useNotifications.apiConfigs}
            createApiConfig={appState.useNotifications.createApiConfig}
            isLoading={appState.useNotifications.isLoading}
            setError={appState.setError}
            setSuccess={appState.setSuccess}
          />
        )}
        {activeSubTab === 'send' && (
          <NotificationSend
            appState={appState}
            notificationTypes={appState.useNotifications.notificationTypes}
            sendNotification={appState.useNotifications.sendNotification}
            usersWithTokens={appState.useNotifications.usersWithTokens}
            fetchUsersWithTokens={appState.useNotifications.fetchUsersWithTokens}
            isLoading={appState.useNotifications.isLoading}
            setError={appState.setError}
            setSuccess={appState.setSuccess}
          />
        )}
      </motion.section>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </div>
  );
};

export default AdminNotifications;

export const pageMetadata = {
  path: '/app/admin/notifications',
  label: 'admin.notifications.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 3,
  locations: ['sidebar'],
  description: 'admin.notifications.description',
  icon: 'FaBell',
};