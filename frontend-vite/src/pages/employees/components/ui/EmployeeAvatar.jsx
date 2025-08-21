import React from 'react';
import { Avatar } from '@mui/material';

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

const EmployeeAvatar = ({ emp, size = 36 }) => {
  const src = getPhotoUrl(emp);
  const label = `${emp?.nombres || ''} ${emp?.apellidopaterno || ''}`.trim() || emp?.rut || '';
  if (src) return <Avatar src={src} alt={label} sx={{ width: size, height: size }} />;
  return <Avatar sx={{ width: size, height: size }}>{initialsFrom(emp)}</Avatar>;
};

export default EmployeeAvatar;
