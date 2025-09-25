import React from 'react';
import { useTranslation } from 'react-i18next';
import MultiSelect from './MultiSelect.jsx'; // Asegúrate que la ruta sea correcta

const FormSection = ({ children }) => <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">{children}</div>;

const Step3_Scope = ({ formData, setFormData, errors, catalogs }) => {
    const { t } = useTranslation();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMultiSelectChange = (name, selectedOptions) => {
        setFormData(prev => ({ ...prev, [name]: selectedOptions }));
    };

    const selectStyles = "w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 appearance-none focus:ring-2 focus:ring-matrix-green";

    return (
        <FormSection>
            <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">{t('gamification.scope_type_label') || 'Limitar por'}</label>
                    <select name="scopeType" value={formData.scopeType} onChange={handleChange} className={selectStyles}>
                        <option value="none">{t('gamification.scope_type_none') || 'Ninguno (aplica a todos)'}</option>
                        <option value="cargos">{t('gamification.scope_type_cargos') || 'Cargos'}</option>
                        <option value="secciones">{t('gamification.scope_type_secciones') || 'Secciones'}</option>
                    </select>
                </div>

                {formData.scopeType !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-dark-border/10 rounded-lg">
                        <div className="flex flex-col gap-1.5 md:col-span-1">
                            <label className="text-sm font-medium">{t('gamification.scope_mode_label') || 'Modo'}</label>
                            <select name="scopeMode" value={formData.scopeMode} onChange={handleChange} className={selectStyles}>
                                <option value="include">{t('gamification.scope_mode_include') || 'Incluir solo a estos'}</option>
                                <option value="exclude">{t('gamification.scope_mode_exclude') || 'Excluir a estos'}</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-sm font-medium">
                                {formData.scopeType === 'cargos' ? (t('gamification.scope_cargos_label') || 'Cargos') : (t('gamification.scope_secciones_label') || 'Secciones')}
                            </label>
                            {formData.scopeType === 'cargos' && (
                                <MultiSelect
                                    options={catalogs.cargos || []}
                                    value={formData.selectedCargos}
                                    onChange={(selected) => handleMultiSelectChange('selectedCargos', selected)}
                                    placeholder={t('gamification.filter_cargos') || 'Buscar y seleccionar cargos...'}
                                />
                            )}
                            {formData.scopeType === 'secciones' && (
                                <MultiSelect
                                    options={catalogs.secciones || []}
                                    value={formData.selectedSecciones}
                                    onChange={(selected) => handleMultiSelectChange('selectedSecciones', selected)}
                                    placeholder={t('gamification.filter_secciones') || 'Buscar y seleccionar secciones...'}
                                />
                            )}
                            {errors.scope && <p className="text-xs text-red-500 mt-1">{errors.scope}</p>}
                        </div>
                    </div>
                )}
            </div>
        </FormSection>
    );
};

export default Step3_Scope;