import React from 'react';

const RadialGauge = ({ value = 0, label = '', size = 80 }) => {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - 10) / 2;
  const C = 2 * Math.PI * r;
  const dashLen = (clamped / 100) * C;

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`translate(${size / 2} ${size / 2})`}>
            <circle r={r} fill="none" className="stroke-light-surface-secondary dark:stroke-dark-surface-secondary" strokeWidth={8} />
            <g transform="rotate(-90)">
              <circle r={r} fill="none" className="stroke-light-accent dark:stroke-dark-accent" strokeWidth={8} strokeLinecap="round"
                strokeDasharray={`${Math.max(dashLen, 0)} ${Math.max(C - dashLen, 0)}`}
                style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
              />
            </g>
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{Math.round(clamped)}%</span>
        </div>
      </div>
      {label && (
        <p className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary text-center uppercase tracking-wider">{label}</p>
      )}
    </div>
  );
};

export default RadialGauge;
