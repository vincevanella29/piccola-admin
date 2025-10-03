import React from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Award, Gem } from 'lucide-react';

const formatScope = (scope, t) => t(`mificha.rules.times.scope_${scope}`, scope);

const TimesProgress = ({ progress, params }) => {
  const { t } = useTranslation();
  const rankingItem = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!rankingItem || typeof rankingItem.current_position === 'undefined') {
    return (
      <div className="bg-light-surface dark:bg-dark-surface p-2 rounded-md text-center border border-light-border/10 dark:border-dark-border/10">
        <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.rules.times.no_data')}</p>
      </div>
    );
  }

  const { current_position, best_value, avg_value, current_value } = rankingItem;
  const targetPosition = typeof rankingItem.target_position !== 'undefined'
    ? rankingItem.target_position
    : (params?.ranking_position ?? 1);
  const isWinner = current_position > 0 && current_position <= targetPosition;

  const fmt = (v) => (typeof v === 'number' ? `${v.toFixed(2)}s` : '--');

  return (
    <div className="bg-light-surface dark:bg-dark-surface p-3 rounded-md space-y-2 border border-light-border/10 dark:border-dark-border/10">
      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <span>{t('mificha.rules.times.your_position')}</span>
        <span>{t('mificha.rules.times.target')}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
          #{current_position > 0 ? current_position : '--'}
        </p>
        <p className={`font-bold ${isWinner ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
          Top {targetPosition}
        </p>
      </div>
      <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary pt-2 border-t border-light-border/10 dark:border-dark-border/10 space-y-1">
        <div>
          {t('mificha.rules.times.best_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmt(best_value)}</span>
        </div>
        <div>
          {t('mificha.rules.times.avg_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmt(avg_value)}</span>
        </div>
        <div>
          {t('mificha.rules.times.your_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmt(current_value)}</span>
        </div>
      </div>
    </div>
  );
};

const TimesRankingCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const scope = params.ranking_scope;
  const position = params.ranking_position;
  const isCompanyChamp = scope === 'empresa' && position === 1;

  return (
    <div className="mt-3 mb-4 space-y-3">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
        {isCompanyChamp
          ? t('mificha.rules.times.card_desc_champ')
          : t('mificha.rules.times.card_desc_normal', { position, scope: formatScope(scope, t) })}
      </p>
      <TimesProgress progress={progress} params={params} />
    </div>
  );
};

const TimesRankingTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const { params } = merit;
  return (
    <div>
      <h4 className="font-bold mb-2">{t('mificha.rules.times.tooltip_title', { position: params.ranking_position })}</h4>
      <p className="text-sm">{t('mificha.rules.times.tooltip_desc', { position: params.ranking_position, scope: formatScope(params.ranking_scope, t) })}</p>
      <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
        <li>{t('mificha.rules.times.tooltip_li1')}</li>
        <li>{t('mificha.rules.times.tooltip_li2')}</li>
      </ul>
    </div>
  );
};

export const config = {
  key: 'times_ranking_position',
  icon: Timer,
  card: TimesRankingCard,
  tooltip: TimesRankingTooltip,
  getCardStyle: (merit) => {
    const scope = merit.params?.ranking_scope;
    const position = merit.params?.ranking_position;
    if (scope === 'empresa' && position === 1) {
      return {
        borderColor: 'rgba(192, 132, 252, 0.4)',
        backgroundColor: 'rgba(168, 85, 247, 0.05)',
        icon: Gem
      };
    }
    if (scope === 'local' && position === 1) {
      return {
        borderColor: 'rgba(250, 204, 21, 0.4)',
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        icon: Award
      };
    }
    return {
      borderColor: 'rgba(96, 165, 250, 0.3)',
      backgroundColor: 'rgba(59, 130, 246, 0.05)'
    };
  },
};
