// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/pages/company/tokens/components/PieChartCustom.jsx
import React from 'react';
import { motion } from 'framer-motion';

const PieChartCustom = ({ usages, activeIdx, setActiveIdx }) => {
  const COLORS = [
    '#4f46e5',
    '#0ea5e9',
    '#22d3ee',
    '#22c55e',
    '#fbbf24',
    '#a21caf',
    '#e11d48',
    '#f59e42',
    '#64748b',
    '#14b8a6',
  ];
  const total = usages.reduce((acc, u) => acc + Number(u.percentage || 0), 0);
  let startAngle = 0;
  const center = 60,
    radius = 50,
    activeRadius = 56;
  const slices = usages.map((u, i) => {
    const value = Number(u.percentage || 0);
    const angle = (value / 100) * 360;
    if (value <= 0) return null;
    const r = activeIdx === i ? activeRadius : radius;
    const x1 = center + r * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = center + r * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = center + r * Math.cos((Math.PI * (startAngle + angle - 90)) / 180);
    const y2 = center + r * Math.sin((Math.PI * (startAngle + angle - 90)) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    const path = `M${center},${center} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
    const isActive = activeIdx === i;
    startAngle += angle;
    return (
      <motion.path
        key={i}
        d={path}
        fill={COLORS[i % COLORS.length]}
        stroke={isActive ? '#fff' : '#fff'}
        strokeWidth={isActive ? 4 : 2}
        style={{
          opacity: isActive ? 1 : 0.85,
          filter: isActive ? 'drop-shadow(0 0 8px #fff)' : 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setActiveIdx(i)}
        onMouseLeave={() => setActiveIdx(null)}
        onClick={() => setActiveIdx(i)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: i * 0.05 }}
      />
    );
  });
  let centerLabel = `${total}%`;
  let centerSub = 'Total';
  if (activeIdx !== null && usages[activeIdx]) {
    centerLabel = `${Number(usages[activeIdx].percentage || 0)}%`;
    centerSub = usages[activeIdx].name || 'Uso';
  }
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-lg">
      {slices}
      <motion.circle
        cx={center}
        cy={center}
        r={32}
        fill="#181A20"
        fillOpacity="0.97"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: slices.length * 0.05 }}
      />
      <motion.text
        x={center}
        y={center + 5}
        textAnchor="middle"
        fontSize="22"
        fontWeight="bold"
        fill="#fff"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: (slices.length + 1) * 0.05 }}
      >
        {centerLabel}
      </motion.text>
      <motion.text
        x={center}
        y={center + 22}
        textAnchor="middle"
        fontSize="11"
        fill="#a1a1aa"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: (slices.length + 2) * 0.05 }}
      >
        {centerSub}
      </motion.text>
    </svg>
  );
};

export default PieChartCustom;