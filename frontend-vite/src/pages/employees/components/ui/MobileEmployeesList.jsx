import React from 'react';
import { Box, Paper, Stack, Select, MenuItem, IconButton, Tooltip, Chip, Typography } from '@mui/material';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import MobileEmployeeCard from './MobileEmployeeCard';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function getDeltaPct(emp) {
  const prev = Number(emp?.payroll?.previous?.net || 0);
  const ante = Number(emp?.payroll?.anteprevious?.net || 0);
  if (ante > 0) return ((prev - ante) / ante) * 100;
  return prev > 0 ? 100 : null;
}

function valueFor(emp, key) {
  switch (key) {
    case 'total':
      return Number(emp?.payroll?.totals?.total || 0);
    case 'prev':
      return Number(emp?.payroll?.previous?.net || 0);
    case 'delta':
      return getDeltaPct(emp);
    case 'sucursal':
      return String(emp?.sucursal || '');
    default:
      return null;
  }
}

function cmp(a, b, key, dir) {
  const av = valueFor(a, key);
  const bv = valueFor(b, key);

  // null/NaN al final siempre
  const aBad = av == null || (typeof av === 'number' && !isFinite(av));
  const bBad = bv == null || (typeof bv === 'number' && !isFinite(bv));
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;

  let res = 0;
  if (key === 'sucursal') {
    res = collator.compare(av, bv);
  } else {
    res = av === bv ? 0 : (av > bv ? 1 : -1);
  }
  return dir === 'asc' ? res : -res;
}

const MobileEmployeesList = ({ items = [], onSelect, t }) => {
  const [sortBy, setSortBy] = React.useState('total');   // 'total' | 'sucursal' | 'prev' | 'delta'
  const [sortDir, setSortDir] = React.useState('desc');  // 'asc' | 'desc'
  // incremental loading
  const BATCH = 20;
  const [visibleCount, setVisibleCount] = React.useState(BATCH);
  const sentinelRef = React.useRef(null);

  const sorted = React.useMemo(() => {
    // stable sort con índice como desempate
    return [...items]
      .map((it, i) => ({ it, i }))
      .sort((a, b) => {
        const res = cmp(a.it, b.it, sortBy, sortDir);
        return res !== 0 ? res : a.i - b.i;
      })
      .map(({ it }) => it);
  }, [items, sortBy, sortDir]);

  // reset visible items when data or sort changes
  React.useEffect(() => {
    setVisibleCount(BATCH);
  }, [items, sortBy, sortDir]);

  // observe sentinel to load more when approaching bottom
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount((c) => Math.min(c + BATCH, sorted.length));
        }
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sorted.length]);

  return (
    <Box sx={{ width: '100%' }}>
      {/* Barra de orden compacta estilo exchange */}
      <Paper
        variant="outlined"
        className="bg-light-surface/70 dark:bg-dark-surface/70 border border-light-accent/30 dark:border-dark-accent/30 rounded-2xl backdrop-blur-md"
        sx={{ p: 1, mb: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary">
            {t?.('common.sort') || 'Ordenar'}
          </Typography>

          <Select
            size="small"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            variant="outlined"
            sx={{
              height: 30,
              '& .MuiSelect-select': { py: 0.5, fontSize: 12, fontWeight: 600 },
              minWidth: 170,
            }}
          >
            <MenuItem value="total">{t?.('employees.payroll.columns.total_paid') || 'Total sueldos'}</MenuItem>
            <MenuItem value="prev">{t?.('employees.payroll.columns.net_previous') || 'Sueldo anterior'}</MenuItem>
            <MenuItem value="delta">{t?.('employees.common.change_pct') || '% cambio'}</MenuItem>
            <MenuItem value="sucursal">{t?.('employees.table.sucursal') || 'Sucursal'}</MenuItem>
          </Select>

          <Tooltip title={sortDir === 'desc' ? (t?.('common.desc') || 'Descendente') : (t?.('common.asc') || 'Ascendente')}>
            <IconButton
              size="small"
              onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="text-light-text-secondary dark:text-dark-text-secondary"
              aria-label="toggle-sort"
            >
              <SwapVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Box sx={{ flex: 1 }} />
          <Chip
            size="small"
            label={`${t?.('employees.payroll.records') || 'registros'}: ${items.length}`}
            className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary"
            sx={{ height: 22 }}
          />
        </Stack>
      </Paper>

      {/* Lista ordenada con carga incremental */}
      <Stack spacing={0.75}>
        {sorted.slice(0, visibleCount).map((emp) => (
          <MobileEmployeeCard key={String(emp?._id || emp?.rut)} emp={emp} onClick={() => onSelect?.(emp)} t={t} />
        ))}
        {visibleCount < sorted.length && (
          <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
        )}
      </Stack>
    </Box>
  );
};

export default MobileEmployeesList;
