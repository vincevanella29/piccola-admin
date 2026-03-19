import React from 'react';
import dayjs from 'dayjs';
import { summarizeAttendance, pctDelta, DAY_WORKED_BY_MOV } from '../../../../utils/attendanceMetrics';
import DeltaPill from '../../../../components/ui/DeltaPill';
import HoloChip from '../../../../components/ui/HoloChip';
import CategoricalDonutWidget from '../../../../components/widgets/CategoricalDonutWidget';

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Number(n || 0)));

const Bar = ({ valuePct = 0, faint = false }) => (
  <div className={`h-2 rounded-full bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 overflow-hidden ${faint ? 'opacity-60' : ''}`}>
    <div className="h-2 rounded-full bg-light-accent/80 dark:bg-dark-accent/80 transition-all" style={{ width: `${clamp(valuePct)}%` }} />
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

function gradeFromPct(p) {
  const v = clamp(p);
  if (v >= 98) return { tier: 'S', color: 'text-emerald-500' };
  if (v >= 95) return { tier: 'A', color: 'text-emerald-500' };
  if (v >= 90) return { tier: 'B', color: 'text-light-text-primary dark:text-dark-text-primary' };
  if (v >= 85) return { tier: 'C', color: 'text-amber-500' };
  return { tier: 'D', color: 'text-red-500' };
}

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
  let best = 0, cur = 0;
  for (let d = s.clone(); d.isSame(e, 'day') || d.isBefore(e, 'day'); d = d.add(1, 'day')) {
    if (workedSet.has(d.format('YYYY-MM-DD'))) { cur += 1; best = Math.max(best, cur); } else { cur = 0; }
  }
  let streak = 0;
  for (let d = e.clone().startOf('day'); d.isSame(s, 'day') || d.isAfter(s, 'day'); d = d.subtract(1, 'day')) {
    if (workedSet.has(d.format('YYYY-MM-DD'))) streak += 1; else break;
  }
  return { best, current: streak };
}

