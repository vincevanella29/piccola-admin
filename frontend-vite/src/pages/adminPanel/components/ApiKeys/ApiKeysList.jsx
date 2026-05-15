import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Trash2, RefreshCw } from 'lucide-react';

const ApiKeysList = ({ appState, isLoading, keys = [], onRefresh, onRevoke }) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-light-border/10 dark:border-white/10">
        <h2 className="text-2xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center shadow-md shadow-matrix-green/20">
            <KeyRound size={20} className="text-white" />
          </div>
          {appState?.t?.('apikeys.my_keys') || 'My API Keys'}
        </h2>
        <button
          onClick={() => onRefresh?.()}
          className="px-4 py-2 text-sm font-semibold rounded-full bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <RefreshCw size={16} /> <span className="hidden sm:inline">{appState?.t?.('common.refresh') || 'Refresh'}</span>
        </button>
      </div>

      <div className="grid gap-4">
        <AnimatePresence>
          {keys.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 rounded-3xl border border-dashed border-light-border/30 dark:border-white/20 text-center flex flex-col items-center justify-center gap-3 text-light-text-secondary dark:text-gray-400"
            >
              <KeyRound size={32} className="opacity-50" />
              <p className="text-sm font-medium">{appState?.t?.('apikeys.empty') || 'No API keys yet.'}</p>
            </motion.div>
          )}

          {keys.map((k) => {
            const id = k?.id || k?._id || k?.key_id;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={`p-5 sm:p-6 rounded-3xl border ${!k.active ? 'border-red-500/10 bg-red-500/5 dark:bg-red-500/5' : 'border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e]'} shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 group`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-semibold tracking-tight ${!k.active ? 'text-red-500 line-through opacity-70' : 'text-light-text-primary dark:text-white'}`}>{k?.name || '-'}</span>
                    {!k.active ? (
                      <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-full tracking-wider bg-red-500/10 text-red-500">Revoked</span>
                    ) : (
                      <span className="px-2.5 py-1 text-[10px] uppercase font-bold rounded-full tracking-wider bg-matrix-green/10 text-matrix-green">Active</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-light-text-secondary dark:text-gray-400">
                    <span className={`font-mono text-xs px-2 py-1 rounded-md ${!k.active ? 'bg-red-500/10 text-red-400' : 'bg-black/5 dark:bg-white/10 text-light-text-primary dark:text-white'}`}>{id}</span>
                  </div>
                  <div className="text-xs mt-1 flex flex-col sm:flex-row gap-2 sm:gap-4 opacity-70 text-light-text-secondary dark:text-gray-400 font-medium">
                    <span>{(appState?.t?.('apikeys.expires_at_label') || 'Expires:') + ' '} {k?.expires_at ? new Date(k.expires_at).toLocaleString() : (appState?.t?.('apikeys.expiry_never') || 'Never')}</span>
                  </div>
                </div>
                
                {k.active && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      disabled={isLoading}
                      onClick={() => {
                        if (window.confirm('Are you sure you want to revoke this key?')) {
                          onRevoke?.({ keyId: id });
                        }
                      }}
                      className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-2"
                      title={appState?.t?.('apikeys.revoke') || 'Revoke'}
                    >
                      <Trash2 size={16} /> <span className="hidden sm:inline">{appState?.t?.('apikeys.revoke') || 'Revoke'}</span>
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ApiKeysList;
