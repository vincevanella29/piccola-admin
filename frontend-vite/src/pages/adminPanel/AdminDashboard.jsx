import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Database, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import useAdminData from '../../hooks/useAdminData';
import AdminUsers from './components/Dashboard/AdminUsers';
import AdminCollections from './components/Dashboard/AdminCollections';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AdminDashboard = ({ appState }) => {
  const { t } = useTranslation();
  const {
    fetchUsersApi,
    fetchDbCollections,
    isLoading,
    error,
    success
  } = useAdminData(appState);
  const [activeTab, setActiveTab] = useState('users');
  const [fetchedTabs, setFetchedTabs] = useState({
    users: false,
    collections: false
  });

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    if (!fetchedTabs[tabKey]) {
      if (tabKey === 'users') fetchUsersApi();
      else if (tabKey === 'collections') fetchDbCollections();
      setFetchedTabs((prev) => ({ ...prev, [tabKey]: true }));
    }
  };

  useEffect(() => {
    if (appState.accessToken && appState.account) {
      fetchUsersApi();
      setFetchedTabs((prev) => ({ ...prev, users: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [
    { key: 'users', label: t('admin.users.label'), icon: Users },
    { key: 'collections', label: t('admin.collections.label'), icon: Database }
  ];

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2 sm:gap-3"
      >
        <Users className="text-light-accent dark:text-dark-accent" size={24} sm={28} lg={36} />
        {t('admin.dashboard')}
      </motion.h1>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2"
          >
            <AlertTriangle size={18} sm={20} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-success/20 dark:bg-dark-success/20 rounded-lg flex items-center gap-2"
          >
            <CheckCircle size={18} sm={20} className="text-light-success dark:text-dark-success" />
            <span className="text-light-success dark:text-dark-success text-sm sm:text-base">{success}</span>
          </motion.div>
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-lg flex items-center gap-2"
          >
            <Loader2 size={18} sm={20} className="text-light-text-secondary dark:text-dark-text-secondary animate-spin" />
            <span className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm sm:text-base">
              {t('admin.loading')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="flex justify-center mb-6 sm:mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 bg-light-surface/50 dark:bg-dark-surface/50 p-2 sm:p-3 rounded-xl border border-light-border/20 dark:border-dark-border/20 w-full max-w-md sm:max-w-lg">
          {tabs.map((tab) => (
            <motion.button
              key={tab.key}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold ${
                activeTab === tab.key
                  ? 'bg-light-accent dark:bg-dark-accent text-white'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/10 dark:hover:bg-dark-accent/10'
              }`}
              onClick={() => handleTabClick(tab.key)}
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
        className="mx-auto w-full max-w-4xl rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-4 sm:p-6 shadow-neon backdrop-blur-md"
      >
        {activeTab === 'users' && <AdminUsers appState={appState} />}
        {activeTab === 'collections' && <AdminCollections appState={appState} />}
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

export default AdminDashboard;

export const pageMetadata = {
  path: '/app/admin',
  label: 'admin.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 2,
  orderWalletMenu: 0,
  locations: ['sidebar', 'walletMenu'],
  description: 'admin.description',
  icon: 'FaShieldAlt',
};