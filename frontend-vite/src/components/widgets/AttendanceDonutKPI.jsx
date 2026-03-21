import React, { useMemo } from 'react';
import DeltaPill from '../ui/DeltaPill';

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Number(n || 0)));
const pct1 = (n) => (n == null || !isFinite(n)) ? '—' : `${Math.round(clamp(n))}%`;
const pctDelta = (curr, prev) => {
  if (!isFinite(curr) || !isFinite(prev)) return null;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};
const gradeFromPct = (p) => {
  const v = clamp(p);
  if (v >= 95) return { tier: 'A', cls: 'text-light-success dark:text-dark-success' };
  if (v >= 90) return { tier: 'B', cls: 'text-light-accent dark:text-dark-accent' };
  if (v >= 85) return { tier: 'C', cls: 'text-light-text-secondary dark:text-dark-text-secondary' };
  return { tier: 'D', cls: 'text-light-error dark:text-dark-error' };
};

const AttendanceDonutKPI = ({
  t = (k, p) => p?.default || k,
  title,
  currentPct: currPctProp,
  currentWorked,
  currentTotal,
  previousPct: prevPctProp,
  previousWorked,
  previousTotal,
  size = 72,
  stroke = 8,
  showLegend = true,
  goodWhenUp = true,
}) => {
  const currPct = useMemo(() => {
    if (isFinite(currPctProp)) return clamp(currPctProp);
    const w = Number(currentWorked || 0), tot = Number(currentTotal || 0);
    return tot > 0 ? clamp((w / tot) * 100) : 0;
  }, [currPctProp, currentWorked, currentTotal]);

  const prevPct = useMemo(() => {
    if (isFinite(prevPctProp)) return clamp(prevPctProp);
    const w = Number(previousWorked || 0), tot = Number(previousTotal || 0);
    if (tot <= 0) return null;
    return clamp((w / tot) * 100);
  }, [prevPctProp, previousWorked, previousTotal]);

  const comparative = prevPct != null && isFinite(prevPct);
  const delta = comparative ? pctDelta(currPct, prevPct) : null;
  const grade = gradeFromPct(currPct);

  const pad = 3;
  const rOuter = (size - stroke) / 2;
  const rInner = comparative ? rOuter - stroke - pad : rOuter;
  const COuter = 2 * Math.PI * rOuter;
  const CInner = 2 * Math.PI * rInner;
  const dashLenPrev = comparative ? (prevPct / 100) * COuter : 0;
  const dashLenCurr = (currPct / 100) * CInner;

  const workedTxt = (w, tot) => (isFinite(w) && isFinite(tot) && tot > 0) ? `${w}/${tot}` : '—';

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`translate(${size / 2} ${size / 2})`}>
          {comparative ? (
            <>
              <circle r={rOuter} fill="none" className="stroke-light-surface-secondary dark:stroke-dark-surface-secondary" strokeWidth={stroke} />
              <circle r={rInner} fill="none" className="stroke-light-surface-secondary dark:stroke-dark-surface-secondary" strokeWidth={stroke} />
            </>
          ) : (
            <circle r={rInner} fill="none" className="stroke-light-surface-secondary dark:stroke-dark-surface-secondary" strokeWidth={stroke} />
          )}
          <g transform="rotate(-90)">
            {comparative && (
              <circle r={rOuter} fill="none" className="stroke-light-text-secondary/30 dark:stroke-dark-text-secondary/30" strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${Math.max(dashLenPrev, 0)} ${Math.max(COuter - dashLenPrev, 0)}`}
              />
            )}
            <circle r={rInner} fill="none" className="stroke-light-accent dark:stroke-dark-accent" strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${Math.max(dashLenCurr, 0)} ${Math.max(CInner - dashLenCurr, 0)}`}
            />
          </g>
        </g>
      </svg>

      <div className="flex-1 min-w-0">
        {title && <p className="text-[10px] font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-0.5">{title}</p>}
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{pct1(currPct)}</span>
          <span className={`text-[10px] font-bold ${grade.cls}`}>Tier {grade.tier}</span>
          {comparative && <DeltaPill value={delta} goodWhenUp={goodWhenUp} t={t} />}
        </div>
        {showLegend && (
          <div className="flex gap-2 mt-1 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
            <span>{t('employees.attendance.current') || 'Actual'}: {pct1(currPct)}{isFinite(currentWorked) && isFinite(currentTotal) ? ` · ${workedTxt(currentWorked, currentTotal)}` : ''}</span>
            {comparative && (
              <span>{t('employees.attendance.previous') || 'Anterior'}: {pct1(prevPct)}{isFinite(previousWorked) && isFinite(previousTotal) ? ` · ${workedTxt(previousWorked, previousTotal)}` : ''}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceDonutKPI;