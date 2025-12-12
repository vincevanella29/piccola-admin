// src/pages/mificha/components/tabs/rules/templates/TimesMetricsLocal.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Award, Store, Trophy, TrendingDown, MapPin } from 'lucide-react';

// Formateo limpio
const fmtSec = (v) => (typeof v === 'number' ? `${v.toFixed(1)} min` : '--');
const fmtCount = (v) => (typeof v === 'number' ? v : '--');

const TimesMetricsLocalProgress = ({ progress, params }) => {
  const { t } = useTranslation();
  
  // Extracción segura de datos
  const item = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'local_ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!item || typeof item.current_position === 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-light-surface-secondary/30 dark:bg-black/20 rounded-xl border border-dashed border-light-border/20">
        <Store size={20} className="text-light-text-tertiary dark:text-dark-text-tertiary mb-2 opacity-50"/>
        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
          {t('mificha.rules.times_local.no_data', 'Calculando métricas de local...')}
        </span>
      </div>
    );
  }

  const target = params?.ranking_position ?? 1;
  const isTimeMetric = params?.position_metric !== 'samples';
  const { current_position, best_value, avg_value, current_value, local } = item;
  const isWinner = current_position > 0 && current_position <= target;
  const isTop1 = current_position === 1;

  const renderValue = (val) => isTimeMetric ? fmtSec(val) : fmtCount(val);

  return (
    <div className="space-y-3">
        {/* --- Header: Ranking y Meta --- */}
        <div className={`
            flex items-center justify-between p-3 rounded-xl border
            ${isWinner 
                ? 'bg-cyan-500/10 border-cyan-500/20' 
                : 'bg-light-surface-secondary/30 dark:bg-black/20 border-light-border/10 dark:border-white/5'}
        `}>
            <div className="flex items-center gap-3">
                <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg shadow-inner
                    ${isTop1 ? 'bg-yellow-400 text-black' : isWinner ? 'bg-cyan-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'}
                `}>
                    #{current_position > 0 ? current_position : '-'}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary font-bold tracking-wider">
                        {t('mificha.rules.times_local.ranking_label', 'Ranking Local')}
                    </span>
                    <span className={`text-sm font-bold leading-tight ${isWinner ? 'text-cyan-500' : 'text-light-text-primary dark:text-white'}`}>
                        {isTop1 ? '¡Local Líder!' : isWinner ? '¡Buen trabajo!' : 'A mejorar tiempos'}
                    </span>
                </div>
            </div>

            <div className="text-right">
                <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary block mb-0.5">Meta</span>
                <div className="px-2 py-0.5 rounded bg-light-surface dark:bg-black/40 border border-light-border/10 dark:border-white/10 text-xs font-mono font-bold">
                    Top {target}
                </div>
            </div>
        </div>

        {/* --- Grid de Métricas --- */}
        <div className="grid grid-cols-3 gap-2 text-xs">
             {/* Valor Actual */}
             <div className="col-span-1 p-2 rounded-lg bg-light-surface-secondary/50 dark:bg-white/5 border border-light-border/10 dark:border-white/5 flex flex-col justify-between">
                <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1 flex items-center gap-1">
                    <Timer size={10} className="text-cyan-400"/> {t('mificha.rules.times_local.your_value', 'Actual')}
                </span>
                <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white">
                    {renderValue(current_value)}
                </span>
            </div>

            {/* Mejor Valor */}
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

        {/* --- Footer Local (Si existe) --- */}
        {!!local && (
             <div className="flex items-center gap-1.5 text-[10px] text-light-text-secondary dark:text-dark-text-secondary pt-1 pl-1">
                <MapPin size={10} />
                <span className="truncate max-w-[200px]">{local}</span>
             </div>
        )}
    </div>
  );
};

const TimesMetricsLocalCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const position = params?.ranking_position;

  return (
    <div className="mt-2 space-y-4">
      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
        {position === 1
          ? t('mificha.rules.times_local.card_desc_champ', 'Tu local es el más eficiente de la cadena.')
          : t('mificha.rules.times_local.card_desc_normal', { position }, `Posiciona tu local entre los ${position} mejores.`)}
      </p>
      <TimesMetricsLocalProgress progress={progress} params={params} />
    </div>
  );
};

const TimesMetricsLocalTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const position = merit?.params?.ranking_position;
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
        <Store size={16}/> 
        {t('mificha.rules.times_local.tooltip_title', { position }, 'Eficiencia de Local')}
      </h4>
      <p className="text-xs text-gray-300">
        {t('mificha.rules.times_local.tooltip_desc', { position }, 'Mide el desempeño promedio de los tiempos en tu sucursal.')}
      </p>
      <div className="pt-2 border-t border-white/10">
        <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
            <li>{t('mificha.rules.times_local.tooltip_li1', 'Competencia entre sucursales.')}</li>
            <li>{t('mificha.rules.times_local.tooltip_li2', 'Contribuye al ranking general de la empresa.')}</li>
        </ul>
      </div>
    </div>
  );
};

export const config = {
  key: 'times_metrics_local',
  icon: Store, // Icono de Tienda para diferenciar
  card: TimesMetricsLocalCard,
  tooltip: TimesMetricsLocalTooltip,
  getCardStyle: (merit) => {
    const position = merit?.params?.ranking_position;
    
    // Top 1: Dorado
    if (position === 1) {
      return { 
          borderColor: 'rgba(234, 179, 8, 0.6)', 
          backgroundColor: 'rgba(234, 179, 8, 0.08)', 
          icon: Trophy 
      };
    }
    // General: Cyan/Turquesa
    return { 
        borderColor: 'rgba(6, 182, 212, 0.4)', // Cyan 500
        backgroundColor: 'rgba(6, 182, 212, 0.05)', 
        icon: Store
    };
  },
};