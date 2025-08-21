import React from 'react';
import { Box, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

const RadialGauge = ({ value = 0, label = '', size = 86 }) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <Box className="relative rounded-3xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30 shadow-neon">
      <Box sx={{ position:'relative', width:size, height:size, display:'grid', placeItems:'center' }}>
        <CircularProgress variant="determinate" value={100} thickness={4} />
        <Box sx={{ position:'absolute', inset:0 }}>
          <CircularProgress variant="determinate" value={clamped} thickness={4} className="text-light-accent dark:text-dark-accent" sx={{ color: 'currentColor' }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={700}>{Math.round(clamped)}%</Typography>
      </Box>
      {label ? (
        <Typography variant="caption" className="block mt-2 text-light-text-secondary dark:text-dark-text-secondary">{label}</Typography>
      ) : null}
    </Box>
  );
};

export default RadialGauge;
