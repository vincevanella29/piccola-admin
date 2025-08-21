import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Palette, RefreshCw } from 'lucide-react';
import InfoTooltip from '../../../../components/common/Tools/InfoTooltip';
import ModernColorPicker from '../../../../components/common/Tools/ModernColorPicker';

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
};

const AdminDarkTheme = ({ appState, onConfigChange, formData, isLoading }) => {
  const { t } = useTranslation();
  const userRoleLevel = appState?.roleLevel ?? null;
  const [activePicker, setActivePicker] = useState(null);

  const handleColorChange = (colorKey, color) => {
    onConfigChange({
      colors: {
        ...formData.colors,
        dark: { ...formData.colors.dark, [colorKey]: color },
      },
    });
  };

  const handleUseDefault = (colorKey) => {
    onConfigChange({
      colors: {
        ...formData.colors,
        dark: { ...formData.colors.dark, [colorKey]: DEFAULT_COLORS[colorKey] },
      },
    });
  };

  if (userRoleLevel < 3) {
    return (
      <div className="p-4 text-light-error dark:text-dark-error bg-light-error/20 dark:bg-dark-error/20 rounded-lg shadow-neon-error">
        {t('admin.form.no_permission')}
      </div>
    );
  }

  return (
    <div className="bg-light-surface/30 dark:bg-dark-surface/30 p-6 rounded-xl shadow-neon relative">
      <motion.button
        onClick={() => {
          onConfigChange({
            colors: {
              ...formData.colors,
              dark: { ...DEFAULT_COLORS },
            },
          });
        }}
        disabled={isLoading}
        className="absolute top-4 right-4 px-4 py-2 rounded-lg bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary font-semibold shadow-neon transition-all text-xs sm:text-sm disabled:opacity-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {t('admin.color_levels.set_all_default')}
      </motion.button>
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
        <Palette size={24} className="text-light-accent dark:text-dark-accent" />
        {t('admin.color_levels.dark_theme')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COLOR_FIELDS.map((field) => {
          const colorKey = `dark-${field}`;
          return (
            <div key={colorKey} className="relative">
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2 flex items-center gap-1">
                {t(`admin.color_levels.dark_${field}`)}
                <InfoTooltip text={t(`admin.color_levels.dark_${field}_tooltip`)} />
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-xl border border-light-border/20 dark:border-dark-border/20 cursor-pointer shadow-neon"
                  style={{ backgroundColor: formData.colors.dark[colorKey] || DEFAULT_COLORS[colorKey] }}
                  onClick={() => setActivePicker(activePicker === colorKey ? null : colorKey)}
                />
                <input
                  type="text"
                  value={formData.colors.dark[colorKey] || ''}
                  onChange={(e) => handleColorChange(colorKey, e.target.value)}
                  placeholder={DEFAULT_COLORS[colorKey] || '#000000'}
                  className="flex-1 p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent text-sm transition-all"
                  disabled={isLoading}
                />
                <motion.button
                  onClick={() => handleUseDefault(colorKey)}
                  disabled={isLoading}
                  className="p-2 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RefreshCw size={16} />
                </motion.button>
              </div>
              {activePicker === colorKey && (
                <div
                  className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
                  onClick={() => setActivePicker(null)}
                >
                  <div onClick={(e) => e.stopPropagation()}>
                    <ModernColorPicker
                      value={formData.colors.dark[colorKey] || DEFAULT_COLORS[colorKey]}
                      onChange={(color) => handleColorChange(colorKey, color)}
                      onClose={() => setActivePicker(null)}
                      showAlpha={true}
                      showFormats={true}
                      previewClass="shadow-neon"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDarkTheme;