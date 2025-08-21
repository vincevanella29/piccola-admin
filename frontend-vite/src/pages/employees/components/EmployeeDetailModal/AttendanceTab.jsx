import React from 'react';
import { Box, Paper, Typography, Chip, Stack, LinearProgress } from '@mui/material';
import dayjs from 'dayjs';
import { summarizeAttendance, pctDelta, DAY_WORKED_BY_MOV } from '../../../../utils/attendanceMetrics';
import DeltaPill from '../../../../components/ui/DeltaPill';
import HoloChip from '../../../../components/ui/HoloChip';
import CategoricalDonutWidget from '../../../../components/widgets/CategoricalDonutWidget';

// ---------- utils ----------
const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Number(n || 0)));
const n1 = (n) => `${Number(n||0)}`;

// barra neon minimal
const Bar = ({ valuePct = 0, faint = false }) => (
  <div className={`h-2 rounded bg-light-surface/60 dark:bg-dark-surface/60 overflow-hidden ${faint ? 'opacity-70' : ''}`}>
    <div className="h-2 bg-light-accent/90 dark:bg-dark-accent/90" style={{ width: `${clamp(valuePct)}%` }} />
  </div>
);

const PeriodBadge = ({ title, start, end }) => {
  if (!start || !end) return null;
  const a = dayjs(start).format('YYYY-MM-DD');
  const b = dayjs(end).format('YYYY-MM-DD');
  return <HoloChip label={`${title}: ${a} → ${b}`} />;
};

const movementLabel = (t, code) => {
  const map = {
    PTE: t('employees.attendance.presente') || 'Presente',
    LBR: t('employees.attendance.libre') || 'Libre/Laborado',
    VAC: t('employees.attendance.vacaciones') || 'Vacaciones',
    LIC: t('employees.attendance.licencia') || 'Licencia',
    AUS: t('employees.attendance.ausencia') || 'Ausencias',
    NVI: t('employees.attendance.no_show') || 'No vino',
    PSG: t('employees.attendance.permiso_sin_goce') || 'Permiso s/g',
    PCG: t('employees.attendance.permiso_con_goce') || 'Permiso c/g',
    HUE: t('employees.attendance.huelga') || 'Huelga',
    OTHER: t('employees.attendance.other') || 'Otro',
  };
  return map[code] || code;
};

// tier gamer S/A/B/C/D según % asistencia
function gradeFromPct(p) {
  const v = clamp(p);
  if (v >= 98) return { tier: 'S', color: 'text-matrix-green' };
  if (v >= 95) return { tier: 'A', color: 'text-matrix-green' };
  if (v >= 90) return { tier: 'B', color: 'text-light-text-primary dark:text-dark-text-primary' };
  if (v >= 85) return { tier: 'C', color: 'text-vanellix-purple' };
  return { tier: 'D', color: 'text-vanellix-purple' };
}

