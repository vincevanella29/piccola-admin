import dayjs from 'dayjs';

export const DAY_WORKED_BY_MOV = {
  AUS: 0, // Ausencia
  HUE: 1, // Huelga (si lo consideras trabajado, queda en 1)
  LBR: 1, // Libre remunerado / laborado, según tu regla
  LIC: 0, // Licencia
  NVI: 0, // No vino
  PCG: 1, // Permiso con goce
  PSG: 0, // Permiso sin goce
  PTE: 1, // Presente
  VAC: 1, // Vacaciones
};

export function summarizeAttendance(items = [], start = null, end = null) {
  const breakdown = { AUS:0,HUE:0,LBR:0,LIC:0,NVI:0,PCG:0,PSG:0,PTE:0,VAC:0,OTHER:0 };

  // Días del rango (inclusivo) para el denominador del % asistencia
  let totalDays = 0;
  if (start && end) {
    const s = dayjs(start).startOf('day');
    const e = dayjs(end).endOf('day');
    totalDays = e.diff(s, 'day') + 1;
  } else {
    // fallback por fechas únicas presentes en el payload
    const uniq = new Set(items.map(it => it?.fecha_trabajada).filter(Boolean));
    totalDays = uniq.size;
  }

  let worked = 0;
  for (const it of items) {
    const mv = String(it?.tipo_movimiento || '').toUpperCase();
    if (mv in DAY_WORKED_BY_MOV) {
      worked += DAY_WORKED_BY_MOV[mv];
      breakdown[mv] = (breakdown[mv] || 0) + 1;
    } else {
      breakdown.OTHER = (breakdown.OTHER || 0) + 1;
    }
  }

  const pct = totalDays > 0 ? (worked / totalDays) * 100 : 0;
  const absent = Math.max(totalDays - worked, 0);
  const movements = items.map(it => it.tipo_movimiento);

  return { worked, absent, totalDays, pct, breakdown, movements };
}

export function pctDelta(currPct, prevPct) {
  if (prevPct === 0 && currPct === 0) return 0;
  if (prevPct === 0) return 100; // pasó de 0 a algo (>0)
  return ((currPct - prevPct) / prevPct) * 100;
}
