import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import Button from '@mui/material/Button';
import { DateRange, CalendarMonth, CompareArrows } from '@mui/icons-material';
import DatePickerTheme from '../common/DatePickerTheme';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

dayjs.extend(isoWeek);

// === helpers ===
const resolveQuickRange = (key) => {
  const today = dayjs().endOf('day');
  switch (key) {
    case 'THIS_YEAR':
      return { start: dayjs().startOf('year').toDate(), end: today.toDate() };
    case 'LAST_YEAR':
      return {
        start: dayjs().subtract(1, 'year').startOf('year').toDate(),
        end: dayjs().subtract(1, 'year').endOf('year').toDate(),
      };
    case 'LAST_2_YEARS':
      return { start: dayjs().subtract(2, 'year').startOf('year').toDate(), end: today.toDate() };
    case 'THIS_WEEK': {
      const start = dayjs().isoWeekday(1).startOf('day').toDate();
      const end = dayjs().isoWeekday(7).endOf('day').toDate();
      return { start, end };
    }
    case 'LAST_WEEK': {
      const start = dayjs().subtract(1, 'week').isoWeekday(1).startOf('day').toDate();
      const end = dayjs().subtract(1, 'week').isoWeekday(7).endOf('day').toDate();
      return { start, end };
    }
    case 'LAST_7_DAYS': {
      const end = today.toDate();
      const start = dayjs().subtract(6, 'day').startOf('day').toDate();
      return { start, end };
    }
    case 'THIS_MONTH':
      return { start: dayjs().startOf('month').toDate(), end: today.toDate() };
    case 'LAST_MONTH':
      return {
        start: dayjs().subtract(1, 'month').startOf('month').toDate(),
        end: dayjs().subtract(1, 'month').endOf('month').toDate(),
      };
    case 'TWO_AGO':
      return {
        start: dayjs().subtract(2, 'month').startOf('month').toDate(),
        end: dayjs().subtract(2, 'month').endOf('month').toDate(),
      };
    default:
      return { start: null, end: null };
  }
};

