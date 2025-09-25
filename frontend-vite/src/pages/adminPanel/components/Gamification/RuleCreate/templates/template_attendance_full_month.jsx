import React from 'react';

// Template: attendance_full_month with own UI Component
export const attendanceTemplate = {
  key: 'attendance_full_month',
  name: 'Asistencia Perfecta del Mes',
  description: 'Otorga mérito si el empleado no tiene días ausentes (AUS, LIC, NVI, PSG) en el mes.',
  category: 'attendance',
  period: 'month',
  data_sources: [
    {
      collection: 'asistencia_diaria_intranet',
      fields: ['rut', 'fecha_trabajada', 'tipo_movimiento'],
    },
    {
      collection: 'empleados_usuarios',
      fields: ['rut', 'wallet', 'status'],
    },
  ],
  required_params: {
    required_attendance_percent: {
      type: 'number',
      min: 100,
      max: 100,
      default: 100,
      description: 'Porcentaje de asistencia requerido (100% para asistencia perfecta).',
    },
  },
  metrics: {
    check: 'perfect_attendance(rut, ym)',
    notes: "Valida que no existan días con tipo_movimiento en ['AUS', 'LIC', 'NVI', 'PSG'].",
  },
  Component: function AttendanceRuleComponent({ formData, setFormData, errors, t }) {
    const value = formData?.params?.required_attendance_percent ?? 100;
    const onChange = (e) => {
      const v = Number(e.target.value);
      setFormData(prev => ({ ...prev, params: { ...prev.params, required_attendance_percent: v } }));
    };
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('gamification.attendance.required_percent') || 'Porcentaje requerido'}</label>
          <input
            type="number"
            min={100}
            max={100}
            value={100}
            readOnly
            onChange={onChange}
            className="w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 cursor-not-allowed"
          />
          <p className="text-xs text-dark-text-secondary">{t('gamification.attendance.locked_100') || 'Esta regla exige 100% de asistencia (fijo).'}</p>
          {errors?.required_attendance_percent && <p className="text-xs text-red-500 mt-1">{errors.required_attendance_percent}</p>}
        </div>
      </div>
    );
  }
};
