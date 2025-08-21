import React from 'react';
import { Chip } from '@mui/material';

// HoloChip con forwardRef para que pueda ser hijo de Tooltip sin warnings
const HoloChip = React.forwardRef(function HoloChip({ label, className = '', sx, ...rest }, ref) {
  return (
    <Chip
      ref={ref}
      size="small"
      label={label}
      className={`text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 ${className}`}
      sx={{ height: 22, borderRadius: '9999px', ...(sx || {}) }}
      {...rest}
    />
  );
});

export default HoloChip;