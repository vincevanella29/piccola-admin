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
    // Contenedor principal con padding responsivo
    <div className="min-h-screen text-light-text-primary dark:text-dark-text-primary p-4 sm:p-6 lg:py-8 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado de la página */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-matrix-green/10 rounded-lg flex-shrink-0">
              <Award className="text-matrix-green" size={28} />
            </div>
            {/* Título con tamaño de fuente responsivo */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t('gamification.admin_title', 'Gestión de Meritocracia')}
            </h1>
          </div>
          <p className="mt-2 text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
            Administra segmentos, reglas de juego y propuestas de gobernanza.
          </p>
        </motion.header>

        {/* Navegación por Pestañas Responsiva */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          {/* Contenedor que permite el scroll horizontal en pantallas pequeñas */}
          <div className="border-b border-dark-border/20">
            <div className="overflow-x-auto scrollbar-none">
              {/* Flex container con whitespace-nowrap para evitar que las pestañas se rompan en varias líneas */}
              <div className="flex items-center gap-2 sm:gap-4 -mb-px whitespace-nowrap">
                {subTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSubTab(tab.key)}
                    // Se agrega flex-shrink-0 para que los botones no se encojan y se ajusta el padding
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors duration-200 border-b-2
                      ${
                        activeSubTab === tab.key
                          ? 'border-matrix-green text-matrix-green'
                          : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                      }`}
                  >
                    <tab.icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.nav>

        {/* Contenido Principal */}
        <motion.main
          key={activeSubTab} // Clave para que Framer Motion re-anime el contenido al cambiar de tab
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          {activeSubTab === 'segments' && (
            <SegmentManager
              isLoading={api.isLoading} segments={api.segments}
              onSegmentCreate={api.createSegment} onDaoAllow={api.allowDaoInSegment}
              onRefresh={api.listSegments} onBootstrapSpecial={api.bootstrapSpecialExecute}
              onAuthorizeAll={api.authorizeCompanyAllBuild} appState={appState}
            />
          )}
          {activeSubTab === 'list' && <RuleList isLoading={api.isLoading} rules={api.rules} onRefresh={api.listRules} />}
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

// El pageMetadata se mantiene igual, como pediste.
export const pageMetadata = {
  path: '/app/admin/gamification',
  label: 'gamification.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 7,
  locations: ['sidebar'],
  description: 'gamification.description',
  icon: 'FaAward',
};