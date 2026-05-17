import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Zap, PlusCircle, Edit3, Trash2, ToggleLeft, ToggleRight, Clock, Bell, Users, Briefcase, Mail } from 'lucide-react';
import NotificationPreview from '../components/NotificationPreview';

const NotificationAutomationList = ({ 
  appState, 
  templates = [],
  automations = [],
  triggersConfig = {},
  fetchAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation
}) => {
  const { t } = useTranslation();
  const [segment, setSegment] = useState('customers');
  const [showEditor, setShowEditor] = useState(false);
  const [editingAuto, setEditingAuto] = useState(null);

  const [form, setForm] = useState({
    name: '',
    trigger_event: 'customer_registered',
    action_type: 'push',
    template_id: '',
    delay_minutes: 0,
    active: true,
  });

  useEffect(() => {
    if (fetchAutomations) {
      fetchAutomations(segment);
    }
  }, [segment, fetchAutomations]);

  const currentTriggers = (triggersConfig && triggersConfig[segment]) || [];

  const resetForm = () => {
    setForm({ 
      name: '', 
      trigger_event: currentTriggers?.[0]?.value || '', 
      action_type: 'push',
      template_id: '', 
      delay_minutes: 0, 
      active: true 
    });
    setEditingAuto(null);
    setShowEditor(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.template_id) return;
    try {
      if (editingAuto) {
        await updateAutomation(editingAuto, { ...form, segment, action_type: 'push' });
      } else {
        await createAutomation({ ...form, segment, action_type: 'push' });
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (auto) => {
    setForm({ 
      name: auto.name,
      trigger_event: auto.trigger_event,
      action_type: auto.action_type || 'push',
      template_id: auto.template_id,
      delay_minutes: auto.delay_minutes,
      active: auto.active
    });
    setEditingAuto(auto.id);
    setShowEditor(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('notifications.confirm_delete_automation') || 'Delete this automation?')) {
      await deleteAutomation(id);
    }
  };

  const toggleActive = async (auto) => {
    await updateAutomation(auto.id, { ...auto, active: !auto.active, segment });
  };

  const getTemplateName = (id) => {
    const tpl = templates.find(t => t.id === id);
    return tpl ? tpl.event_name : id;
  };

  const getTriggerInfo = (val) => {
    const all = [];
    if (triggersConfig) {
      Object.values(triggersConfig).forEach(arr => all.push(...arr));
    }
    return all.find(o => o.value === val) || { label: val, emoji: '⚡' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-light-text-primary dark:text-white">
            {t('notifications.automations') || 'Automations'}
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-gray-400 mt-1">
            {t('notifications.automations_desc') || 'Automatically send push notifications when events happen'}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowEditor(true); }}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 font-bold text-sm"
        >
          <PlusCircle size={18} /> {t('notifications.new_automation') || 'New Automation'}
        </button>
      </div>

      {/* Segment Tabs */}
      <div className="flex bg-light-surface/50 dark:bg-black/20 p-1.5 rounded-full w-fit mb-4">
        <button
          onClick={() => { setSegment('customers'); resetForm(); }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${segment === 'customers' ? 'bg-vanellix-cyan text-white shadow-md' : 'text-light-text-secondary dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <Users size={16} /> Clientes (Delivery)
        </button>
        <button
          onClick={() => { setSegment('employees'); resetForm(); }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${segment === 'employees' ? 'bg-vanellix-cyan text-white shadow-md' : 'text-light-text-secondary dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <Briefcase size={16} /> Empleados (Team)
        </button>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 rounded-3xl bg-light-surface/80 dark:bg-[#1c1c1e] border border-light-border/10 dark:border-white/5 shadow-lg backdrop-blur-xl space-y-5"
          >
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Column: Form */}
              <div className="flex-1 space-y-5">
                <h3 className="text-lg font-bold text-light-text-primary dark:text-white flex items-center gap-2">
                  <Zap size={18} className="text-vanellix-cyan" />
                  {editingAuto !== null ? (t('notifications.edit_automation') || 'Edit Automation') : (t('notifications.new_automation') || 'New Automation')}
                  <span className="text-xs px-2 py-1 bg-black/5 dark:bg-white/10 rounded-lg opacity-70 ml-2">
                    {segment === 'customers' ? 'Customers' : 'Team'}
                  </span>
                </h3>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.automation_name') || 'Name'}</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Welcome message"
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 shadow-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.automation_trigger') || 'Trigger Event'}</label>
                    <select
                      value={form.trigger_event}
                      onChange={(e) => setForm(prev => ({ ...prev, trigger_event: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none shadow-sm"
                    >
                      {currentTriggers.map(o => (
                        <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300">{t('notifications.select_template') || 'Template'}</label>
                    <select
                      value={form.template_id}
                      onChange={(e) => setForm(prev => ({ ...prev, template_id: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 appearance-none shadow-sm"
                    >
                      <option value="">-- Select template --</option>
                      <option value="original" className="font-bold text-vanellix-cyan">✨ Usar mensaje original del evento</option>
                      {templates.filter(tpl => !tpl.trigger_event || tpl.trigger_event === form.trigger_event).map(tpl => (
                        <option key={tpl.id} value={tpl.id}>{tpl.event_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-light-text-secondary dark:text-gray-300 flex items-center gap-2">
                      <Clock size={14} className="text-vanellix-cyan" /> {t('notifications.automation_delay') || 'Delay (minutes)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.delay_minutes}
                      onChange={(e) => setForm(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-black/20 border border-light-border/20 dark:border-white/10 text-light-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-vanellix-cyan/50 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-5 border-t border-light-border/10 dark:border-white/5">
                  <button
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-full text-sm font-semibold bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!form.name || !form.template_id}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white shadow-lg shadow-matrix-green/20 hover:shadow-matrix-green/40 transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
                  >
                    {editingAuto !== null ? (t('common.save') || 'Save') : (t('notifications.create_automation') || 'Create Automation')}
                  </button>
                </div>
              </div>

              {/* Right Column: Preview */}
              <div className="lg:w-[320px] flex-shrink-0 flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-gray-400">
                    Live Preview
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-vanellix-cyan font-medium">
                    <Zap size={10} /> Apple Style
                  </span>
                </div>
                
                <NotificationPreview 
                  template={form.template_id === "original" ? {
                    title_template: currentTriggers.find(t => t.value === form.trigger_event)?.mock_payload?.title_default || "Mensaje Dinámico",
                    body_template: currentTriggers.find(t => t.value === form.trigger_event)?.mock_payload?.body_default || "...",
                    icon_url: currentTriggers.find(t => t.value === form.trigger_event)?.mock_payload?.icon_url || "",
                    image_url: currentTriggers.find(t => t.value === form.trigger_event)?.mock_payload?.image_url || ""
                  } : templates.find(t => t.id === form.template_id)}
                  trigger={currentTriggers.find(t => t.value === form.trigger_event)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Automation List */}
      <div className="grid gap-3">
        <AnimatePresence>
          {automations.length === 0 && !showEditor && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-12 rounded-3xl border border-dashed border-light-border/30 dark:border-white/20 text-center flex flex-col items-center justify-center gap-4 text-light-text-secondary dark:text-gray-400"
            >
              <Zap size={40} className="opacity-40" />
              <p className="text-sm font-medium">{t('notifications.no_automations') || 'No automations configured yet.'}</p>
              <p className="text-xs max-w-sm opacity-70">{t('notifications.automations_hint') || 'Automations let you send push notifications automatically when specific events happen, like new orders or deliveries.'}</p>
            </motion.div>
          )}

          {automations.map((auto, idx) => {
            const triggerInfo = getTriggerInfo(auto.trigger_event || auto.trigger);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-5 rounded-3xl border ${auto.active ? 'border-light-border/10 dark:border-white/5 bg-light-surface/50 dark:bg-[#1c1c1e]' : 'border-red-500/10 bg-red-500/5 dark:bg-red-500/5'} shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-2xl">{triggerInfo.emoji}</div>
                  <div className="min-w-0">
                    <h4 className={`font-semibold tracking-tight truncate ${auto.active ? 'text-light-text-primary dark:text-white' : 'text-red-500 opacity-70'}`}>
                      {auto.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-light-text-secondary dark:text-gray-400">
                      <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">{triggerInfo.label}</span>
                      <span>→</span>
                      <span className="px-2 py-0.5 rounded-full bg-vanellix-cyan/10 text-vanellix-cyan font-semibold flex items-center gap-1">
                        <Bell size={10} /> {getTemplateName(auto.template_id)}
                      </span>
                      {auto.delay_minutes > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-semibold flex items-center gap-1">
                          <Clock size={10} /> +{auto.delay_minutes}min
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(auto)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Toggle active">
                    {auto.active ? <ToggleRight size={24} className="text-matrix-green" /> : <ToggleLeft size={24} className="text-gray-400" />}
                  </button>
                  <button onClick={() => handleEdit(auto)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <Edit3 size={16} className="text-light-text-secondary dark:text-gray-400" />
                  </button>
                  <button onClick={() => handleDelete(auto.id)} className="p-2 rounded-xl hover:bg-red-500/10 transition-colors">
                    <Trash2 size={16} className="text-red-500" />
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

export default NotificationAutomationList;
