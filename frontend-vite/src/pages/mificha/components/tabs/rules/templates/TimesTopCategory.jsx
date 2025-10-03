import React from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Gem, Timer } from 'lucide-react';

const formatScope = (scope, t) => t(`mificha.rules.sales.scope_${scope}`, scope);

const fmtSec = (v) => (typeof v === 'number' ? `${v.toFixed(2)}s` : '--');

const ProgressAggregatedTimes = ({ progress, params }) => {
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

  const target_position = params?.ranking_position ?? 1;
  const { current_position, best_value, avg_value, current_value, keys_aggregated, local } = rankingItem;
  const isWinner = current_position > 0 && current_position <= target_position;

  return (
    <div className="bg-light-surface dark:bg-dark-surface p-3 rounded-md space-y-2 border border-light-border/10 dark:border-dark-border/10">
      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <span>{t('mificha.rules.times.your_position')}</span>
        <span>{t('mificha.rules.times.target')}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">#{current_position > 0 ? current_position : '--'}</p>
        <p className={`font-bold ${isWinner ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>Top {target_position}</p>
      </div>
      <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary pt-2 border-t border-light-border/10 dark:border-dark-border/10 space-y-1">
        <div>
          {t('mificha.rules.times.best_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtSec(best_value)}</span>
        </div>
        <div>
          {t('mificha.rules.times.avg_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtSec(avg_value)}</span>
        </div>
        {typeof current_value !== 'undefined' && (
          <div>
            {t('mificha.rules.times.your_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtSec(current_value)}</span>
          </div>
        )}
        {!!(keys_aggregated?.length) && (
          <div className="truncate">
            {t('mificha.rules.sales_cat.aggregated_from', { count: keys_aggregated.length })}
            {local ? ` • ${t('mificha.rules.sales.scope_local_label')}: ${local}` : ''}
          </div>
        )}
      </div>
    </div>
  );
};

const TimesTopCategoryCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const scope = params.ranking_scope;
  const position = params.ranking_position;
  const isCompanyChamp = scope === 'empresa' && position === 1;

  const scopeLabel = formatScope(scope, t);

  const labels = (params.selected_labels && params.selected_labels.length > 0)
    ? params.selected_labels
    : (params.names && params.names.length > 0)
      ? params.names
      : (params.selected_keys || []);
  const keysCount = labels.length;

  // Title/description text per times domain
  const desc = isCompanyChamp
    ? t('mificha.rules.times.card_desc_champ')
    : t('mificha.rules.times.card_desc_normal', { position, scope: scopeLabel });

  return (
    <div className="mt-3 mb-4 space-y-3">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
        {desc}
      </p>
      {keysCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map((lbl, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary"
              title={lbl}
            >
              {lbl}
            </span>
          ))}
        </div>
      )}
      <ProgressAggregatedTimes progress={progress} params={params} />
    </div>
  );
};

const TimesTopCategoryTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const { params } = merit;
  const position = params.ranking_position;
  const scopeLabel = formatScope(params.ranking_scope, t);

  return (
    <div>
      <h4 className="font-bold mb-2">{t('mificha.rules.times.tooltip_title', { position })}</h4>
      <p className="text-sm">{t('mificha.rules.times.tooltip_desc', { scope: scopeLabel })}</p>
      {!!(params.selected_labels?.length) && (
        <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
          {params.selected_labels.map((label, idx) => (
            <li key={idx}>{label}</li>
          ))}
        </ul>
      )}
      <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
        <li>{t('mificha.rules.times.tooltip_li1')}</li>
        <li>{t('mificha.rules.times.tooltip_li2')}</li>
      </ul>
    </div>
  );
};

export const config = {
  key: 'times_top_category',
  icon: Timer,
  card: TimesTopCategoryCard,
  tooltip: TimesTopCategoryTooltip,
  getCardStyle: (merit) => {
    const scope = merit.params?.ranking_scope;
    const position = merit.params?.ranking_position;
    if (scope === 'empresa' && position === 1) {
      return { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.05)', icon: Gem };
    }
    if (scope === 'local' && position === 1) {
      return { borderColor: 'rgba(234, 179, 8, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.05)', icon: Award };
    }
    return { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.05)' };
  },
};
