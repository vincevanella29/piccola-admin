// src/pages/mificha/components/tabs/rules/templates/AdminSalesTopCategory.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Award, BarChart3, Gem, Tag, Trophy, Target } from 'lucide-react';

const formatLevel = (level, t) => t(`mificha.rules.sales_cat.level_${level}`, level);
const formatMetric = (metric, t) => t(`mificha.rules.sales_cat.metric_${metric}`, metric);
const formatScope = (scope, t) => t(`mificha.rules.sales.scope_${scope}`, scope);

const ProgressAggregated = ({ progress, params }) => {
  const { t } = useTranslation();
  
  // Extracción segura de datos
  const rankingItem = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!rankingItem || typeof rankingItem.current_position === 'undefined') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-light-surface-secondary/30 dark:bg-black/20 rounded-xl border border-dashed border-light-border/20">
        <BarChart3 size={20} className="text-light-text-tertiary dark:text-dark-text-tertiary mb-2 opacity-50"/>
        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary opacity-70">
          {t('mificha.rules.sales.no_data', 'Calculando datos de categoría...')}
        </span>
      </div>
    );
  }

  const target_position = params?.ranking_position ?? 1;
  const { current_position, top_value, current_value, keys_aggregated, local } = rankingItem;
  const isWinner = current_position > 0 && current_position <= target_position;
  const isTop1 = current_position === 1;

  return (
    <div className="space-y-3">
        {/* --- Header: Posición y Target --- */}
        <div className={`
            flex items-center justify-between p-3 rounded-xl border
            ${isWinner 
                ? 'bg-indigo-500/10 border-indigo-500/20' 
                : 'bg-light-surface-secondary/30 dark:bg-black/20 border-light-border/10 dark:border-white/5'}
        `}>
            <div className="flex items-center gap-3">
                <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg shadow-inner
                    ${isTop1 ? 'bg-yellow-400 text-black' : isWinner ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'}
                `}>
                    #{current_position > 0 ? current_position : '-'}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary font-bold tracking-wider">
                        {t('mificha.rules.sales.your_position', 'Ranking')}
                    </span>
                    <span className={`text-sm font-bold leading-tight ${isWinner ? 'text-indigo-400' : 'text-light-text-primary dark:text-white'}`}>
                        {isTop1 ? '¡Especialista Top!' : isWinner ? '¡Bien Posicionado!' : 'Sigue sumando'}
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

        {/* --- Grid de Valores --- */}
        {(typeof top_value !== 'undefined' || typeof current_value !== 'undefined') && (
            <div className="grid grid-cols-2 gap-2 text-xs">
                {typeof current_value !== 'undefined' && (
                    <div className="p-2 rounded-lg bg-light-surface-secondary/50 dark:bg-white/5 border border-light-border/10 dark:border-white/5 flex flex-col justify-between">
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase font-bold mb-1">
                            {t('mificha.rules.sales.your_value', 'Tu Venta')}
                        </span>
                        <span className="font-mono font-bold text-sm text-light-text-primary dark:text-white">
                            ${Number(current_value)?.toLocaleString('es-CL')}
                        </span>
                    </div>
                )}
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

        {/* --- Info Footer --- */}
        {!!(keys_aggregated?.length) && (
            <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary text-center pt-1 truncate">
               {t('mificha.rules.sales_cat.aggregated_from', { count: keys_aggregated.length }, `Basado en ${keys_aggregated.length} productos`)}
               {local ? ` • ${local}` : ''}
            </div>
        )}
    </div>
  );
};

const AdminSalesTopCategoryCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  
  // Extraemos las etiquetas
  const labels = (params.selected_labels && params.selected_labels.length > 0)
    ? params.selected_labels
    : (params.names && params.names.length > 0)
      ? params.names
      : (params.selected_keys || []);
  
  const displayLabels = labels.slice(0, 3);
  const remaining = labels.length - 3;

  return (
    <div className="mt-2 space-y-3">
      <div className="space-y-2">
         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
            {t('mificha.rules.sales_cat.card_desc', 'Destácate vendiendo estos productos específicos.')}
         </p>
         
         {/* Etiquetas Visuales (Chips) */}
         {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayLabels.map((lbl, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                >
                  <Tag size={10} />
                  {lbl}
                </span>
              ))}
              {remaining > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-light-surface-secondary dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary border border-light-border/10">
                  +{remaining}
                </span>
              )}
            </div>
         )}
      </div>

      <ProgressAggregated progress={progress} params={params} />
    </div>
  );
};

const AdminSalesTopCategoryTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const { params } = merit;
  const levelLabel = formatLevel(params.level, t);
  const metricLabel = formatMetric(params.metric, t);

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-indigo-400 flex items-center gap-2">
        <BarChart3 size={16}/> 
        {t('mificha.rules.sales_cat.tooltip_title', { position: params.ranking_position, level: levelLabel }, 'Ranking Categoría')}
      </h4>
      <p className="text-xs text-gray-300">
        {t('mificha.rules.sales_cat.tooltip_desc', { metric: metricLabel }, 'Ranking basado en ventas de categorías específicas.')}
      </p>
      
      {!!(params.selected_labels?.length) && (
        <div className="pt-2 border-t border-white/10">
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Incluye:</p>
            <div className="flex flex-wrap gap-1">
                {params.selected_labels.map((label, idx) => (
                    <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-gray-300">
                        {label}
                    </span>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export const config = {
  key: 'admin_sales_top_category',
  icon: BarChart3,
  card: AdminSalesTopCategoryCard,
  tooltip: AdminSalesTopCategoryTooltip,
  getCardStyle: (merit) => {
    const scope = merit.params?.ranking_scope;
    const position = merit.params?.ranking_position;
    
    // Top 1 Empresa: Diamante (Purple)
    if (scope === 'empresa' && position === 1) {
      return { 
          borderColor: 'rgba(168, 85, 247, 0.6)', 
          backgroundColor: 'rgba(168, 85, 247, 0.08)', 
          icon: Gem 
      };
    }
    // Top 1 Local: Dorado
    if (scope === 'local' && position === 1) {
      return { 
          borderColor: 'rgba(234, 179, 8, 0.6)', 
          backgroundColor: 'rgba(234, 179, 8, 0.08)', 
          icon: Award 
      };
    }
    // General: Índigo (para diferenciar de Ventas Totales que es Verde)
    return { 
        borderColor: 'rgba(99, 102, 241, 0.4)', // Indigo 500
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        icon: BarChart3
    };
  },
};