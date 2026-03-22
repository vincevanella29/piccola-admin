// src/pages/adminPanel/components/meritRankings/MeritStatStrip.jsx
import React from 'react';
import { CheckCircle, TrendingUp, Star } from 'lucide-react';

const StatChip = ({ icon: Icon, label, value, colorClass }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-dark-surface border border-dark-border/20 rounded-xl px-3 py-2.5 text-center min-w-0">
    <Icon size={14} className={`${colorClass} mb-0.5`} />
    <p className={`text-lg font-black leading-none ${colorClass}`}>{value}</p>
    <p className="text-[9px] text-dark-text-secondary uppercase tracking-wider truncate w-full text-center">{label}</p>
  </div>
);

const MeritStatStrip = ({ comp, t }) => {
  if (!comp || !comp.has_data) return null;

  const isLive = comp.is_live === true;
  const competing = (comp.total_participants || 0) - (comp.fulfilled_count || 0);

  return (
    <div className="flex gap-2">
      <StatChip
        icon={CheckCircle}
        label={isLive ? 'Ganarían' : t('merit_rankings.stats.winners')}
        value={comp.fulfilled_count ?? 0}
        colorClass={isLive ? 'text-amber-400' : 'text-matrix-green'}
      />
      <StatChip
        icon={TrendingUp}
        label={isLive ? 'En competencia' : t('merit_rankings.stats.competing')}
        value={competing}
        colorClass="text-yellow-400"
      />
      <StatChip
        icon={Star}
        label={t('merit_rankings.stats.pts_prize')}
        value={`+${comp.merit_points ?? 0}`}
        colorClass="text-dark-accent"
      />
    </div>
  );
};

export default MeritStatStrip;
