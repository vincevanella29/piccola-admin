import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Gauge, Settings, Eye } from 'lucide-react';
import useConversionTrackerAdmin from '../../hooks/useConversionTrackerAdmin.jsx';
import CTProviders from './components/AdminNotif/CTProviders.jsx';
import CTConfig from './components/AdminNotif/CTConfig.jsx';

const AdminConversionTracker = ({ appState }) => {
  // Try to reuse the same auth conventions used across the app
  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;
  const account = appState?.account || appState?.wallet || appState?.useAuth?.account;

  const {
    providers, config,
    loading, error,
    listProviders, createProvider, updateProvider,
    fetchConfig, refreshAll,
    providersById, eventToProviders,
    listServices, getServiceRules, uploadCredentialsJson,
  } = useConversionTrackerAdmin({ token, account, autoLoad: true });

  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('providers');
  const tabs = useMemo(() => ([
    { key: 'providers', label: t('conversion_tracker.tabs.providers'), icon: Settings },
    { key: 'config', label: t('conversion_tracker.tabs.config'), icon: Eye },
  ]), [t]);

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2 sm:gap-3"
      >
        <Gauge className="text-light-accent dark:text-dark-accent" size={28} />
        {t('conversion_tracker.title')}
      </motion.h1>

      <motion.div
        className="flex justify-center mb-6 sm:mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 bg-light-surface/50 dark:bg-dark-surface/50 p-2 sm:p-3 rounded-xl border border-light-border/20 dark:border-dark-border/20 w-full max-w-md sm:max-w-3xl">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary shadow-neon'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/10 dark:hover:bg-dark-accent/10'
              }`}
              onClick={() => setActiveTab(tab.key)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <tab.icon size={16} />
              {tab.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mx-auto w-full max-w-5xl rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-4 sm:p-6 shadow-neon backdrop-blur-md bg-light-surface/90 dark:bg-dark-surface/90"
      >
        {activeTab === 'providers' && (
          <CTProviders
            loading={loading}
            error={error}
            providers={providers}
            onRefresh={listProviders}
            onCreate={createProvider}
            onUpdate={updateProvider}
            token={token}
            account={account}
            listServices={listServices}
            getServiceRules={getServiceRules}
            uploadCredentialsJson={uploadCredentialsJson}
          />
        )}
        {activeTab === 'config' && (
          <CTConfig
            loading={loading}
            error={error}
            config={config}
            providersById={providersById}
            onRefresh={refreshAll}
          />
        )}
      </motion.section>
    </div>
  );
};

export default AdminConversionTracker;

export const pageMetadata = {
  path: '/app/admin/conversion-tracker',
  label: 'conversion_tracker.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 7,
  locations: ['sidebar'],
  description: 'conversion_tracker.description',
  icon: 'FaTachometerAlt',
};
