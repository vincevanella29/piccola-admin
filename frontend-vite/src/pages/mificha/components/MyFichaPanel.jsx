// src/pages/employees_register/components/MyFichaPanel.jsx

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { LoaderCircle, RefreshCw, User, Wallet, LayoutDashboard, Award, DollarSign, ListChecks, ShoppingCart } from 'lucide-react';
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
  const [liquidacionModal, setLiquidacionModal] = useState({ isOpen: false, data: null, error: null, loading: false });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    loadingStates, ficha, sueldos, asistenciaKpis, meritos, ventasData, ventasDetalle,
    fetchSueldos, fetchAsistenciaKpis, fetchMeritos, fetchVentasTotal,
    fetchVentasKpisUltimos, fetchVentasPorPeriodo, fetchLiquidacionDetalle,
    fetchVentasDetalleProductos,
  } = fichaContext || {};

  // Carga de datos perezosa y específica para cada pestaña
  useEffect(() => {
    if (!ficha) return;

    const loadTabData = async () => {
      if (activeTab === 'dashboard' && !ventasData.kpisUltimos) {
        await fetchVentasKpisUltimos();
      } else if (activeTab === 'meritos' && !meritos) {
        await fetchMeritos();
      } else if (activeTab === 'sueldos' && !sueldos) {
        await fetchSueldos();
      } else if (activeTab === 'ventas' && (!ventasData.porPeriodo || !ventasData.total)) {
        await Promise.all([
          fetchVentasPorPeriodo(),
          fetchVentasTotal()
        ]);
      }
    };
    loadTabData();
  }, [
      activeTab, ficha, fetchVentasKpisUltimos, fetchMeritos, fetchSueldos, 
      fetchAsistenciaKpis, fetchVentasPorPeriodo, fetchVentasTotal
  ]); // Dependencias correctas

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshActions = {
        dashboard: () => fetchVentasKpisUltimos({ force: true }),
        meritos: () => fetchMeritos({ force: true }),
        sueldos: () => fetchSueldos({ force: true }),
        asistencia: () => fetchAsistenciaKpis({ force: true }),
        ventas: () => Promise.all([
            fetchVentasPorPeriodo({ force: true }),
            fetchVentasTotal({ force: true })
        ]),
      };
      if (refreshActions[activeTab]) {
        await refreshActions[activeTab]();
      }
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
  
  if (!ficha) {
    return <div className="flex justify-center items-center h-64"><LoaderCircle className="animate-spin text-matrix-green" size={48} /></div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <Tooltip id="rule-tooltip" style={{ backgroundColor: '#1a202c', color: '#fff', zIndex: 9999, maxWidth: '250px' }} />
      <Tooltip id="dashboard-tooltip" style={{ backgroundColor: '#2A2A2A', color: '#fff', zIndex: 50 }} />

      <header className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <img src={ficha?.profile?.profile_image_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${appState?.walletAddress}`} alt={t('mificha.profile_photo_alt', 'Foto de perfil')} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-light-surface-secondary dark:border-dark-surface-secondary object-cover" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">{ficha?.profile?.nombres} {ficha?.profile?.apellidopaterno}</h1>
            <p className="text-md text-light-text-secondary dark:text-dark-text-secondary">{ficha?.profile?.cargo}</p>
          </div>
        </div>
        <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 w-full justify-center sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover border border-light-border/20 dark:border-dark-border/20 transition-all disabled:opacity-60">
          {isRefreshing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {isRefreshing ? t('mificha.refrescando', 'Refrescando…') : t('mificha.refrescar', 'Refrescar')}
        </button>
      </header>

      <Tabs>
        <div className="relative w-full"><div className="overflow-x-auto scrollbar-none pb-2 -mb-2"><TabsList>{tabs.map(tab => (<TabsTrigger key={tab.id} isActive={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} icon={tab.icon} className="whitespace-nowrap">{tab.label}</TabsTrigger>))}</TabsList></div></div>
        
        <TabsContent isActive={activeTab === 'dashboard'}>
            <DashboardPanel 
                isLoading={loadingStates.ventasKpisUltimos} 
                ficha={ficha} 
                ventasKpis={ventasData.kpisUltimos} 
            />
        </TabsContent>
        <TabsContent isActive={activeTab === 'meritos'}><MeritosPanel isLoading={loadingStates.meritos} meritos={meritos} ficha={ficha} /></TabsContent>
        <TabsContent isActive={activeTab === 'sueldos'}><SueldosPanel isLoading={loadingStates.sueldos} sueldos={sueldos} fetchLiquidacionDetalle={fetchLiquidacionDetalle} /></TabsContent>
        <TabsContent isActive={activeTab === 'asistencia'}><AsistenciaPanel initialKpis={asistenciaKpis} isLoading={loadingStates.asistencia} fetchAsistenciaKpis={fetchAsistenciaKpis} /></TabsContent>
        
        <TabsContent isActive={activeTab === 'ventas'}>
          <VentasPanel fichaContext={fichaContext} />
        </TabsContent>
      </Tabs>
    </div>
  );
}