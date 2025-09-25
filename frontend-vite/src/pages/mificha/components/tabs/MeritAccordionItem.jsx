// src/pages/employees_register/components/ui/MeritAccordionItem.jsx

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Shield, BrainCircuit, Sparkles, HeartHandshake, Wind, Weight, EyeIcon, BarChart, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SEGMENT_ICONS = {
  INT: BrainCircuit, END: Shield, LCK: Sparkles, CHA: HeartHandshake,
  STR: Weight, AGI: Wind, PER: EyeIcon, default: Award
};

// --- Componente para un stat individual dentro de la tarjeta ---
const Stat = ({ label, value }) => (
    <div className="bg-light-surface dark:bg-dark-surface p-2 rounded-md text-center">
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{label}</p>
        <p className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary text-sm">{value}</p>
    </div>
);

export default function MeritAccordionItem({ segment }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('progreso');
  const balance = useMemo(() => parseFloat(segment.balance) / 1e18, [segment.balance]);
  const Icon = SEGMENT_ICONS[segment.symbol] || SEGMENT_ICONS.default;

  const getLevel = (score) => {
    if (score < 10) return { level: 1, key: 'novato', next: 10, current: 0 };
    if (score < 50) return { level: 2, key: 'aprendiz', next: 50, current: 10 };
    if (score < 150) return { level: 3, key: 'adepto', next: 150, current: 50 };
    if (score < 500) return { level: 4, key: 'experto', next: 500, current: 150 };
    return { level: 5, key: 'maestro', next: Infinity, current: 500 };
  };

  const { level, key, next, current } = getLevel(balance);
  const levelName = t(`mificha.levels.${key}`, key);
  
  const pointsForNextLevel = next - current;
  const progressInLevel = balance - current;
  const progressPercent = next === Infinity ? 100 : (progressInLevel / pointsForNextLevel) * 100;
  
  const nextLevelInfo = getLevel(next);
  const nextLevelName = t(`mificha.levels.${nextLevelInfo.key}`, nextLevelInfo.key);

  const pointsNeeded = next - balance;

  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-lg border border-light-border/20 dark:border-dark-border/20">
      {/* --- HEADER --- */}
      <header className="flex items-center justify-between p-3 border-b border-light-border/10 dark:border-dark-border/10">
        <div className="flex items-center gap-3">
          <Icon className="text-matrix-green" size={24} />
          <span className="font-bold text-lg text-light-text-primary dark:text-dark-text-primary">{segment.name}</span>
        </div>
        <span className="font-mono text-xl px-3 py-1 rounded-md bg-light-surface-secondary dark:bg-dark-surface-secondary text-matrix-green font-bold">
            {balance.toFixed(2)}
        </span>
      </header>

      {/* --- SELECTOR DE TABS --- */}
      <div className="flex bg-light-surface/50 dark:bg-dark-surface/50">
          <button 
              onClick={() => setActiveTab('progreso')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'progreso' 
                  ? 'border-matrix-green text-matrix-green' 
                  : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }`}
          >
              <BarChart size={14} /> {t('mificha.progreso', 'Progreso')}
          </button>
          <button 
              onClick={() => setActiveTab('detalle')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'detalle' 
                  ? 'border-matrix-green text-matrix-green' 
                  : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }`}
          >
              <FileText size={14} /> {t('mificha.detalle', 'Detalle')}
          </button>
      </div>
      
      {/* --- CONTENIDO DE TABS --- */}
      <div className="p-4">
        <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === 'progreso' && (
                    <div className="space-y-2">
                        <p className="text-center text-sm font-semibold text-matrix-green">{`${t('mificha.nivel_prefix', 'Nivel')} ${level}: ${levelName}`}</p>
                        <div className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full h-2.5">
                            <motion.div 
                                className="bg-matrix-green h-2.5 rounded-full" 
                                initial={{ width: 0 }} 
                                animate={{ width: `${progressPercent}%` }} 
                                transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary">
                            <span>{current} pts</span>
                            <span>{next === Infinity ? t('mificha.nivel_maximo', 'Nivel Máximo') : `${next} pts`}</span>
                        </div>
                    </div>
                )}

                {activeTab === 'detalle' && (
                    <div className="grid grid-cols-2 gap-3">
                        <Stat label={t('mificha.nivel_actual', 'Nivel Actual')} value={`Nvl. ${level}`} />
                        <Stat label={t('mificha.para_siguiente_nivel', 'Faltan')} value={next === Infinity ? 'MAX' : `${pointsNeeded.toFixed(2)} pts`} />
                        <Stat label={t('mificha.proximo_nivel', 'Próximo Nivel')} value={next === Infinity ? '-' : `Nvl. ${nextLevelInfo.level}`} />
                        <Stat label={t('mificha.balance_total', 'Balance')} value={balance.toFixed(2)} />
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};