import React, { useMemo } from 'react';

const CategoricalDonutWidget = ({
  title,
  total: totalProp,
  data = [],
  size = 64,
  stroke = 8,
  showLegend = true,
  hideZero = true,
}) => {
  const { total, segments } = useMemo(() => {
    const t = totalProp ?? data.reduce((a, d) => a + (Number(d.count) || 0), 0);
    const items = data.map((d) => ({ key: d.key, label: d.label, count: Number(d.count) || 0, color: d.color || '#9e9e9e' }));
    return { total: t, segments: items };
  }, [data, totalProp]);

  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);
  let dashOffset = 0;

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`translate(${size / 2} ${size / 2})`}>
            <circle r={r} fill="none" className="stroke-light-surface-secondary dark:stroke-dark-surface-secondary" strokeWidth={stroke} />
            <g transform="rotate(-90)">
              {segments.map((s, idx) => {
                const segLen = (pct(s.count) / 100) * C;
                const dash = (
                  <circle key={s.key || idx} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                    strokeDasharray={`${Math.max(segLen - 1, 0)} ${Math.max(C - segLen + 1, 0)}`}
                    strokeDashoffset={-dashOffset}
                  />
                );
                dashOffset += segLen;
                return dash;
              })}
            </g>
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{total}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {title && <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">{title}</p>}
        {showLegend && (
          <div className="space-y-0.5">
            {segments.filter((s) => (hideZero ? s.count > 0 : true)).map((s) => (
              <div key={s.key} className="flex items-center gap-1 text-[10px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-light-text-secondary dark:text-dark-text-secondary truncate">{s.label}</span>
                <span className="font-bold text-light-text-primary dark:text-dark-text-primary ml-auto">{Math.round(pct(s.count))}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoricalDonutWidget;