import React from 'react';
import dayjs from 'dayjs';
import { Box, Tooltip } from '@mui/material';

const colorFor = (worked) => worked ? 'bg-light-accent/80 dark:bg-dark-accent/80' : 'bg-light-surface-tertiary/70 dark:bg-dark-surface-tertiary/70';

const AttendanceHeatmap = ({ start, end, items = [] }) => {
  if (!start || !end) return null;
  // status por día
  const byDay = new Map();
  for (const it of items) {
    const d = dayjs(it?.fecha_trabajada).format('YYYY-MM-DD');
    const worked = ['PTE','LBR','VAC','PCG','HUE'].includes(String(it?.tipo_movimiento).toUpperCase());
    byDay.set(d, worked ? 1 : 0);
  }

  const cells = [];
  let cur = dayjs(start).startOf('day');
  const last = dayjs(end).startOf('day');
  while (cur.isBefore(last) || cur.isSame(last)) {
    const ds = cur.format('YYYY-MM-DD');
    const worked = byDay.get(ds) ?? 0;
    cells.push({ date: ds, worked });
    cur = cur.add(1, 'day');
  }

  return (
    <Box className="rounded-3xl border border-light-accent/30 dark:border-dark-accent/30 p-3 bg-light-surface/50 dark:bg-dark-surface/50">
      <div className="grid grid-cols-14 gap-1">
        {cells.map((c) => (
          <Tooltip key={c.date} title={`${c.date} · ${c.worked ? 'Asistió' : 'No asistió'}`}>
            <div className={`h-4 w-4 rounded ${colorFor(c.worked)} hover:shadow-neon transition`} />
          </Tooltip>
        ))}
      </div>
    </Box>
  );
};

export default AttendanceHeatmap;
