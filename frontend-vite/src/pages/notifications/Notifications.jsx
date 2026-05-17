// src/pages/notifications/Notifications.jsx
// Push Notifications panel — Templates, Send & Test, Automations, Settings
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaBell, FaPaperPlane, FaRobot, FaCog, FaSync, FaUsers, FaMagic
} from 'react-icons/fa';
import { FiBarChart2 } from 'react-icons/fi';
import { Bell } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import appData from '../../utils/appData.jsx';

import { AIChatSidebar } from '../../components/common/ai-chat';
import NotificationTemplateList from './templates/NotificationTemplateList';
import NotificationTemplateEditor from './templates/NotificationTemplateEditor';
import NotificationSend from './send/NotificationSend';
import NotificationSettings from './settings/NotificationSettings';
import NotificationAnalytics from './analytics/NotificationAnalytics';
import NotificationAudience from './audience/NotificationAudience';
import NotificationAutomationList from './automations/NotificationAutomationList';
import NotificationPreferences from './settings/NotificationPreferences';
import useConversionTrackerAdmin from '../../hooks/conversionTracker/useConversionTrackerAdmin.jsx';

// ─── Tab Config ──────────────────────────────────────────────
const TABS = [
  { id: 'templates', label: 'Templates', icon: FaBell },
  { id: 'send', label: 'Send & Test', icon: FaPaperPlane },
  { id: 'audience', label: 'Audience', icon: FaUsers },
  { id: 'analytics', label: 'Analytics', icon: FiBarChart2 },
  { id: 'automations', label: 'Automations', icon: FaRobot },
  { id: 'settings', label: 'Settings', icon: FaCog },
  { id: 'preferences', label: 'Preferencias', icon: FaMagic },
];

