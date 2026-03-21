import React from 'react';

const StackedBarWidget = ({
  title,
  totalLabel = 'Total',
  total = 0,
  ranges = [],
  barHeight = 10,
  showRangeCounts = true,
  compact = false,
}) => {
  const denom = ranges.reduce((a, r) => a + (Number(r.count) || 0), 0) || 1;

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-0.5">{title}</p>
      )}
      <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
        {totalLabel}: {total.toLocaleString()}
      </p>

      <div className="w-full rounded-full overflow-hidden bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" style={{ height: barHeight }}>
        <div className="flex w-full h-full">
          {ranges.map((r, idx) => {
            const pct = (Number(r.count) || 0) / denom * 100;
            return (
              <div
                key={r.key || idx}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${pct}%`, background: r.color || ['#009246','#1DE9B6','#4db6ac','#009688','#00695c'][idx % 5] }}
                title={`${r.label || r.key}: ${r.count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {!compact && showRangeCounts && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
          {ranges.map((r, idx) => (
            <span key={r.key || idx} className="flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color || ['#009246','#1DE9B6','#4db6ac','#009688','#00695c'][idx % 5] }} />
              {r.label || r.key}: {r.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default StackedBarWidget;
