// src/pages/adminPanel/components/promotions/AdminApiKeys.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CommandLineIcon, 
  ClipboardDocumentIcon, 
  ClipboardDocumentCheckIcon,
  EyeIcon, 
  EyeSlashIcon, 
  KeyIcon, 
  ClockIcon, 
  PlusIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

// Sub-componente para cada Tarjeta de API Key
const ApiKeyCard = ({ api, isVisible, onToggle, onCopy, t }) => {
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = () => {
    onCopy(api.token);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const isExpired = api.expires_at && new Date(api.expires_at) < new Date();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative p-5 rounded-2xl border transition-all duration-300 ${
        isExpired 
          ? 'bg-light-surface/50 dark:bg-dark-surface/50 border-light-error/20 dark:border-dark-error/20' 
          : 'bg-light-surface dark:bg-dark-surface border-light-border/20 dark:border-dark-border/20 hover:border-matrix-green/30 hover:shadow-lg hover:shadow-matrix-green/5'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Token Info & Value */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isExpired ? 'bg-light-error/10 text-light-error' : 'bg-matrix-green/10 text-matrix-green'}`}>
              <KeyIcon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                {t('promotion.api_token_title')}
                {isExpired && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-light-error/10 text-light-error">
                    {t('promotion.expired') || 'Expirado'}
                  </span>
                )}
              </h4>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                {t('promotion.expires')}: {api.expires_at ? new Date(api.expires_at).toLocaleDateString() : t('promotion.forever')}
              </p>
            </div>
          </div>

          {/* Code Block */}
          <div className="relative group/code">
            <div className={`
              w-full p-3 rounded-xl font-mono text-sm break-all transition-colors
              ${isVisible 
                ? 'bg-light-surface-secondary dark:bg-black/30 text-matrix-green' 
                : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary select-none'
              }
            `}>
              {isVisible ? api.token : 'sk_live_••••••••••••••••••••••••••••••••'}
            </div>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
            title={isVisible ? t('promotion.toggle_hide') : t('promotion.toggle_show')}
          >
            {isVisible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
          
          <button
            onClick={handleCopy}
            className={`p-2 rounded-lg transition-all duration-300 flex items-center gap-2 ${
              justCopied 
                ? 'bg-matrix-green text-light-text-primary' 
                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary hover:bg-matrix-green/20 hover:text-matrix-green'
            }`}
          >
            {justCopied ? (
              <>
                <ClipboardDocumentCheckIcon className="h-5 w-5" />
                <span className="text-xs font-bold hidden md:inline">{t('promotion.copied')}</span>
              </>
            ) : (
              <ClipboardDocumentIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// --- COMPONENTE PRINCIPAL ---
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
      await loadApiTokens();
    } catch (err) {
      setFormError(t('promotion.error_generating_api', { message: err.message }));
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Podrías usar un toast aquí si appState.setSuccess no es suficiente visualmente
  };

  const toggleVisibility = (id) => {
    setVisibleTokens((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-light-border/20 dark:border-dark-border/20 pb-6">
        <div>
          <h2 className="text-2xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <CommandLineIcon className="h-8 w-8 text-matrix-green" />
            {t('promotion.api_keys')}
          </h2>
          <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xl">
            {t('promotion.api_keys_description')}
          </p>
        </div>
      </div>

      {/* Generator Toolbar */}
      <div className="bg-light-surface dark:bg-dark-surface p-1.5 rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-sm flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <ClockIcon className="h-5 w-5 text-light-text-secondary dark:text-dark-text-secondary" />
          </div>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-transparent text-light-text-primary dark:text-dark-text-primary text-sm font-medium focus:outline-none cursor-pointer hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 rounded-xl transition-colors appearance-none"
          >
            <option value="1m">{t('promotion.1_month')} {t('promotion.duration_recommended_suffix')}</option>
            <option value="6m">{t('promotion.6_months')}</option>
            <option value="1y">{t('promotion.1_year')}</option>
            <option value="forever">⚠️ {t('promotion.forever')} {t('promotion.duration_forever_warning_suffix')}</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
             <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">▼</span>
          </div>
        </div>
        
        <button
          onClick={generateNewApiToken}
          disabled={generating || isLoading}
          className="px-6 py-3 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-light-text-primary font-bold text-sm rounded-xl hover:shadow-[0_0_15px_rgba(var(--matrix-green-rgb),0.4)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {generating ? (
             <>
               <motion.div 
                 animate={{ rotate: 360 }} 
                 transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                 className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
               />
               {t('promotion.generating')}
             </>
          ) : (
             <>
               <PlusIcon className="h-5 w-5" />
               {t('promotion.generate')}
             </>
          )}
        </button>
      </div>

      {/* List Section */}
      <div className="space-y-4 min-h-[300px]">
        {loadingTokens ? (
          // Skeleton Loading
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-2xl animate-pulse border border-light-border/10 dark:border-dark-border/10" />
          ))
        ) : apiTokens.length > 0 ? (
          <AnimatePresence>
            {apiTokens.map((api) => (
              <ApiKeyCard 
                key={api._id}
                api={api}
                isVisible={visibleTokens[api._id]}
                onToggle={() => toggleVisibility(api._id)}
                onCopy={copyToClipboard}
                t={t}
              />
            ))}
          </AnimatePresence>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-light-border/20 dark:border-dark-border/20 rounded-3xl bg-light-surface/30 dark:bg-dark-surface/30"
          >
            <div className="p-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full mb-4">
              <SparklesIcon className="h-8 w-8 text-matrix-green" />
            </div>
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
              {t('promotion.no_token')}
            </h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs">
              {t('promotion.generate_first_token_help')}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminApiKeys;