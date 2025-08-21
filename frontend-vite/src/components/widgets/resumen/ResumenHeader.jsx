import React from 'react';
import { Box, FormControl, Select, MenuItem, InputLabel, Switch, FormControlLabel, IconButton, Chip } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

const ResumenHeader = ({
  t,
  allResumenes,
  selectedResumen,
  setSelectedResumen,
  granularity,
  setGranularity,
  mode,
  setMode,
  onExpand,
  dense = true,
  hideExpand = false,
  labelName = '', // New
}) => {
  const granularities = React.useMemo(() => ([
    { value: 'day', label: 'D' },
    { value: 'week', label: 'S' },
    { value: 'month', label: 'M' },
  ]), []);

  const handleResumenChange = (e) => setSelectedResumen(e.target.value);

  return (
    <Box className="text-light-text-primary dark:text-dark-text-primary flex items-center justify-between gap-2 mb-4" sx={{ mb: dense ? 2 : 3 }}>
      <FormControl className="text-light-text-primary dark:text-dark-text-primary" size="small" sx={{ minWidth: 80, maxWidth: 150, width: 150 }}>
        <InputLabel className="text-light-text-primary dark:text-dark-text-primary">{labelName || t('analytics.Resumen')}</InputLabel>
        <Select
          multiple
          value={selectedResumen}
          onChange={handleResumenChange}
          label={labelName || t('analytics.Resumen')}
          renderValue={(selected) => (
            <Box className="text-light-text-primary dark:text-dark-text-primary flex flex-wrap gap-0.5 min-h-9 max-h-9 w-full overflow-x-auto overflow-y-hidden items-center" sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.5,
              minHeight: 36,
              maxHeight: 36,
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
              alignItems: 'center',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { background: '#ddd', borderRadius: 4 },
            }}>
              {selected.map((value) => (
                <Chip className="text-light-text-primary dark:text-dark-text-primary" key={value} label={value} size="small" sx={{ mr: 0.5 }} />
              ))}
            </Box>
          )}
          MenuProps={{ PaperProps: { style: { minWidth: 80, maxWidth: 150, width: 150 } } }}
        >
          {allResumenes.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={mode === 'compare'}
            onChange={(e) => setMode(e.target.checked ? 'compare' : 'aggregate')}
          />
        }
        labelPlacement="start"
        label={<CompareArrowsIcon fontSize="small" className="text-light-text-primary dark:text-dark-text-primary" />}
      />

      <FormControl className="text-light-text-primary dark:text-dark-text-primary" size="small" sx={{ minWidth: 80 }}>
        <InputLabel className="text-light-text-primary dark:text-dark-text-primary">{t('analytics.Granularidad')}</InputLabel>
        <Select
          className="text-light-text-primary dark:text-dark-text-primary"
          value={granularity}
          onChange={e => setGranularity(e.target.value)}
          label={t('analytics.Granularidad')}
        >
          {granularities.map(g => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
        </Select>
      </FormControl>

      {!hideExpand && (
        <IconButton onClick={onExpand} size="small" className="text-light-text-primary dark:text-dark-text-primary">
          <FullscreenIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default ResumenHeader;
