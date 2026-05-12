// src/pages/marketing/Marketing.jsx
// Marketing & Mailing panel — Templates, Campaigns, Automations + AI Assistant
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaEnvelope, FaBullhorn, FaRobot, FaSync, FaPaperPlane, FaMagic, FaCog,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useMarketing from '../../hooks/useMarketing';
import * as marketingApi from '../../utils/marketingData';
import { AIChatSidebar } from '../../components/common/ai-chat';
import TemplateList from './templates/TemplateList';
import TemplateEditor from './templates/TemplateEditor';
import CampaignList from './campaigns/CampaignList';
import CampaignCompose from './campaigns/CampaignCompose';
import AutomationList from './automations/AutomationList';
import MailSettings from './settings/MailSettings';

// ─── Tab Config ──────────────────────────────────────────────
const TABS = [
  { id: 'templates', label: 'Templates', icon: FaEnvelope },
  { id: 'campaigns', label: 'Campañas', icon: FaBullhorn },
  { id: 'automations', label: 'Automaciones', icon: FaRobot },
  { id: 'settings', label: 'Ajustes', icon: FaCog },
];

// ─── Tab Selector ────────────────────────────────────────────
const TabSelector = ({ activeTab, setActiveTab }) => (
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
              layoutId="marketingTabBg"
              className="absolute inset-0 bg-white dark:bg-dark-surface rounded-lg shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <tab.icon className={isActive ? 'text-matrix-green' : ''} size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
          </span>
        </button>
      );
    })}
  </div>
);

