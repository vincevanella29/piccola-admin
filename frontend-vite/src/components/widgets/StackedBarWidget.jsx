import React from 'react';
import { Box } from '@mui/material';

/**
 * StackedBarWidget
 * Generic stacked bar for distribution across ranges/buckets
 * Props:
 * - title: string
 * - totalLabel: string (e.g., "Total")
 * - total: number
 * - ranges: Array<{ key: string, label?: string, count: number, color?: string }>
 * - barHeight: number (px) default 12
 * - showRangeCounts: boolean default true
 * - compact: boolean default false (if true, hides grid labels)
 */
const StackedBarWidget = ({
  title,
  totalLabel = 'Total',
  total = 0,
  ranges = [],
  barHeight = 12,
  showRangeCounts = true,
  compact = false,
}) => {
  const denom = ranges.reduce((a, r) => a + (Number(r.count) || 0), 0) || 1;

  return (
    <Box className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-3">
      {title && (
        <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{title}</div>
      )}
      <div className="text-lg font-semibold">{totalLabel}: {total}</div>
      <div className="mt-2 w-full rounded-full overflow-hidden bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" style={{ height: barHeight }}>
        <div className="flex w-full h-full">
          {ranges.map((r, idx) => (
            <div
              key={r.key || idx}
              className="h-full"
              style={{
                width: `${(Number(r.count) || 0) / denom * 100}%`,
                background: r.color || ['#80cbc4','#4db6ac','#26a69a','#00897b','#00695c'][idx % 5],
              }}
            />
          ))}
        </div>
      </div>
      {!compact && showRangeCounts && (
        <div className="grid grid-cols-5 gap-1 mt-2 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
          {ranges.map((r) => (
            <div key={r.key} className="text-center">
              <div className="font-medium">{r.label || r.key}</div>
              <div>{r.count}</div>
            </div>
          ))}
        </div>
      )}
    </Box>
  );
};

export default StackedBarWidget;
