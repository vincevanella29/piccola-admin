import React from 'react';
import { CheckCircle, TrendingUp, Star } from 'lucide-react';

const StatChip = ({ icon: Icon, label, value, colorClass, borderClass, bgClass }) => (
  <div className={`flex flex-1 flex-col items-center justify-center gap-1 bg-white/60 dark:bg-dark-surface/40 backdrop-blur-md border ${borderClass} rounded-[20px] px-3 py-3.5 text-center min-w-0 shadow-sm transition-transform hover:shadow-md hover:scale-[1.02] cursor-default`}>
    <div className={`p-1.5 rounded-full ${bgClass} mb-0.5`}>
      <Icon size={16} className={`${colorClass}`} strokeWidth={2.5} />
    </div>
    <p className={`text-xl font-black leading-none ${colorClass}`}>{value}</p>
    <p className="text-[10px] font-bold text-light-text-secondary/80 dark:text-dark-text-secondary uppercase tracking-widest truncate w-full text-center mt-0.5">{label}</p>
  </div>
);

const MeritStatStrip = ({ comp, t }) => {
  if (!comp || !comp.has_data) return null;

  const isLive = comp.is_live === true;
  const competing = (comp.total_participants || 0) - (comp.fulfilled_count || 0);

  return (
    <div className="flex gap-3">
      <StatChip
        icon={CheckCircle}
        label={isLive ? 'Ganarían' : t('merit_rankings.stats.winners')}
        value={comp.fulfilled_count ?? 0}
        colorClass={isLive ? 'text-amber-500 dark:text-amber-400' : 'text-matrix-green'}
        borderClass={isLive ? 'border-amber-200 dark:border-amber-500/30' : 'border-matrix-green/30'}
        bgClass={isLive ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-matrix-green/10'}
      />
      <StatChip
        icon={TrendingUp}
        label={isLive ? 'En competencia' : t('merit_rankings.stats.competing')}
        value={competing}
        colorClass="text-yellow-600 dark:text-yellow-400"
        borderClass="border-yellow-200 dark:border-yellow-400/30"
        bgClass="bg-yellow-100 dark:bg-yellow-400/10"
      />
      <StatChip
        icon={Star}
        label={t('merit_rankings.stats.pts_prize')}
        value={`+${comp.merit_points ?? 0}`}
        colorClass="text-indigo-600 dark:text-indigo-400"
        borderClass="border-indigo-200 dark:border-indigo-500/30"
        bgClass="bg-indigo-100 dark:bg-indigo-500/10"
      />
    </div>
  );
};

export default MeritStatStrip;
