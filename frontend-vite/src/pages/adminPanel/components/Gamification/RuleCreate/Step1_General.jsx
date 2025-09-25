import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

const FormSection = ({ children }) => <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">{children}</div>;

const Step1_General = ({ formData, setFormData, errors, segments }) => {
  const { t } = useTranslation();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const inputStyles = "w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-matrix-green focus:border-matrix-green transition";
  const selectWrapperStyles = "relative w-full";
  const selectStyles = `${inputStyles} appearance-none`;

  return (
    <FormSection>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* --- Nombre de la Regla --- */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('gamification.field_rule_name_label') || 'Nombre de la Regla (Único)'}</label>
          <input
            name="ruleName"
            value={formData.ruleName}
            onChange={handleChange}
            className={inputStyles}
            placeholder={t('gamification.rule_name_ph') || 'Ej: Asistencia perfecta garzones'}
            required
          />
          {errors.ruleName && <p className="text-xs text-red-500">{errors.ruleName}</p>}
        </div>

        {/* --- Segmento --- */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('gamification.field_segment_label') || 'Segmento de Meritocracia'}</label>
          <div className={selectWrapperStyles}>
            <select
              name="segmentTokenId"
              value={formData.segmentTokenId}
              onChange={handleChange}
              className={selectStyles}
              required
            >
              <option value="">{t('gamification.select_segment_ph') || 'Selecciona un segmento…'}</option>
              {segments.map((seg) => (
                <option key={seg.token_id} value={seg.token_id}>
                  {seg.name} ({seg.symbol}) - ID: {seg.token_id}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dark-text-secondary" />
          </div>
          {errors.segmentTokenId && <p className="text-xs text-red-500">{errors.segmentTokenId}</p>}
        </div>

        {/* --- Puntos de Mérito --- */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('gamification.field_points_label') || 'Puntos de Meritocracia'}</label>
          <input
            name="meritPoints"
            type="number"
            min="1"
            value={formData.meritPoints}
            onChange={handleChange}
            className={inputStyles}
            required
          />
          {errors.meritPoints && <p className="text-xs text-red-500">{errors.meritPoints}</p>}
        </div>

         {/* --- Estado (Activa/Inactiva) --- */}
        <div className="flex flex-col gap-1.5 justify-end">
            <label htmlFor="is_active_toggle" className="flex items-center cursor-pointer">
                <div className="relative">
                    <input
                    type="checkbox"
                    id="is_active_toggle"
                    name="isActive"
                    className="sr-only"
                    checked={formData.isActive}
                    onChange={handleChange}
                    />
                    <div className={`block w-12 h-6 rounded-full transition ${formData.isActive ? 'bg-matrix-green' : 'bg-dark-surface-secondary'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
                <div className="ml-3 text-sm font-medium">{t('gamification.active_rule_label')}</div>
            </label>
        </div>
      </div>
    </FormSection>
  );
};

export default Step1_General;