import React, { useMemo } from 'react';
import { Box } from '@mui/material';

/**
 * GenderDonutWidget
 * Generic donut widget for categorical distribution with up to N segments.
 * Props:
 * - title: string
 * - total: number (optional, if omitted will sum data.count)
 * - data: Array<{ key: string, label: string, count: number, color: string }>
 * - size: number (px) default 72
 * - stroke: number (px) default 10
 * - showLegend: boolean default true
 * - hideZero: boolean default true
 */
const GenderDonutWidget = ({
  title,
  total: totalProp,
  data = [],
  size = 72,
  stroke = 10,
  showLegend = true,
  hideZero = true,
}) => {
  const { total, segments } = useMemo(() => {
    const t = totalProp ?? data.reduce((a, d) => a + (Number(d.count) || 0), 0);
    const items = data.map((d) => ({
      key: d.key,
      label: d.label,
      count: Number(d.count) || 0,
      color: d.color || '#9e9e9e',
    }));
    return { total: t, segments: items };
  }, [data, totalProp]);

  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);

  let dashOffset = 0;

  return (
    <Box className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-3 flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2} ${size / 2})`}>
          <circle r={r} fill="none" stroke="var(--ring-bg, rgba(0,0,0,0.08))" strokeWidth={stroke} />
          <g transform="rotate(-90)">
            {segments.map((s, idx) => {
              const segLen = (pct(s.count) / 100) * C;
              const dash = (
                <circle
                  key={s.key || idx}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${Math.max(segLen, 0)} ${Math.max(C - segLen, 0)}`}
                  strokeDashoffset={-dashOffset}
                />
              );
              dashOffset += segLen;
              return dash;
            })}
          </g>
        </g>
      </svg>
      <div className="flex-1">
        {title && (
          <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{title}</div>
        )}
        <div className="text-lg font-semibold">{total}</div>
        {showLegend && (
          <div className="text-xs flex flex-wrap gap-3 mt-1">
            {segments
              .filter((s) => (hideZero ? s.count > 0 : true))
              .map((s) => (
                <span key={s.key} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.label}: {Math.round(pct(s.count))}% ({s.count})
                </span>
              ))}
          </div>
        )}
      </div>
    </Box>
  );
};

export default GenderDonutWidget;