// streaks (racha actual y máxima en el rango)
function computeStreaks(items = [], start, end) {
  const workedSet = new Set();
  for (const it of items) {
    const mv = String(it?.tipo_movimiento || '').toUpperCase();
    if (DAY_WORKED_BY_MOV[mv]) {
      const d = it?.fecha_trabajada || it?.date || it?.fecha;
      if (!d) continue;
      workedSet.add(dayjs(d).format('YYYY-MM-DD'));
    }
  }
  const s = start ? dayjs(start).startOf('day') : (items[0]?.fecha_trabajada ? dayjs(items[0].fecha_trabajada) : dayjs());
  const e = end ? dayjs(end).endOf('day') : dayjs();
  let best = 0, current = 0, cur = 0;
  for (let d = s.clone(); d.isSame(e, 'day') || d.isBefore(e, 'day'); d = d.add(1, 'day')) {
    const key = d.format('YYYY-MM-DD');
    if (workedSet.has(key)) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  let streak = 0;
  for (let d = e.clone().startOf('day'); d.isSame(s, 'day') || d.isAfter(s, 'day'); d = d.subtract(1, 'day')) {
    const key = d.format('YYYY-MM-DD');
    if (workedSet.has(key)) streak += 1;
    else break;
  }
  current = streak;
  return { best, current };
}

const AttendanceTab = ({ t, attData, attPrev, comparisonWindow }) => {
  // ventanas
  const start = comparisonWindow?.start ?? null;
  const end   = comparisonWindow?.end   ?? null;

  // KPI asistencia y breakdown
  const cur = summarizeAttendance(attData || [], start, end);
  const prev = summarizeAttendance(attPrev || [], start, end);
  const deltaPct = (attPrev && attPrev.length) ? pctDelta(cur.pct, prev.pct) : null;

  // streaks gamer
  const streaks = computeStreaks(attData || [], start, end);

  // días por movimiento (destacados)
  const sumOf = (obj, keys) => keys.reduce((a,k)=>a+(obj?.[k]||0),0);
  const CUR = {
    PTE: cur.breakdown.PTE || 0,
    LBR: cur.breakdown.LBR || 0,
    VAC: cur.breakdown.VAC || 0,
    LIC: cur.breakdown.LIC || 0,
    AUS: sumOf(cur.breakdown, ['AUS','NVI','PSG']),
  };
  const grade = gradeFromPct(cur.pct);

  // Data para donut único (colores legibles en claro/oscuro)
  const donutData = [
    { key: 'PTE', label: movementLabel(t,'PTE'), count: CUR.PTE, color: '#22c55e' },   // green-500
    { key: 'LBR', label: movementLabel(t,'LBR'), count: CUR.LBR, color: '#0ea5e9' },   // sky-500
    { key: 'VAC', label: movementLabel(t,'VAC'), count: CUR.VAC, color: '#f59e0b' },   // amber-500
    { key: 'LIC', label: movementLabel(t,'LIC'), count: CUR.LIC, color: '#a78bfa' },   // violet-400
    { key: 'AUS', label: movementLabel(t,'AUS'), count: CUR.AUS, color: '#ef4444' },   // red-500
  ];

  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' }}>
      {/* HUD top: rango + quick info */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
        <PeriodBadge title={t('employees.payroll.period_current') || 'Periodo actual'} start={start} end={end} />
        {attPrev?.length ? <HoloChip label={`${t('employees.attendance.previous') || 'Anterior'}: ${Math.round(prev.pct)}%`} /> : null}
        <HoloChip label={t('employees.attendance.worked_ratio', { worked: cur.worked, total: cur.totalDays })} />
        <HoloChip label={`${t('employees.attendance.days') || 'días'}: ${cur.totalDays}`} />
        <DeltaPill value={deltaPct} goodWhenUp t={t} />
      </Stack>

      {/* Row 1: Player card + comparación de % */}
      <Box className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-1">
        <Box>
          <Paper
            variant="outlined"
            className="rounded-3xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30 shadow-neon"
          >
            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  className="text-light-text-primary dark:text-dark-text-primary font-futurist tracking-wide"
                >
                  {t('employees.attendance.title') || 'Asistencia · HUD'}
                </Typography>
                <Chip
                  size="small"
                  label={`Tier ${grade.tier} · ${Math.round(clamp(cur.pct))}%`}
                  className={`${grade.color} bg-light-surface/60 dark:bg-dark-surface/60`}
                  sx={{ height: 24, borderRadius: '9999px', fontWeight: 800 }}
                />
              </Stack>

              <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary">
                {t('employees.merit.title')}
              </Typography>
              <LinearProgress variant="determinate" value={clamp(cur.pct)} />

              <Stack direction="row" spacing={1} mt={1}>
                <Box className="flex-1 rounded-2xl p-2 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
                  <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.streak_current') || 'Racha actual'}</div>
                  <div className="text-lg font-semibold">{streaks.current} {t('employees.attendance.days') || 'días'}</div>
                </Box>
                <Box className="flex-1 rounded-2xl p-2 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
                  <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.streak_best') || 'Mejor racha'}</div>
                  <div className="text-lg font-semibold">{streaks.best} {t('employees.attendance.days') || 'días'}</div>
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        <Box>
          <Paper
            variant="outlined"
            className="rounded-3xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30 shadow-neon"
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" fontWeight={800} className="text-light-text-primary dark:text-dark-text-primary font-futurist tracking-wide">
                  {t('employees.attendance.comparison')}
                </Typography>
                <DeltaPill value={deltaPct} goodWhenUp t={t} />
              </Stack>

              <Box>
                <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                  {t('employees.attendance.current')}: <b>{Math.round(clamp(cur.pct))}%</b>
                </div>
                <Bar valuePct={cur.pct} />
                {attPrev?.length ? (
                  <div className="mt-1">
                    <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                      {t('employees.attendance.previous')}: <b>{Math.round(clamp(prev.pct))}%</b>
                    </div>
                    <Bar valuePct={prev.pct} faint />
                  </div>
                ) : null}
              </Box>

              <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary">
                {t('employees.attendance.merit_hint')}
              </Typography>
            </Stack>
          </Paper>
        </Box>
      </Box>

      {/* Row 2: **Donut único** distribución por tipo (limpio y entendible) */}
      <Box className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-2">
        <CategoricalDonutWidget
          title={t('employees.attendance.by_type') || 'Distribución por tipo'}
          total={cur.totalDays}
          data={donutData}
          size={92}
          stroke={10}
        />
      </Box>

      {/* Row 3: Logros + Breakdown compacto */}
      <Box className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-1">
        <Box className="md:col-span-5">
          <Paper
            variant="outlined"
            className="rounded-3xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30"
          >
            <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary">
              {t('employees.attendance.achievements') || 'Logros'}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" mt={1}>
              {(() => {
                const achievements = [
                  CUR.AUS === 0 ? (t('employees.attendance.achievement.no_absences') || 'Sin ausencias') : null,
                  streaks.best >= 7 ? (t('employees.attendance.achievement.perfect_week') || 'Semana perfecta') : null,
                  streaks.current >= 5 ? (t('employees.attendance.achievement.on_fire') || 'En racha') : null,
                  CUR.VAC > 0 ? (t('employees.attendance.achievement.vacation_taken') || 'Vacaciones en periodo') : null,
                  deltaPct!=null && deltaPct > 5 ? (t('employees.attendance.achievement.comeback') || 'Remontada') : null,
                ].filter(Boolean);
                return achievements.length ? achievements.map((txt, i) => (
                  <Chip key={i} size="small" label={txt} className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" />
                )) : (
                  <Typography variant="body2" className="text-light-text-secondary dark:text-dark-text-secondary">
                    {t('employees.attendance.no_data')}
                  </Typography>
                );
              })()}
            </Stack>
          </Paper>
        </Box>

        <Box className="md:col-span-7">
          <Paper
            variant="outlined"
            className="rounded-3xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30"
          >
            <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary">
              {t('employees.attendance.daily_summary')}
            </Typography>
            <Stack spacing={0.5} mt={1}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.days')}</span>
                <span className="font-semibold">{cur.totalDays}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{movementLabel(t,'PTE')}</span>
                <span className="font-semibold">{CUR.PTE}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{movementLabel(t,'LBR')}</span>
                <span className="font-semibold">{CUR.LBR}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{movementLabel(t,'VAC')}</span>
                <span className="font-semibold">{CUR.VAC}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{movementLabel(t,'LIC')}</span>
                <span className="font-semibold">{CUR.LIC}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.absences') || 'Ausencias'}</span>
                <span className="font-semibold">{CUR.AUS}</span>
              </div>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default AttendanceTab;