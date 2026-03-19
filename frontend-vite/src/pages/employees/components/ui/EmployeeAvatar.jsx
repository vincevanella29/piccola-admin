import React from 'react';

function initialsFrom(emp) {
  const parts = [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno]
    .filter(Boolean)
    .map((s) => String(s).trim());
  const name = parts.join(' ').trim();
  if (!name) return '??';
  const tokens = name.split(/\s+/);
  return ((tokens[0]?.[0] || '') + (tokens[1]?.[0] || '')).toUpperCase();
}

function getPhotoUrl(emp) {
  return emp?.profile_image_url || null;
}

const EmployeeAvatar = ({ emp, size = 36 }) => {
  const src = getPhotoUrl(emp);
  const label = `${emp?.nombres || ''} ${emp?.apellidopaterno || ''}`.trim() || emp?.rut || '';

  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        style={style}
        className="rounded-xl object-cover"
      />
    );
  }

  return (
    <div
      style={style}
      className="rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center text-xs font-bold text-light-accent dark:text-dark-accent shrink-0"
    >
      {initialsFrom(emp)}
    </div>
  );
};

export default EmployeeAvatar;
