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
    <div className="space-y-8 max-w-2xl mx-auto font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-light-border/10 dark:border-white/10">
        <h2 className="text-2xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center shadow-md shadow-matrix-green/20">
            <KeyRound size={20} className="text-white" />
          </div>
          {t('apikeys.create_title') || 'Create API Key'}
        </h2>
      </div>

      <form onSubmit={handleCreate} className="grid gap-6 p-6 sm:p-8 rounded-3xl bg-light-surface/50 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-sm">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.name_label') || 'Name'}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('apikeys.name_ph') || 'Backoffice, CI, Integrations...'}
            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('apikeys.expiry_label') || 'Expiration'}</label>
          <select
            value={expiryMonths}
            onChange={(e) => setExpiryMonths(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none transition-all shadow-sm"
          >
            <option value="">{t('apikeys.expiry_never') || 'Never'}</option>
            <option value="1">{t('apikeys.expiry_1m') || '1 month'}</option>
            <option value="3">{t('apikeys.expiry_3m') || '3 months'}</option>
            <option value="6">{t('apikeys.expiry_6m') || '6 months'}</option>
            <option value="12">{t('apikeys.expiry_12m') || '12 months'}</option>
          </select>
        </div>

        <div className="flex justify-end pt-4 border-t border-light-border/10 dark:border-white/5">
          <button
            type="submit"
            disabled={isLoading || !name}
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none font-bold text-base"
          >
            <PlusCircle size={18} /> {t('apikeys.create_btn') || 'Create'}
          </button>
        </div>
      </form>

      {created?.api_key && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="p-6 rounded-3xl border border-vanellix-cyan/30 bg-vanellix-cyan/5 shadow-lg shadow-vanellix-cyan/10"
        >
          <div className="font-semibold text-light-text-primary dark:text-white mb-3 flex items-center gap-2">
            <span className="text-xl">🎉</span> {t('apikeys.copy_once') || 'Copy this API key now; it will not be shown again:'}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-black/30 p-4 rounded-2xl border border-light-border/10 dark:border-white/5">
            <code className="text-sm font-mono break-all text-light-text-primary dark:text-vanellix-cyan font-bold">{created.api_key}</code>
            <button
              onClick={() => copyToClipboard(created.api_key)}
              className="px-6 py-2.5 rounded-xl bg-vanellix-cyan/10 hover:bg-vanellix-cyan/20 text-vanellix-cyan dark:text-vanellix-cyan flex items-center justify-center gap-2 font-semibold transition-all"
            >
              <Copy size={16} /> {t('common.copy') || 'Copy'}
            </button>
          </div>
          <div className="text-xs mt-4 opacity-70 text-light-text-secondary dark:text-gray-400 font-medium">
            {t('apikeys.expires_at_label') || 'Expires:'} {created?.expires_at ? new Date(created.expires_at).toLocaleString() : (t('apikeys.expiry_never') || 'Never')}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ApiKeyCreate;
