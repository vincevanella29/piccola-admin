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
import DatePickerTheme from '../../../../components/common/DatePickerTheme';
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
      // set quick range
      const defKey = 'LAST_MONTH';
      setQuickRange?.(defKey);
      const { start, end } = resolveQuickRange(defKey);
      handlePendingDateRangeChange('start')(start);
      handlePendingDateRangeChange('end')(end);
      // set comparison to same_period (año pasado) + align weekdays
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

  const handleQuickChangeSelect = (e) => handleQuickSelect(e.target.value);

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
      className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-modal"
      sx={{ p: 2.5, width: '100%' }}
    >
      <Box className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
        {/* Rango rápido */}
        <Box className="md:col-span-6 lg:col-span-7">
          {mdUp ? (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CalendarMonth fontSize="small" />
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
                    px: 1.25,
                    py: 0.5,
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
            </Stack>
          ) : (
            <FormControl size="small" fullWidth>
              <InputLabel className="text-light-text-primary dark:text-dark-text-primary">
                {t('analytics.Rango')}
              </InputLabel>
              <Select
                className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                value={quickRange || 'LAST_MONTH'}
                onChange={handleQuickChangeSelect}
                label={t('analytics.Rango')}
                MenuProps={{
                  PaperProps: {
                    className:
                      'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary',
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

          {/* Fecha legible ó pickers */}
          <Box mt={1.25}>
            {quickRange === 'CUSTOM' ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
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
              <Stack direction="row" alignItems="center" spacing={1}>
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
                  sx={{ borderRadius: 2 }}
                />
              </Stack>
            )}
          </Box>
        </Box>

        {/* Divisor para mobile */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <Divider />
        </Box>

        {/* Comparación + alineación + aplicar */}
        <Box className="md:col-span-6 lg:col-span-5">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="flex-end"
          >
            {mdUp ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                <CompareArrows fontSize="small" />
                <ToggleButtonGroup
                  className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                  size="small"
                  exclusive
                  value={pendingConfig.comparisonType || 'same_period'}
                  onChange={(_, v) =>
                    v && handlePendingConfigChange('comparisonType')({ target: { value: v } })
                  }
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      borderRadius: 2,
                      px: 1.25,
                      py: 0.5,
                    },
                  }}
                >
                  <ToggleButton className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="none">{t('analytics.Sin comparación')}</ToggleButton>
                  <ToggleButton className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="same_period">{t('analytics.Mismo período')}</ToggleButton>
                  <ToggleButton className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="previous_period" disabled={comparisonDisabled}>
                    {t('analytics.Período anterior')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            ) : (
              <FormControl size="small" fullWidth>
                <InputLabel className="text-light-text-primary dark:text-dark-text-primary">
                  {t('analytics.Comparación')}
                </InputLabel>
                <Select
                  className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary"
                  value={pendingConfig.comparisonType || 'same_period'}
                  onChange={handlePendingConfigChange('comparisonType')}
                  label={t('analytics.Comparación')}
                  MenuProps={{
                    PaperProps: {
                      className:
                        'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary',
                    },
                  }}
                >
                  <MenuItem className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="none">{t('analytics.Sin comparación')}</MenuItem>
                  <MenuItem className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="same_period">{t('analytics.Mismo período')}</MenuItem>
                  <MenuItem className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary" value="previous_period" disabled={comparisonDisabled}>
                    {t('analytics.Período anterior')}{comparisonDisabled ? ` (${t('analytics.No disponible')})` : ''}
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            <Tooltip title={t('analytics.align_by_weekday_to_compare')}>
              <FormControlLabel
                sx={{ ml: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={!!pendingConfig.compareByWeekdays}
                    onChange={(e) =>
                      handlePendingConfigChange('compareByWeekdays')({
                        target: { value: e.target.checked },
                      })
                    }
                    disabled={pendingConfig.comparisonType === 'none'}
                  />
                }
                label={t('analytics.Cuadrar días (L–D)')}
                labelPlacement="start"
              />
            </Tooltip>

            <Button
              loading={!!isLoading}
              variant="contained"
              onClick={handleApply}
              disabled={!pendingDateRange.start || !pendingDateRange.end}
              className="bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white rounded-xl"
              sx={{ fontWeight: 700, px: 2.5 }}
            >
              {t('analytics.Buscar')}
            </Button>
          </Stack>

          {/* Mensajes de estado */}
          <Box mt={1}>
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
        </Box>
      </Box>
    </Box>
  );
};

export default ControlsBar;