// ─── Main Component ──────────────────────────────────────────
const Marketing = ({ appState }) => {
  const { t } = useTranslation();
  const mk = useMarketing(appState);

  const [activeTab, setActiveTab] = useState('templates');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [composingCampaign, setComposingCampaign] = useState(null);
  const [showAI, setShowAI] = useState(false);

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'templates') mk.loadTemplates();
    if (activeTab === 'campaigns') {
      mk.loadCampaigns();
      mk.loadTemplates();
    }
    if (activeTab === 'automations') {
      mk.loadAutomations();
      mk.loadTemplates();
      mk.loadStatuses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRefresh = () => {
    if (activeTab === 'templates') mk.loadTemplates();
    if (activeTab === 'campaigns') mk.loadCampaigns();
    if (activeTab === 'automations') mk.loadAutomations();
  };

  const handleActionApplied = () => {
    mk.loadTemplates();
    mk.loadAutomations();
  };

  // ── AI integration callbacks ─────────────────────────────────
  const aiContext = {
    templates: (mk.templates || []).map(t => ({ _id: t._id, name: t.name, type: t.type, subject: t.subject })),
    automations: (mk.automations || []).map(a => ({ _id: a._id, name: a.name, condition: a.condition, delay_minutes: a.delay_minutes, active: a.active })),
    order_statuses: (mk.orderStatuses || []).map(s => ({ key: s.key, label: s.label })),
    block_types: 'header, text, image, product_card, product_grid, button, review_button, divider, spacer, variable',
    block_format: 'Blocks array: [{id,type,data}]. Types: header(title,subtitle), text(html), image(src,alt,link), product_card(name,price,image), product_grid(products:[{name,price,image}]), button(text,url,color), review_button(text,url,color), divider(), spacer(height), variable(variable:order_items_html|suggested_products_html)',
  };

  const handleAISend = useCallback(async (message, history) => {
    return marketingApi.marketingAIChat({
      token: appState?.token,
      walletAddress: appState?.account,
      message,
      history,
      context: aiContext,
    });
  }, [appState?.token, appState?.account, mk.templates, mk.automations]);

  const handleAIApply = useCallback(async (action) => {
    const { action: actionType } = action;

    if (actionType === 'create_template') {
      const tpl = action.template;
      if (tpl) {
        if (tpl.blocks && !tpl.html) {
          const { compileBlocks } = await import('./templates/blockCompiler');
          tpl.html = compileBlocks(tpl.blocks);
        }
        await mk.saveTemplate(null, tpl);
        handleActionApplied();
      }
    }

    if (actionType === 'edit_template') {
      const tpl = action.template || {};
      if (tpl.blocks) {
        const { compileBlocks } = await import('./templates/blockCompiler');
        tpl.html = compileBlocks(tpl.blocks);
      }
      setEditingTemplate(tpl);
    }

    if (actionType === 'create_automation') {
      const auto = action.automation;
      if (auto) {
        if (!auto.template_id && auto.template_name) {
          const match = (mk.templates || []).find(t =>
            t.name.toLowerCase().includes(auto.template_name.toLowerCase())
          );
          if (match) auto.template_id = match._id;
        }
        if (!auto.template_id) {
          throw new Error('No encontré el template. Crea uno primero.');
        }
        await mk.saveAutomation(null, auto);
        handleActionApplied();
      }
    }

    // Full flow: create template + automation in one shot
    if (actionType === 'create_full_flow') {
      const tpl = action.template;
      const auto = action.automation;
      if (!tpl) throw new Error('Falta el template en el flujo.');

      // 1. Compile blocks → HTML
      if (tpl.blocks && !tpl.html) {
        const { compileBlocks } = await import('./templates/blockCompiler');
        tpl.html = compileBlocks(tpl.blocks);
      }

      // 2. Create template & get its ID
      const templateId = await mk.saveTemplate(null, tpl);

      // 3. Create automation linked to the new template
      if (auto && templateId) {
        auto.template_id = templateId;
        await mk.saveAutomation(null, auto);
      }

      handleActionApplied();
      toast.success('✅ Template + automación creados');
    }

    // Generate marketing image
    if (actionType === 'generate_image') {
      const img = action.image;
      if (img) {
        try {
          const result = await mk.generateMarketingImage({
            style: img.style || 'product_hero',
            prompt: img.prompt,
          });
          if (result?.url) {
            toast.success('🖼️ Imagen generada');
          }
        } catch (e) {
          toast.error('Error generando imagen');
        }
      }
    }
  }, [mk.templates]);

  const aiActionLabel = useCallback((action) => {
    if (action.action === 'create_template') return '📄 Crear template';
    if (action.action === 'edit_template') return '✏️ Abrir en editor';
    if (action.action === 'create_automation') return '⚡ Crear automación';
    if (action.action === 'create_full_flow') return '🚀 Crear flujo completo';
    if (action.action === 'generate_image') return '🖼️ Generar imagen';
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
            <FaPaperPlane className="text-matrix-green" />
            Marketing & Mailing
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Templates, campañas masivas y automaciones de email
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAI(!showAI)}
            className={`px-4 py-2 rounded-xl font-medium transition-all text-sm flex items-center gap-2 border ${
              showAI
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
            Actualizar
          </button>
        </div>
      </div>

      {/* Layout — main content + optional AI sidebar */}
      <div className={`flex gap-4 ${showAI ? 'flex-col lg:flex-row' : ''}`}>
        {/* Main Content */}
        <div className={showAI ? 'flex-1 min-w-0' : 'w-full'}>
          <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} />

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
                  <TemplateEditor
                    template={editingTemplate}
                    searchProducts={mk.searchProducts}
                    getBestsellers={mk.getBestsellers}
                    generateMarketingImage={mk.generateMarketingImage}
                    fetchMarketingAssets={mk.fetchMarketingAssets}
                    onSave={async (data) => {
                      await mk.saveTemplate(editingTemplate._id, data);
                      setEditingTemplate(null);
                    }}
                    onCancel={() => setEditingTemplate(null)}
                    onPreview={(data) => mk.previewTpl(editingTemplate._id || 'new', data)}
                  />
                ) : (
                  <TemplateList
                    templates={mk.templates}
                    loading={mk.templatesLoading}
                    onCreate={() => setEditingTemplate({})}
                    onEdit={(t) => setEditingTemplate(t)}
                    onDelete={mk.removeTemplate}
                    onSendTest={mk.testEmail}
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'campaigns' && (
              <motion.div
                key="campaigns"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {composingCampaign !== null ? (
                  <CampaignCompose
                    campaign={composingCampaign}
                    templates={mk.templates}
                    onSave={async (data) => {
                      await mk.saveCampaign(composingCampaign._id, data);
                      setComposingCampaign(null);
                    }}
                    onCancel={() => setComposingCampaign(null)}
                    onSend={async (id) => {
                      await mk.launchCampaign(id);
                      setComposingCampaign(null);
                    }}
                  />
                ) : (
                  <CampaignList
                    campaigns={mk.campaigns}
                    loading={mk.campaignsLoading}
                    onCreate={() => setComposingCampaign({})}
                    onEdit={(c) => setComposingCampaign(c)}
                    onSend={mk.launchCampaign}
                    onCancel={mk.cancelCamp}
                    onDelete={mk.removeCampaign}
                    onStats={mk.getCampaignStats}
                  />
                )}
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
                <AutomationList
                  automations={mk.automations}
                  templates={mk.templates}
                  orderStatuses={mk.orderStatuses}
                  loading={mk.automationsLoading}
                  onSave={mk.saveAutomation}
                  onToggle={mk.toggleAuto}
                  onDelete={mk.removeAutomation}
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
                <MailSettings
                  loadMailSettings={mk.loadMailSettings}
                  saveMailSettings={mk.saveMailSettings}
                  testMailSettings={mk.testMailSettings}
                  deleteMailSettings={mk.deleteMailSettings}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Sidebar */}
        <AIChatSidebar
          show={showAI}
          onClose={() => setShowAI(false)}
          title="Asistente Marketing"
          subtitle="Powered by Grok"
          welcomeMessage={'¡Hola! 👋 Soy tu asistente de marketing. Puedo ayudarte con:\n\n• **Templates**: _"Crea un email de bienvenida"_\n• **Automaciones**: _"Pide review 2 horas después de entrega"_\n• **Ideas**: _"Sugiere automaciones para retención"_\n\n¿Qué necesitas?'}
          placeholder="Ej: Crea un email de confirmación..."
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

export default Marketing;

export const pageMetadata = {
  path: '/app/marketing',
  label: 'Marketing & Mailing',
  category: 'marketing.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 1,
  locations: ['sidebar'],
  description: 'Email marketing, campañas y automaciones',
  icon: 'FaPaperPlane',
  isSearchable: true,
};
