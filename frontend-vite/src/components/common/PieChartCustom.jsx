import { motion } from 'framer-motion';

function PieChartCustom({ usages, activeIdx, setActiveIdx }) {
  const COLORS = ['#4f46e5', '#0ea5e9', '#22d3ee', '#22c55e', '#fbbf24', '#a21caf', '#e11d48', '#f59e42', '#64748b', '#14b8a6'];

  // Normalize percentages to sum to 100%
  const total = usages.reduce((acc, u) => acc + Number(u.percentage || u[1] || 0), 0);
  const normalizedUsages = usages.map((u) => ({
    name: u.name || u[0],
    percentage: total > 0 ? (Number(u.percentage || u[1] || 0) / total) * 100 : 0,
  })).filter(u => u.percentage > 0); // Filter out zero or invalid percentages

  let startAngle = 0;
  const center = 60,
    radius = 50,
    activeRadius = 56;

  const slices = normalizedUsages.map((u, i) => {
    const value = Number(u.percentage);
    const angle = (value / 100) * 360;
    if (value <= 0) return null;
    const r = activeIdx === i ? activeRadius : radius;
    const x1 = center + r * Math.cos(Math.PI * (startAngle - 90) / 180);
    const y1 = center + r * Math.sin(Math.PI * (startAngle - 90) / 180);
    const x2 = center + r * Math.cos(Math.PI * (startAngle + angle - 90) / 180);
    const y2 = center + r * Math.sin(Math.PI * (startAngle + angle - 90) / 180);
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
        strokeWidth={isActive ? 2 : 1}
        style={{ opacity: isActive ? 1 : 0.85, cursor: 'pointer' }}
        onMouseEnter={() => setActiveIdx(i)}
        onMouseLeave={() => setActiveIdx(null)}
        onClick={() => setActiveIdx(i)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: i * 0.05 }}
      />
    );
  });

  // Center label
  let centerLabel = `100%`;
  let centerSub = 'Total';
  if (activeIdx !== null && normalizedUsages[activeIdx]) {
    centerLabel = `${Number(normalizedUsages[activeIdx].percentage).toFixed(1)}%`;
    centerSub = normalizedUsages[activeIdx].name || 'Uso';
  }

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-md">
      {slices}
      <motion.circle
        cx={center}
        cy={center}
        r={32}
        fill="#181A20"
        fillOpacity="0.95"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: slices.length * 0.05 }}
      />
      <motion.text
        x={center}
        y={center + 5}
        textAnchor="middle"
        fontSize="18"
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
        y={center + 20}
        textAnchor="middle"
        fontSize="10"
        fill="#a1a1aa"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: (slices.length + 2) * 0.05 }}
      >
        {centerSub}
      </motion.text>
    </svg>
  );
}

export default PieChartCustom;