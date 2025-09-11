import React from 'react';
import {
  Box,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
// Using Unicode glyphs instead of MUI icons to avoid SvgIcon hook issues
import EmployeeAvatar from './EmployeeAvatar';

// --- utils de formato compact ---
const fmtCLPFull = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
function compactNumber(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '')}b`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '')}m`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${sign}${Math.round(abs)}`;
}
function fmtCLPCompact(n = 0) {
  if (n == null || isNaN(n)) return '—';
  return `$${compactNumber(n)}`;
}
function pct1(n) {
  if (n == null || !isFinite(n)) return '—';
  const v = Math.abs(n).toFixed(1).replace(/\.0$/, '');
  return `${v}%`;
}

const HeaderCell = ({ children, active, dir, onClick }) => (
  <TableCell
    onClick={onClick}
    className="cursor-pointer text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30 select-none"
    sx={{ position: 'sticky', top: 0, backdropFilter: 'blur(6px)', background: 'transparent', width: 160 }}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      {!active && <span className="opacity-60">⥮</span>}
      {active && (dir === 'desc' ? <span className="opacity-90">▼</span> : <span className="opacity-90">▲</span>)}
    </span>
  </TableCell>
);

const TrendCell = ({ delta }) => {
  if (delta == null || !isFinite(delta)) return <TableCell className="align-middle">—</TableCell>;
  const up = delta >= 0;
  return (
    <TableCell>
      <span className="inline-flex items-center gap-1">
        <span className={`align-middle font-semibold ${up ? 'text-matrix-green' : 'text-vanellix-purple'}`}>{up ? '▲' : '▼'}</span>
        <span className="text-light-text-secondary dark:text-dark-text-secondary font-medium">{pct1(delta)}</span>
      </span>
    </TableCell>
  );
};

const MoneyCell = ({ value, className = '' }) => (
  <TableCell className={`text-light-text-secondary dark:text-dark-text-secondary align-middle ${className}`}>
    <Tooltip title={fmtCLPFull.format(Number(value || 0))} arrow>
      <span className={`text-light-text-secondary dark:text-dark-text-secondary font-medium ${className}`}>{fmtCLPCompact(Number(value || 0))}</span>
    </Tooltip>
  </TableCell>
);

const DesktopEmployeesTable = ({ items, loading, t, page, setPage, pageSize, setPageSize, onSelect }) => {
  // sort: 'total' | 'prev' | 'delta'
  const [sortBy, setSortBy] = React.useState('delta');
  const [sortDir, setSortDir] = React.useState('desc');

  const withComputed = React.useMemo(() => {
    return (items || []).map((emp) => {
      const p = emp?.payroll || {};
      const total = Number(p?.totals?.total || 0);
      const prev = Number(p?.previous?.net || 0);       // último período disponible
      const ante = Number(p?.anteprevious?.net || 0);   // período ante-anterior (para delta)
      const delta = ante > 0 ? ((prev - ante) / ante) * 100 : (prev > 0 ? 100 : null);
      const name = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno].filter(Boolean).map(s => String(s).trim()).join(' ');
      return {
        ...emp,
        __total: total,
        __prev: prev,
        __ante: ante,
        __delta: isFinite(delta) ? delta : null,
        __name: (name || '').toLowerCase(),
        __rut_s: String(emp?.rut ?? ''),
        __seccion_s: String(emp?.seccion ?? '').toLowerCase(),
        __cargo_s: String(emp?.cargo ?? '').toLowerCase(),
        __sucursal_s: String(emp?.sucursal ?? '').toLowerCase(),
        __ingreso_s: String(emp?.fechaingreso ?? ''),
      };
    });
  }, [items]);

  const sorted = React.useMemo(() => {
    const arr = [...withComputed];
    const factor = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const isTextKey = (k) => ['name','rut','seccion','cargo','sucursal','ingreso'].includes(k);
      if (isTextKey(sortBy)) {
        const map = {
          name: '__name',
          rut: '__rut_s',
          seccion: '__seccion_s',
          cargo: '__cargo_s',
          sucursal: '__sucursal_s',
          ingreso: '__ingreso_s',
        };
        const ka = map[sortBy];
        const avs = String(a[ka] ?? '');
        const bvs = String(b[ka] ?? '');
        const cmp = avs.localeCompare(bvs, undefined, { sensitivity: 'base' });
        if (cmp === 0) {
          // tie-breaker por nombre
          const t = String(a.__name || '').localeCompare(String(b.__name || ''), undefined, { sensitivity: 'base' });
          return t;
        }
        return cmp * factor;
      } else {
        const av = a[`__${sortBy}`];
        const bv = b[`__${sortBy}`];
        // nulls al final
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av === bv) {
          // tie-breaker por monto más alto (prev) y luego por nombre
          const pComp = (b.__prev || 0) - (a.__prev || 0);
          if (pComp !== 0) return pComp * (sortBy === 'delta' ? 1 : factor);
          return String(a.__name || '').localeCompare(String(b.__name || ''));
        }
        return av > bv ? factor : -factor;
      }
    });
    return arr;
  }, [withComputed, sortBy, sortDir]);

  const paged = React.useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [sorted, page, pageSize]);

  const toggleSort = (key) => {
    setSortBy((prevKey) => {
      if (prevKey !== key) {
        setSortDir('desc');
        return key;
      }
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return prevKey;
    });
  };

  return (
    <TableContainer
      component={Paper}
      className="bg-light-surface/70 dark:bg-dark-surface/70 border border-light-accent/30 dark:border-dark-accent/30 shadow-neon rounded-3xl backdrop-blur-md mt-2"
      sx={{ width: '100%', overflowX: 'auto', maxHeight: '70vh' }}
    >
      <Table
        size="small"
        className="text-light-text-primary dark:text-dark-text-primary"
        stickyHeader
        sx={{ tableLayout: 'fixed', width: '100%' }}
      >
        <TableHead className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40">
          <TableRow>
            <HeaderCell className="text-xs font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30" sx={{ width: 64 }}>
              {t('employees.table.photo')}
            </HeaderCell>
            <HeaderCell
              active={sortBy === 'name'}
              dir={sortDir}
              onClick={() => toggleSort('name')}
              className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30"
            >
              {t('employees.table.name')}
            </HeaderCell>
            <HeaderCell
              active={sortBy === 'rut'}
              dir={sortDir}
              onClick={() => toggleSort('rut')}
              className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30"
              sx={{ width: 120 }}
            >
              {t('employees.table.rut')}
            </HeaderCell>
            <HeaderCell
              active={sortBy === 'seccion'}
              dir={sortDir}
              onClick={() => toggleSort('seccion')}
              className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30"
              sx={{ width: 160 }}
            >
              {t('employees.filters.seccion')}
            </HeaderCell>
            <HeaderCell
              active={sortBy === 'cargo'}
              dir={sortDir}
              onClick={() => toggleSort('cargo')}
              className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30"
              sx={{ width: 160 }}
            >
              {t('employees.table.cargo')}
            </HeaderCell>
            <HeaderCell
              active={sortBy === 'sucursal'}
              dir={sortDir}
              onClick={() => toggleSort('sucursal')}
              className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30"
              sx={{ width: 160 }}
            >
              {t('employees.table.sucursal')}
            </HeaderCell>
            <HeaderCell
              active={sortBy === 'ingreso'}
              dir={sortDir}
              onClick={() => toggleSort('ingreso')}
              className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-semibold font-futurist tracking-wide border-b border-light-accent/30 dark:border-dark-accent/30"
              sx={{ width: 140 }}
            >
              {t('employees.table.ingreso')}
            </HeaderCell>

            <HeaderCell
              active={sortBy === 'total'}
              dir={sortDir}
              onClick={() => toggleSort('total')}
            >
              {t('employees.payroll.columns.total_paid')}
            </HeaderCell>

            <HeaderCell
              active={sortBy === 'prev'}
              dir={sortDir}
              onClick={() => toggleSort('prev')}
            >
              {t('employees.payroll.columns.net_previous')}
            </HeaderCell>

            <HeaderCell
              active={sortBy === 'delta'}
              dir={sortDir}
              onClick={() => toggleSort('delta')}
            >
              {t('employees.common.change_pct')}
            </HeaderCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading && Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
            <TableRow className="border-b border-light-accent/15 dark:border-dark-accent/15" key={`s-${i}`}>
              <TableCell><Skeleton variant="circular" width={36} height={36} /></TableCell>
              <TableCell><Skeleton variant="text" width="50%" /><Skeleton variant="text" width="30%" /></TableCell>
              <TableCell><Skeleton variant="text" width="60%" /></TableCell>
              <TableCell><Skeleton variant="text" width="50%" /></TableCell>
              <TableCell><Skeleton variant="text" width="50%" /></TableCell>
              <TableCell><Skeleton variant="text" width="40%" /></TableCell>
              <TableCell><Skeleton variant="text" width="50%" /></TableCell>
              <TableCell><Skeleton variant="text" width="50%" /></TableCell>
              <TableCell><Skeleton variant="text" width="40%" /></TableCell>
            </TableRow>
          ))}

          {!loading && paged.map((emp) => {
            const name = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno]
              .filter(Boolean)
              .map((s) => String(s).trim())
              .join(' ');
            return (
              <TableRow
                key={String(emp?._id || emp?.rut)}
                hover
                onClick={() => onSelect(emp)}
                className="cursor-pointer border-b border-light-accent/15 dark:border-dark-accent/15 hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/20 transition duration-150"
              >
                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">
                  <EmployeeAvatar emp={emp} />
                </TableCell>

                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">
                  <Typography variant="body2" fontWeight={700} className="tracking-tight">{name || t('employees.table.unknown')}</Typography>
                  <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary truncate block">
                    {emp?.email || emp?.correo || ''}
                  </Typography>
                </TableCell>

                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">{emp?.rut ?? t('employees.table.unknown')}</TableCell>

                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">
                  {emp?.cargo ? (
                    <Chip size="small" label={emp.cargo} className="text-light-text-secondary dark:text-dark-text-secondary" />
                  ) : t('employees.table.unknown')}
                </TableCell>

                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">
                  {emp?.seccion ? (
                    <Chip size="small" label={emp.seccion} className="text-light-text-secondary dark:text-dark-text-secondary" variant="outlined" />
                  ) : t('employees.table.unknown')}
                </TableCell>

                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">
                  {emp?.sucursal ? <Chip className="text-light-text-secondary dark:text-dark-text-secondary" size="small" label={emp.sucursal} variant="outlined" /> : t('employees.table.unknown')}
                </TableCell>

                <TableCell className="text-light-text-secondary dark:text-dark-text-secondary align-middle">{emp?.fechaingreso ?? t('employees.table.unknown')}</TableCell>

                <MoneyCell className="text-light-text-secondary dark:text-dark-text-secondary" value={emp.__total} />
                <MoneyCell className="text-light-text-secondary dark:text-dark-text-secondary" value={emp.__prev} />
                <TrendCell className="text-light-text-secondary dark:text-dark-text-secondary" delta={emp.__delta} />
              </TableRow>
            );
          })}

          {!loading && !items.length && (
            <TableRow className="border-b border-light-accent/15 dark:border-dark-accent/15">
              <TableCell colSpan={10}>
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" className="text-light-text-secondary dark:text-dark-text-secondary">
                    {t('employees.attendance.no_data')}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Divider />
      <Box className="bg-light-surface/70 dark:bg-dark-surface/70" sx={{ position: 'sticky', bottom: 0 }}>
        <TablePagination
          component="div"
          count={items.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setPageSize(v);
            setPage(0);
          }}
          rowsPerPageOptions={[10, 50, 100]}
          labelRowsPerPage={t('employees.table.per_page')}
          className="text-light-text-primary dark:text-dark-text-primary"
          sx={{
            '& .MuiTablePagination-toolbar': { color: 'inherit' },
            '& .MuiSvgIcon-root': { color: 'inherit' },
          }}
        />
      </Box>
    </TableContainer>
  );
};

export default DesktopEmployeesTable;
