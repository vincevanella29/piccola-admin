import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Shield, BrainCircuit, Sparkles, HeartHandshake, Wind, Weight, EyeIcon, Wallet, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SEGMENT_ICONS = {
  INT: BrainCircuit, END: Shield, LCK: Sparkles, CHA: HeartHandshake,
  STR: Weight, AGI: Wind, PER: EyeIcon, default: Award
};

export default function MeritAccordionItem({ segment }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState('total'); // 'wallet' | 'total'
  
  // --- Procesamiento de Datos ---
  // segment.balance = Confirmado en Blockchain (Wei)
  // segment.pending = Pendiente de minting (Puntos simples)
  const walletBalance = useMemo(() => parseFloat(segment.balance || 0) / 1e18, [segment.balance]);
  const pendingBalance = useMemo(() => {
    const raw = segment.pending;
    if (Array.isArray(raw)) {
      return raw.reduce((acc, v) => acc + (Number(v) || 0), 0);
    }
    if (raw && typeof raw === 'object') {
      return Object.values(raw).reduce((acc, v) => acc + (Number(v) || 0), 0);
    }
    return Number(raw) || 0;
  }, [segment.pending]); 
  
  const totalBalance = walletBalance + pendingBalance;
  
  // Si estamos en modo 'wallet', mostramos solo lo confirmado. Si es 'total', mostramos la suma.
  const currentDisplayValue = viewMode === 'wallet' ? walletBalance : totalBalance;

  const Icon = SEGMENT_ICONS[segment.symbol] || SEGMENT_ICONS.default;

  // --- Lógica de Niveles (Calculada sobre el Total para motivar) ---
  const getLevel = (score) => {
    if (score < 10) return { level: 1, key: 'novato', next: 10, start: 0 };
    if (score < 50) return { level: 2, key: 'aprendiz', next: 50, start: 10 };
    if (score < 150) return { level: 3, key: 'adepto', next: 150, start: 50 };
    if (score < 500) return { level: 4, key: 'experto', next: 500, start: 150 };
    return { level: 5, key: 'maestro', next: Infinity, start: 500 };
  };

  const { level, key, next, start } = getLevel(totalBalance);
  const levelName = t(`mificha.levels.${key}`, key);
  
  // Progreso Visual
  const range = next - start;
  const progress = next === Infinity ? 100 : ((totalBalance - start) / range) * 100;
  const safeProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/20 shadow-sm hover:shadow-md transition-shadow">
      
      {/* Icono de Fondo Decorativo */}
      <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none transform rotate-12">
        <Icon size={140} />
      </div>

      <div className="p-5 flex flex-col gap-5">
        
        {/* --- HEADER: Título y Toggle Switch --- */}
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className={`
                    p-2.5 rounded-xl border shadow-sm transition-colors duration-300
                    ${viewMode === 'wallet' 
                        ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/20' 
                        : 'bg-light-accent/10 text-light-accent border-light-accent/20'} 
                `}>
                    <Icon size={22} />
                </div>
                <div>
                    <h3 className="font-bold text-base text-light-text-primary dark:text-white leading-none">{segment.name}</h3>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-light-text-secondary dark:text-dark-text-secondary mt-1.5">
                        {t('mificha.nivel_label', 'Nivel')} {level} • {levelName}
                    </p>
                </div>
            </div>

            {/* Switch iOS Style */}
            <div className="flex p-1 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg border border-light-border/10 dark:border-dark-border/20 relative h-8">
                <button
                    onClick={() => setViewMode('wallet')}
                    className={`relative z-10 px-3 h-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors ${viewMode === 'wallet' ? 'text-matrix-green' : 'text-light-text-tertiary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
                >
                    <Wallet size={12} />
                    Wallet
                </button>
                <button
                    onClick={() => setViewMode('total')}
                    className={`relative z-10 px-3 h-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors ${viewMode === 'total' ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-tertiary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
                >
                    <RefreshCcw size={12} />
                    Simulado
                </button>
                
                {/* Fondo Animado del Switch */}
                <motion.div 
                    className="absolute inset-y-1 rounded-md bg-light-surface dark:bg-dark-surface shadow-sm"
                    initial={false}
                    animate={{ 
                        left: viewMode === 'wallet' ? '4px' : '50%', 
                        x: viewMode === 'wallet' ? 0 : 4,
                        width: 'calc(50% - 8px)' 
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
            </div>
        </div>

        {/* --- DISPLAY NUMÉRICO --- */}
        <div className="flex items-end justify-between border-b border-light-border/5 dark:border-dark-border/20 pb-4">
            <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    {viewMode === 'wallet' ? t('mificha.saldo_blockchain', 'Saldo Blockchain') : t('mificha.saldo_proyectado', 'Saldo Proyectado')}
                </span>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={viewMode}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-baseline gap-1.5"
                    >
                        <span className={`text-4xl font-mono font-bold tracking-tight ${viewMode === 'wallet' ? 'text-matrix-green' : 'text-light-text-primary dark:text-white'}`}>
                            {currentDisplayValue.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary self-end mb-1.5">{segment.symbol}</span>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Aviso de Pendientes (Solo visible en modo 'total' si hay pendientes) */}
            {viewMode === 'total' && pendingBalance > 0 && (
                <div className="text-right flex flex-col items-end animate-pulse">
                    <span className="px-2 py-1 rounded bg-light-accent/10 border border-light-accent/20 text-light-accent dark:text-dark-accent text-[10px] font-bold flex items-center gap-1.5">
                        <RefreshCcw size={10} className="animate-spin-slow"/>
                        +{pendingBalance.toLocaleString()} Pendientes
                    </span>
                </div>
            )}
        </div>

        {/* --- BARRA DE PROGRESO --- */}
        <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary">
                <span>{Math.round(safeProgress)}% {t('mificha.para_siguiente_nivel', 'para Nvl')} {next === Infinity ? 'MAX' : level + 1}</span>
                <span>{next === Infinity ? 'MAX' : `${(next - totalBalance).toLocaleString()} pts restantes`}</span>
            </div>
            <div className="h-2 w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
                <motion.div 
                    className={`h-full ${viewMode === 'wallet' ? 'bg-matrix-green' : 'bg-gradient-to-r from-light-accent to-matrix-green'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${safeProgress}%` }}
                    transition={{ duration: 1, ease: "circOut" }}
                />
            </div>
        </div>

      </div>
    </div>
  );
};