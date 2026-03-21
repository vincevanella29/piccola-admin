import React from 'react';

const KPIStat = ({ label, value, deltaPct = null, goodWhenUp = true, isLoading = false }) => {
  const isPositive = deltaPct !== null && deltaPct >= 0;
  const isGood = deltaPct === null ? null : (isPositive ? goodWhenUp : !goodWhenUp);

  if (isLoading) {
    return (
      <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
        <div className="h-2.5 w-14 rounded bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 animate-pulse mb-2" />
        <div className="h-5 w-20 rounded bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 animate-pulse mb-1.5" />
        <div className="h-2.5 w-10 rounded bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary leading-tight truncate">
        {value}
      </p>
      {deltaPct !== null && (
        <p className={`text-[11px] font-bold mt-1 ${
          isGood
            ? 'text-light-success dark:text-dark-success'
            : 'text-light-error dark:text-dark-error'
        }`}>
          {deltaPct >= 0 ? '↗' : '↘'} {Math.abs(deltaPct).toFixed(1)}%
        </p>
      )}
    </div>
  );
};

export default KPIStat;
