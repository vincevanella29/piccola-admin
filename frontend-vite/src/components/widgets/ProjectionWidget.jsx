import React from 'react';
import { Line } from 'react-chartjs-2';
import Chart from 'chart.js/auto';

const ProjectionWidget = ({ historical, projections, title }) => {
  const safeHistorical = Array.isArray(historical) ? historical : [];
  const safeProjections = Array.isArray(projections) ? projections : [];
  const chartData = {
    labels: [...safeHistorical.map((d) => d._id), ...safeProjections.map((d) => d.month)],
    datasets: [
      {
        label: 'Total Cargo (Histórico)',
        data: safeHistorical.map((d) => d.total_cargo),
        borderColor: '#009246',
        backgroundColor: 'rgba(0,146,70,0.05)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      },
      {
        label: 'Total Cargo (Proyectado)',
        data: [...safeHistorical.map(() => null), ...safeProjections.map((d) => d.projected_cargo)],
        borderColor: 'rgba(206,43,55,0.7)',
        backgroundColor: 'rgba(206,43,55,0.03)',
        borderDash: [5, 3],
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 10 } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 9 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } },
    },
  };

  return (
    <div className="rounded-xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
      {title && <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary mb-2">{title}</p>}
      <div className="h-52">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ProjectionWidget;