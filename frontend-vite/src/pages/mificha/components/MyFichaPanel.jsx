import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LoaderCircle, RefreshCw, LayoutDashboard, Award, 
  DollarSign, ListChecks, ShoppingCart 
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';

import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import DashboardPanel from './tabs/DashboardPanel.jsx';
import MeritosPanel from './tabs/rules/MeritosPanel.jsx';
import SueldosPanel from './tabs/SueldosPanel.jsx';
import AsistenciaPanel from './tabs/AsistenciaPanel.jsx';
import VentasPanel from './tabs/VentasPanel.jsx';

export default function MyFichaPanel({ appState, fichaContext }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    loadingStates, ficha, sueldos, asistenciaKpis, meritos, ventasData,
    fetchSueldos, fetchAsistenciaKpis, fetchMeritos, fetchVentasTotal,
    fetchVentasKpisUltimos, fetchVentasPorPeriodo, fetchLiquidacionDetalle
  } = fichaContext || {};

  // --- Carga Perezosa Inteligente ---
  useEffect(() => {
    if (!ficha) return;
    const loadTabData = async () => {
      if (activeTab === 'dashboard') {
        // En el dashboard cargamos KPIs de venta Y el resumen de méritos
        if (!ventasData.kpisUltimos) await fetchVentasKpisUltimos();
        if (!meritos) await fetchMeritos(); 
      } else if (activeTab === 'meritos' && !meritos) {
        await fetchMeritos();
      } else if (activeTab === 'sueldos' && !sueldos) {
        await fetchSueldos();
      } else if (activeTab === 'ventas' && (!ventasData.porPeriodo || !ventasData.total)) {
        await Promise.all([fetchVentasPorPeriodo(), fetchVentasTotal()]);
      }
    };
    loadTabData();
  }, [activeTab, ficha, fetchVentasKpisUltimos, fetchMeritos, fetchSueldos, fetchAsistenciaKpis, fetchVentasPorPeriodo, fetchVentasTotal]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshActions = {
        // Al refrescar dashboard, actualizamos todo lo vital
        dashboard: () => Promise.all([fetchVentasKpisUltimos({ force: true }), fetchMeritos({ force: true })]),
        meritos: () => fetchMeritos({ force: true }),
        sueldos: () => fetchSueldos({ force: true }),
        asistencia: () => fetchAsistenciaKpis({ force: true }),
        ventas: () => Promise.all([fetchVentasPorPeriodo({ force: true }), fetchVentasTotal({ force: true })]),
      };
      if (refreshActions[activeTab]) await refreshActions[activeTab]();
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, fetchVentasKpisUltimos, fetchMeritos, fetchSueldos, fetchAsistenciaKpis, fetchVentasPorPeriodo, fetchVentasTotal]);
  
  const tabs = [
    { id: 'dashboard', label: t('mificha.tabs.dashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: 'meritos', label: t('mificha.tabs.meritos', 'Mis Méritos'), icon: Award },
    { id: 'sueldos', label: t('mificha.tabs.sueldos', 'Sueldos'), icon: DollarSign },
    { id: 'asistencia', label: t('mificha.tabs.asistencia', 'Asistencia'), icon: ListChecks },
    { id: 'ventas', label: t('mificha.tabs.ventas', 'Ventas'), icon: ShoppingCart },
  ];
  
  const tabContentVariants = {
    hidden: { opacity: 0, x: 10, filter: 'blur(4px)' },
    visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.3, ease: 'easeOut' }},
    exit: { opacity: 0, x: -10, transition: { duration: 0.2 } }
  };

  if (!ficha) return <div className="flex justify-center items-center h-64"><LoaderCircle className="animate-spin text-matrix-green" size={40} /></div>;

  return (
    <div className="w-full mx-auto space-y-8 animate-fade-in">
      {/* Tooltips Globales */}
      <Tooltip id="rule-tooltip" className="!bg-dark-surface !text-white !border !border-white/10 !rounded-lg !px-3 !py-2 !opacity-100 shadow-xl backdrop-blur-md" />
      <Tooltip id="dashboard-tooltip" className="!bg-dark-surface !text-white !border !border-white/10 !rounded-lg !px-3 !py-2 !opacity-100 shadow-xl backdrop-blur-md" />

      {/* HEADER HERO */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-light-border/10 dark:border-dark-border/10">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-matrix-green/50 to-transparent rounded-full opacity-75 blur group-hover:opacity-100 transition duration-500"></div>
            <img src={ficha?.profile?.profile_image_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${appState?.walletAddress}`} alt="Profile" className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-light-surface dark:border-dark-surface bg-dark-surface object-cover shadow-lg" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-light-text-primary dark:text-dark-text-primary">
              {ficha?.profile?.nombres} <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">{ficha?.profile?.apellidopaterno}</span>
            </h1>
            <div className="flex items-center gap-2 text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wide">
              <span className="bg-light-surface-secondary dark:bg-dark-surface-secondary px-2 py-0.5 rounded text-xs border border-light-border/10 dark:border-dark-border/10">{ficha?.profile?.cargo}</span>
              <span>•</span>
              <span>{ficha?.profile?.sucursal}</span>
            </div>
          </div>
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 border border-transparent hover:border-matrix-green/30 transition-all backdrop-blur-sm">
          <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin text-matrix-green' : ''}`} />
          <span>{isRefreshing ? t('mificha.refrescando') : t('mificha.refrescar')}</span>
        </button>
      </header>

      {/* TABS DE NAVEGACIÓN */}
      <Tabs className="space-y-6">
        <div className="sticky top-0 z-10 bg-light-bg/80 dark:bg-dark-bg/80 backdrop-blur-md py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="overflow-x-auto scrollbar-none">
            <TabsList className="inline-flex h-auto p-1 space-x-1 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-xl border border-light-border/5 dark:border-dark-border/5">
                {tabs.map(tab => (
                <TabsTrigger key={tab.id} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === tab.id ? 'bg-white dark:bg-dark-surface text-matrix-green shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-white/50 dark:hover:bg-white/5'}`}>
                    {tab.label}
                </TabsTrigger>
                ))}
            </TabsList>
            </div>
        </div>
        
        {/* ÁREA DE CONTENIDO */}
        <div className="min-h-[400px] relative">
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={tabContentVariants} initial="hidden" animate="visible" exit="exit" className="w-full">
                    <TabsContent isActive={activeTab === 'dashboard'}>
                        {/* Pasamos 'onNavigate' para que el dashboard pueda mandarte a otras pestañas */}
                        <DashboardPanel 
                            isLoading={loadingStates.ventasKpisUltimos} 
                            ficha={ficha} 
                            ventasKpis={ventasData.kpisUltimos}
                            meritos={meritos} 
                            onNavigate={setActiveTab}
                        />
                    </TabsContent>
                    <TabsContent isActive={activeTab === 'meritos'}><MeritosPanel isLoading={loadingStates.meritos} meritos={meritos} ficha={ficha} /></TabsContent>
                    <TabsContent isActive={activeTab === 'sueldos'}><SueldosPanel isLoading={loadingStates.sueldos} sueldos={sueldos} fetchLiquidacionDetalle={fetchLiquidacionDetalle} /></TabsContent>
                    <TabsContent isActive={activeTab === 'asistencia'}><AsistenciaPanel initialKpis={asistenciaKpis} isLoading={loadingStates.asistencia} fetchAsistenciaKpis={fetchAsistenciaKpis} /></TabsContent>
                    <TabsContent isActive={activeTab === 'ventas'}><VentasPanel fichaContext={fichaContext} /></TabsContent>
                </motion.div>
            </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}