// src/hooks/useMeritSystem.jsx
import { useMemo } from 'react';
import {
  BrainCircuit, // Intelecto (INT)
  Shield,       // Resistencia (END)
  Sparkles,     // Suerte (LCK)
  HeartHandshake, // Carisma (CHA)
  Weight,       // Fuerza (STR)
  Wind,         // Agilidad (AGI)
  EyeIcon,      // Percepción (PER)
  Award,        // Default
} from 'lucide-react';

// --- CONFIGURACIÓN CENTRAL DE MÉRITOS ---

// 1. Íconos por Símbolo de Segmento (como los S.P.E.C.I.A.L. de Fallout)
export const SEGMENT_ICONS = {
  INT: BrainCircuit,
  END: Shield,
  LCK: Sparkles,
  CHA: HeartHandshake,
  STR: Weight,
  AGI: Wind,
  PER: EyeIcon,
  default: Award,
};
export const getSegmentIcon = (symbol) => SEGMENT_ICONS[symbol] || SEGMENT_ICONS.default;

// 2. Niveles (puedes ajustar la curva de progresión aquí)
const DEFAULT_LEVELS = [
  { min: 0,   key: 'novato',   label: 'Novato' },
  { min: 10,  key: 'aprendiz', label: 'Aprendiz' },
  { min: 50,  key: 'adepto',   label: 'Adepto' },
  { min: 150, key: 'experto',  label: 'Experto' },
  { min: 500, key: 'maestro',  label: 'Maestro' },
];

// 3. Helper para convertir balance en WEI a puntos
export function toPoints(balance, { decimals = 18 } = {}) {
  const n = Number(balance || 0);
  if (!Number.isFinite(n)) return 0;
  return n / Math.pow(10, decimals);
}

// --- HOOK PRINCIPAL ---

export default function useMeritSystem({ decimals = 18 } = {}) {
  const getLevelForScore = (score = 0) => {
    let current = DEFAULT_LEVELS[0];
    for (const row of DEFAULT_LEVELS) {
      if (score >= row.min) current = row; else break;
    }
    return current;
  };

  return useMemo(() => ({
    SEGMENT_ICONS,
    getSegmentIcon,
    DEFAULT_LEVELS,
    toPoints: (balance) => toPoints(balance, { decimals }),
    getLevelForScore,
  }), [decimals]);
}