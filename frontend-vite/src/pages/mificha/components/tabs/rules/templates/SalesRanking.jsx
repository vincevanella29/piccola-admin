import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Award, Gem } from 'lucide-react';

// --- Helpers (ahora usan i18n) ---
const formatMetric = (key, t) => t(`mificha.rules.sales.metric_${key}`, key);
const formatScope = (scope, t) => t(`mificha.rules.sales.scope_${scope}`, scope);

// --- Componente de Progreso Competitivo ---
const CompetitionProgress = ({ progress, params }) => {
  const { t } = useTranslation();
  // Backend can return either { progress: [ {type:'ranking', ...} ] } or a flattened object
  const rankingItem = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!rankingItem || typeof rankingItem.current_position === 'undefined') {
    return (
      <div className="bg-light-surface dark:bg-dark-surface p-2 rounded-md text-center border border-light-border/10 dark:border-dark-border/10">
        <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.rules.sales.no_data')}</p>
      </div>
    );
  }

  const { current_position, top_value, target_position } = rankingItem;
  const isWinner = current_position > 0 && current_position <= target_position;

  return (
    <div className="bg-light-surface dark:bg-dark-surface p-3 rounded-md space-y-2 border border-light-border/10 dark:border-dark-border/10">
      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <span>{t('mificha.rules.sales.your_position')}</span>
        <span>{t('mificha.rules.sales.target')}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          #{current_position > 0 ? current_position : '--'}
        </p>
        <p className={`font-bold ${isWinner ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
          Top {target_position}
        </p>
      </div>
      {(typeof top_value !== 'undefined' || typeof rankingItem?.current_value !== 'undefined') && (
        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary pt-2 border-t border-light-border/10 dark:border-dark-border/10 space-y-1">
          {typeof top_value !== 'undefined' && (
            <div>
              {t('mificha.rules.sales.leader_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{Number(top_value)?.toLocaleString('es-CL')}</span>
            </div>
          )}
          {typeof rankingItem?.current_value !== 'undefined' && (
            <div>
              {t('mificha.rules.sales.your_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{Number(rankingItem.current_value)?.toLocaleString('es-CL')}</span>
            </div>
          )}
          {Number(rankingItem?.min_days_worked) > 0 && (
            <div>
              Días con venta: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{(rankingItem.current_days_worked ?? '--')} / {rankingItem.min_days_worked}</span>
            </div>
          )}
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
    <div className="mt-3 mb-4 space-y-3">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
        {isCompanyChamp 
          ? t('mificha.rules.sales.card_desc_champ')
          : t('mificha.rules.sales.card_desc_normal', { position, metric: formatMetric(params.metric_key, t), scope: formatScope(scope, t) })
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
    <div>
      <h4 className="font-bold mb-2">{t('mificha.rules.sales.tooltip_title', { position: params.ranking_position, metric: formatMetric(params.metric_key, t) })}</h4>
      <p className="text-sm">{t('mificha.rules.sales.tooltip_desc', { position: params.ranking_position, scope: formatScope(params.ranking_scope, t) })}</p>
      <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
        <li>{t('mificha.rules.sales.tooltip_li1')}</li>
        <li>{t('mificha.rules.sales.tooltip_li2')}</li>
      </ul>
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
    if (scope === 'empresa' && position === 1) {
      return { // Estilo "Campeón de Campeones"
        borderColor: 'rgba(192, 132, 252, 0.4)', // Púrpura Diamante
        backgroundColor: 'rgba(168, 85, 247, 0.05)',
        icon: Gem
      };
    }
    if (scope === 'local' && position === 1) {
      return { // Estilo "Campeón Local"
        borderColor: 'rgba(250, 204, 21, 0.4)', // Dorado
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        icon: Award
      };
    }
    return { // Estilo estándar
      borderColor: 'rgba(96, 165, 250, 0.3)', // Azul
      backgroundColor: 'rgba(59, 130, 246, 0.05)'
    };
  },
};