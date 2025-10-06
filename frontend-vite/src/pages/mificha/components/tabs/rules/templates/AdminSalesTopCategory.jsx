import React from 'react';
import { useTranslation } from 'react-i18next';
import { Award, BarChart3, Gem } from 'lucide-react';

const formatLevel = (level, t) => t(`mificha.rules.sales_cat.level_${level}`, level);
const formatMetric = (metric, t) => t(`mificha.rules.sales_cat.metric_${metric}`, metric);
const formatScope = (scope, t) => t(`mificha.rules.sales.scope_${scope}`, scope);

const ProgressAggregated = ({ progress, params }) => {
  const { t } = useTranslation();
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

  const target_position = params?.ranking_position ?? 1;
  const { current_position, top_value, current_value, keys_aggregated, local } = rankingItem;
  const isWinner = current_position > 0 && current_position <= target_position;

  return (
    <div className="bg-light-surface dark:bg-dark-surface p-3 rounded-md space-y-2 border border-light-border/10 dark:border-dark-border/10">
      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <span>{t('mificha.rules.sales.your_position')}</span>
        <span>{t('mificha.rules.sales.target')}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">#{current_position > 0 ? current_position : '--'}</p>
        <p className={`font-bold ${isWinner ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>Top {target_position}</p>
      </div>
      {(typeof top_value !== 'undefined' || typeof current_value !== 'undefined') && (
        <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary pt-2 border-t border-light-border/10 dark:border-dark-border/10 space-y-1">
          {typeof top_value !== 'undefined' && (
            <div>
              {t('mificha.rules.sales.leader_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{Number(top_value)?.toLocaleString('es-CL')}</span>
            </div>
          )}
          {typeof current_value !== 'undefined' && (
            <div>
              {t('mificha.rules.sales.your_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{Number(current_value)?.toLocaleString('es-CL')}</span>
            </div>
          )}
          {!!(keys_aggregated?.length) && (
            <div className="truncate">
              {t('mificha.rules.sales_cat.aggregated_from', { count: keys_aggregated.length })}
              {local ? ` • ${t('mificha.rules.sales.scope_local_label')}: ${local}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminSalesTopCategoryCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const scope = params.ranking_scope;
  const position = params.ranking_position;
  const isCompanyChamp = scope === 'empresa' && position === 1;

  const levelLabel = formatLevel(params.level, t);
  const metricLabel = formatMetric(params.metric, t);
  const scopeLabel = formatScope(scope, t);

  const labels = (params.selected_labels && params.selected_labels.length > 0)
    ? params.selected_labels
    : (params.names && params.names.length > 0)
      ? params.names
      : (params.selected_keys || []);
  const keysCount = labels.length;

  return (
    <div className="mt-3 mb-4 space-y-3">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
        {t('mificha.rules.sales_cat.card_desc', { level: levelLabel, metric: metricLabel, scope: scopeLabel, count: keysCount })}
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
    <div>
      <h4 className="font-bold mb-2">{t('mificha.rules.sales_cat.tooltip_title', { position: params.ranking_position, level: levelLabel })}</h4>
      <p className="text-sm">{t('mificha.rules.sales_cat.tooltip_desc', { metric: metricLabel })}</p>
      {!!(params.selected_labels?.length) && (
        <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
          {params.selected_labels.map((label, idx) => (
            <li key={idx}>{label}</li>
          ))}
        </ul>
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
    if (scope === 'empresa' && position === 1) {
      return { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.05)', icon: Gem };
    }
    if (scope === 'local' && position === 1) {
      return { borderColor: 'rgba(234, 179, 8, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.05)', icon: Award };
    }
    return { borderColor: 'rgba(34, 197, 94, 0.3)', backgroundColor: 'rgba(34, 197, 94, 0.05)' };
  },
};
