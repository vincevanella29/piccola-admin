// src/pages/AdminGamification.jsx

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Award, ListChecks, PlusCircle, Layers, Landmark, Gift, UserCheck } from 'lucide-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useGamificationAdmin from '../../hooks/useGamificationAdmin.jsx';
import RuleList from './components/Gamification/RuleList.jsx';
import RuleCreate from './components/Gamification/RuleCreate/RuleCreate.jsx';
import SegmentManager from './components/Gamification/SegmentManager.jsx';
import DaoGovernance from './components/Gamification/DaoGovernance.jsx';
import MeritBatchManager from './components/Gamification/MeritBatchManager.jsx';
import FastMinterManager from './components/Gamification/FastMinterManager.jsx';

const AdminGamification = ({ appState }) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState('dao');
  const api = useGamificationAdmin(appState, t);

  const subTabs = [
    { key: 'dao', label: t('gamification.dao_tab', 'Gobernanza'), icon: Landmark },
    { key: 'segments', label: t('gamification.segments_tab', 'Segmentos'), icon: Layers },
    { key: 'list', label: t('gamification.list_tab', 'Reglas'), icon: ListChecks },
    { key: 'create', label: t('gamification.create_tab', 'Crear'), icon: PlusCircle },
    { key: 'merits', label: t('gamification.merits_tab', 'Méritos'), icon: Gift },
    { key: 'fast_minters', label: t('gamification.fast_minters_tab', 'Fast Minters'), icon: UserCheck },
  ];

  useEffect(() => {
    if (activeSubTab === 'list') api.listRules().catch(console.error);
    if (activeSubTab === 'segments' || activeSubTab === 'create') api.listSegments().catch(console.error);
    if (activeSubTab === 'merits') api.listMeritResults().catch(console.error);
    if (activeSubTab === 'fast_minters') api.listFastMinters().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab]);

  return (
    // Contenedor principal con padding responsivo y transición suave
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent text-light-text-primary dark:text-dark-text-primary p-4 sm:p-6 lg:py-8 lg:px-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado de la página */}
        <motion.header
          initial={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="p-3 bg-white dark:bg-dark-surface-secondary/60 rounded-2xl border border-dark-border/5 dark:border-dark-border/20 shadow-sm flex-shrink-0 self-start sm:self-auto">
              <Award className="text-matrix-green drop-shadow-sm" size={32} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-light-text-primary dark:text-dark-text-primary">
                {t('gamification.admin_title', 'Gestión de Meritocracia')}
              </h1>
              <p className="mt-1 text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base font-medium">
                Administra segmentos, reglas de juego y propuestas de gobernanza.
              </p>
            </div>
          </div>
        </motion.header>

        {/* Navegación por Pestañas Responsiva estilo Píldoras */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-white/80 dark:bg-dark-surface-secondary/40 backdrop-blur-md p-1.5 rounded-2xl border border-dark-border/10 dark:border-dark-border/20 shadow-sm overflow-x-auto scrollbar-none">
            <div className="flex flex-nowrap items-center gap-1 xl:justify-start">
              {subTabs.map((tab) => {
                const isActive = activeSubTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    className={`flex-shrink-0 relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-xl transition-all duration-300
                      ${isActive
                        ? 'text-black dark:text-black shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-surface'
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSubTabBg"
                        className="absolute inset-0 bg-matrix-green rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <tab.icon size={16} className={`relative z-10 ${isActive ? 'text-black/80' : 'opacity-60'}`} />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.nav>

        {/* Contenido Principal */}
        <motion.main
          key={activeSubTab} // Clave para re-animar
          initial={{ opacity: 0, scale: 0.98, filter: 'blur(2px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="bg-white/40 dark:bg-transparent rounded-3xl"
        >
          {activeSubTab === 'segments' && (
            <SegmentManager
              isLoading={api.isLoading} segments={api.segments}
              onSegmentCreate={api.createSegment} onDaoAllow={api.allowDaoInSegment}
              onRefresh={api.listSegments} onBootstrapSpecial={api.bootstrapSpecialExecute}
              onAuthorizeAll={api.authorizeCompanyAllBuild} appState={appState}
            />
          )}
          {activeSubTab === 'list' && (
            <RuleList
              isLoading={api.isLoading}
              rules={api.rules}
              onRefresh={api.listRules}
              onUpdate={api.updateRuleFromTemplate}
              loadTemplates={api.listRuleTemplates}
              loadSegments={api.listSegments}
              loadCatalogs={api.listCatalogs}
            />
          )}
          {activeSubTab === 'create' && (
            <RuleCreate
              isLoading={api.isLoading}
              defineRuleFromTemplate={async (payload) => {
                await api.defineRuleFromTemplate(payload);
                setActiveSubTab('list');
                await api.listRules();
              }}
              listRuleTemplates={api.listRuleTemplates}
              listSegments={api.listSegments}
              listCatalogs={api.listCatalogs}
            />
          )}
          {activeSubTab === 'dao' && <DaoGovernance appState={appState} />}
          {activeSubTab === 'merits' && <MeritBatchManager api={api} appState={appState} />}
          {activeSubTab === 'fast_minters' && <FastMinterManager api={api} />}
        </motion.main>
      </div>

      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        // Margen responsivo para que no se pegue a los bordes en móviles
        className="m-4"
      />
    </div>
  );
};

export default AdminGamification;

export const pageMetadata = {
  path: '/app/admin/gamification',
  label: 'gamification.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 8,
  locations: ['sidebar'],
  description: 'gamification.description',
  icon: 'FaAward',
};