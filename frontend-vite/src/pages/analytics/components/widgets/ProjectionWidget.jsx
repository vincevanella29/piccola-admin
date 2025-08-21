// src/pages/analytics/components/ProjectionWidget.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import { Box, Typography } from '@mui/material';
import Chart from 'chart.js/auto';

const ProjectionWidget = ({ historical, projections, title }) => {
  const safeHistorical = Array.isArray(historical) ? historical : [];
  const safeProjections = Array.isArray(projections) ? projections : [];
  const chartData = {
    labels: [
      ...safeHistorical.map((d) => d._id),
      ...safeProjections.map((d) => d.month),
    ],
    datasets: [
      {
        label: 'Total Cargo (Histórico)',
        data: safeHistorical.map((d) => d.total_cargo),
        borderColor: 'rgba(75, 192, 192, 1)',
        fill: false,
      },
      {
        label: 'Total Cargo (Proyectado)',
        data: [
          ...safeHistorical.map(() => null),
          ...safeProjections.map((d) => d.projected_cargo),
        ],
        borderColor: 'rgba(255, 99, 132, 1)',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6">{title}</Typography>
      <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
    </Box>
  );
};

export default ProjectionWidget;