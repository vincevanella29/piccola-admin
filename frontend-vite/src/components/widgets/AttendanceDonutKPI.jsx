import React, { useMemo } from 'react';
import { Box, Stack, Chip, Tooltip, Typography } from '@mui/material';
import DeltaPill from '../ui/DeltaPill';
import HoloChip from '../ui/HoloChip';

// ---------- helpers ----------
const clamp = (n, a=0, b=100) => Math.max(a, Math.min(b, Number(n||0)));
const pct1 = (n) => (n==null||!isFinite(n)) ? '—' : `${Math.round(clamp(n))}%`;
const pctDelta = (curr, prev) => {
  if (!isFinite(curr) || !isFinite(prev)) return null;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};
const gradeFromPct = (p) => {
  const v = clamp(p);
  if (v >= 98) return { tier: 'S', color: 'text-matrix-green' };
  if (v >= 95) return { tier: 'A', color: 'text-matrix-green' };
  if (v >= 90) return { tier: 'B', color: 'text-light-text-primary dark:text-dark-text-primary' };
  if (v >= 85) return { tier: 'C', color: 'text-vanellix-purple' };
  return { tier: 'D', color: 'text-vanellix-purple' };
};

// ---------- component ----------
const AttendanceDonutKPI = ({
  t = (k, p) => p?.default || k,
  title,
  currentPct: currPctProp,
  currentWorked,
  currentTotal,
  previousPct: prevPctProp,
  previousWorked,
  previousTotal,
  size = 92,
  stroke = 10,
  showLegend = true,
  goodWhenUp = true,
}) => {
  const currPct = useMemo(() => {
    if (isFinite(currPctProp)) return clamp(currPctProp);
    const w = Number(currentWorked||0), tot = Number(currentTotal||0);
    return tot > 0 ? clamp((w / tot) * 100) : 0;
  }, [currPctProp, currentWorked, currentTotal]);

  const prevPct = useMemo(() => {
    if (isFinite(prevPctProp)) return clamp(prevPctProp);
    const w = Number(previousWorked||0), tot = Number(previousTotal||0);
    if (tot <= 0) return null;
    return clamp((w / tot) * 100);
  }, [prevPctProp, previousWorked, previousTotal]);

  const comparative = prevPct != null && isFinite(prevPct);
  const delta = comparative ? pctDelta(currPct, prevPct) : null;
  const grade = gradeFromPct(currPct);

  // Geometría donut
  const pad = 4; // separación entre anillos
  const rOuter = (size - stroke) / 2;
  const rInner = comparative ? rOuter - stroke - pad : rOuter;
  const COuter = 2 * Math.PI * rOuter;
  const CInner = 2 * Math.PI * rInner;
  const dashLenPrev = comparative ? (prevPct / 100) * COuter : 0;
  const dashLenCurr = (currPct / 100) * CInner;

  const workedTxt = (w, tot) => (isFinite(w) && isFinite(tot) && tot>0) ? `${w}/${tot}` : '—';

  return (
    <Box className="rounded-2xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30 shadow-neon flex items-center gap-3">
      {/* DONUT */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size/2} ${size/2})`}>
          {/* tracks */}
          {comparative ? (
            <>
              <circle r={rOuter} fill="none" stroke="var(--ring-bg, rgba(0,0,0,0.10))" strokeWidth={stroke}/>
              <circle r={rInner} fill="none" stroke="var(--ring-bg, rgba(0,0,0,0.10))" strokeWidth={stroke}/>
            </>
          ) : (
            <circle r={rInner} fill="none" stroke="var(--ring-bg, rgba(0,0,0,0.10))" strokeWidth={stroke}/>
          )}
          {/* arcs */}
          <g transform="rotate(-90)">
            {comparative && (
              <circle
                r={rOuter}
                fill="none"
                stroke="rgba(127,127,127,0.45)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(dashLenPrev,0)} ${Math.max(COuter-dashLenPrev,0)}`}
              />
            )}
            <circle
              r={rInner}
              fill="none"
              className="text-light-accent dark:text-dark-accent"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(dashLenCurr,0)} ${Math.max(CInner-dashLenCurr,0)}`}
            />
          </g>
        </g>
      </svg>

      {/* INFO */}
      <div className="flex-1">
        {title && (
          <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{title}</div>
        )}

        {/* KPI principal */}
        <div className="flex items-center gap-2">
          <Typography variant="h6" className="leading-none font-semibold">
            {pct1(currPct)}
          </Typography>
          <Chip
            size="small"
            label={`Tier ${grade.tier}`}
            className={`${grade.color} bg-light-surface/60 dark:bg-dark-surface/60`}
            sx={{ height: 22, borderRadius: '9999px', fontWeight: 800 }}
          />
          {comparative && <DeltaPill value={delta} goodWhenUp={goodWhenUp} t={t} />}
        </div>

        {/* Leyenda/Contexto */}
        {showLegend && (
          <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.75}>
            <Tooltip title={t('employees.attendance.current') || 'Actual'} arrow describeChild>
              <HoloChip
                label={`${t('employees.attendance.current') || 'Actual'}: ${pct1(currPct)}${isFinite(currentWorked)&&isFinite(currentTotal) ? ` · ${workedTxt(currentWorked,currentTotal)}`:''}`}
              />
            </Tooltip>

            {comparative && (
              <Tooltip title={t('employees.attendance.previous') || 'Anterior'} arrow describeChild>
                <HoloChip
                  label={`${t('employees.attendance.previous') || 'Anterior'}: ${pct1(prevPct)}${isFinite(previousWorked)&&isFinite(previousTotal) ? ` · ${workedTxt(previousWorked,previousTotal)}`:''}`}
                />
              </Tooltip>
            )}
          </Stack>
        )}
      </div>
    </Box>
  );
};

export default AttendanceDonutKPI;