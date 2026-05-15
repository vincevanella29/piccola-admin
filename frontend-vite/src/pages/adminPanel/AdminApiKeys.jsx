import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { KeyRound, List, PlusCircle, Plug, Play, BookOpen } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ApiKeysList from './components/ApiKeys/ApiKeysList';
import ApiKeyCreate from './components/ApiKeys/ApiKeyCreate';
import EndpointBuilder from './components/ApiKeys/EndpointBuilder';
import EndpointsList from './components/ApiKeys/EndpointsList';
import ApiPlayground from './components/ApiKeys/ApiPlayground';
import ApiDocs from './components/ApiKeys/ApiDocs';
import useApiKeysAdmin from '../../hooks/useApiKeysAdmin';
import { useApiEndpoints } from '../../hooks/useApiEndpoints';

const AdminApiKeys = ({ appState }) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('list');
  const api = useApiKeysAdmin(appState, t);
  const epApi = useApiEndpoints(appState, t);
  const [editingEndpoint, setEditingEndpoint] = useState(null);

  const subTabs = [
    { key: 'list', label: t('apikeys.list_tab') || 'My API Keys', icon: List },
    { key: 'create', label: t('apikeys.create_tab') || 'Create Key', icon: PlusCircle },
    { key: 'endpoints', label: t('apikeys.endpoints_tab') || 'Endpoints', icon: Plug },
    { key: 'playground', label: t('apikeys.playground_tab') || 'Playground', icon: Play },
    { key: 'docs', label: t('apikeys.docs_tab') || 'Docs', icon: BookOpen },
  ];

  useEffect(() => {
    if (activeSubTab === 'list') {
      api.listMyKeys().catch(() => {});
    } else if (activeSubTab === 'endpoints') {
      epApi.loadEndpoints().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  const handleSubTabClick = (tabKey) => {
    setActiveSubTab(tabKey);
    setEditingEndpoint(null);
  };

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2 sm:gap-3"
      >
        <KeyRound className="text-light-accent dark:text-dark-accent" size={24} sm={28} lg={36} />
        {t('apikeys.label') || 'API Keys'}
      </motion.h1>

      <motion.div
        className="flex justify-center mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex flex-wrap justify-center p-1.5 rounded-[20px] bg-black/20 dark:bg-white/5 backdrop-blur-xl border border-white/10 dark:border-white/5 shadow-inner w-full max-w-[90%] sm:max-w-4xl">
          {subTabs.map((tab) => (
            <motion.button
              key={tab.key}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-medium transition-all duration-300 ${
                activeSubTab === tab.key
                  ? 'bg-white/90 text-black shadow-lg shadow-black/10 dark:bg-[#1c1c1e] dark:text-white dark:border dark:border-white/10'
                  : 'text-light-text-secondary dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              onClick={() => handleSubTabClick(tab.key)}
              whileTap={{ scale: 0.97 }}
            >
              <tab.icon size={18} className={activeSubTab === tab.key ? 'opacity-100' : 'opacity-70'} />
              <span className="hidden sm:inline">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mx-auto w-full max-w-5xl rounded-3xl border border-white/20 dark:border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl bg-white/40 dark:bg-[#121212]/60"
      >
        {activeSubTab === 'list' && (
          <ApiKeysList
            appState={appState}
            isLoading={api.isLoading}
            keys={api.keys}
            onRefresh={api.listMyKeys}
            onRevoke={api.revokeKey}
          />
        )}
        {activeSubTab === 'create' && (
          <ApiKeyCreate
            appState={appState}
            isLoading={api.isLoading}
            onCreate={api.createKey}
          />
        )}
        {activeSubTab === 'endpoints' && (
          editingEndpoint ? (
            <EndpointBuilder
              appState={appState}
              isLoading={epApi.isLoading}
              collections={epApi.collections}
              initialData={editingEndpoint === 'new' ? null : editingEndpoint}
              onCancel={() => setEditingEndpoint(null)}
              onSave={async (data) => {
                if (editingEndpoint === 'new') {
                  await epApi.createEndpoint(data);
                } else {
                  await epApi.updateEndpoint(editingEndpoint.slug, data);
                }
                setEditingEndpoint(null);
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setEditingEndpoint('new')}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary shadow-neon flex items-center gap-2 text-sm font-semibold"
                >
                  <PlusCircle size={16} /> {t('apikeys.create_endpoint') || 'Create Endpoint'}
                </button>
              </div>
              <EndpointsList
                appState={appState}
                endpoints={epApi.endpoints}
                isLoading={epApi.isLoading}
                onEdit={(ep) => setEditingEndpoint(ep)}
                onDelete={epApi.deleteEndpoint}
                onTest={(ep) => {
                  setEditingEndpoint(null);
                  setActiveSubTab('playground');
                  // We could pass selected endpoint to playground, but it will read from endpoints list
                }}
              />
            </div>
          )
        )}
        {activeSubTab === 'playground' && (
          <ApiPlayground
            appState={appState}
            endpoints={epApi.endpoints}
            apiKeys={api.keys}
          />
        )}
        {activeSubTab === 'docs' && (
          <ApiDocs
            appState={appState}
            endpoints={epApi.endpoints}
          />
        )}
      </motion.section>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </div>
  );
};

export default AdminApiKeys;

export const pageMetadata = {
  path: '/app/admin/apikeys',
  label: 'apikeys.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 10,
  locations: ['sidebar'],
  description: 'apikeys.description',
  icon: 'FaKey',
};
