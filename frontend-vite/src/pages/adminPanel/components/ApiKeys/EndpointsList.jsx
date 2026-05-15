import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plug, Trash2, Edit3, ExternalLink, Play, Copy, Database } from 'lucide-react';

const EndpointsList = ({ appState, endpoints, isLoading, onEdit, onDelete, onTest }) => {
  const t = appState?.t || ((k) => k);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      appState?.setSuccess?.(t('common.copied') || 'Copied');
    } catch (_) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-light-border/10 dark:border-white/10">
        <h2 className="text-xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center">
            <Plug size={16} className="text-light-text-primary dark:text-white" />
          </div>
          {t('apikeys.endpoints_title') || 'My Endpoints'}
        </h2>
      </div>

      <div className="grid gap-4">
        <AnimatePresence>
          {endpoints.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 rounded-3xl border border-dashed border-light-border/30 dark:border-white/20 text-center flex flex-col items-center justify-center gap-3 text-light-text-secondary dark:text-gray-400"
            >
              <Database size={32} className="opacity-50" />
              <p className="text-sm font-medium">{t('apikeys.endpoints_empty') || 'No endpoints configured yet.'}</p>
            </motion.div>
          )}

          {endpoints.map((ep) => (
            <motion.div
              key={ep.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="p-5 sm:p-6 rounded-3xl border border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e] shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 group"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-light-text-primary dark:text-white tracking-tight">{ep.name}</span>
                  <span className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-full tracking-wider ${ep.active ? 'bg-matrix-green/10 text-matrix-green' : 'bg-red-500/10 text-red-500'}`}>
                    {ep.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-light-text-secondary dark:text-gray-400">
                  <span className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md text-xs font-semibold text-light-text-primary dark:text-white">{ep.collection_name}</span>
                  <span className="font-mono text-xs truncate max-w-[200px] sm:max-w-xs">/api/v1/data/{ep.slug}</span>
                  <button onClick={() => copyToClipboard(`/api/v1/data/${ep.slug}`)} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-light-text-secondary dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors" title="Copy Path">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  disabled={isLoading}
                  onClick={() => onTest?.(ep)}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-light-text-primary dark:text-white transition-colors flex items-center gap-2"
                  title={t('apikeys.test_endpoint') || 'Test Endpoint'}
                >
                  <Play size={16} /> <span className="hidden sm:inline">{t('apikeys.test') || 'Test'}</span>
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => onEdit?.(ep)}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-light-text-primary dark:text-white transition-colors flex items-center gap-2"
                  title={t('common.edit') || 'Edit'}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => {
                    if (window.confirm(t('apikeys.confirm_delete') || 'Are you sure you want to delete this endpoint?')) {
                      onDelete?.(ep.slug);
                    }
                  }}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors flex items-center gap-2"
                  title={t('common.delete') || 'Delete'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EndpointsList;
