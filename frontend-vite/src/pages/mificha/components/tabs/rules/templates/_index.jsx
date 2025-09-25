import React from 'react';
import { HardHat } from 'lucide-react';

// Importa todas las configuraciones de las reglas
import { config as attendanceConfig } from './Attendance';
import { config as salesRankingConfig } from './SalesRanking';

// Plantilla por defecto para reglas no encontradas
const defaultConfig = {
  icon: HardHat,
  card: () => <div>Regla no configurada.</div>,
  tooltip: () => <p>Contacta a administración para más detalles.</p>,
  getCardStyle: () => ({
    borderColor: 'rgba(107, 114, 128, 0.4)',
    backgroundColor: 'rgba(31, 41, 55, 0.5)',
  }),
};

// Construye el mapa de configuraciones dinámicamente
const ruleConfigs = {
  [attendanceConfig.key]: attendanceConfig,
  [salesRankingConfig.key]: salesRankingConfig,
};

// Función helper que exportaremos
export const getRuleConfig = (templateKey) => {
  return ruleConfigs[templateKey] || defaultConfig;
};