/**
 * ProjectionWidget — lightweight recharts-based projection chart.
 * Used internally by ProjectionTab; kept as a reusable widget.
 */
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CLP = (n) => Math.round(n).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const ProjectionWidget = ({ historical = [], projections = [], title = '' }) => {
  const chartData = [
    ...historical.map(d => ({
      month: d._id || d.month,
      actual: d.total_cargo || d.value || 0,
    })),
    ...projections.map(d => ({
      month: d.month,
      projected: d.projected_cargo || d.value || 0,
    })),
  ];

  if (!chartData.length) return null;

  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-4">
      {title && (
        <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="projGradActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="projGradProjected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => CLP(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="actual" name="Histórico" stroke="#3b82f6" fill="url(#projGradActual)" strokeWidth={2} />
          <Area type="monotone" dataKey="projected" name="Proyectado" stroke="#f97316" fill="url(#projGradProjected)" strokeWidth={2} strokeDasharray="5 5" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProjectionWidget;