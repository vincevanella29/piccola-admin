import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Settings, Eye } from 'lucide-react';
import useConversionTrackerAdmin from '../../hooks/conversionTracker/useConversionTrackerAdmin.jsx';
import CTProviders from './components/CTProviders.jsx';
import CTAnalytics from './components/CTAnalytics.jsx';
import CTConfig from './components/CTConfig.jsx';
import TrackerPlayground from './components/guides/TrackerPlayground.jsx';
import { X } from 'lucide-react';

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
    realtimeData, fetchRealtimeAnalytics,
    ecosystemProviders, fetchEcosystemProviders, resyncEcosystemProvider,
    analyticsProviders, fetchAnalyticsProviders,
  } = useConversionTrackerAdmin({ token, account, autoLoad: true });

  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('providers');
  const [playgroundProvider, setPlaygroundProvider] = useState(null);

  const tabs = useMemo(() => ([
    { key: 'providers', label: t('conversion_tracker.tabs.providers', 'Providers'), icon: Settings },
    { key: 'analytics', label: t('conversion_tracker.tabs.analytics', 'Analytics'), icon: Gauge },
    { key: 'config', label: t('conversion_tracker.tabs.config', 'Config'), icon: Eye },
  ]), [t]);


  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col relative overflow-hidden bg-light-background dark:bg-dark-background">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-matrix-green/5 to-transparent pointer-events-none"></div>

      <AnimatePresence>
        {playgroundProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-3xl bg-light-surface dark:bg-dark-surface rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-light-border/20 dark:border-dark-border/20 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
                <div>
                  <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    Test Connection: {playgroundProvider.name || playgroundProvider.service}
                  </h3>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Interactive simulator to verify events.</p>
                </div>
                <button
                  onClick={() => setPlaygroundProvider(null)}
                  className="p-2 bg-light-surface dark:bg-dark-surface rounded-full hover:bg-red-500/20 hover:text-red-500 border border-light-border/40 dark:border-dark-border/40 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 bg-light-surface dark:bg-dark-surface h-[500px]">
                <TrackerPlayground
                  service={playgroundProvider.service}
                  trackerId={playgroundProvider.credentials?.pixel_id || playgroundProvider.credentials?.measurementId || playgroundProvider.analytics_settings?.ga4_property_id}
                  eventsFired={[]}
                  onFireEvent={() => { }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8 relative z-10"
      >
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-matrix-green to-vanellix-cyan mb-2 flex items-center justify-center gap-3">
          <Gauge className="text-matrix-green" size={36} />
          {t('conversion_tracker.title')}
        </h1>
        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base max-w-2xl mx-auto">
          Centralized command center for managing Meta Pixel, Google Analytics (GA4), Firebase, and other marketing integrations across the entire ecosystem.
        </p>
      </motion.div>

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
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold ${activeTab === tab.key
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
            ecosystemProviders={[...ecosystemProviders, { slug: 'admin', name: 'Admin Panel (Self)', domain: window.location.host }]}
            onTestProvider={(p) => setPlaygroundProvider(p)}
          />
        )}
        {activeTab === 'analytics' && (
          <CTAnalytics
            providers={providers}
            realtimeData={realtimeData}
            fetchRealtimeAnalytics={fetchRealtimeAnalytics}
            loading={loading}
            setActiveTab={setActiveTab}
            ecosystemProviders={[...ecosystemProviders, { slug: 'admin', name: 'Admin Panel (Self)', domain: window.location.host }]}
            analyticsProviders={analyticsProviders}
          />
        )}
        {activeTab === 'config' && (
          <CTConfig
            loading={loading}
            error={error}
            config={config}
            providersById={providersById}
            onRefresh={refreshAll}
            ecosystemProviders={ecosystemProviders}
            resyncEcosystemProvider={resyncEcosystemProvider}
            conversionProviders={providers}
            onUpdateProvider={updateProvider}
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
  category: 'marketing.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 7,
  locations: ['sidebar'],
  description: 'conversion_tracker.description',
  icon: 'FaTachometerAlt',
};
