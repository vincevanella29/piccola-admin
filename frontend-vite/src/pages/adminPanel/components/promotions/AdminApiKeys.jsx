// src/pages/adminPanel/components/promotions/AdminApiKeys.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ClipboardIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';

const AdminApiKeys = ({ appState, fetchApiToken, generateApiToken, isLoading, setFormError }) => {
  const { t } = useTranslation();
  const [apiTokens, setApiTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [duration, setDuration] = useState('1m');
  const [visibleTokens, setVisibleTokens] = useState({});

  const loadApiTokens = async () => {
    setLoadingTokens(true);
    try {
      const response = await fetchApiToken();
      setApiTokens(response || []);
    } catch (err) {
      setApiTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    loadApiTokens();
  }, []);

  const generateNewApiToken = async () => {
    setGenerating(true);
    setFormError(null);
    try {
      const wallet = appState.account;
      if (!wallet) {
        setFormError(t('wallet.connect_wallet'));
        return;
      }
      const timestamp = Date.now();
      const plain_data = `Generate API Token for ${wallet} at ${timestamp} with duration ${duration}`;
      const signature = await appState.signTxData(plain_data);
      if (!signature) {
        setFormError(t('wallet.error_transfer'));
        return;
      }
      await generateApiToken({ signature, plain_data, duration });
      appState.setSuccess(t('promotion.api_generated'));
      await loadApiTokens(); // Reload the list after creation
    } catch (err) {
      setFormError(t('promotion.error_generating_api', { message: err.message }));
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    appState.setSuccess(t('promotion.api_copied'));
  };

  const toggleVisibility = (id) => {
    setVisibleTokens((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
        {t('promotion.api_keys')}
      </h2>
      {loadingTokens ? (
        <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
          {t('promotion.loading')}
        </p>
      ) : apiTokens.length > 0 ? (
        <div className="space-y-4">
          {apiTokens.map((api) => (
            <div key={api._id} className="bg-light-surface-secondary dark:bg-dark-surface-secondary p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 p-2 bg-light-surface dark:bg-dark-surface rounded text-light-text-primary dark:text-dark-text-primary break-all">
                  {visibleTokens[api._id] ? api.token : '****************************************'}
                </code>
                <button
                  onClick={() => toggleVisibility(api._id)}
                  className="p-2 text-matrix-green hover:text-vanellix-cyan transition-colors"
                >
                  {visibleTokens[api._id] ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => copyToClipboard(api.token)}
                  className="p-2 text-matrix-green hover:text-vanellix-cyan transition-colors"
                >
                  <ClipboardIcon className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {t('promotion.created_at')}: {new Date(api.created_at).toLocaleString()}
              </p>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {t('promotion.expires')}: {api.expires_at ? new Date(api.expires_at).toLocaleString() : t('promotion.forever')}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
          {t('promotion.no_token')}
        </p>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
          {t('promotion.duration')}
        </label>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full p-2 bg-light-surface dark:bg-dark-surface rounded text-light-text-primary dark:text-dark-text-primary"
        >
          <option value="1m">{t('promotion.1_month')}</option>
          <option value="6m">{t('promotion.6_months')}</option>
          <option value="1y">{t('promotion.1_year')}</option>
          <option value="forever">{t('promotion.forever')}</option>
        </select>
        <button
          onClick={generateNewApiToken}
          disabled={generating || isLoading}
          className="w-full px-4 py-2 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {generating ? t('promotion.generating') : t('promotion.generate')}
        </button>
      </div>
    </motion.div>
  );
};

export default AdminApiKeys;