// ═══════════════════════════════════════════════════════════════════════════════
const AttendanceTab = ({ t, attData, attPrev, comparisonWindow }) => {
  const start = comparisonWindow?.start ?? null;
  const end = comparisonWindow?.end ?? null;

  const cur = summarizeAttendance(attData || [], start, end);
  const prev = summarizeAttendance(attPrev || [], start, end);
  const deltaPct = (attPrev && attPrev.length) ? pctDelta(cur.pct, prev.pct) : null;

  const streaks = computeStreaks(attData || [], start, end);

  const sumOf = (obj, keys) => keys.reduce((a,k) => a+(obj?.[k]||0), 0);
  const CUR = {
    PTE: cur.breakdown.PTE || 0,
    LBR: cur.breakdown.LBR || 0,
    VAC: cur.breakdown.VAC || 0,
    LIC: cur.breakdown.LIC || 0,
    AUS: sumOf(cur.breakdown, ['AUS','NVI','PSG']),
  };
  const grade = gradeFromPct(cur.pct);

  const donutData = [
    { key: 'PTE', label: movementLabel(t,'PTE'), count: CUR.PTE, color: '#22c55e' },
    { key: 'LBR', label: movementLabel(t,'LBR'), count: CUR.LBR, color: '#0ea5e9' },
    { key: 'VAC', label: movementLabel(t,'VAC'), count: CUR.VAC, color: '#f59e0b' },
    { key: 'LIC', label: movementLabel(t,'LIC'), count: CUR.LIC, color: '#a78bfa' },
    { key: 'AUS', label: movementLabel(t,'AUS'), count: CUR.AUS, color: '#ef4444' },
  ];

  return (
    <div className="w-full overflow-x-hidden space-y-3">
      {/* Top badge bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PeriodBadge title={t('employees.payroll.period_current')} start={start} end={end} />
        {attPrev?.length ? <HoloChip label={`${t('employees.attendance.previous')}: ${Math.round(prev.pct)}%`} /> : null}
        <HoloChip label={t('employees.attendance.worked_ratio', { worked: cur.worked, total: cur.totalDays })} />
        <HoloChip label={`${t('employees.attendance.days')}: ${cur.totalDays}`} />
        <DeltaPill value={deltaPct} goodWhenUp t={t} />
      </div>

      {/* Row 1: HUD card + comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Player card */}
        <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              {t('employees.attendance.title')}
            </h4>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${grade.color} bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20`}>
              Tier {grade.tier} · {Math.round(clamp(cur.pct))}%
            </span>
          </div>

          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-1">{t('employees.merit.title')}</p>
          <div className="h-2 rounded-full bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 overflow-hidden">
            <div className="h-2 rounded-full bg-light-accent dark:bg-dark-accent transition-all" style={{ width: `${clamp(cur.pct)}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl p-2.5 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/15">
              <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.streak_current')}</div>
              <div className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{streaks.current} <span className="text-xs font-normal">{t('employees.attendance.days')}</span></div>
            </div>
            <div className="rounded-xl p-2.5 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/15">
              <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.streak_best')}</div>
              <div className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{streaks.best} <span className="text-xs font-normal">{t('employees.attendance.days')}</span></div>
            </div>
          </div>
        </div>

        {/* Comparison card */}
        <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              {t('employees.attendance.comparison')}
            </h4>
            <DeltaPill value={deltaPct} goodWhenUp t={t} />
          </div>

          <div>
            <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
              {t('employees.attendance.current')}: <b className="text-light-text-primary dark:text-dark-text-primary">{Math.round(clamp(cur.pct))}%</b>
            </div>
            <Bar valuePct={cur.pct} />
            {attPrev?.length ? (
              <div className="mt-2">
                <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                  {t('employees.attendance.previous')}: <b className="text-light-text-primary dark:text-dark-text-primary">{Math.round(clamp(prev.pct))}%</b>
                </div>
                <Bar valuePct={prev.pct} faint />
              </div>
            ) : null}
          </div>

          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-3">
            {t('employees.attendance.merit_hint')}
          </p>
        </div>
      </div>

      {/* Row 2: Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CategoricalDonutWidget
          title={t('employees.attendance.by_type')}
          total={cur.totalDays}
          data={donutData}
          size={92}
          stroke={10}
        />
      </div>

      {/* Row 3: Achievements + Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5">
          <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
            <h4 className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">
              {t('employees.attendance.achievements')}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const achievements = [
                  CUR.AUS === 0 ? (t('employees.attendance.achievement.no_absences') || 'Sin ausencias') : null,
                  streaks.best >= 7 ? (t('employees.attendance.achievement.perfect_week') || 'Semana perfecta') : null,
                  streaks.current >= 5 ? (t('employees.attendance.achievement.on_fire') || 'En racha') : null,
                  CUR.VAC > 0 ? (t('employees.attendance.achievement.vacation_taken') || 'Vacaciones en periodo') : null,
                  deltaPct != null && deltaPct > 5 ? (t('employees.attendance.achievement.comeback') || 'Remontada') : null,
                ].filter(Boolean);
                return achievements.length ? achievements.map((txt, i) => (
                  <span key={i} className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
                    {txt}
                  </span>
                )) : (
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('employees.attendance.no_data')}</p>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="md:col-span-7">
          <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
            <h4 className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">
              {t('employees.attendance.daily_summary')}
            </h4>
            <div className="space-y-1">
              {[
                { label: t('employees.attendance.days'), value: cur.totalDays },
                { label: movementLabel(t, 'PTE'), value: CUR.PTE },
                { label: movementLabel(t, 'LBR'), value: CUR.LBR },
                { label: movementLabel(t, 'VAC'), value: CUR.VAC },
                { label: movementLabel(t, 'LIC'), value: CUR.LIC },
                { label: t('employees.attendance.absences'), value: CUR.AUS },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-0.5 text-sm">
                  <span className="text-light-text-secondary dark:text-dark-text-secondary">{row.label}</span>
                  <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTab;