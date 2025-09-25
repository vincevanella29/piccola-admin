import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';

// --- Componentes ---
const AttendanceCard = ({ merit }) => {
  const { t } = useTranslation();
  const progress = merit.progress;

  return (
    <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-3 mb-4 space-y-2">
      <p>{t('mificha.rules.attendance.card_desc')}</p>
      {progress && (
        <div className="bg-light-surface dark:bg-dark-surface p-2 rounded-md text-center border border-light-border/10 dark:border-dark-border/10">
          <p className="text-xs uppercase font-semibold text-light-text-secondary dark:text-dark-text-secondary">
            {t('mificha.rules.attendance.progress_label')}
          </p>
          <p className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
            {progress.current_value || 0}
            <span className="text-sm font-normal text-light-text-secondary dark:text-dark-text-secondary"> / {progress.target_value} {t('mificha.rules.attendance.absences')}</span>
          </p>
        </div>
      )}
    </div>
  );
};

const AttendanceTooltip = ({ merit }) => {
  const { t } = useTranslation();
  return (
    <div>
      <h4 className="font-bold mb-2">{t('mificha.rules.attendance.tooltip_title')}</h4>
      <p className="text-sm">{t('mificha.rules.attendance.tooltip_desc')}</p>
      <ul className="text-xs list-disc pl-5 mt-2 space-y-1 text-light-text-secondary dark:text-dark-text-secondary">
        <li>{t('mificha.rules.attendance.tooltip_li1')}</li>
        <li>{t('mificha.rules.attendance.tooltip_li2')}</li>
      </ul>
    </div>
  );
};

// La configuración completa de la regla
export const config = {
  key: 'attendance_full_month',
  icon: Calendar,
  card: AttendanceCard,
  tooltip: AttendanceTooltip,
  // Función para devolver estilos dinámicos (opcional, pero potente)
  getCardStyle: (merit) => ({
    borderColor: 'rgba(52, 211, 153, 0.3)', // Verde sutil
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  }),
};