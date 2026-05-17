// src/pages/notifications/templates/NotificationTemplateEditor.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, Bell, Smartphone, Image, Users, Radio, Globe, AlertTriangle, Link, Settings } from 'lucide-react';
import { toast } from 'react-toastify';

const DEFAULT_TOKENS = [
  { key: '{{order_number}}', desc: 'Order Number' },
  { key: '{{customer_name}}', desc: 'Customer Name' }
];

const NotificationTemplateEditor = ({ appState, template, apiConfigs, triggersConfig, onSave, onCancel }) => {
  const { t } = useTranslation();
  const isEditing = !!template?.id;

  // Resolve available configs
  const configsList = Array.isArray(apiConfigs) ? apiConfigs : (apiConfigs && Object.keys(apiConfigs).length > 0 ? [apiConfigs] : []);
  const firstConfigId = configsList[0]?.id || '';

  const [form, setForm] = useState({
    event_name: '',
    title_template: '',
    body_template: '',
    icon_url: '',
    image_url: '',
    link_url: '',
    target_type: 'user',
    target_value: '',
    api_config_id: '',
    trigger_event: '',
  });

  const allTriggers = React.useMemo(() => {
    if (!triggersConfig) return [];
    return [...(triggersConfig.customers || []), ...(triggersConfig.employees || [])];
  }, [triggersConfig]);

  const activeTrigger = React.useMemo(() => {
    return allTriggers.find(t => t.value === form.trigger_event) || null;
  }, [allTriggers, form.trigger_event]);

  const availableVariables = activeTrigger?.variables?.length ? activeTrigger.variables : DEFAULT_TOKENS;

  useEffect(() => {
    if (template && template.id) {
      setForm({
        event_name: template.event_name || '',
        title_template: template.title_template || '',
        body_template: template.body_template || '',
        icon_url: template.icon_url || '',
        image_url: template.image_url || '',
        link_url: template.link_url || '',
        target_type: template.target_type || 'user',
        target_value: template.target_value || '',
        api_config_id: template.api_config_id || firstConfigId,
        trigger_event: template.trigger_event || '',
      });
    } else if (firstConfigId && !form.api_config_id) {
      setForm(prev => ({ ...prev, api_config_id: firstConfigId }));
    }
  }, [template, firstConfigId]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const insertVariable = (field, variable) => {
    setForm(prev => ({ ...prev, [field]: prev[field] + variable }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.api_config_id) {
      toast && toast.error('Primero configura Firebase en Settings');
      return;
    }
    onSave(form);
  };

  // Resolve preview with mock data
  const resolvePreview = (text) => {
    return (text || '')
      .replace('{order_id}', '1042')
      .replace('{user_name}', 'Juan Pérez')
      .replace('{total}', '$12.500')
      .replace('{status}', 'En Preparación')
      .replace('{product_name}', 'Pizza Margherita');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-light-border/10 dark:border-white/10">
        <h2 className="text-2xl font-bold tracking-tight text-light-text-primary dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center shadow-md shadow-matrix-green/20">
            <Bell size={20} className="text-white" />
          </div>
          {isEditing ? (t('notifications.edit_template') || 'Edit Template') : (t('notifications.create_type') || 'New Template')}
        </h2>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold rounded-full bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <ArrowLeft size={16} /> {t('common.cancel') || 'Cancel'}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left: Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-3xl bg-light-surface/50 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-sm space-y-5">
            {/* Event Name */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.event_name') || 'Event Name'}</label>
              <input
                required
                value={form.event_name}
                onChange={(e) => handleChange('event_name', e.target.value)}
                placeholder="e.g. new_order, order_delivered"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
              />
            </div>

            {/* Trigger Event Binding */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">Vinculado a la Regla (Opcional)</label>
              <select
                value={form.trigger_event}
                onChange={(e) => handleChange('trigger_event', e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm appearance-none"
              >
                <option value="">-- Template Global (Cualquier Regla) --</option>
                {allTriggers.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
              <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-1">
                Si vinculas este template a una regla específica, te mostraremos sus variables exactas.
              </p>
            </div>

            {/* Title Template */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.title_template') || 'Title Template'}</label>
              <input
                required
                value={form.title_template}
                onChange={(e) => handleChange('title_template', e.target.value)}
                placeholder="e.g. New Order #{order_id}"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
              />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {availableVariables.map((v, i) => (
                  <button
                    key={v.name || v.key || i}
                    type="button"
                    onClick={() => insertVariable('title_template', `{{${v.name || v.key.replace(/[{}]/g, '')}}}`)}
                    className="px-2 py-1 text-[11px] font-mono rounded-lg bg-vanellix-cyan/10 text-vanellix-cyan hover:bg-vanellix-cyan/20 transition-colors tooltip-trigger relative group"
                  >
                    {`{{${v.name || v.key.replace(/[{}]/g, '')}}}`}
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                      {v.desc || v.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Body Template */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.body_template') || 'Body Template'}</label>
              <textarea
                required
                rows={3}
                value={form.body_template}
                onChange={(e) => handleChange('body_template', e.target.value)}
                placeholder="e.g. You have a new order from {user_name} for {total}"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {availableVariables.map((v, i) => (
                  <button
                    key={`body_${v.name || v.key || i}`}
                    type="button"
                    onClick={() => insertVariable('body_template', `{{${v.name || v.key.replace(/[{}]/g, '')}}}`)}
                    className="px-2 py-1 text-[11px] font-mono rounded-lg bg-vanellix-cyan/10 text-vanellix-cyan hover:bg-vanellix-cyan/20 transition-colors tooltip-trigger relative group"
                  >
                    {`{{${v.name || v.key.replace(/[{}]/g, '')}}}`}
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                      {v.desc || v.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Icon URL */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
                <Image size={14} className="text-vanellix-cyan" /> {t('notifications.icon_url') || 'Small Icon URL'} <span className="text-xs font-normal opacity-50">(optional, defaults to Piccola Logo)</span>
              </label>
              <input
                value={form.icon_url}
                onChange={(e) => handleChange('icon_url', e.target.value)}
                placeholder="https://example.com/icon.png"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
              />
            </div>

            {/* Image URL */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
                <Image size={14} className="text-vanellix-cyan" /> {t('notifications.image_url') || 'Hero Image URL'} <span className="text-xs font-normal opacity-50">(optional)</span>
              </label>
              <input
                value={form.image_url}
                onChange={(e) => handleChange('image_url', e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
              />
            </div>

            {/* Link URL */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
                <Link size={14} className="text-vanellix-cyan" /> {t('notifications.link_url') || 'Click Action Link'} <span className="text-xs font-normal opacity-50">(optional)</span>
              </label>
              <input
                value={form.link_url}
                onChange={(e) => handleChange('link_url', e.target.value)}
                placeholder="/app/notifications"
                className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm font-mono text-sm"
              />
            </div>
          </div>

          {/* Target config */}
          <div className="p-6 rounded-3xl bg-light-surface/50 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-sm space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-gray-400">
              {t('notifications.target_config') || 'Target Configuration'}
            </h3>

            {/* API Config selector */}
            {configsList.length === 0 && (
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>No hay configuración Firebase guardada. Ve a <strong>Settings → Paso 2</strong> para agregar una antes de crear templates.</span>
              </div>
            )}
            {configsList.length > 0 && (
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">Firebase Config</label>
                <select
                  value={form.api_config_id}
                  onChange={(e) => handleChange('api_config_id', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none shadow-sm"
                >
                  {configsList.map(c => (
                    <option key={c.id} value={c.id}>{c.service || 'Firebase'} — {c.project_id || c.id}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.target_type') || 'Target Type'}</label>
                <div className="flex gap-2">
                  {[
                    { value: 'user', label: 'User', Icon: Users },
                    { value: 'topic', label: 'Topic', Icon: Radio },
                    { value: 'all', label: 'All', Icon: Globe },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChange('target_type', opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                        form.target_type === opt.value
                          ? 'bg-vanellix-cyan/10 border-vanellix-cyan/30 text-vanellix-cyan'
                          : 'bg-white dark:bg-black/20 border-light-border/20 dark:border-white/10 text-light-text-secondary dark:text-gray-400 hover:border-vanellix-cyan/50'
                      }`}
                    >
                      <opt.Icon size={14} /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.target_value') || 'Target Value'}</label>
                <input
                  required
                  value={form.target_value}
                  onChange={(e) => handleChange('target_value', e.target.value)}
                  placeholder={form.target_type === 'user' ? 'wallet address' : form.target_type === 'topic' ? 'topic name' : 'all'}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 font-bold text-base"
            >
              <Save size={18} /> {isEditing ? (t('common.save') || 'Save Changes') : (t('notifications.create_type_button') || 'Create Template')}
            </button>
          </div>
        </form>

        {/* Right: Phone Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-light-text-secondary dark:text-gray-400 mb-4">
              {t('notifications.live_preview') || 'Live Preview'}
            </h3>
            <div className="relative mx-auto w-[280px]">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] bg-gradient-to-b from-gray-800 to-gray-900 p-3 shadow-2xl shadow-black/40">
                <div className="rounded-[2rem] bg-black overflow-hidden">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-6 pt-3 pb-2 text-white text-[10px] font-semibold">
                    <span>9:41</span>
                    <div className="flex gap-1 items-center">
                      <div className="w-4 h-2 border border-white rounded-sm"><div className="w-2/3 h-full bg-white rounded-sm"></div></div>
                    </div>
                  </div>
                  {/* Notification card */}
                  <div className="px-3 pb-6 pt-2 min-h-[400px]">
                    <motion.div
                      key={form.title_template + form.body_template}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/95 backdrop-blur-xl rounded-2xl p-3.5 shadow-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-[10px] overflow-hidden shadow-sm shrink-0 border border-black/5 bg-white flex items-center justify-center">
                          {form.icon_url ? (
                            <img src={form.icon_url} alt="icon" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/favicon-piccola.png' }} />
                          ) : (
                            <img src="/favicon-piccola.png" alt="Piccola" className="w-8 h-8 object-contain" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[12px] font-semibold text-gray-800 tracking-tight">Piccola Italia</span>
                            <span className="text-[11px] text-gray-400">ahora</span>
                          </div>
                          <p className="text-[14px] font-bold text-gray-900 leading-snug">
                            {resolvePreview(form.title_template) || 'Title Preview'}
                          </p>
                          <p className="text-[14px] text-gray-600 mt-0.5 leading-snug line-clamp-3">
                            {resolvePreview(form.body_template) || 'Body preview will appear here...'}
                          </p>
                          {form.image_url && (
                            <div className="mt-2 rounded-xl overflow-hidden bg-gray-100 max-h-32 flex items-center justify-center border border-black/5">
                              <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                    {/* Ghost notifications */}
                    <div className="mt-3 opacity-30">
                      <div className="bg-white/60 rounded-2xl p-3 h-16"></div>
                    </div>
                    <div className="mt-2 opacity-15">
                      <div className="bg-white/40 rounded-2xl p-3 h-12"></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationTemplateEditor;
