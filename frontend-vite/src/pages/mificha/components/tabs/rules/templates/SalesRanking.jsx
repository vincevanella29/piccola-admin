// src/pages/mificha/components/tabs/rules/templates/SalesRanking.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Award, Gem, Target, DollarSign, Calendar, Trophy } from 'lucide-react';

const formatMetric = (key, t) => t(`mificha.rules.sales.metric_${key}`, key);
const formatScope = (scope, t) => t(`mificha.rules.sales.scope_${scope}`, scope);

const CompetitionProgress = ({ progress, params }) => {
  const { t } = useTranslation();
  
  // Extracción segura
  const rankingItem = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!rankingItem || typeof rankingItem.current_position === 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-light-surface-secondary/30 dark:bg-black/20 rounded-xl border border-dashed border-light-border/20">
        <TrendingUp size={20} className="text-light-text-tertiary dark:text-dark-text-tertiary mb-2 opacity-50"/>
        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
          {t('mificha.rules.sales.no_data', 'Calculando ranking...')}
        </span>
      </div>
    );
  }

  const { current_position, top_value, target_position } = rankingItem;
  const isWinner = current_position > 0 && current_position <= target_position;
  const isTop1 = current_position === 1;

  return (
    <div className="space-y-3">
        {/* --- Header: Posición --- */}
        <div className={`
            flex items-center justify-between p-3 rounded-xl border
            ${isWinner 
                ? 'bg-emerald-500/10 border-emerald-500/20' 
                : 'bg-light-surface-secondary/30 dark:bg-black/20 border-light-border/10 dark:border-white/5'}
        `}>
            <div className="flex items-center gap-3">
                <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg shadow-inner
                    ${isTop1 ? 'bg-yellow-400 text-black' : isWinner ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'}
                `}>
                    #{current_position > 0 ? current_position : '-'}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary font-bold tracking-wider">
                        {t('mificha.rules.sales.your_position', 'Ranking')}
                    </span>
                    <span className={`text-sm font-bold leading-tight ${isWinner ? 'text-emerald-500' : 'text-light-text-primary dark:text-white'}`}>
                        {isTop1 ? '¡Liderando!' : isWinner ? '¡En el Top!' : 'Sigue empujando'}
                    </span>
                </div>
            </div>

            <div className="text-right">
                <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary block mb-0.5 flex items-center justify-end gap-1">
                    <Target size={10} /> Meta
                </span>
                <div className="px-2 py-0.5 rounded bg-light-surface dark:bg-black/40 border border-light-border/10 dark:border-white/10 text-xs font-mono font-bold">
                    Top {target_position}
                </div>
            </div>
        </div>

        {/* --- Grid de Valores (Dinero) --- */}
        {(typeof top_value !== 'undefined' || typeof rankingItem?.current_value !== 'undefined') && (
             <div className="grid grid-cols-2 gap-2 text-xs">
                 {/* Tu Venta */}
                {typeof rankingItem?.current_value !== 'undefined' && (
                     <div className="p-2 rounded-lg bg-light-surface-secondary/50 dark:bg-white/5 border border-light-border/10 dark:border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1 flex items-center gap-1">
                            <DollarSign size={10} className="text-emerald-400"/> {t('mificha.rules.sales.your_value', 'Tu Venta')}
                        </span>
                        <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white">
                            ${Number(rankingItem.current_value)?.toLocaleString('es-CL')}
                        </span>
                    </div>
                )}
                
                {/* Líder */}
                {typeof top_value !== 'undefined' && (
                    <div className="p-2 rounded-lg bg-light-surface-secondary/30 dark:bg-white/5 border border-light-border/5 dark:border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1 flex items-center gap-1">
                            <Trophy size={10} className="text-yellow-500"/> {t('mificha.rules.sales.leader_value', 'Líder')}
                        </span>
                        <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white opacity-80">
                            ${Number(top_value)?.toLocaleString('es-CL')}
                        </span>
                    </div>
                )}
             </div>
        )}

        {/* --- Footer: Días Trabajados --- */}
        {Number(rankingItem?.min_days_worked) > 0 && (
            <div className="flex items-center gap-2 pt-1 pl-1">
                <div className="p-1 rounded bg-light-surface-secondary dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary">
                    <Calendar size={10} />
                </div>
                <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                    <span className="font-semibold text-light-text-primary dark:text-white">{(rankingItem.current_days_worked ?? '--')}</span>
                    <span className="opacity-70"> / {rankingItem.min_days_worked} días hábiles</span>
                </div>
            </div>
        )}
    </div>
  );
};

// --- Componentes Principales de la Tarjeta ---
const SalesRankingCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const scope = params.ranking_scope;
  const position = params.ranking_position;
  const isCompanyChamp = scope === 'empresa' && position === 1;

  return (
    <div className="mt-2 space-y-3">
      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
        {isCompanyChamp 
          ? t('mificha.rules.sales.card_desc_champ', 'Eres el mejor vendedor de toda la compañía.')
          : t('mificha.rules.sales.card_desc_normal', { position, metric: formatMetric(params.metric_key, t), scope: formatScope(scope, t) }, `Compite por estar entre los ${position} mejores.`)
        }
      </p>
      <CompetitionProgress progress={progress} params={params} />
    </div>
  );
};

const SalesRankingTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const { params } = merit;
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
        <TrendingUp size={16}/> 
        {t('mificha.rules.sales.tooltip_title', { position: params.ranking_position }, 'Ranking de Ventas')}
      </h4>
      <p className="text-xs text-gray-300">
        {t('mificha.rules.sales.tooltip_desc', { position: params.ranking_position, scope: formatScope(params.ranking_scope, t) }, 'Se evalúa el monto total vendido en el periodo.')}
      </p>
      
      <div className="pt-2 border-t border-white/10">
        <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
             <li>{t('mificha.rules.sales.tooltip_li1', 'Mayor venta sube en el ranking.')}</li>
             <li>{t('mificha.rules.sales.tooltip_li2', 'Considera solo ventas efectivas.')}</li>
        </ul>
      </div>
    </div>
  );
};

// --- Configuración Completa ---
export const config = {
  key: 'sales_ranking_position',
  icon: TrendingUp,
  card: SalesRankingCard,
  tooltip: SalesRankingTooltip,
  getCardStyle: (merit) => {
    const scope = merit.params?.ranking_scope;
    const position = merit.params?.ranking_position;
    
    // Elite (Empresa Top 1)
    if (scope === 'empresa' && position === 1) {
      return { 
          borderColor: 'rgba(192, 132, 252, 0.6)', // Purple
          backgroundColor: 'rgba(168, 85, 247, 0.08)',
          icon: Gem
      };
    }
    // Champion (Local Top 1)
    if (scope === 'local' && position === 1) {
      return { 
          borderColor: 'rgba(234, 179, 8, 0.6)', // Gold
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          icon: Award
      };
    }
    // Standard Sales (Green)
    return { 
        borderColor: 'rgba(16, 185, 129, 0.4)', // Emerald
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        icon: TrendingUp
    };
  },
};