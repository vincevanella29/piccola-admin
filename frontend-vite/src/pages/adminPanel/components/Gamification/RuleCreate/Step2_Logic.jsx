import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Cpu, Sparkles } from 'lucide-react';
import { RULE_TEMPLATES } from './templates';

const FormSection = ({ children }) => (
  <div className="bg-white/60 dark:bg-dark-surface-secondary/30 backdrop-blur-xl border border-dark-border/10 dark:border-dark-border/20 rounded-3xl p-6 md:p-8 shadow-sm">
    {children}
  </div>
);

const Step2_Logic = ({ formData, setFormData, errors, templates, selectedTemplate }) => {
  const { t } = useTranslation();

  const resolvedTemplate = useMemo(() => {
    const apiTpl = templates?.find?.(tpl => tpl.key === formData.selectedTemplateKey) || selectedTemplate || null;
    formData.catalogs = selectedTemplate?.catalogs || {};
    const uiTpl = RULE_TEMPLATES.find(t => t.key === (apiTpl?.key || formData.selectedTemplateKey));
    if (!apiTpl && uiTpl) return uiTpl; 
    if (!apiTpl) return null;
    return {
      ...apiTpl,
      Component: uiTpl?.Component || apiTpl.Component,
      required_params: apiTpl.required_params || uiTpl?.required_params || {},
      optional_params: apiTpl.optional_params || uiTpl?.optional_params || {},
      name: apiTpl.name || uiTpl?.name,
      description: apiTpl.description || uiTpl?.description,
    };
  }, [templates, selectedTemplate, formData.selectedTemplateKey]);

  const handleTemplateChange = (e) => {
    setFormData(prev => ({ ...prev, selectedTemplateKey: e.target.value, params: {} }));
  };
  
  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, params: { ...prev.params, [name]: value } }));
  };

  const inputStyles = "w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/30 rounded-xl px-4 py-3 text-light-text-primary dark:text-dark-text-primary shadow-sm focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green transition-all outline-none";
  const selectWrapperStyles = "relative w-full";
  const selectStyles = `${inputStyles} appearance-none pr-10`;

  const ParamField = ({ paramKey, meta }) => {
    const value = formData.params?.[paramKey] ?? meta.default ?? '';
    
    return (
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
           {meta.description || paramKey}
        </label>
        {meta.type === 'select' ? (
          <div className={selectWrapperStyles}>
            <select
              name={paramKey}
              value={value}
              onChange={handleParamChange}
              className={selectStyles}
            >
              <option value="" disabled>Selecciona...</option>
              {meta.options.map(opt => <option key={opt} value={opt} className="text-black dark:text-white">{opt}</option>)}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
          </div>
        ) : (
          <input
            name={paramKey}
            type={meta.type || 'text'}
            min={meta.min}
            max={meta.max}
            value={value}
            onChange={handleParamChange}
            className={`${inputStyles} font-medium`}
          />
        )}
        {errors[paramKey] && <p className="text-xs text-red-500 font-medium ml-1">{errors[paramKey]}</p>}
      </div>
    );
  };

  return (
    <FormSection>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight flex items-center gap-2">
           Lógica de la Regla
        </h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Elige un template predefinido para determinar cómo se calculan los méritos.</p>
      </div>

      <div className="space-y-6">
        {/* --- Selección de Template --- */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider flex items-center gap-2">
            <Cpu size={14} /> {t('gamification.field_template_label') || 'Template Base'}
          </label>
          <div className={selectWrapperStyles}>
            <select
              value={formData.selectedTemplateKey}
              onChange={handleTemplateChange}
              className={`${selectStyles} font-bold text-[15px] ${!formData.selectedTemplateKey ? 'text-gray-400 dark:text-gray-500' : ''}`}
            >
              <option value="" disabled>{t('gamification.select_template_ph') || 'Selecciona un motor de lógica…'}</option>
              {templates.map((tpl) => <option key={tpl.key} value={tpl.key} className="text-black dark:text-white">{tpl.name}</option>)}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
          </div>
          {errors.template && <p className="text-xs text-red-500 font-medium ml-1">{errors.template}</p>}
        </div>

        {/* --- UI propia del Template seleccionado --- */}
        {resolvedTemplate?.Component ? (
          <div className="pt-6 border-t border-dark-border/10">
            <resolvedTemplate.Component
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              t={t}
            />
          </div>
        ) : (
          resolvedTemplate && Object.keys(resolvedTemplate.required_params || {}).length > 0 && (
            <div className="pt-6 border-t border-dark-border/10 dark:border-dark-border/20 mt-8">
              <h4 className="text-md font-bold mb-5 flex items-center gap-2 text-light-text-primary dark:text-dark-text-primary">
                <Sparkles size={16} className="text-matrix-green" /> Parámetros Específicos
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 bg-gray-50/50 dark:bg-dark-surface p-5 rounded-2xl border border-dark-border/5 dark:border-dark-border/20">
                {Object.entries(resolvedTemplate.required_params).map(([key, meta]) => (
                  <ParamField key={key} paramKey={key} meta={meta} />
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </FormSection>
  );
};

export default Step2_Logic;