import React from 'react';

export const Th = ({ children, onSort, icon, align = 'left', title }) => (
  <th
    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-dark-text-secondary text-${align} ${onSort ? 'cursor-pointer hover:text-dark-text-primary' : ''}`}
    onClick={onSort}
    title={title}
  >
    <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
      {children} {icon}
    </div>
  </th>
);

export const Td = ({ children, align = 'left', className = '', title }) => (
  <td className={`px-4 py-4 text-${align} ${className}`} title={title}>{children}</td>
);
