// src/pages/merits/components/EmployeeDetailPanel/HistoryTab.jsx
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, BarChart2, Award, Clock } from 'lucide-react';

const MERIT_TEMPLATES = {
  attendance_full_month: { name: 'Asistencia Perfecta', icon: CheckCircle },
  sales_ranking_position: { name: 'Ranking de Ventas', icon: BarChart2 },
  default: { name: 'Mérito General', icon: Award },
};

export const HistoryTab = ({ employee }) => {
  const meritHistory = employee.merits_history?.filter(m => m.merit_points > 0).sort((a,b) => b.periodo.localeCompare(a.periodo)) || [];

  return (
    <div className="space-y-3">
      {meritHistory.length > 0 ? meritHistory.map((merit, index) => {
        const template = MERIT_TEMPLATES[merit.template_key] || MERIT_TEMPLATES.default;
        const Icon = template.icon;
        return (
          <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-dark-surface-secondary">
            <div className="p-2 bg-dark-surface rounded-full text-cyan-400">
              <Icon size={20} />
            </div>
            <div className="flex-grow">
              <p className="font-semibold text-dark-text-primary">{template.name}</p>
              <p className="text-sm text-dark-text-secondary">
                {format(new Date(`${merit.periodo}-02`), 'MMMM yyyy', { locale: es })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg text-matrix-green">+{merit.merit_points}</p>
              {merit.is_minted ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-matrix-green/80">
                  <CheckCircle size={12} /> Minteado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-400/80">
                  <Clock size={12} /> Pendiente
                </span>
              )}
            </div>
          </div>
        );
      }) : (
        <p className="text-dark-text-secondary text-center p-6">Sin méritos ganados aún.</p>
      )}
    </div>
  );
};