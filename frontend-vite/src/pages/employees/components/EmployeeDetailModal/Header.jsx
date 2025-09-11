import React from 'react';
import { Box, Avatar, Typography, IconButton, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function initialsFrom(emp) {
  const parts = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno]
    .filter(Boolean)
    .map((s) => String(s).trim());
  const name = parts.join(' ').trim();
  if (!name) return '??';
  const tokens = name.split(/\s+/);
  return (tokens[0]?.[0] || '') + (tokens[1]?.[0] || '');
}
function getPhotoUrl(emp) {
  return emp?.profile_image_url || null;
}

const EmployeeDetailHeader = ({ emp, t, onClose }) => {
  const name = React.useMemo(() => {
    const parts = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno]
      .filter(Boolean)
      .map((s) => String(s).trim());
    return parts.join(' ') || t('employees.table.unknown');
  }, [emp, t]);

  const avatar = React.useMemo(() => {
    const src = getPhotoUrl(emp);
    const label = `${emp?.nombres || ''} ${emp?.apellidopaterno || ''}`.trim() || emp?.rut || '';
    if (src) return <Avatar src={src} alt={label} sx={{ width: 56, height: 56 }} />;
    return <Avatar sx={{ width: 56, height: 56 }}>{initialsFrom(emp)}</Avatar>;
  }, [emp]);

  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        {avatar}
        <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Typography variant="h6" className="text-light-text-primary dark:text-dark-text-primary" fontWeight={700}>
            {name}
          </Typography>
          <Typography variant="body2" className="text-light-text-secondary dark:text-dark-text-secondary" noWrap>
            {t('employees.table.rut')}: {emp?.rut ?? '-'} · {t('employees.table.cargo')}: {emp?.cargo ?? '-'} · {t('employees.filters.seccion') || 'Sección'}: {emp?.seccion ?? '-'} · {t('employees.table.sucursal')}: {emp?.sucursal ?? '-'}
          </Typography>
        </Box>
      </Stack>
      <IconButton onClick={onClose} aria-label={t('common.close')}>
        <CloseIcon />
      </IconButton>
    </Box>
  );
};

export default EmployeeDetailHeader;
