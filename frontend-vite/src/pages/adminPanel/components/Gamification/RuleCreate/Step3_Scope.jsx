import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Users, Filter } from 'lucide-react';
import MultiSelect from './MultiSelect.jsx';

const FormSection = ({ children }) => (
  <div className="bg-white/60 dark:bg-dark-surface-secondary/30 backdrop-blur-xl border border-dark-border/10 dark:border-dark-border/20 rounded-3xl p-6 md:p-8 shadow-sm">
    {children}
  </div>
);

const Step3_Scope = ({ formData, setFormData, errors, catalogs }) => {
    const { t } = useTranslation();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMultiSelectChange = (name, selectedOptions) => {
        setFormData(prev => ({ ...prev, [name]: selectedOptions }));
    };

    const selectStyles = "w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/30 rounded-xl px-4 py-3 text-light-text-primary dark:text-dark-text-primary shadow-sm appearance-none focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green transition-all outline-none font-medium";
    const selectWrapperStyles = "relative w-full";

    return (
        <FormSection>
            <div className="mb-6">
                <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight flex items-center gap-2">
                    Destinatarios
                </h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Opcional: Limita esta regla a ciertos cargos o secciones. Por defecto, aplica a todos.</p>
            </div>

            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
                        <Filter size={14} /> {t('gamification.scope_type_label') || 'Limitar por'}
                    </label>
                    <div className={selectWrapperStyles}>
                        <select name="scopeType" value={formData.scopeType} onChange={handleChange} className={selectStyles}>
                            <option value="none" className="text-black dark:text-white">{t('gamification.scope_type_none') || 'Ninguno (Aplica a toda la empresa)'}</option>
                            <option value="cargos" className="text-black dark:text-white">{t('gamification.scope_type_cargos') || 'Escalar por Cargos'}</option>
                            <option value="secciones" className="text-black dark:text-white">{t('gamification.scope_type_secciones') || 'Escalar por Secciones'}</option>
                        </select>
                        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
                    </div>
                </div>

                {formData.scopeType !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border border-dark-border/10 dark:border-dark-border/20 rounded-2xl bg-gray-50/50 dark:bg-dark-surface">
                        <div className="flex flex-col gap-2 md:col-span-1">
                            <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
                                <Users size={14} /> {t('gamification.scope_mode_label') || 'Modo de Inclusión'}
                            </label>
                            <div className={selectWrapperStyles}>
                                <select name="scopeMode" value={formData.scopeMode} onChange={handleChange} className={selectStyles}>
                                    <option value="include" className="text-black dark:text-white">{t('gamification.scope_mode_include') || 'Solo a los seleccionados'}</option>
                                    <option value="exclude" className="text-black dark:text-white">{t('gamification.scope_mode_exclude') || 'A todos menos a estos'}</option>
                                </select>
                                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                                {formData.scopeType === 'cargos' ? (t('gamification.scope_cargos_label') || 'Selección de Cargos') : (t('gamification.scope_secciones_label') || 'Selección de Secciones')}
                            </label>
                            <div className="bg-white dark:bg-dark-surface-secondary/40 rounded-xl shadow-sm border border-dark-border/10">
                                {formData.scopeType === 'cargos' && (
                                    <MultiSelect
                                        options={catalogs.cargos || []}
                                        value={formData.selectedCargos}
                                        onChange={(selected) => handleMultiSelectChange('selectedCargos', selected)}
                                        placeholder={t('gamification.filter_cargos') || 'Haz clic para buscar cargos...'}
                                    />
                                )}
                                {formData.scopeType === 'secciones' && (
                                    <MultiSelect
                                        options={catalogs.secciones || []}
                                        value={formData.selectedSecciones}
                                        onChange={(selected) => handleMultiSelectChange('selectedSecciones', selected)}
                                        placeholder={t('gamification.filter_secciones') || 'Haz clic para buscar secciones...'}
                                    />
                                )}
                            </div>
                            {errors.scope && <p className="text-xs text-red-500 font-medium mt-1">{errors.scope}</p>}
                        </div>
                    </div>
                )}
            </div>
        </FormSection>
    );
};

export default Step3_Scope;