import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Palette, Eye, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import useColorData from '../../hooks/useColorData';
import AdminLevelConfig from './components/colorsLevel/AdminLevelConfig';
import AdminDarkTheme from './components/colorsLevel/AdminDarkTheme';
import AdminLightTheme from './components/colorsLevel/AdminLightTheme';
import AdminLevelList from './components/colorsLevel/AdminLevelList';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ethers } from 'ethers';

const COLOR_FIELDS = [
  'background', 'surface', 'surface-secondary', 'surface-tertiary', 'text-primary', 'text-secondary',
  'accent', 'accent-hover', 'error', 'error-hover', 'success', 'border',
  'social-twitter', 'social-discord', 'social-github', 'glow', 'matrix-green', 'vanellix-purple', 'vanellix-cyan'
];

const ColorLevelDashboard = ({ appState }) => {
  const { t } = useTranslation();
  const { fetchColorLevelsApi, createColorLevel, isLoading, error, success } = useColorData(appState);
  const [activeTab, setActiveTab] = useState('levelConfig');
  const [fetchedTabs, setFetchedTabs] = useState({ levelConfig: true, darkTheme: false, lightTheme: false, levelList: false });
  const [formData, setFormData] = useState({
    level: '',
    minTokens: '',
    tokenAddress: '',
    colors: {
      dark: COLOR_FIELDS.reduce((acc, field) => ({ ...acc, [`dark-${field}`]: '' }), {}),
      light: COLOR_FIELDS.reduce((acc, field) => ({ ...acc, [`light-${field}`]: '' }), {}),
    },
  });
  const [formError, setFormError] = useState(null);

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    setFetchedTabs((prev) => ({ ...prev, [tabKey]: true }));
  };

  const handleConfigChange = (updates) => {
    setFormError(null);
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleCreateLevel = async () => {
    setFormError(null);
    if (!formData.level || !formData.minTokens || !formData.tokenAddress) {
      setFormError(t('admin.color_levels.incomplete'));
      return;
    }
    if (!ethers.isAddress(formData.tokenAddress)) {
      setFormError(t('admin.color_levels.invalid_address'));
      return;
    }
    if (isNaN(formData.level) || isNaN(formData.minTokens) || formData.level < 0 || formData.minTokens < 0) {
      setFormError(t('admin.color_levels.invalid_values'));
      return;
    }
    const allColorsFilled = COLOR_FIELDS.every(
      (field) => formData.colors.dark[`dark-${field}`] && formData.colors.light[`light-${field}`]
    );
    if (!allColorsFilled) {
      setFormError(t('admin.color_levels.all_colors_required'));
      return;
    }
    try {
      await createColorLevel({
        level: parseInt(formData.level),
        minTokens: parseFloat(formData.minTokens),
        tokenAddress: ethers.getAddress(formData.tokenAddress),
        colors: formData.colors,
      });
      setFormData({
        level: '',
        minTokens: '',
        tokenAddress: '',
        colors: {
          dark: COLOR_FIELDS.reduce((acc, field) => ({ ...acc, [`dark-${field}`]: '' }), {}),
          light: COLOR_FIELDS.reduce((acc, field) => ({ ...acc, [`light-${field}`]: '' }), {}),
        },
      });
      setActiveTab('levelConfig');
    } catch (err) {
      setFormError(err.message || t('admin.color_levels.error_creating'));
    }
  };

  useEffect(() => {
    if (appState.accessToken && appState.account) {
      fetchColorLevelsApi();
      setFetchedTabs((prev) => ({ ...prev, levelList: true }));
    }
  }, [appState.accessToken, appState.account, fetchColorLevelsApi]);

  const tabs = [
    { key: 'levelConfig', label: t('admin.color_levels.level_config'), icon: Settings },
    { key: 'darkTheme', label: t('admin.color_levels.dark_theme'), icon: Palette },
    { key: 'lightTheme', label: t('admin.color_levels.light_theme'), icon: Palette },
    { key: 'levelList', label: t('admin.color_levels.list'), icon: Eye },
  ];

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2 sm:gap-3"
      >
        <Palette className="text-light-accent dark:text-dark-accent" size={24} sm={28} lg={36} />
        {t('admin.color_levels.dashboard')}
      </motion.h1>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
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
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-success/20 dark:bg-dark-success/20 rounded-lg flex items-center gap-2 shadow-neon"
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
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <Loader2 size={18} sm={20} className="text-light-text-secondary dark:text-dark-text-secondary animate-spin" />
            <span className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm sm:text-base">
              {t('admin.loading')}
            </span>
          </motion.div>
        )}
        {formError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={18} sm={20} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base">{formError}</p>
          </motion.div>
        )}
      </AnimatePresence>

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
        className="mx-auto w-full max-w-4xl rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-4 sm:p-6 shadow-neon backdrop-blur-md bg-light-surface/90 dark:bg-dark-surface/90"
      >
        {activeTab === 'levelConfig' && (
          <AdminLevelConfig
            appState={appState}
            onConfigChange={handleConfigChange}
            formData={formData}
            formError={formError}
            setFormError={setFormError}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'darkTheme' && (
          <AdminDarkTheme
            appState={appState}
            onConfigChange={handleConfigChange}
            formData={formData}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'lightTheme' && (
          <AdminLightTheme
            appState={appState}
            onConfigChange={handleConfigChange}
            formData={formData}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'levelList' && <AdminLevelList appState={appState} />}
        {activeTab !== 'levelList' && (
          <motion.div
            className="mt-6 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.button
              onClick={handleCreateLevel}
              disabled={isLoading}
              className="px-4 sm:px-6 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('admin.color_levels.create_button')}
            </motion.button>
          </motion.div>
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

export default ColorLevelDashboard;

export const pageMetadata = {
  path: '/app/color-levels',
  label: 'admin.color_levels.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 9,
  locations: ['sidebar'],
  description: 'admin.color_levels.description',
  icon: 'FaPalette',
};