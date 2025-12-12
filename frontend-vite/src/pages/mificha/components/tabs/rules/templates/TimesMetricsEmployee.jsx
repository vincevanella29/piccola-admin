// src/pages/mificha/components/tabs/rules/templates/TimesMetricsEmployee.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Zap, Trophy, TrendingDown, Clock, Activity } from 'lucide-react';

// Formateador simple y limpio
const fmtTime = (v) => (typeof v === 'number' ? `${v.toFixed(1)} min` : '--');
const fmtCount = (v) => (typeof v === 'number' ? v : '--');

const ProgressTimesEmployee = ({ progress, params }) => {
  const { t } = useTranslation();
  
  // Extraer datos con seguridad
  const item = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!item || typeof item.current_position === 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-light-surface-secondary/30 dark:bg-black/20 rounded-xl border border-dashed border-light-border/20">
        <Activity size={20} className="text-light-text-tertiary dark:text-dark-text-tertiary mb-2 opacity-50"/>
        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
          {t('mificha.rules.times_local.no_data', 'Sin datos de tiempos aún')}
        </span>
      </div>
    );
  }

  const target = params?.ranking_position ?? 1;
  // Detectar si la métrica es por conteo (muestras) o por tiempo (segundos/minutos)
  const isTimeMetric = params?.position_metric !== 'samples'; 
  const metricType = isTimeMetric ? 'time' : 'count';
  
  const { current_position, best_value, avg_value, current_value } = item;
  const isWinner = current_position > 0 && current_position <= target;
  const isTop1 = current_position === 1;

  // Renderizador de valor (Tiempo o Cantidad)
  const renderValue = (val) => isTimeMetric ? fmtTime(val) : fmtCount(val);

  return (
    <div className="space-y-3">
        {/* --- Card de Posición y Estado --- */}
        <div className={`
            flex items-center justify-between p-3 rounded-xl border
            ${isWinner 
                ? 'bg-blue-500/10 border-blue-500/20' 
                : 'bg-light-surface-secondary/30 dark:bg-black/20 border-light-border/10 dark:border-white/5'}
        `}>
            <div className="flex items-center gap-3">
                <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg shadow-inner
                    ${isTop1 ? 'bg-yellow-400 text-black' : isWinner ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'}
                `}>
                    #{current_position > 0 ? current_position : '-'}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary font-bold tracking-wider">
                        {t('mificha.rules.times_local.ranking_label', 'Ranking')}
                    </span>
                    <span className={`text-sm font-bold leading-tight ${isWinner ? 'text-blue-500' : 'text-light-text-primary dark:text-white'}`}>
                        {isTop1 ? '¡El más veloz!' : isWinner ? '¡Buena velocidad!' : 'Acelera el paso'}
                    </span>
                </div>
            </div>

            {/* Target Badge */}
            <div className="text-right">
                <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary block mb-0.5">Meta</span>
                <div className="px-2 py-0.5 rounded bg-light-surface dark:bg-black/40 border border-light-border/10 dark:border-white/10 text-xs font-mono font-bold">
                    Top {target}
                </div>
            </div>
        </div>

        {/* --- Métricas de Velocidad (Grid) --- */}
        <div className="grid grid-cols-3 gap-2 text-xs">
            {/* Mi Tiempo */}
            <div className="col-span-1 p-2 rounded-lg bg-light-surface-secondary/50 dark:bg-white/5 border border-light-border/10 dark:border-white/5 flex flex-col justify-between">
                <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1 flex items-center gap-1">
                    <Zap size={10} className="text-blue-400"/> {t('mificha.rules.times_local.your_value', 'Tú')}
                </span>
                <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white">
                    {renderValue(current_value)}
                </span>
            </div>

            {/* Mejor Tiempo (Benchmark) */}
            <div className="col-span-1 p-2 rounded-lg bg-light-surface-secondary/30 dark:bg-white/5 border border-light-border/5 dark:border-white/5 flex flex-col justify-between">
                <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1 flex items-center gap-1">
                    <Trophy size={10} className="text-yellow-500"/> {t('mificha.rules.times_local.best', 'Récord')}
                </span>
                <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white opacity-80">
                    {renderValue(best_value)}
                </span>
            </div>

            {/* Promedio */}
            <div className="col-span-1 p-2 rounded-lg bg-light-surface-secondary/30 dark:bg-white/5 border border-light-border/5 dark:border-white/5 flex flex-col justify-between">
                <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1 flex items-center gap-1">
                    <TrendingDown size={10} className="text-gray-400"/> Avg
                </span>
                <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white opacity-60">
                    {renderValue(avg_value)}
                </span>
            </div>
        </div>
    </div>
  );
};

const TimesMetricsEmployeeCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const position = params?.ranking_position;

  return (
    <div className="mt-2 space-y-4">
      {/* Descripción dinámica */}
      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
        {position === 1
          ? t('mificha.rules.times_local.card_desc_champ', 'Sé el más rápido y eficiente del equipo.')
          : t('mificha.rules.times_local.card_desc_normal', { position }, `Ubícate entre los ${position} mejores tiempos.`)}
      </p>
      <ProgressTimesEmployee progress={progress} params={params} />
    </div>
  );
};

const TimesMetricsEmployeeTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const position = merit?.params?.ranking_position;
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-blue-400 flex items-center gap-2">
        <Timer size={16}/> 
        {t('mificha.rules.times_local.tooltip_title', { position }, 'Competencia de Velocidad')}
      </h4>
      <p className="text-xs text-gray-300">
        {t('mificha.rules.times_local.tooltip_desc', { position }, 'Se mide la eficiencia en tiempos de atención o preparación.')}
      </p>
      <div className="pt-2 border-t border-white/10">
        <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
            <li>{t('mificha.rules.times_local.tooltip_li1', 'Menor tiempo es mejor (usualmente).')}</li>
            <li>{t('mificha.rules.times_local.tooltip_li2', 'Se compara con el promedio histórico o del equipo.')}</li>
        </ul>
      </div>
    </div>
  );
};

export const config = {
  key: 'times_metrics_employee',
  icon: Clock, // Icono base
  card: TimesMetricsEmployeeCard,
  tooltip: TimesMetricsEmployeeTooltip,
  getCardStyle: (merit) => {
    const position = merit?.params?.ranking_position;
    // Top 1: Azul Brillante
    if (position === 1) {
      return { 
          borderColor: 'rgba(59, 130, 246, 0.6)', // Blue 500
          backgroundColor: 'rgba(59, 130, 246, 0.08)', 
          icon: Zap // Rayo para el #1
      };
    }
    // General: Azul Tecnológico sutil
    return { 
        borderColor: 'rgba(96, 165, 250, 0.4)', // Blue 400
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        icon: Timer
    };
  },
};