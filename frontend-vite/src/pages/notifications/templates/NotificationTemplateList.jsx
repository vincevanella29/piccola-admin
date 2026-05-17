// src/pages/notifications/templates/NotificationTemplateList.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bell, PlusCircle, Edit3, Trash2, Users, Radio, Globe, Image } from 'lucide-react';

const TARGET_BADGES = {
  user: { label: 'User', color: 'bg-blue-500/10 text-blue-500', icon: Users },
  topic: { label: 'Topic', color: 'bg-purple-500/10 text-purple-500', icon: Radio },
  all: { label: 'All', color: 'bg-matrix-green/10 text-matrix-green', icon: Globe },
};

const NotificationTemplateList = ({ appState, templates = [], triggersConfig, loading, onCreate, onEdit, onDelete }) => {
  const { t } = useTranslation();

  const allTriggers = React.useMemo(() => {
    if (!triggersConfig) return [];
    return [...(triggersConfig.customers || []), ...(triggersConfig.employees || [])];
  }, [triggersConfig]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-light-text-primary dark:text-white">
            {t('notifications.types_list') || 'Notification Templates'}
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-gray-400 mt-1">
            {t('notifications.templates_desc') || 'Configure push notification templates for different events'}
          </p>
        </div>
        <button
          onClick={onCreate}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 font-bold text-sm"
        >
          <PlusCircle size={18} />
          {t('notifications.create_type') || 'New Template'}
        </button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {templates.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="sm:col-span-2 lg:col-span-3 p-12 rounded-3xl border border-dashed border-light-border/30 dark:border-white/20 text-center flex flex-col items-center justify-center gap-4 text-light-text-secondary dark:text-gray-400"
            >
              <Bell size={40} className="opacity-40" />
              <p className="text-sm font-medium">{t('notifications.no_types') || 'No notification templates yet.'}</p>
              <button
                onClick={onCreate}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 transition-colors"
              >
                {t('notifications.create_type') || 'Create your first template'}
              </button>
            </motion.div>
          )}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="sm:col-span-2 lg:col-span-3 p-8 flex justify-center"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-matrix-green"></div>
            </motion.div>
          )}

          {templates.map((tpl) => {
            const targetInfo = TARGET_BADGES[tpl.target_type] || TARGET_BADGES.user;
            const TargetIcon = targetInfo.icon;
            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="p-5 rounded-3xl border border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e] shadow-sm hover:shadow-lg transition-all group flex flex-col gap-4"
              >
                {/* Top: Event name + target badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-light-text-primary dark:text-white tracking-tight truncate">
                      {tpl.event_name}
                    </h3>
                    <p className="text-xs font-mono text-light-text-secondary dark:text-gray-500 mt-0.5 truncate">
                      {tpl.target_value || '-'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase font-bold rounded-full tracking-wider ${targetInfo.color}`}>
                      <TargetIcon size={12} />
                      {targetInfo.label}
                    </span>
                    {tpl.trigger_event && (
                      <span className="text-[9px] font-medium text-matrix-green bg-matrix-green/10 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                        {allTriggers.find(t => t.value === tpl.trigger_event)?.emoji || '⚡️'} Rule Bound
                      </span>
                    )}
                  </div>
                </div>

                {/* Preview */}
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-light-border/10 dark:border-white/5 space-y-1.5">
                  <p className="text-sm font-semibold text-light-text-primary dark:text-white truncate">
                    {tpl.title_template || 'No title'}
                  </p>
                  <p className="text-xs text-light-text-secondary dark:text-gray-400 line-clamp-2">
                    {tpl.body_template || 'No body'}
                  </p>
                  {tpl.image_url && (
                    <div className="flex items-center gap-1.5 text-xs text-vanellix-cyan mt-1">
                      <Image size={12} /> Image attached
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-2 border-t border-light-border/10 dark:border-white/5">
                  <button
                    onClick={() => onEdit(tpl)}
                    className="flex-1 px-3 py-2 text-sm font-semibold rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-light-text-primary dark:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 size={14} /> {t('common.edit') || 'Edit'}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('notifications.confirm_delete_template') || 'Delete this template?')) {
                        onDelete(tpl.id);
                      }
                    }}
                    className="px-3 py-2 text-sm font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} />
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

export default NotificationTemplateList;
