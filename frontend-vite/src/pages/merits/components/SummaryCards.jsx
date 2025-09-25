// src/pages/merits/components/SummaryCards.jsx
import React, { useMemo } from 'react';
import { TrendingUp, Award, Users, BarChart } from 'lucide-react';

const fmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export const SummaryCards = ({ data }) => {
  const summary = useMemo(() => {
    if (!data || data.length === 0) {
      return { totalVenta: 0, totalMeritos: 0, promedioMesa: 0, colaboradores: 0 };
    }
    const totalVenta = data.reduce((sum, emp) => sum + (emp.kpi?.total_venta || 0), 0);
    const totalMeritos = data.reduce((sum, emp) => sum + (emp.merits_totals?.total_points || 0), 0);
    const sumaPromedios = data.reduce((sum, emp) => sum + (emp.kpi?.promedio_mesa || 0), 0);
    return {
      totalVenta,
      totalMeritos,
      promedioMesa: sumaPromedios / data.length,
      colaboradores: data.length,
    };
  }, [data]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard icon={TrendingUp} title="Venta Total (Filtrada)" value={fmt.format(summary.totalVenta)} />
      <KpiCard icon={Award} title="Puntos de Mérito Totales" value={summary.totalMeritos.toLocaleString('es-CL')} />
      <KpiCard icon={BarChart} title="Promedio por Mesa" value={fmt.format(summary.promedioMesa)} />
      <KpiCard icon={Users} title="Colaboradores en Vista" value={summary.colaboradores.toLocaleString('es-CL')} />
    </div>
  );
};

const KpiCard = ({ icon: Icon, title, value }) => (
  <div className="bg-light-surface dark:bg-dark-surface p-4 rounded-xl border border-light-border/20 dark:border-dark-border/20 flex items-start gap-4">
    <div className="p-2 bg-matrix-green/10 rounded-lg text-matrix-green">
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
      <p className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{value}</p>
    </div>
  </div>
);