// /Users/vanellix/piccola_italia_web3/piccola_italia_web3/frontend-vite/src/pages/adminPanel/components/colorsLevel/AdminLevelConfig.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings } from 'lucide-react';
import InfoTooltip from '../../../../components/common/Tools/InfoTooltip';
import { ethers } from 'ethers';

const AdminLevelConfig = ({ appState, onConfigChange, formData, formError, setFormError, isLoading }) => {
  const { t } = useTranslation();
  const userRoleLevel = appState?.roleLevel ?? null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormError(null);
    onConfigChange({ [name]: value });
  };

  if (userRoleLevel < 3) {
    return (
      <div className="p-4 text-light-error dark:text-dark-error bg-light-error/20 dark:bg-dark-error/20 rounded-lg shadow-neon-error">
        {t('admin.form.no_permission')}
      </div>
    );
  }

  return (
    <div className="bg-light-surface/30 dark:bg-dark-surface/30 p-6 rounded-xl shadow-neon">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
        <Settings size={24} className="text-light-accent dark:text-dark-accent" />
        {t('admin.color_levels.level_config')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 flex items-center gap-1">
            {t('admin.color_levels.level')}
            <InfoTooltip text={t('admin.color_levels.level_tooltip')} />
          </label>
          <input
            type="number"
            name="level"
            value={formData.level}
            onChange={handleInputChange}
            placeholder={t('admin.color_levels.level_placeholder')}
            className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent text-sm transition-all"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 flex items-center gap-1">
            {t('admin.color_levels.min_tokens')}
            <InfoTooltip text={t('admin.color_levels.min_tokens_tooltip')} />
          </label>
          <input
            type="number"
            name="minTokens"
            value={formData.minTokens}
            onChange={handleInputChange}
            placeholder={t('admin.color_levels.min_tokens_placeholder')}
            className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent text-sm transition-all"
            disabled={isLoading}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 flex items-center gap-1">
            {t('admin.color_levels.token_address')}
            <InfoTooltip text={t('admin.color_levels.token_address_tooltip')} />
          </label>
          <input
            type="text"
            name="tokenAddress"
            value={formData.tokenAddress}
            onChange={handleInputChange}
            placeholder={t('admin.color_levels.token_address_placeholder')}
            className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent text-sm font-mono transition-all"
            disabled={isLoading}
          />
        </div>
      </div>
      <AnimatePresence>
        {formError && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-2 text-light-error dark:text-dark-error text-sm"
          >
            {formError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLevelConfig;