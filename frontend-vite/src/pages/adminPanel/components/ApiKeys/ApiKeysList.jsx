import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Trash2, RefreshCw } from 'lucide-react';

const ApiKeysList = ({ appState, isLoading, keys = [], onRefresh, onRevoke }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <KeyRound size={18} className="text-light-accent dark:text-dark-accent" />
          {appState?.t?.('apikeys.my_keys') || 'My API Keys'}
        </h2>
        <button
          onClick={() => onRefresh?.()}
          className="px-3 py-2 text-sm rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 flex items-center gap-2"
        >
          <RefreshCw size={16} /> {appState?.t?.('common.refresh') || 'Refresh'}
        </button>
      </div>

      <div className="grid gap-3">
        <AnimatePresence>
          {keys.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 rounded-lg border border-light-border/20 dark:border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary"
            >
              {appState?.t?.('apikeys.empty') || 'No API keys yet.'}
            </motion.div>
          )}

          {keys.map((k) => {
            const id = k?.id || k?._id || k?.key_id;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-lg border border-light-border/20 dark:border-dark-border/20 bg-light-surface/70 dark:bg-dark-surface/70 flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{id}</span>
                  <span className="text-base font-medium text-light-text-primary dark:text-dark-text-primary">{k?.name || '-'}</span>
                  <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {(appState?.t?.('apikeys.expires_at_label') || 'Expires:') + ' '}
                    {k?.expires_at ? new Date(k.expires_at).toLocaleString() : (appState?.t?.('apikeys.expiry_never') || 'Never')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isLoading}
                    onClick={() => onRevoke?.({ keyId: id })}
                    className="px-3 py-2 text-sm rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center gap-2"
                    title={appState?.t?.('apikeys.revoke') || 'Revoke'}
                  >
                    <Trash2 size={16} /> {appState?.t?.('apikeys.revoke') || 'Revoke'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ApiKeysList;
