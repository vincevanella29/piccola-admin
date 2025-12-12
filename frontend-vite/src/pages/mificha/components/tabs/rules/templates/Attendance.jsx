// src/pages/mificha/components/tabs/rules/templates/Attendance.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, UserCheck, AlertCircle, ShieldCheck } from 'lucide-react';

const AttendanceCard = ({ merit }) => {
  const { t } = useTranslation();
  const progress = merit.progress || {};
  const currentAbsences = Number(progress.current_value || 0);
  const maxAbsences = Number(progress.target_value || 0);
  
  // Calculamos el "porcentaje de vida" de la regla.
  // Si max es 0, cualquier falta mata la regla. Si max > 0, calculamos cuánto margen queda.
  const isPerfect = currentAbsences === 0;
  const isAtRisk = currentAbsences > 0 && currentAbsences <= maxAbsences;
  const isFailed = currentAbsences > maxAbsences;

  return (
    <div className="mt-2 space-y-4">
      {/* Descripción corta */}
      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">
        {t('mificha.rules.attendance.card_desc', 'Mantén tu asistencia perfecta durante el mes.')}
      </p>

      {/* Widget Principal */}
      <div className={`
        flex items-center justify-between p-3 rounded-xl border
        ${isPerfect 
            ? 'bg-matrix-green/5 border-matrix-green/20' 
            : 'bg-yellow-500/5 border-yellow-500/20'}
      `}>
        <div className="flex items-center gap-3">
            <div className={`
                flex items-center justify-center w-10 h-10 rounded-lg shadow-sm
                ${isPerfect ? 'bg-matrix-green/10 text-matrix-green' : 'bg-yellow-500/10 text-yellow-500'}
            `}>
                {isPerfect ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
            </div>
            
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    {t('mificha.rules.attendance.status_label', 'Estado')}
                </span>
                <span className={`text-sm font-bold ${isPerfect ? 'text-matrix-green' : 'text-yellow-500'}`}>
                    {isPerfect 
                        ? t('mificha.rules.attendance.perfect', 'Asistencia Perfecta') 
                        : t('mificha.rules.attendance.warning', 'Con Observaciones')}
                </span>
            </div>
        </div>

        {/* Contador Big Data */}
        <div className="text-right">
             <span className="text-[10px] uppercase text-light-text-secondary dark:text-dark-text-secondary block mb-0.5">
                {t('mificha.rules.attendance.absences', 'Faltas')}
             </span>
             <div className="flex items-baseline justify-end gap-1">
                <span className={`text-xl font-mono font-bold ${currentAbsences > 0 ? 'text-light-text-primary dark:text-white' : 'text-matrix-green'}`}>
                    {currentAbsences}
                </span>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                    / {maxAbsences}
                </span>
             </div>
        </div>
      </div>

      {/* Barra de Tolerancia (Solo si se permiten faltas, visualmente útil) */}
      {maxAbsences > 0 && !isFailed && (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary">
                <span>Margen disponible</span>
                <span>{maxAbsences - currentAbsences} restante(s)</span>
            </div>
            <div className="h-1.5 w-full bg-light-surface-secondary dark:bg-black/20 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ${isPerfect ? 'bg-matrix-green' : 'bg-yellow-500'}`}
                    style={{ width: `${((maxAbsences - currentAbsences) / maxAbsences) * 100}%` }}
                />
            </div>
        </div>
      )}
    </div>
  );
};

const AttendanceTooltip = ({ merit }) => {
  const { t } = useTranslation();
  const max = merit.progress?.target_value || 0;

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-sm text-matrix-green flex items-center gap-2">
        <CalendarCheck size={16}/> 
        {t('mificha.rules.attendance.tooltip_title', 'Regla de Asistencia')}
      </h4>
      <p className="text-xs text-gray-300">
        {t('mificha.rules.attendance.tooltip_desc', 'El cumplimiento de horarios y asistencia es fundamental para la operación.')}
      </p>
      
      <div className="pt-2 border-t border-white/10">
         <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white font-mono">Max: {max}</span>
            <span className="text-[10px] text-gray-400">faltas permitidas.</span>
         </div>
         <ul className="text-xs list-disc pl-4 space-y-1 text-gray-400">
            <li>{t('mificha.rules.attendance.tooltip_li1', 'Se considera mes calendario completo.')}</li>
            <li>{t('mificha.rules.attendance.tooltip_li2', 'Licencias médicas podrían afectar según política.')}</li>
        </ul>
      </div>
    </div>
  );
};

export const config = {
  key: 'attendance_full_month',
  icon: UserCheck, // Icono base
  card: AttendanceCard,
  tooltip: AttendanceTooltip,
  getCardStyle: (merit) => {
    // Si tiene faltas (pero no ha perdido), advertencia visual. Si es perfecto, verde puro.
    const current = Number(merit.progress?.current_value || 0);
    
    if (current > 0) {
        return {
            borderColor: 'rgba(234, 179, 8, 0.4)', // Yellow glow
            backgroundColor: 'rgba(234, 179, 8, 0.05)', // Yellow tint
            icon: AlertCircle
        };
    }
    
    return {
      borderColor: 'rgba(52, 211, 153, 0.4)', // Green glow
      backgroundColor: 'rgba(16, 185, 129, 0.05)', // Green tint
      icon: ShieldCheck
    };
  },
};