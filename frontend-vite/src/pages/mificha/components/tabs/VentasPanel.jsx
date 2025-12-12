// src/pages/employees_register/components/tabs/VentasPanel.jsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LoaderCircle, 
  BarChart2, 
  History, 
  FileText, 
  TrendingUp 
} from 'lucide-react';
import { Tooltip as ReactTooltip } from 'react-tooltip';

import VentasResumenPanel from './VentasResumenPanel';
import HistorialVentasPanel from './HistorialVentasPanel';
import AnalisisProductosPanel from './AnalisisProductosPanel';

export default function VentasPanel({ fichaContext }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('resumen');

  const {
      loadingStates,
      ventasData,
      ventasDetalle,
      fetchVentasTotal,
      fetchVentasPorPeriodo,
      fetchVentasDetalleProductos
  } = fichaContext;

  // Carga inicial de datos esenciales
  useEffect(() => {
    if (!ventasData.porPeriodo) fetchVentasPorPeriodo();
    if (!ventasData.total) fetchVentasTotal();
  }, [fetchVentasPorPeriodo, fetchVentasTotal]);

  // Configuración de Tabs para iterar limpiamente
  const tabs = [
    { id: 'resumen', label: t('mificha.tab_resumen', 'Resumen Global'), icon: BarChart2 },
    { id: 'historial', label: t('mificha.tab_historial', 'Historial Mensual'), icon: History },
    { id: 'detalle', label: t('mificha.tab_detalle', 'Productos'), icon: FileText },
  ];

  // Loading inicial "Blocking" solo si no hay data crítica para mostrar la estructura
  const isInitialLoading = loadingStates.ventasTotal && !ventasData.total;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <LoaderCircle className="animate-spin text-matrix-green" size={40} />
        <span className="text-sm text-light-text-tertiary dark:text-dark-text-secondary animate-pulse">
          Sincronizando datos de ventas...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tooltip Global Config */}
      <ReactTooltip 
        id="benchmark-tooltip" 
        className="!bg-dark-surface !text-white !border !border-dark-border/50 !rounded-lg !px-3 !py-2 !opacity-100 !shadow-xl"
        place="top"
        style={{ zIndex: 100 }}
      />
      
      {/* Header Visual */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-light-accent/20 to-light-accent/5 dark:from-dark-accent/20 dark:to-dark-accent/5 border border-light-accent/10 dark:border-dark-accent/10">
            <TrendingUp size={22} className="text-light-accent dark:text-dark-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
              Rendimiento Comercial
            </h2>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Analiza tus comisiones, ventas totales y productos estrella.
            </p>
          </div>
        </div>

        {/* Sliding Segmented Control (Tabs) */}
        <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/30 rounded-xl border border-light-border/10 dark:border-dark-border/10">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors z-10 flex-1 sm:flex-none justify-center
                  ${isActive ? 'text-light-text-primary dark:text-white' : 'text-light-text-tertiary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-white'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white dark:bg-dark-surface shadow-sm rounded-lg border border-light-border/10 dark:border-dark-border/10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area con Animaciones de Transición */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'resumen' && (
              <VentasResumenPanel 
                  ventasTotal={ventasData.total} 
                  kpisUltimos={ventasData.kpisUltimos} 
                  isLoading={loadingStates.ventasTotal} 
              />
            )}
            
            {activeTab === 'historial' && (
              <HistorialVentasPanel 
                  historial={ventasData.porPeriodo} 
                  isLoading={loadingStates.ventasPorPeriodo} 
              />
            )}
            
            {activeTab === 'detalle' && (
              <AnalisisProductosPanel
                  ventasDetalle={ventasDetalle}
                  fetchVentasDetalleProductos={fetchVentasDetalleProductos}
                  isLoading={loadingStates.ventasDetalle}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}