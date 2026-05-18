// src/pages/whatsapp/WhatsApp.jsx
// WhatsApp Business Platform — Templates, Send, Audience, Settings
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaCog, FaSync } from 'react-icons/fa';
import { MessageSquare, Send, Users, FileText, Settings, BarChart2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useWhatsApp from '../../hooks/useWhatsApp.jsx';
import WhatsAppSettings from './settings/WhatsAppSettings';
import WhatsAppSend from './send/WhatsAppSend';
import WhatsAppTemplateList from './templates/WhatsAppTemplateList';
import WhatsAppTemplateEditor from './templates/WhatsAppTemplateEditor';
import WhatsAppAudience from './audience/WhatsAppAudience';

// ─── Tab Config ──────────────────────────────────────────────
const TABS = [
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'send', label: 'Send & Test', icon: Send },
  { id: 'audience', label: 'Audiencia', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// ─── Tab Selector (Apple-style) ──────────────────────────────
const TabSelector = ({ activeTab, setActiveTab }) => (
  <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl w-full mx-auto mb-6">
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all z-10
            ${isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
        >
          {isActive && (
            <motion.div
              layoutId="waTabBg"
              className="absolute inset-0 bg-white dark:bg-dark-surface rounded-lg shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <tab.icon className={isActive ? 'text-green-500' : ''} size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Main Component ──────────────────────────────────────────
const WhatsApp = ({ appState }) => {
  const { t } = useTranslation();
  const token = appState?.accessToken || appState?.useAuth?.accessToken || appState?.token;
  const account = appState?.account || appState?.wallet || appState?.useAuth?.account;
  
  const wa = useWhatsApp({ token, account });

  const [activeTab, setActiveTab] = useState('templates');
  const [editingTemplate, setEditingTemplate] = useState(false);

  const handleRefresh = () => {
    if (activeTab === 'templates') wa.fetchTemplates();
    if (activeTab === 'send') wa.fetchTemplates();
    if (activeTab === 'settings') wa.fetchConfig();
  };

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
            <MessageSquare className="text-green-500" size={28} />
            WhatsApp Business
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Templates, campañas, audiencia & configuración
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium transition-colors text-sm flex items-center gap-2 border border-light-border/10 dark:border-dark-border/10"
        >
          <FaSync size={12} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'templates' && (
          <motion.div key="templates" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {editingTemplate ? (
              <WhatsAppTemplateEditor wa={wa} appState={appState} onClose={() => setEditingTemplate(false)} />
            ) : (
              <WhatsAppTemplateList wa={wa} appState={appState} onCreateNew={() => setEditingTemplate(true)} />
            )}
          </motion.div>
        )}

        {activeTab === 'send' && (
          <motion.div key="send" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <WhatsAppSend wa={wa} appState={appState} />
          </motion.div>
        )}

        {activeTab === 'audience' && (
          <motion.div key="audience" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <WhatsAppAudience appState={appState} />
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            <WhatsAppSettings wa={wa} appState={appState} />
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </motion.div>
  );
};

export default WhatsApp;

export const pageMetadata = {
  path: '/app/whatsapp',
  label: 'WhatsApp',
  category: 'marketing.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 3,
  locations: ['sidebar'],
  description: 'WhatsApp Business — Templates, campañas & audiencia',
  icon: 'FaWhatsapp',
  isSearchable: true,
};
