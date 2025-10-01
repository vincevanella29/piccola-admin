import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Hash, Users, UserCheck } from 'lucide-react';

import { useKpiBenchmarks } from './hooks/useKpiBenchmarks';
import { BenchmarkDetailCard } from './ui/BenchmarkDetailCard';
import { TabButton } from './ui/TabButton';

// El prop `allEmployees` es la lista completa que viene desde MeritsDashboardPage
export const KpiTab = ({ employee, allEmployees }) => {
  const [activeKpi, setActiveKpi] = useState('sales');
  console.log("allEmployees", allEmployees);
  const benchmarks = useKpiBenchmarks(employee, allEmployees);

  console.log("benchmarks", benchmarks);

  // Map comparative/variation data from employee payload to KPI keys used here
  const comp = employee?.comparativo || {};
  const vari = employee?.variacion || {};
  const comparativeMap = {
    sales: comp.total_venta,
    personas_atendidas: comp.personas_atendidas,
    total_mesas: comp.total_mesas,
    promedio_por_persona: comp.promedio_por_persona,
    promedio_por_mesa: comp.promedio_mesa,
  };
  const variationMap = {
    sales: vari.total_venta,
    personas_atendidas: vari.personas_atendidas,
    total_mesas: vari.total_mesas,
    promedio_por_persona: vari.promedio_por_persona,
    promedio_por_mesa: vari.promedio_mesa,
  };

  const kpiConfig = {
    sales: { label: 'Ventas', icon: DollarSign, unit: '$', data: benchmarks.sales },
    personas_atendidas: { label: 'Personas', icon: Users, unit: '', data: benchmarks.personas_atendidas },
    total_mesas: { label: 'Mesas', icon: Hash, unit: '', data: benchmarks.total_mesas },
    promedio_por_persona: { label: 'Prom x Persona', icon: UserCheck, unit: '$', data: benchmarks.promedio_por_persona },
    promedio_por_mesa: { label: 'Prom x Mesa', icon: DollarSign, unit: '$', data: benchmarks.promedio_por_mesa },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center border-b border-dark-border/20">
        {Object.entries(kpiConfig).map(([key, { label, icon }]) => (
          <TabButton
            key={key}
            label={label}
            icon={icon}
            isActive={activeKpi === key}
            onClick={() => setActiveKpi(key)}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeKpi}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {kpiConfig[activeKpi] && (
            <BenchmarkDetailCard
              title={kpiConfig[activeKpi].label}
              icon={kpiConfig[activeKpi].icon}
              unit={kpiConfig[activeKpi].unit}
              kpiData={kpiConfig[activeKpi].data}
              comparative={comparativeMap[activeKpi]}
              variation={variationMap[activeKpi]}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};