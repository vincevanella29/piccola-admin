import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, PlusCircle, Copy } from 'lucide-react';

const ApiKeyCreate = ({ appState, isLoading, onCreate }) => {
  const [name, setName] = useState('');
  const [expiryMonths, setExpiryMonths] = useState(''); // '' means infinite
  const [created, setCreated] = useState(null); // guarda la respuesta con api_key

  const t = appState?.t || ((k) => k);

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    try {
      const months = expiryMonths === '' ? null : Number(expiryMonths);
      const resp = await onCreate?.({ name, expiryMonths: months });
      setCreated(resp || null);
      setName('');
      setExpiryMonths('');
    } catch (err) {
      // setError lo maneja el hook
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      appState?.setSuccess?.(t('common.copied') || 'Copied');
    } catch (_) {}
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
        <KeyRound size={18} className="text-light-accent dark:text-dark-accent" />
        {t('apikeys.create_title') || 'Create API Key'}
      </h2>

      <form onSubmit={handleCreate} className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('apikeys.name_label') || 'Name'}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('apikeys.name_ph') || 'Backoffice, CI, Integrations...'}
            className="px-3 py-2 rounded-lg bg-light-surface/70 dark:bg-dark-surface/70 border border-light-border/20 dark:border-dark-border/20 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-vanellix-cyan"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('apikeys.expiry_label') || 'Expiration'}</label>
          <select
            value={expiryMonths}
            onChange={(e) => setExpiryMonths(e.target.value)}
            className="px-3 py-2 rounded-lg bg-light-surface/70 dark:bg-dark-surface/70 border border-light-border/20 dark:border-dark-border/20 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-vanellix-cyan"
          >
            <option value="">{t('apikeys.expiry_never') || 'Never'}</option>
            <option value="1">{t('apikeys.expiry_1m') || '1 month'}</option>
            <option value="3">{t('apikeys.expiry_3m') || '3 months'}</option>
            <option value="6">{t('apikeys.expiry_6m') || '6 months'}</option>
            <option value="12">{t('apikeys.expiry_12m') || '12 months'}</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || !name}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary shadow-neon flex items-center gap-2 disabled:opacity-60"
          >
            <PlusCircle size={18} /> {t('apikeys.create_btn') || 'Create'}
          </button>
        </div>
      </form>

      {created?.api_key && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-amber-400/30 bg-amber-500/5 text-amber-300"
        >
          <div className="font-medium mb-2">{t('apikeys.copy_once') || 'Copy this API key now; it will not be shown again:'}</div>
          <div className="flex items-center justify-between gap-2">
            <code className="text-sm break-all">{created.api_key}</code>
            <button
              onClick={() => copyToClipboard(created.api_key)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center gap-2"
            >
              <Copy size={16} /> {t('common.copy') || 'Copy'}
            </button>
          </div>
          <div className="text-xs mt-2 opacity-80">
            {t('apikeys.expires_at_label') || 'Expires:'} {created?.expires_at ? new Date(created.expires_at).toLocaleString() : (t('apikeys.expiry_never') || 'Never')}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ApiKeyCreate;
