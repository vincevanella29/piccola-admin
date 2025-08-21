import React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';

const KPIStat = ({ label, value, deltaPct = null, goodWhenUp = true, isLoading = false }) => {
  const deltaClass = deltaPct === null
    ? ''
    : (deltaPct >= 0
        ? (goodWhenUp ? 'text-green-600' : 'text-red-500')
        : (goodWhenUp ? 'text-red-500' : 'text-green-600'));

  const arrow = deltaPct === null ? '' : (deltaPct >= 0 ? '▲' : '▼');

  return (
    <Box className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-3">
      <Typography variant="caption" className="text-light-text-secondary dark:text-dark-text-secondary">
        {isLoading ? <Skeleton variant="text" width={80} height={16} /> : label}
      </Typography>
      <div className="text-xl font-semibold">
        {isLoading ? <Skeleton variant="text" width={120} height={28} /> : value}
      </div>
      {deltaPct !== null && (
        <div className={`text-xs ${deltaClass}`}>
          {isLoading ? (
            <Skeleton variant="text" width={60} height={16} />
          ) : (
            <>
              {arrow} {Math.abs(deltaPct).toFixed(1)}%
            </>
          )}
        </div>
      )}
    </Box>
  );
};

export default KPIStat;