// ─── Tab Selector (Apple-style segmented control) ────────────
const TabSelector = ({ activeTab, setActiveTab, t }) => (
  <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl w-full mx-auto mb-6">
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all z-10
            ${isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}
          `}
        >
          {isActive && (
            <motion.div
              layoutId="notifTabBg"
              className="absolute inset-0 bg-white dark:bg-dark-surface rounded-lg shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <tab.icon className={isActive ? 'text-matrix-green' : ''} size={16} />
            <span className="hidden sm:inline">{t(`notifications.tab_${tab.id}`, tab.label)}</span>
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Main Component ──────────────────────────────────────────
const Notifications = ({ appState }) => {
  const { t } = useTranslation();
  const notif = appState.useNotifications;

  // We reuse the conversion tracker hook just for the ecosystem providers sync
  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;
  const account = appState?.account || appState?.wallet || appState?.useAuth?.account;
  const {
    ecosystemProviders, resyncEcosystemProvider
  } = useConversionTrackerAdmin({ token, account, autoLoad: true });

  const [activeTab, setActiveTab] = useState('templates');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (activeTab === 'templates') { 
      notif.fetchNotificationTypes(); 
      notif.fetchApiConfigs(); 
      notif.loadTriggers();
    }
    if (activeTab === 'send') {
      notif.fetchNotificationTypes();
      notif.fetchUsersWithTokens();
      notif.fetchAudience();
    }
    if (activeTab === 'automations') {
      notif.fetchNotificationTypes();
      notif.loadTriggers();
    }
    if (activeTab === 'settings') notif.fetchApiConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === 'templates') notif.fetchNotificationTypes();
    if (activeTab === 'send') notif.fetchUsersWithTokens();
    if (activeTab === 'analytics') notif.fetchAnalytics();
    if (activeTab === 'settings') notif.fetchApiConfigs();
    if (activeTab === 'automations') {
      notif.fetchNotificationTypes();
      notif.loadTriggers();
    }
  };

  const handleActionApplied = () => {
    notif.fetchNotificationTypes();
    if (activeTab === 'automations') {
      // Refresh automations logic if applicable
    }
  };

  // ── AI integration callbacks ─────────────────────────────────
  const aiContext = {
    templates: (notif.notificationTypes || []).map(t => ({ id: t.id, event_name: t.event_name, target_type: t.target_type })),
    automations: (notif.automations || []).map(a => ({ _id: a._id, name: a.name, condition: a.condition, delay_minutes: a.delay_minutes, active: a.active })),
    order_statuses: [
      {key: 'pending', label: 'Pendiente'}, {key: 'confirmed', label: 'Confirmado'}, 
      {key: 'preparing', label: 'En Preparación'}, {key: 'ready', label: 'Listo'},
      {key: 'dispatched', label: 'En Camino'}, {key: 'delivered', label: 'Entregado'}
    ]
  };

  const handleAISend = useCallback(async (message, history) => {
    return appData.notificationAIChat({
      accessToken: token,
      walletAddress: account,
      message,
      history,
      context: aiContext,
    });
  }, [token, account, notif.notificationTypes, notif.automations]);

  const handleAIApply = useCallback(async (action) => {
    const { action: actionType } = action;

    if (actionType === 'create_notification_template') {
      const tpl = action.template;
      if (tpl) {
        await notif.createNotificationType(tpl);
        handleActionApplied();
        toast.success('✅ Template push creado');
      }
    }

    if (actionType === 'create_automation') {
      const auto = action.automation;
      if (auto) {
        await appData.createAutomation({ accessToken: token, walletAddress: account, data: auto });
        handleActionApplied();
        toast.success('✅ Automatización push creada');
      }
    }

    if (actionType === 'create_full_flow') {
      const tpl = action.template;
      const auto = action.automation;
      if (!tpl) throw new Error('Falta el template en el flujo.');

      const newTpl = await notif.createNotificationType(tpl);
      if (auto && newTpl?.id) {
        auto.notification_type_id = newTpl.id;
        await appData.createAutomation({ accessToken: token, walletAddress: account, data: auto });
      }

      handleActionApplied();
      toast.success('✅ Flujo push completo creado');
    }
  }, [notif.notificationTypes, token, account]);

  const aiActionLabel = useCallback((action) => {
    if (action.action === 'create_notification_template') return '📱 Crear template push';
    if (action.action === 'create_automation') return '⚡ Crear automatización';
    if (action.action === 'create_full_flow') return '🚀 Crear flujo completo';
    return `Acción: ${action.action}`;
  }, []);

  return (
    <motion.div
      className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 min-h-screen pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <Bell className="text-matrix-green" size={28} />
            {t('notifications.label') || 'Push Notifications'}
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            {t('notifications.page_subtitle') || 'Templates, push campaigns, automations & testing'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAI(!showAI)}
            className={`px-4 py-2 rounded-xl font-medium transition-all text-sm flex items-center gap-2 border ${showAI
                ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary'
              }`}
          >
            <FaMagic size={12} />
            Asistente IA
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium transition-colors text-sm flex items-center gap-2 border border-light-border/10 dark:border-dark-border/10"
          >
            <FaSync size={12} />
            {t('common.refresh') || 'Refresh'}
          </button>
        </div>
      </div>

      {/* Layout — main content + optional AI sidebar */}
      <div className={`flex gap-4 ${showAI ? 'flex-col lg:flex-row' : ''}`}>
        
        {/* Main Content */}
        <div className={showAI ? 'flex-1 min-w-0' : 'w-full'}>
          <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} t={t} />

        <AnimatePresence mode="wait">
          {activeTab === 'templates' && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {editingTemplate !== null ? (
                <NotificationTemplateEditor
                  appState={appState}
                  template={editingTemplate}
                  apiConfigs={notif.apiConfigs}
                  triggersConfig={notif.triggers}
                  onSave={async (data) => {
                    if (editingTemplate?.id) {
                      await notif.updateNotificationType(editingTemplate.id, data);
                    } else {
                      await notif.createNotificationType(data);
                    }
                    setEditingTemplate(null);
                    toast.success(t('notifications.template_saved') || 'Template saved!');
                  }}
                  onCancel={() => setEditingTemplate(null)}
                />
              ) : (
                <NotificationTemplateList
                  appState={appState}
                  templates={notif.notificationTypes}
                  triggersConfig={notif.triggers}
                  loading={notif.isLoading}
                  onCreate={() => setEditingTemplate({})}
                  onEdit={(tpl) => setEditingTemplate(tpl)}
                  onDelete={async (id) => {
                    await notif.deleteNotificationType(id);
                    toast.success(t('notifications.template_deleted') || 'Template deleted');
                  }}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'send' && (
            <motion.div
              key="send"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationSend
                appState={appState}
                notificationTypes={notif.notificationTypes}
                sendNotification={notif.sendNotification}
                usersWithTokens={notif.usersWithTokens}
                fetchUsersWithTokens={notif.fetchUsersWithTokens}
                saveNotificationToken={notif.saveNotificationToken}
                notificationPermission={notif.notificationPermission}
                audience={notif.audience}
                fetchAudience={notif.fetchAudience}
                isLoading={notif.isLoading}
              />
            </motion.div>
          )}

          {activeTab === 'automations' && (
            <motion.div
              key="automations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationAutomationList
                appState={appState}
                templates={notif.notificationTypes}
                automations={notif.automations}
                triggersConfig={notif.triggers}
                fetchAutomations={notif.fetchAutomations}
                createAutomation={notif.createAutomation}
                updateAutomation={notif.updateAutomation}
                deleteAutomation={notif.deleteAutomation}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationSettings
                appState={appState}
                apiConfigs={notif.apiConfigs}
                fetchApiConfigs={notif.fetchApiConfigs}
                saveNotificationToken={notif.saveNotificationToken}
                uploadServiceAccount={notif.uploadServiceAccount}
                notificationPermission={notif.notificationPermission}
                isLoading={notif.isLoading}
                ecosystemProviders={ecosystemProviders}
                resyncEcosystemProvider={resyncEcosystemProvider}
              />
            </motion.div>
          )}

          {activeTab === 'audience' && (
            <motion.div
              key="audience"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationAudience
                appState={appState}
                audience={notif.audience}
                fetchAudience={notif.fetchAudience}
                deleteAudienceMember={notif.deleteAudienceMember}
                isLoading={notif.isLoading}
              />
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationAnalytics
                analyticsData={notif.analyticsData}
                fetchAnalytics={notif.fetchAnalytics}
                isLoading={notif.isLoading}
              />
            </motion.div>
          )}

          {activeTab === 'preferences' && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <NotificationPreferences appState={appState} />
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* AI Sidebar */}
        <AIChatSidebar
          show={showAI}
          onClose={() => setShowAI(false)}
          title="Asistente de Notificaciones"
          subtitle="Powered by Grok"
          welcomeMessage={'¡Hola! 👋 Soy tu experto en Notificaciones Push.\n\nPuedo ayudarte con:\n• **Templates**: _"Crea un push para carritos abandonados"_\n• **Automaciones**: _"Pide review 30 minutos después de entrega"_\n• **Flujos completos**: _"Arma un flujo de recompra para 3 días"_\n\n¿Qué te gustaría hacer?'}
          placeholder="Ej: Crea un push de bienvenida..."
          onSend={handleAISend}
          onApply={handleAIApply}
          context={aiContext}
          actionLabel={aiActionLabel}
        />
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </motion.div>
  );
};

export default Notifications;

export const pageMetadata = {
  path: '/app/notifications',
  label: 'notifications.label',
  category: 'marketing.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 2,
  locations: ['sidebar'],
  description: 'notifications.page_subtitle',
  icon: 'FaBell',
  isSearchable: true,
};
