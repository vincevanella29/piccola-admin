import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { RULE_TEMPLATES } from './templates';

const FormSection = ({ children }) => <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">{children}</div>;

const Step2_Logic = ({ formData, setFormData, errors, templates, selectedTemplate }) => {
  // selectedTemplate (legacy) may be passed; but we prefer the one resolved from templates by key
  const { t } = useTranslation();

  const resolvedTemplate = useMemo(() => {
    const apiTpl = templates?.find?.(tpl => tpl.key === formData.selectedTemplateKey) || selectedTemplate || null;
    const uiTpl = RULE_TEMPLATES.find(t => t.key === (apiTpl?.key || formData.selectedTemplateKey));
    if (!apiTpl && uiTpl) return uiTpl; // fallback to local template entirely
    if (!apiTpl) return null;
    // Merge: prefer API data, but attach UI Component and param schemas from UI if missing
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
  
  // Generic param UI as fallback if template provides no Component
  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, params: { ...prev.params, [name]: value } }));
  };
  const ParamField = ({ paramKey, meta }) => {
    const value = formData.params?.[paramKey] ?? meta.default ?? '';
    if (meta.type === 'select') {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{meta.description || paramKey}</label>
          <div className="relative w-full">
            <select
              name={paramKey}
              value={value}
              onChange={handleParamChange}
              className="w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 appearance-none focus:ring-2 focus:ring-matrix-green"
            >
              {meta.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dark-text-secondary" />
          </div>
          {errors[paramKey] && <p className="text-xs text-red-500 mt-1">{errors[paramKey]}</p>}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{meta.description || paramKey}</label>
        <input
          name={paramKey}
          type={meta.type || 'text'}
          min={meta.min}
          max={meta.max}
          value={value}
          onChange={handleParamChange}
          className="w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2"
        />
        {errors[paramKey] && <p className="text-xs text-red-500 mt-1">{errors[paramKey]}</p>}
      </div>
    );
  };

  return (
    <FormSection>
      <div className="space-y-6">
        {/* --- Selección de Template --- */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('gamification.field_template_label') || 'Template de Regla'}</label>
          <div className="relative w-full">
            <select
              value={formData.selectedTemplateKey}
              onChange={handleTemplateChange}
              className="w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 appearance-none focus:ring-2 focus:ring-matrix-green"
            >
              <option value="">{t('gamification.select_template_ph') || 'Selecciona una lógica…'}</option>
              {templates.map((tpl) => <option key={tpl.key} value={tpl.key}>{tpl.name}</option>)}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dark-text-secondary" />
          </div>
          {errors.template && <p className="text-xs text-red-500">{errors.template}</p>}
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
            <div className="pt-6 border-t border-dark-border/10">
              <h4 className="text-md font-bold mb-4">Parámetros Específicos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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