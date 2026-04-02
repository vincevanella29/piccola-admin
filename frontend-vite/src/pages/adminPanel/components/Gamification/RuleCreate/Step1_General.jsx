import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Type, Tag, Zap } from 'lucide-react';

const FormSection = ({ children }) => (
  <div className="bg-white/60 dark:bg-dark-surface-secondary/30 backdrop-blur-xl border border-dark-border/10 dark:border-dark-border/20 rounded-3xl p-6 md:p-8 shadow-sm">
    {children}
  </div>
);

const Step1_General = ({ formData, setFormData, errors, segments }) => {
  const { t } = useTranslation();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const inputStyles = "w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/30 rounded-xl px-4 py-3 text-light-text-primary dark:text-dark-text-primary shadow-sm focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green transition-all outline-none";
  const selectWrapperStyles = "relative w-full";
  const selectStyles = `${inputStyles} appearance-none pr-10`;

  return (
    <FormSection>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">Configuración Básica</h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Define el nombre, segmento y recompensa asociados.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-7">
        {/* --- Nombre de la Regla --- */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Type size={14} /> {t('gamification.field_rule_name_label') || 'Nombre de la Regla'}
          </label>
          <input
            name="ruleName"
            value={formData.ruleName}
            onChange={handleChange}
            className={`${inputStyles} font-medium`}
            placeholder={t('gamification.rule_name_ph') || 'Ej: Asistencia perfecta garzones'}
            required
          />
          {errors.ruleName && <p className="text-xs text-red-500 font-medium ml-1">{errors.ruleName}</p>}
        </div>

        {/* --- Segmento --- */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Tag size={14} /> {t('gamification.field_segment_label') || 'Segmento (TokenID)'}
          </label>
          <div className={selectWrapperStyles}>
            <select
              name="segmentTokenId"
              value={formData.segmentTokenId}
              onChange={handleChange}
              className={`${selectStyles} font-medium ${!formData.segmentTokenId ? 'text-gray-400 dark:text-gray-500' : ''}`}
              required
            >
              <option value="" disabled>{t('gamification.select_segment_ph') || 'Selecciona un segmento…'}</option>
              {segments.map((seg) => (
                <option key={seg.token_id} value={seg.token_id} className="text-black dark:text-white">
                  {seg.name} ({seg.symbol}) - ID: {seg.token_id}
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
          </div>
          {errors.segmentTokenId && <p className="text-xs text-red-500 font-medium ml-1">{errors.segmentTokenId}</p>}
        </div>

        {/* --- Puntos de Mérito --- */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} /> {t('gamification.field_points_label') || 'Recompensa (Puntos)'}
          </label>
          <div className="relative">
            <input
              name="meritPoints"
              type="number"
              min="1"
              value={formData.meritPoints}
              onChange={handleChange}
              className={`${inputStyles} font-black text-matrix-green text-lg`}
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold opacity-30 text-sm pointer-events-none">pts</span>
          </div>
          {errors.meritPoints && <p className="text-xs text-red-500 font-medium ml-1">{errors.meritPoints}</p>}
        </div>

         {/* --- Estado (Activa/Inactiva) --- */}
        <div className="flex flex-col gap-2 md:justify-center md:pl-4">
            <label htmlFor="is_active_toggle" className="flex items-center cursor-pointer group w-max">
                <div className="relative flex items-center p-1 rounded-full bg-gray-200 dark:bg-dark-surface border border-gray-300 dark:border-dark-border/40 shadow-inner overflow-hidden">
                    <input
                      type="checkbox"
                      id="is_active_toggle"
                      name="isActive"
                      className="sr-only"
                      checked={formData.isActive}
                      onChange={handleChange}
                    />
                    <div className={`block w-12 h-6 rounded-full transition-colors duration-300 ${formData.isActive ? 'bg-matrix-green' : 'bg-transparent'}`}></div>
                    <div className={`absolute left-1 bg-white dark:bg-gray-200 shadow-md w-6 h-6 rounded-full transition-transform duration-300 ${formData.isActive ? 'translate-x-[24px]' : 'translate-x-0'}`}></div>
                </div>
                <div className={`ml-3 text-sm font-bold transition-colors ${formData.isActive ? 'text-light-text-primary dark:text-white' : 'text-light-text-secondary dark:text-gray-500'}`}>
                  {formData.isActive ? 'Regla Activa' : 'Regla Pausada'}
                </div>
            </label>
        </div>
      </div>
    </FormSection>
  );
};

export default Step1_General;