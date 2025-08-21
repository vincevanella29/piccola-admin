// /Users/vanellix/piccola_italia_web3/piccola_italia_web3/frontend-vite/src/pages/adminPanel/components/colorsLevel/AdminLevelList.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import useColorData from '../../../../hooks/useColorData';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const COLOR_FIELDS = [
  'background', 'surface', 'surface-secondary', 'surface-tertiary', 'text-primary', 'text-secondary',
  'accent', 'accent-hover', 'error', 'error-hover', 'success', 'border',
  'social-twitter', 'social-discord', 'social-github', 'glow', 'matrix-green', 'vanellix-purple', 'vanellix-cyan'
];

const DEFAULT_COLORS = {
  'dark-background': '#0A0A0A',
  'dark-surface': '#1A1A1A',
  'dark-surface-secondary': '#2A2A2A',
  'dark-surface-tertiary': '#232323',
  'dark-text-primary': '#FFFFFF',
  'dark-text-secondary': '#B0B0B0',
  'dark-accent': '#009246',
  'dark-accent-hover': '#007A3D',
  'dark-error': '#CE2B37',
  'dark-error-hover': '#A8232D',
  'dark-success': '#1DE9B6',
  'dark-border': '#333333',
  'dark-social-twitter': '#009246',
  'dark-social-discord': '#7289DA',
  'dark-social-github': '#FFFFFF',
  'dark-glow': 'rgba(0, 146, 70, 0.3)',
  'dark-matrix-green': '#009246',
  'dark-vanellix-purple': '#CE2B37',
  'dark-vanellix-cyan': '#FFFFFF',
  'light-background': '#F5F5F5',
  'light-surface': '#FFFFFF',
  'light-surface-secondary': '#E5E7EB',
  'light-surface-tertiary': '#D1D5DB',
  'light-text-primary': '#111827',
  'light-text-secondary': '#6B7280',
  'light-accent': '#009246',
  'light-accent-hover': '#007A3D',
  'light-error': '#CE2B37',
  'light-error-hover': '#A8232D',
  'light-success': '#1DE9B6',
  'light-border': '#D1D5DB',
  'light-social-twitter': '#009246',
  'light-social-discord': '#7289DA',
  'light-social-github': '#111827',
  'light-glow': 'rgba(0, 146, 70, 0.3)',
  'light-matrix-green': '#009246',
  'light-vanellix-purple': '#CE2B37',
  'light-vanellix-cyan': '#FFFFFF',
};

const AdminLevelList = ({ appState }) => {
  const { t } = useTranslation();
  const { colorLevels, isLoading, error, success, fetchColorLevelsApi, deleteColorLevel } = useColorData(appState);
  const didFetch = useRef(false);
  const [modalLevel, setModalLevel] = useState(null);

  useEffect(() => {
    if (didFetch.current) return;
    if (appState.token && appState.account) {
      fetchColorLevelsApi();
      didFetch.current = true;
    }
  }, [appState.token, appState.account, fetchColorLevelsApi]);

  const handleDeleteLevel = async (levelId) => {
    try {
      await deleteColorLevel(levelId);
    } catch (err) {
      toast.error(t('admin.color_levels.error_deleting'));
    }
  };

  const openModal = (level) => setModalLevel(level);
  const closeModal = () => setModalLevel(null);

  return (
    <div className="bg-light-surface/30 dark:bg-dark-surface/30 p-6 rounded-xl shadow-neon">
      <ToastContainer position="top-right" autoClose={3000} />
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={20} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-success/20 dark:bg-dark-success/20 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <CheckCircle size={20} className="text-light-success dark:text-dark-success" />
            <span className="text-light-success dark:text-dark-success text-sm sm:text-base">{success}</span>
          </motion.div>
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/30 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <Loader2 size={20} className="text-light-text-secondary dark:text-dark-text-secondary animate-spin" />
            <span className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm sm:text-base">
              {t('admin.loading')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-4 text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <Eye size={24} className="text-light-accent dark:text-dark-accent" />
          {t('admin.color_levels.list')}
        </h2>
        <motion.button
          onClick={fetchColorLevelsApi}
          className="px-4 py-2 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all disabled:opacity-50 transform hover:scale-105 mb-4 text-sm sm:text-base shadow-neon"
          disabled={isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('admin.color_levels.update_list')}
        </motion.button>
        {colorLevels.length === 0 ? (
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
            {t('admin.color_levels.no_levels')}
          </p>
        ) : (
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full table-fixed border-collapse max-w-full">
              <thead>
                <tr className="bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50">
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.color_levels.level')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.color_levels.min_tokens')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.color_levels.token_address')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.color_levels.colors')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.color_levels.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {colorLevels.map((level) => (
                  <tr
                    key={level.id}
                    className="border-b border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40"
                  >
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {level.level}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      {level.minTokens}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem] font-mono">
                      {level.tokenAddress}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                      <motion.button
                        onClick={() => openModal(level)}
                        className="px-3 py-1 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary rounded-lg hover:bg-light-accent/30 dark:hover:bg-dark-accent/30 transition text-xs sm:text-sm shadow-neon"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Eye size={16} className="inline mr-1" />
                        {t('admin.color_levels.view')}
                      </motion.button>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm">
                      <motion.button
                        onClick={() => handleDeleteLevel(level.id)}
                        disabled={isLoading}
                        className="px-3 py-1 bg-light-error/20 dark:bg-dark-error/20 text-light-error dark:text-dark-error rounded-lg hover:bg-light-error/30 dark:hover:bg-dark-error/30 transition disabled:opacity-50 text-xs sm:text-sm shadow-neon-error"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {t('admin.color_levels.delete')}
                      </motion.button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-light-surface/90 dark:bg-dark-surface/90 p-8 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-neon backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-6 text-light-text-primary dark:text-dark-text-primary">
                {t('admin.color_levels.palette_preview', { level: modalLevel.level })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
                    {t('admin.color_levels.dark_theme')}
                  </h4>
                  {COLOR_FIELDS.map((field) => (
                    <div key={`dark-${field}`} className="flex items-center gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-xl border border-light-border/20 dark:border-dark-border/20 shadow-neon"
                        style={{ backgroundColor: modalLevel.colors.dark[`dark-${field}`] || DEFAULT_COLORS[`dark-${field}`] }}
                      />
                      <div>
                        <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                          {t(`admin.color_levels.dark_${field}`)}: {modalLevel.colors.dark[`dark-${field}`] || 'Not Set'}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Default: {DEFAULT_COLORS[`dark-${field}`]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
                    {t('admin.color_levels.light_theme')}
                  </h4>
                  {COLOR_FIELDS.map((field) => (
                    <div key={`light-${field}`} className="flex items-center gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-xl border border-light-border/20 dark:border-dark-border/20 shadow-neon"
                        style={{ backgroundColor: modalLevel.colors.light[`light-${field}`] || DEFAULT_COLORS[`light-${field}`] }}
                      />
                      <div>
                        <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                          {t(`admin.color_levels.light_${field}`)}: {modalLevel.colors.light[`light-${field}`] || 'Not Set'}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          Default: {DEFAULT_COLORS[`light-${field}`]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <motion.button
                onClick={closeModal}
                className="mt-6 px-6 py-2 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition shadow-neon"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('admin.color_levels.close')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLevelList;