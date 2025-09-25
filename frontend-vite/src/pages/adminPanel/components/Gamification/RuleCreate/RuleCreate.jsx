// /components/Gamification/RuleCreate/RuleCreate.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, LoaderCircle } from 'lucide-react';

import Step1_General from './Step1_General.jsx';
import Step2_Logic from './Step2_Logic.jsx';
import Step3_Scope from './Step3_Scope.jsx';
import CompletionTracker from './CompletionTracker.jsx';

const RuleCreate = ({ isLoading, defineRuleFromTemplate, listRuleTemplates, listSegments, listCatalogs }) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    ruleName: '',
    meritPoints: 1,
    segmentTokenId: '',
    selectedTemplateKey: '',
    params: {},
    scopeType: 'none',
    scopeMode: 'include',
    selectedCargos: [],
    selectedSecciones: [],
    isActive: true,
  });
  
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  
  const [apiData, setApiData] = useState({
    templates: [],
    segments: [],
    catalogs: { cargos: [], secciones: [] },
  });

  // --- Carga de datos inicial ---
  useEffect(() => {
    Promise.all([
      listRuleTemplates(),
      listSegments(),
      listCatalogs(),
    ]).then(([templatesRes, segmentsRes, catalogsRes]) => {
      
      // ### CORRECCIÓN CLAVE AQUÍ ###
      // Se ajusta cómo se accede a `templates` para manejar respuestas anidadas en `.data`
      // y se hace más robusto para los otros casos también.
      console.log('templatesRes', templatesRes);
      console.log('segmentsRes', segmentsRes);
      console.log('catalogsRes', catalogsRes);
      setApiData({
        templates: Array.isArray(templatesRes)
          ? templatesRes
          : (templatesRes?.data?.templates || templatesRes?.templates || []),
        segments: segmentsRes?.data?.segments || segmentsRes?.segments || [],
        catalogs: {
          cargos: catalogsRes?.data?.cargos || catalogsRes?.cargos || [],
          secciones: catalogsRes?.data?.secciones || catalogsRes?.secciones || [],
        },
      });

    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  console.log('apiData', apiData);
  const selectedTemplate = useMemo(() => 
    apiData.templates.find(t => t.key === formData.selectedTemplateKey) || null
  , [apiData.templates, formData.selectedTemplateKey]);

  // --- LÓGICA DE PARÁMETROS SIMPLIFICADA ---
  // Ahora, cuando se elige un template, simplemente poblamos los parámetros
  // con los valores por defecto definidos en el backend, sin lógica extra.
  useEffect(() => {
    const nextParams = {};
    if (selectedTemplate) {
      const req = selectedTemplate.required_params || {};
      Object.keys(req).forEach((k) => {
        const meta = req[k] || {};
        // Solo asigna el valor por defecto que viene del backend.
        if (meta.default !== undefined) {
          nextParams[k] = meta.default;
        }
      });
    }
    setFormData(prev => ({ ...prev, params: nextParams }));
  }, [selectedTemplate]);


  // El resto del componente no necesita cambios...
  const validateStep = (step) => {
    const newErrors = {};
    if (step >= 1) {
      if (!formData.ruleName.trim()) newErrors.ruleName = 'El nombre es obligatorio.';
      if (!formData.segmentTokenId) newErrors.segmentTokenId = 'El segmento es obligatorio.';
      if (!formData.meritPoints || formData.meritPoints <= 0) newErrors.meritPoints = 'Los puntos deben ser > 0.';
    }
    if (step >= 2) {
      if (!selectedTemplate) newErrors.template = 'El template es obligatorio.';
      if (selectedTemplate) {
         Object.entries(selectedTemplate.required_params || {}).forEach(([key, meta]) => {
            if (formData.params[key] === undefined || formData.params[key] === '') {
                newErrors[key] = `El parámetro ${key} es obligatorio.`;
            }
         });
      }
    }
    if (step >= 3) {
      if (formData.scopeType === 'cargos' && formData.selectedCargos.length === 0) newErrors.scope = 'Debes seleccionar al menos un cargo.';
      if (formData.scopeType === 'secciones' && formData.selectedSecciones.length === 0) newErrors.scope = 'Debes seleccionar al menos una sección.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };
  
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    const scope = {};
    if (formData.scopeType === 'cargos' && formData.selectedCargos.length > 0) {
      scope.cargos = {
        include: formData.scopeMode === 'include' ? formData.selectedCargos : [],
        exclude: formData.scopeMode === 'exclude' ? formData.selectedCargos : [],
      };
    } else if (formData.scopeType === 'secciones' && formData.selectedSecciones.length > 0) {
      scope.secciones = {
        include: formData.scopeMode === 'include' ? formData.selectedSecciones : [],
        exclude: formData.scopeMode === 'exclude' ? formData.selectedSecciones : [],
      };
    }

    const payload = {
      rule_name: formData.ruleName.trim(),
      segment_token_id: Number(formData.segmentTokenId),
      template_key: selectedTemplate.key,
      params: { ...formData.params },
      merit_points: Number(formData.meritPoints),
      is_active: formData.isActive,
      ...(Object.keys(scope).length ? { scope } : {}),
    };

    try {
      await defineRuleFromTemplate?.(payload);
    } catch (error) {
      setErrors({ submit: error.message || 'Error al guardar la regla' });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        // Evita que Enter envíe el formulario en pasos intermedios o inputs
        if (e.key === 'Enter') {
          e.preventDefault();
        }
      }}
      noValidate
      className="space-y-8"
    >
      <CompletionTracker currentStep={currentStep} setCurrentStep={setCurrentStep} />

      <div className="mt-8">
        <AnimatePresence mode="wait">
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
            >
                {currentStep === 1 && <Step1_General formData={formData} setFormData={setFormData} errors={errors} segments={apiData.segments} />}
                {currentStep === 2 && <Step2_Logic formData={formData} setFormData={setFormData} errors={errors} templates={apiData.templates} selectedTemplate={selectedTemplate} />}
                {currentStep === 3 && <Step3_Scope formData={formData} setFormData={setFormData} errors={errors} catalogs={apiData.catalogs} />}
            </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-dark-border/20">
         {currentStep > 1 ? (
            <button type="button" onClick={handleBack} className="px-4 py-2 rounded-lg font-semibold bg-light-surface dark:bg-dark-surface-secondary hover:opacity-90 transition-opacity">
               {t('common.back') || 'Atrás'}
            </button>
         ) : <div />}
         
         {currentStep < 3 ? (
            <button type="button" onClick={handleNext} className="px-4 py-2 rounded-lg font-semibold text-white bg-matrix-green hover:opacity-90 transition-opacity">
               {t('common.next') || 'Siguiente'}
            </button>
         ) : (
             <button
                type="submit"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-matrix-green hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                disabled={isLoading}
              >
                {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : <Save size={20} />}
                {t('gamification.save_rule') || 'Guardar Regla'}
              </button>
         )}
      </div>
    </form>
  );
};

export default RuleCreate;