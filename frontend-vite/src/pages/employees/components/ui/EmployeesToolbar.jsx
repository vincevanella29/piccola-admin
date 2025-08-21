import React from 'react';
import { Box, Chip, FormControl, InputLabel, MenuItem, Select, TextField, IconButton, Tooltip, InputAdornment } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const EmployeesToolbar = ({
  t,
  q,
  setQ,
  sucursal,
  setSucursal,
  sucursalOptions,
  cargo,
  setCargo,
  cargoOptions,
  loading,
  error,
  onRefresh,
}) => {
  const clearSearch = () => setQ('');
  return (
    <Box
      className="rounded-3xl border border-light-accent/25 dark:border-dark-accent/25 bg-light-surface/70 dark:bg-dark-surface/70 backdrop-blur-md shadow-neon mb-4"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25, p: 1.25 }}
    >
      <TextField
        size="small"
        label={t('employees.filters.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{
          flex: '2 1 240px',
          minWidth: 0,
          '& .MuiInputBase-input': { color: 'inherit' },
          '& .MuiInputLabel-root': { color: 'inherit' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
          '& .MuiSvgIcon-root': { color: 'inherit' },
        }}
        InputLabelProps={{ className: 'text-light-text-primary dark:text-dark-text-primary' }}
        InputProps={{
          className: 'text-light-text-primary dark:text-dark-text-primary',
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: q ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={clearSearch} aria-label="clear">
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <FormControl size="small" sx={{
        minWidth: { xs: 140, sm: 180 },
        flex: '1 1 160px',
        '& .MuiInputLabel-root': { color: 'inherit' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
        '& .MuiSvgIcon-root': { color: 'inherit' },
      }}>
        <InputLabel className="text-light-text-primary dark:text-dark-text-primary">{t('employees.filters.sucursal')}</InputLabel>
        <Select
          value={sucursal}
          label={t('employees.filters.sucursal')}
          onChange={(e) => setSucursal(e.target.value)}
          className="text-light-text-primary dark:text-dark-text-primary"
          MenuProps={{ PaperProps: { className: 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary' } }}
          sx={{ color: 'inherit' }}
        >
          <MenuItem value=""><em>{t('employees.filters.all_f')}</em></MenuItem>
          {sucursalOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{
        minWidth: { xs: 140, sm: 180 },
        flex: '1 1 160px',
        '& .MuiInputLabel-root': { color: 'inherit' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
        '& .MuiSvgIcon-root': { color: 'inherit' },
      }}>
        <InputLabel className="text-light-text-primary dark:text-dark-text-primary">{t('employees.filters.cargo')}</InputLabel>
        <Select
          value={cargo}
          label={t('employees.filters.cargo')}
          onChange={(e) => setCargo(e.target.value)}
          className="text-light-text-primary dark:text-dark-text-primary"
          MenuProps={{ PaperProps: { className: 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary' } }}
          sx={{ color: 'inherit' }}
        >
          <MenuItem value=""><em>{t('employees.filters.all')}</em></MenuItem>
          {cargoOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
        {sucursal && <Chip size="small" onDelete={() => setSucursal('')} label={`${t('employees.filters.sucursal')}: ${sucursal}`} />}
        {cargo && <Chip size="small" onDelete={() => setCargo('')} label={`${t('employees.filters.cargo')}: ${cargo}`} />}
        <Tooltip title={t('employees.actions.refresh')}>
          <span>
            <IconButton onClick={onRefresh} disabled={loading}><RefreshIcon /></IconButton>
          </span>
        </Tooltip>
        {loading && <Chip size="small" color="info" label={t('employees.status.loading')} />}
        {error && <Chip size="small" color="error" label={error?.message || t('employees.status.error')} />}
      </Box>
    </Box>
  );
};

export default EmployeesToolbar;
