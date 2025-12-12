import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Award, Gem, Target, Trophy } from 'lucide-react';

const formatMetric = (key, t) => t(`mificha.rules.sales.metric_${key}`, key);
const formatScope = (scope, t) => t(`mificha.rules.sales.scope_${scope}`, scope);

const CompetitionProgress = ({ progress, params }) => {
  const { t } = useTranslation();
  const rankingItem = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!rankingItem || typeof rankingItem.current_position === 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-light-surface-secondary/30 dark:bg-black/20 rounded-xl border border-dashed border-light-border/20">
        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
          {t('mificha.rules.sales.no_data', 'Calculando posición...')}
        </span>
      </div>
    );
  }

  const { current_position, top_value, target_position } = rankingItem;
  const isWinner = current_position > 0 && current_position <= target_position;
  const isTop1 = current_position === 1;

  return (
    <div className="space-y-3">
        {/* --- Card de Posición Principal --- */}
        <div className={`
            flex items-center justify-between p-3 rounded-xl border
            ${isWinner 
                ? 'bg-gradient-to-r from-matrix-green/10 to-transparent border-matrix-green/20' 
                : 'bg-light-surface-secondary/30 dark:bg-black/20 border-light-border/10 dark:border-white/5'}
        `}>
            <div className="flex items-center gap-3">
                <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg shadow-inner
                    ${isTop1 ? 'bg-yellow-400 text-black' : isWinner ? 'bg-matrix-green text-black' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'}
                `}>
                    #{current_position > 0 ? current_position : '-'}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary font-bold tracking-wider">
                        {t('mificha.rules.sales.your_position', 'Tu Posición')}
                    </span>
                    <span className={`text-sm font-bold leading-tight ${isWinner ? 'text-matrix-green' : 'text-light-text-primary dark:text-white'}`}>
                        {isWinner ? '¡Dentro del Top!' : 'Sigue subiendo'}
                    </span>
                </div>
            </div>
            
            <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase mb-0.5">
                    <Target size={10} />
                    <span>Meta</span>
                </div>
                <div className="px-2 py-0.5 rounded bg-light-surface dark:bg-black/40 border border-light-border/10 dark:border-white/10 text-xs font-mono font-bold">
                    Top {target_position}
                </div>
            </div>
        </div>

        {/* --- Métricas Detalladas (Grid) --- */}
        {(typeof top_value !== 'undefined' || typeof rankingItem?.current_value !== 'undefined') && (
            <div className="grid grid-cols-2 gap-2 text-xs">
                {typeof rankingItem?.current_value !== 'undefined' && (
                    <div className="p-2 rounded-lg bg-light-surface-secondary/20 dark:bg-white/5 border border-light-border/5 dark:border-white/5">
                        <span className="block text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-1">
                            {t('mificha.rules.sales.your_value', 'Tu Venta')}
                        </span>
                        <span className="font-mono font-bold text-light-text-primary dark:text-white">
                            ${Number(rankingItem.current_value)?.toLocaleString('es-CL')}
                        </span>
                    </div>
                )}
                {typeof top_value !== 'undefined' && (
                    <div className="p-2 rounded-lg bg-light-surface-secondary/20 dark:bg-white/5 border border-light-border/5 dark:border-white/5">
                        <span className="block text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-1 flex items-center gap-1">
                            <Trophy size={10} className="text-yellow-500"/> {t('mificha.rules.sales.leader_value', 'Líder')}
                        </span>
                        <span className="font-mono font-bold text-light-text-primary dark:text-white opacity-80">
                            ${Number(top_value)?.toLocaleString('es-CL')}
                        </span>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

const AdminSalesRankingCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const scope = params.ranking_scope;
  const position = params.ranking_position;
  const isCompanyChamp = scope === 'empresa' && position === 1;

  return (
    <div className="mt-2 space-y-4">
      {/* Descripción corta de la misión */}
      <p className="text-xs leading-relaxed text-light-text-secondary dark:text-dark-text-secondary italic">
        {isCompanyChamp 
          ? t('mificha.rules.sales.card_desc_champ', 'Sé el número 1 de toda la empresa.')
          : t('mificha.rules.sales.card_desc_normal', { position, metric: formatMetric(params.metric_key, t), scope: formatScope(scope, t) }, `Entra al Top ${position} en ${formatMetric(params.metric_key, t)}.`)
        }
      </p>
      <CompetitionProgress progress={progress} params={params} />
    </div>
  );
};

const AdminSalesRankingTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const { params } = merit;
  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-yellow-400 flex items-center gap-2">
        <Award size={14}/> 
        {t('mificha.rules.sales.tooltip_title', { position: params.ranking_position, metric: formatMetric(params.metric_key, t) })}
      </h4>
      <p className="text-xs text-gray-300">
        {t('mificha.rules.sales.tooltip_desc', { position: params.ranking_position, scope: formatScope(params.ranking_scope, t) })}
      </p>
      <div className="pt-2 border-t border-white/10">
        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Condiciones:</p>
        <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
            <li>{t('mificha.rules.sales.tooltip_li1', 'Competencia por monto total vendido.')}</li>
            <li>{t('mificha.rules.sales.tooltip_li2', 'Calculado al cierre del periodo.')}</li>
        </ul>
      </div>
    </div>
  );
};

export const config = {
  key: 'admin_sales_ranking',
  icon: TrendingUp,
  card: AdminSalesRankingCard,
  tooltip: AdminSalesRankingTooltip,
  getCardStyle: (merit) => {
    const scope = merit.params?.ranking_scope;
    const position = merit.params?.ranking_position;
    
    // Devolvemos colores rgba para que RuleCard los use en border y background
    if (scope === 'empresa' && position === 1) {
      return {
        borderColor: 'rgba(192, 132, 252, 0.6)', // Purple glow
        backgroundColor: 'rgba(168, 85, 247, 0.08)', // Purple tint
        icon: Gem
      };
    }
    if (scope === 'local' && position === 1) {
      return {
        borderColor: 'rgba(250, 204, 21, 0.6)', // Gold glow
        backgroundColor: 'rgba(245, 158, 11, 0.08)', // Gold tint
        icon: Award
      };
    }
    // Default blue tech style
    return {
      borderColor: 'rgba(96, 165, 250, 0.4)',
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
      icon: TrendingUp
    };
  },
};