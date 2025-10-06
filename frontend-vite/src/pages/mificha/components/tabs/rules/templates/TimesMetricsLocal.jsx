import React from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Timer } from 'lucide-react';

const fmtSec = (v) => (typeof v === 'number' ? `${v.toFixed(2)}m` : '--');
const fmtVal = (metric, v) => (metric === 'samples' ? (typeof v === 'number' ? v : '--') : fmtSec(v));

// Renderiza el progreso para la plantilla EXACTA 'times_metrics_local'
// Se ajusta a lo que llega desde backend: progress.progress con item { type: 'local_ranking', ... }
const TimesMetricsLocalProgress = ({ progress, params }) => {
  const { t } = useTranslation();
  const item = Array.isArray(progress?.progress)
    ? progress.progress.find((p) => p?.type === 'local_ranking')
    : (typeof progress?.current_position !== 'undefined' ? progress : null);

  if (!item || typeof item.current_position === 'undefined') {
    return (
      <div className="bg-light-surface dark:bg-dark-surface p-2 rounded-md text-center border border-light-border/10 dark:border-dark-border/10">
        <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.rules.times_local.no_data')}</p>
      </div>
    );
  }

  const target = params?.ranking_position ?? 1;
  const metric = (item?.metric) || (params?.position_metric === 'samples' ? 'samples' : 'avg_seg');
  const { current_position, best_value, avg_value, current_value, local } = item;
  const isWinner = current_position > 0 && current_position <= target;

  return (
    <div className="bg-light-surface dark:bg-dark-surface p-3 rounded-md space-y-2 border border-light-border/10 dark:border-dark-border/10">
      <div className="flex justify-between items-center text-xs text-light-text-secondary dark:text-dark-text-secondary">
        <span>{t('mificha.rules.times_local.your_position')}</span>
        <span>{t('mificha.rules.times_local.target')}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">#{current_position > 0 ? current_position : '--'}</p>
        <p className={`font-bold ${isWinner ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
          {t('mificha.rules.times_local.top_n', { n: target })}
        </p>
      </div>
      <div className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary pt-2 border-t border-light-border/10 dark:border-dark-border/10 space-y-1">
        <div>
          {t('mificha.rules.times_local.best_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtVal(metric, best_value)}</span>
        </div>
        <div>
          {t('mificha.rules.times_local.avg_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtVal(metric, avg_value)}</span>
        </div>
        {typeof current_value !== 'undefined' && (
          <div>
            {t('mificha.rules.times_local.your_value')}: <span className="font-mono font-bold text-light-text-primary dark:text-dark-text-primary">{fmtVal(metric, current_value)}</span>
          </div>
        )}
        {!!local && (
          <div className="truncate">
            {t('mificha.rules.sales.scope_local_label')}: {local}
          </div>
        )}
      </div>
    </div>
  );
};

const TimesMetricsLocalCard = ({ merit }) => {
  const { t } = useTranslation();
  const { params, progress } = merit;
  const position = params?.ranking_position;
  const level = params?.level; // 'overall' | 'center'

  // Reutilizamos mismos textos de times_local
  return (
    <div className="mt-3 mb-4 space-y-3">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
        {position === 1
          ? t('mificha.rules.times_local.card_desc_champ')
          : t('mificha.rules.times_local.card_desc_normal', { position })}
      </p>
      <TimesMetricsLocalProgress progress={progress} params={params} />
    </div>
  );
};

const TimesMetricsLocalTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const position = merit?.params?.ranking_position;
  return (
    <div>
      <h4 className="font-bold mb-2">{t('mificha.rules.times_local.tooltip_title', { position })}</h4>
      <p className="text-sm">{t('mificha.rules.times_local.tooltip_desc', { position })}</p>
      <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
        <li>{t('mificha.rules.times_local.tooltip_li1')}</li>
        <li>{t('mificha.rules.times_local.tooltip_li2')}</li>
      </ul>
    </div>
  );
};

export const config = {
  key: 'times_metrics_local',
  icon: Timer,
  card: TimesMetricsLocalCard,
  tooltip: TimesMetricsLocalTooltip,
  getCardStyle: (merit) => {
    const position = merit?.params?.ranking_position;
    if (position === 1) {
      return { borderColor: 'rgba(234, 179, 8, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.05)', icon: Award };
    }
    return { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.05)' };
  },
};
