import React from 'react';
import dayjs from 'dayjs';

const AttendanceHeatmap = ({ start, end, items = [] }) => {
  if (!start || !end) return null;

  const byDay = new Map();
  for (const it of items) {
    const d = dayjs(it?.fecha_trabajada).format('YYYY-MM-DD');
    const worked = ['PTE', 'LBR', 'VAC', 'PCG', 'HUE'].includes(String(it?.tipo_movimiento).toUpperCase());
    byDay.set(d, worked ? 1 : 0);
  }

  const cells = [];
  let cur = dayjs(start).startOf('day');
  const last = dayjs(end).startOf('day');
  while (cur.isBefore(last) || cur.isSame(last)) {
    const ds = cur.format('YYYY-MM-DD');
    cells.push({ date: ds, worked: byDay.get(ds) ?? 0 });
    cur = cur.add(1, 'day');
  }

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
      <div className="flex items-center gap-3 mb-2 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-light-accent/70 dark:bg-dark-accent/70" /> Asistió ({cells.filter(c => c.worked).length})</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50" /> No ({cells.filter(c => !c.worked).length})</span>
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date} · ${c.worked ? 'Asistió' : 'No asistió'}`}
            className={`aspect-square rounded-sm ${
              c.worked
                ? 'bg-light-accent/70 dark:bg-dark-accent/70'
                : 'bg-light-surface-tertiary/40 dark:bg-dark-surface-tertiary/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default AttendanceHeatmap;
