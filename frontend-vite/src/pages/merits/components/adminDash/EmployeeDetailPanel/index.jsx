// src/pages/merits/components/EmployeeDetailPanel/index.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, BarChart3, Gem, History } from 'lucide-react';

import useMeritDisplay from '../../../../../hooks/useMeritDisplay';

import { TabButton } from './ui/TabButton';
import { KpiTab } from './KpiTab';
import { MeritsTab } from './MeritsTab';
import { HistoryTab } from './HistoryTab';

export const EmployeeDetailPanel = ({ employee, allEmployees, appState, onClose }) => {
  const [activeTab, setActiveTab] = useState('kpis');
  
  // Usamos el hook para enriquecer el objeto del empleado con datos de méritos calculados
  const { enrichedEmployees } = useMeritDisplay([employee]);
  const enrichedEmployee = enrichedEmployees[0];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'merits':
        return <MeritsTab employee={enrichedEmployee} />;
      case 'history':
        return <HistoryTab employee={enrichedEmployee} appState={appState} />;
      case 'kpis':
      default:
        return <KpiTab employee={enrichedEmployee} allEmployees={allEmployees} />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-x-0 bg-black/60 backdrop-blur-sm z-40"
        style={{
          top: 'var(--app-header-height, 40px)',
          bottom: 'var(--app-footer-height, 64px)'
        }}
      />
      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 w-full max-w-2xl bg-dark-surface p-6 shadow-2xl z-50 flex flex-col"
        style={{
          top: 'var(--app-header-height, 40px)',
          bottom: 'var(--app-footer-height, 64px)'
        }}
      >
        {/* Header Fijo */}
        <div className="flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <img src={employee.profile_image_url} alt="profile" className="w-20 h-20 rounded-full object-cover border-2 border-dark-border" />
              <div>
                <h2 className="text-2xl font-bold text-dark-text-primary">{employee.nombre} {employee.apellido}</h2>
                <p className="text-dark-text-secondary">{employee.cargo} en {employee.local}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <Award size={16} /> {employee.merits_totals?.total_points || 0} Puntos Totales
                  </div>
                  <div className="text-dark-text-secondary">
                    Ranking Global: <span className="font-bold text-dark-text-primary">#{employee.puesto_empresa}</span>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-dark-surface-secondary transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Navegación de Tabs */}
          <div className="flex items-center border-b border-dark-border/20 mb-6">
            <TabButton label="KPIs" icon={BarChart3} isActive={activeTab === 'kpis'} onClick={() => setActiveTab('kpis')} />
            <TabButton label="Méritos" icon={Gem} isActive={activeTab === 'merits'} onClick={() => setActiveTab('merits')} />
            <TabButton label="Historial" icon={History} isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          </div>
        </div>

        {/* Contenido del Tab (con scroll) */}
        <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-dark-surface-secondary pr-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};