const ControlsBar = ({
  t,
  // min/max combinados
  ventaMinDate, ventaMaxDate,
  gastoMinDate, gastoMaxDate,
  // quick + rango
  quickRange, setQuickRange,
  pendingDateRange, handlePendingDateRangeChange,
  // comparación
  pendingConfig, handlePendingConfigChange,
  // aplicar
  handleApply,
  // empresa
  empresaOptions = [],
  selectedEmpresaId = null,
  onSelectEmpresa,
  // sucursales
  sucursalOptions = [],
  selectedSucursalIds = [],
  onSelectSucursales,
  // estado
  isLoading, error,
}) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  // ==== DEFAULTS on mount: LAST_MONTH + same_period + align weekdays ====
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    if (didInitRef.current) return;
    const needQuick = !quickRange || quickRange === 'CUSTOM';
    const needDates = !pendingDateRange?.start || !pendingDateRange?.end;
    const needCmp = pendingConfig?.comparisonType === 'none' || pendingConfig?.comparisonType == null;
    const needAlign = !pendingConfig?.compareByWeekdays;

    if (needQuick || needDates || needCmp || needAlign) {
      const defKey = 'LAST_MONTH';
      setQuickRange?.(defKey);
      const { start, end } = resolveQuickRange(defKey);
      handlePendingDateRangeChange('start')(start);
      handlePendingDateRangeChange('end')(end);
      handlePendingConfigChange('comparisonType')({ target: { value: 'same_period' } });
      handlePendingConfigChange('compareByWeekdays')({ target: { value: true } });
    }
    didInitRef.current = true;
  }, [
    quickRange,
    pendingDateRange?.start,
    pendingDateRange?.end,
    pendingConfig?.comparisonType,
    pendingConfig?.compareByWeekdays,
    setQuickRange,
    handlePendingDateRangeChange,
    handlePendingConfigChange,
  ]);

  // ==== derived ====
  const minAll = React.useMemo(
    () => dayjs.min(ventaMinDate || dayjs(null), gastoMinDate || dayjs(null)),
    [ventaMinDate, gastoMinDate]
  );
  const maxAll = React.useMemo(
    () => dayjs.max(ventaMaxDate || dayjs(null), gastoMaxDate || dayjs(null)),
    [ventaMaxDate, gastoMaxDate]
  );

  const handleQuickSelect = (key) => {
    setQuickRange(key);
    const { start, end } = resolveQuickRange(key);
    if (key !== 'CUSTOM') {
      handlePendingDateRangeChange('start')(start);
      handlePendingDateRangeChange('end')(end);
    } else {
      handlePendingDateRangeChange('start')(null);
      handlePendingDateRangeChange('end')(null);
    }
  };

  const quickOptions = [
    { key: 'LAST_7_DAYS',  label: t('analytics.Últimos 7 días') },
    { key: 'THIS_WEEK',    label: t('analytics.Esta semana') },
    { key: 'LAST_WEEK',    label: t('analytics.Semana pasada') },
    { key: 'THIS_MONTH',   label: t('analytics.Este mes') },
    { key: 'LAST_MONTH',   label: t('analytics.Mes pasado') },
    { key: 'THIS_YEAR',    label: t('analytics.Este año') },
    { key: 'LAST_YEAR',    label: t('analytics.Año pasado') },
    { key: 'LAST_2_YEARS', label: t('analytics.Últimos 2 años') },
    { key: 'TWO_AGO',      label: t('analytics.Antepasado') },
    { key: 'CUSTOM',       label: t('analytics.Personalizado') },
  ];

  const comparisonDisabled = quickRange === 'CUSTOM';

  // ==== UI ====
  return (
    <Box
      className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-modal mb-4"
      sx={{ p: 2, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
    >
      <Stack spacing={1.5}>
        {/* Row 1: Empresa + Sucursales (una sola fila en md+) */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="stretch">
          <FormControl size="small" sx={{ flex: 1, minWidth: 180 }}>
            <InputLabel className="text-light-text-primary dark:text-dark-text-primary">
              {t('analytics.Empresa')}
            </InputLabel>
            <Select
              className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
              value={selectedEmpresaId || ''}
              onChange={(e) => onSelectEmpresa?.(e.target.value || null)}
              label={t('analytics.Empresa')}
              displayEmpty
              MenuProps={{
                PaperProps: { className: 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary' },
              }}
            >
              <MenuItem className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="">
                <em>{t('analytics.Todas')}</em>
              </MenuItem>
              {(empresaOptions || []).map((emp) => (
                <MenuItem
                  className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                  key={emp.id || emp._id || emp.empresa_id || emp.value}
                  value={emp.id || emp._id || emp.empresa_id || emp.value}
                >
                  {emp.nombre || emp.name || emp.label || `Empresa ${emp.id || emp._id || ''}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ flex: 2, minWidth: 220 }} disabled={!selectedEmpresaId}>
            <InputLabel className="text-light-text-primary dark:text-dark-text-primary">
              {t('analytics.Sucursales')}
            </InputLabel>
            <Select
              className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
              multiple
              value={Array.isArray(selectedSucursalIds) ? selectedSucursalIds : []}
              onChange={(e) => onSelectSucursales?.(Array.isArray(e.target.value) ? e.target.value : [])}
              label={t('analytics.Sucursales')}
              renderValue={(selected) => {
                const map = new Map((sucursalOptions || []).map(s => [Number(s.id), s]));
                const names = (selected || []).map((id) => map.get(Number(id))?.label || String(id));
                return names.join(', ');
              }}
              MenuProps={{
                PaperProps: { className: 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary' },
              }}
            >
              {(sucursalOptions || []).map((s) => (
                <MenuItem
                  className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                  key={s.id}
                  value={s.id}
                >
                  {s.label || s.sigla || `Sucursal ${s.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Comparación + Alinear (empujado a la derecha en md+) */}
          <Stack direction={{ xs: 'row', md: 'row' }} spacing={1} sx={{ ml: { md: 'auto' } }} alignItems="center">
            {mdUp ? (
              <ToggleButtonGroup
                className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                size="small"
                exclusive
                value={pendingConfig.comparisonType || 'same_period'}
                onChange={(_, v) => v && handlePendingConfigChange('comparisonType')({ target: { value: v } })}
                sx={{
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 1,
                    py: 0.5,
                    lineHeight: 1.1,
                  },
                }}
              >
                <ToggleButton className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="none">{t('analytics.Sin comparación')}</ToggleButton>
                <ToggleButton className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="same_period">{t('analytics.Mismo período')}</ToggleButton>
                <ToggleButton className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="previous_period" disabled={comparisonDisabled}>
                  {t('analytics.Período anterior')}
                </ToggleButton>
              </ToggleButtonGroup>
            ) : null}

            <Tooltip title={t('analytics.align_by_weekday_to_compare')}>
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={!!pendingConfig.compareByWeekdays}
                    onChange={(e) =>
                      handlePendingConfigChange('compareByWeekdays')({ target: { value: e.target.checked } })
                    }
                    disabled={pendingConfig.comparisonType === 'none'}
                  />
                }
                label={t('analytics.Cuadrar días (L–D)')}
                labelPlacement="end"
              />
            </Tooltip>
          </Stack>
        </Stack>

        {/* Row 2: Quick range */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
          <CalendarMonth fontSize="small" />
          {mdUp ? (
            <ToggleButtonGroup
              className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary rounded-2xl"
              size="small"
              exclusive
              value={quickRange}
              onChange={(_, v) => v && handleQuickSelect(v)}
              sx={{
                flexWrap: 'wrap',
                gap: 0.75,
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 1,
                  py: 0.5,
                  lineHeight: 1.1,
                  whiteSpace: 'normal',
                },
              }}
            >
              {quickOptions.map((opt) => (
                <ToggleButton
                  className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary rounded-2xl"
                  key={opt.key}
                  value={opt.key}
                >
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          ) : (
            <FormControl size="small" fullWidth>
              <InputLabel className="text-light-text-primary dark:text-dark-text-primary">
                {t('analytics.Rango')}
              </InputLabel>
              <Select
                className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                value={quickRange || 'LAST_MONTH'}
                onChange={(e) => handleQuickSelect(e.target.value)}
                label={t('analytics.Rango')}
                MenuProps={{
                  PaperProps: {
                    className: 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary',
                  },
                }}
              >
                {quickOptions.map((opt) => (
                  <MenuItem
                    className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                    key={opt.key}
                    value={opt.key}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>

        {/* Row 3: Fecha o pickers + Buscar (alineado a la derecha en md+) */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          {quickRange === 'CUSTOM' ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flex: 1 }}>
              <DatePickerTheme
                className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                label={t('analytics.Fecha Inicio')}
                value={
                  pendingDateRange.start
                    ? typeof pendingDateRange.start.toDate === 'function'
                      ? pendingDateRange.start.toDate()
                      : new Date(pendingDateRange.start)
                    : null
                }
                onChange={handlePendingDateRangeChange('start')}
                minDate={minAll?.isValid?.() ? minAll.toDate() : undefined}
                maxDate={pendingDateRange.end || (maxAll?.isValid?.() ? maxAll.toDate() : undefined)}
                showYearDropdown
              />
              <DatePickerTheme
                className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                label={t('analytics.Fecha Fin')}
                value={
                  pendingDateRange.end
                    ? typeof pendingDateRange.end.toDate === 'function'
                      ? pendingDateRange.end.toDate()
                      : new Date(pendingDateRange.end)
                    : null
                }
                onChange={handlePendingDateRangeChange('end')}
                minDate={pendingDateRange.start || (minAll?.isValid?.() ? minAll.toDate() : undefined)}
                maxDate={maxAll?.isValid?.() ? maxAll.toDate() : undefined}
                showYearDropdown
              />
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <DateRange fontSize="small" />
              <Chip
                className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                size="small"
                label={
                  pendingDateRange.start && pendingDateRange.end
                    ? `${dayjs(pendingDateRange.start).format('YYYY-MM-DD')} – ${dayjs(pendingDateRange.end).format('YYYY-MM-DD')}`
                    : ''
                }
                variant="outlined"
                sx={{ borderRadius: 2, maxWidth: '100%', overflow: 'hidden', '& .MuiChip-label': { display: 'block' } }}
              />
            </Stack>
          )}

          <Button
            loading={!!isLoading}
            variant="contained"
            onClick={handleApply}
            disabled={!pendingDateRange.start || !pendingDateRange.end}
            className="bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white rounded-xl"
            sx={{ fontWeight: 700, px: 2, ml: { sm: 'auto' }, minWidth: 140 }}
          >
            {t('analytics.Buscar')}
          </Button>
        </Stack>

        {/* Estado */}
        <Box>
          {isLoading && (
            <Typography variant="caption" className="text-light-accent dark:text-dark-accent">
              {t('analytics.Cargando...')}
            </Typography>
          )}
          {error && (
            <Typography variant="caption" className="text-light-error dark:text-dark-error">
              {error.message}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

export default ControlsBar;
