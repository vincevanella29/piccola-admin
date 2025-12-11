// src/pages/employees_register/components/tabs/VentasPanel.jsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { LoaderCircle, BarChart2, History, FileText } from 'lucide-react';
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

  useEffect(() => {
    if (!ventasData.porPeriodo) {
      fetchVentasPorPeriodo();
    }
    if (!ventasData.total) {
      fetchVentasTotal();
    }
  }, [fetchVentasPorPeriodo, fetchVentasTotal]);

  const TabButton = ({ id, label, icon: Icon, action, current }) => (
    <button onClick={action} className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-md transition-colors ${current === id ? 'bg-matrix-green/10 text-matrix-green' : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}>
      <Icon size={16} /><span className="hidden sm:inline">{label}</span>
    </button>
  );

  // isLoading es verdadero si CUALQUIERA de las cargas de esta pestaña está activa
  const isLoading = loadingStates.ventasPorPeriodo || loadingStates.ventasTotal;
  if (isLoading && (!ventasData.porPeriodo || !ventasData.total)) {
    return <div className="flex justify-center p-8"><LoaderCircle className="animate-spin text-matrix-green" /></div>;
  }

  return (
    <div className="space-y-6">
      <ReactTooltip id="benchmark-tooltip" border="1px solid #444" style={{ backgroundColor: '#2A2A2A', color: '#fff', zIndex: 50 }} />
      
      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-dark-surface-secondary/40 border border-dark-border/20 w-full overflow-x-auto scrollbar-none">
        <TabButton id="resumen" label={t('mificha.tab_resumen', 'Resumen Histórico')} icon={BarChart2} action={() => setActiveTab('resumen')} current={activeTab} />
        <TabButton id="historial" label={t('mificha.tab_historial', 'Historial Mensual')} icon={History} action={() => setActiveTab('historial')} current={activeTab} />
        <TabButton id="detalle" label={t('mificha.tab_detalle', 'Análisis de Productos')} icon={FileText} action={() => setActiveTab('detalle')} current={activeTab} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>

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
  );
}