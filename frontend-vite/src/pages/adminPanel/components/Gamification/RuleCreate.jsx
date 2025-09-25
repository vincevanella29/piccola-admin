import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, LoaderCircle, ChevronDown } from 'lucide-react';
import MultiSelect from './MultiSelect.jsx';

// --- Componente Auxiliar para Estructura del Formulario ---
const FormSection = ({ title, description, children }) => (
  <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">
    <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{title}</h3>
    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 mb-6">{description}</p>
    {children}
  </div>
);

// --- Componente Principal ---
const RuleCreate = ({ isLoading, defineRuleFromTemplate, listRuleTemplates, listSegments, listCatalogs }) => {
  const { t } = useTranslation();

  const [ruleName, setRuleName] = useState('');
  const [meritPoints, setMeritPoints] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [segmentTokenId, setSegmentTokenId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [params, setParams] = useState({});
  const [segments, setSegments] = useState([]);
  const [catalogs, setCatalogs] = useState({ cargos: [], secciones: [] });
  // Scope (cargos/secciones)
  const [scopeType, setScopeType] = useState('none'); // none | cargos | secciones
  const [scopeMode, setScopeMode] = useState('include'); // include | exclude
  const [selectedCargos, setSelectedCargos] = useState([]);
  const [selectedSecciones, setSelectedSecciones] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    listRuleTemplates?.()
      .then((res) => {
        console.log('listRuleTemplates', res);
        setTemplates(Array.isArray(res?.templates) ? res.templates : (Array.isArray(res) ? res : []))
      })
      .catch(console.error);
    listSegments?.()
      .then((res) => {
        console.log('listSegments', res);
        setSegments(Array.isArray(res?.segments) ? res.segments : (Array.isArray(res?.data?.segments) ? res.data.segments : []))
      })
      .catch(console.error);
    listCatalogs?.()
      .then((res) => {
        console.log('listCatalogs', res);
        setCatalogs({
          cargos: Array.isArray(res?.cargos) ? res.cargos : (Array.isArray(res?.data?.cargos) ? res.data.cargos : []),
          secciones: Array.isArray(res?.secciones) ? res.secciones : (Array.isArray(res?.data?.secciones) ? res.data.secciones : []),
        })
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = useMemo(() => templates.find(t => t.key === selectedTemplateKey) || null, [templates, selectedTemplateKey]);

  useEffect(() => {
    if (!selectedTemplate) {
      setParams({});
      setErrors({});
      return;
    }
    // Initialize params with default values from template
    const nextParams = {};
    const req = selectedTemplate.required_params || {};
    Object.keys(req).forEach((k) => {
      const meta = req[k] || {};
      if (meta.default !== undefined) {
        nextParams[k] = meta.default;
      } else if (selectedTemplate.key === 'attendance_full_month' && k === 'required_attendance_percent') {
        nextParams[k] = 100; // Lock to 100 for attendance_full_month
      }
    });
    setParams(nextParams);
    setErrors({});
  }, [selectedTemplate]);

  const validateForm = () => {
    const newErrors = {};
    if (!ruleName.trim()) {
      newErrors.ruleName = t('gamification.error_rule_name_required') || 'El nombre de la regla es obligatorio';
    }
    if (!segmentTokenId) {
      newErrors.segmentTokenId = t('gamification.error_segment_required') || 'Debes seleccionar un segmento';
    }
    if (!meritPoints || meritPoints <= 0) {
      newErrors.meritPoints = t('gamification.error_points_invalid') || 'Los puntos deben ser mayores a 0';
    }
    if (!selectedTemplate) {
      newErrors.template = t('gamification.error_template_required') || 'Debes seleccionar un template';
    }

    // Validate required params
    if (selectedTemplate) {
      const req = selectedTemplate.required_params || {};
      Object.keys(req).forEach((k) => {
        const meta = req[k];
        const value = params[k];
        if (value === undefined || value === '') {
          newErrors[k] = t('gamification.error_param_required', { param: k }) || `El parámetro ${k} es obligatorio`;
        } else if (meta.type === 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            newErrors[k] = t('gamification.error_param_number', { param: k }) || `El parámetro ${k} debe ser numérico`;
          } else {
            if (meta.min !== undefined && num < meta.min) {
              newErrors[k] = t('gamification.error_param_min', { param: k, min: meta.min }) || `El parámetro ${k} debe ser al menos ${meta.min}`;
            }
            if (meta.max !== undefined && num > meta.max) {
              newErrors[k] = t('gamification.error_param_max', { param: k, max: meta.max }) || `El parámetro ${k} no debe exceder ${meta.max}`;
            }
            // Special case for attendance_full_month
            if (selectedTemplate.key === 'attendance_full_month' && k === 'required_attendance_percent' && num !== 100) {
              newErrors[k] = t('gamification.error_attendance_percent') || 'La asistencia perfecta requiere 100%';
            }
          }
        }
      });
    }

    // Validate scope
    if (scopeType === 'cargos' && selectedCargos.length === 0) {
      newErrors.scope = t('gamification.error_scope_cargos') || 'Debes seleccionar al menos un cargo';
    } else if (scopeType === 'secciones' && selectedSecciones.length === 0) {
      newErrors.scope = t('gamification.error_scope_secciones') || 'Debes seleccionar al menos una sección';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const renderParamField = (k, meta) => {
    const value = params[k] ?? meta.default ?? '';
    const isAttendancePercent = selectedTemplate?.key === 'attendance_full_month' && k === 'required_attendance_percent';
    
    return (
      <div key={k} className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{k}</label>
        {isAttendancePercent ? (
          <input
            type="number"
            value={100}
            readOnly
            className="w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 text-light-text-secondary dark:text-dark-text-secondary cursor-not-allowed"
          />
        ) : (
          <input
            type={meta?.type || 'text'}
            min={meta.min}
            max={meta.max}
            value={value}
            onChange={(e) => setParams({ ...params, [k]: e.target.value })}
            className="w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-matrix-green focus:border-matrix-green transition"
          />
        )}
        {meta.description && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{meta.description}</p>}
        {errors[k] && <p className="text-xs text-red-500">{errors[k]}</p>}
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const scope = {};
    if (scopeType === 'cargos' && selectedCargos.length > 0) {
      scope.cargos = {
        include: scopeMode === 'include' ? selectedCargos : [],
        exclude: scopeMode === 'exclude' ? selectedCargos : [],
      };
    } else if (scopeType === 'secciones' && selectedSecciones.length > 0) {
      scope.secciones = {
        include: scopeMode === 'include' ? selectedSecciones : [],
        exclude: scopeMode === 'exclude' ? selectedSecciones : [],
      };
    }

    const payload = {
      rule_name: ruleName.trim(),
      segment_token_id: Number(segmentTokenId),
      template_key: selectedTemplate.key,
      params: { ...params },
      merit_points: Number(meritPoints),
      is_active: isActive,
      ...(Object.keys(scope).length ? { scope } : {}),
    };

    try {
      await defineRuleFromTemplate?.(payload);
    } catch (error) {
      setErrors({ submit: error.message || t('gamification.error_submit') || 'Error al guardar la regla' });
    }
  };

  const inputStyles = "w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-matrix-green focus:border-matrix-green transition";
  const selectWrapperStyles = "relative w-full";
  const selectStyles = `${inputStyles} appearance-none`;
  const radioSelectStyles = `${inputStyles}`;
  const multiSelectStyles = `${inputStyles} h-28`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title={t('gamification.rule_create_section_general_title') || '1. Configuración General'} description={t('gamification.rule_create_section_general_desc') || 'Define las propiedades básicas de la nueva regla.'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.field_rule_name_label') || 'Nombre de la Regla (Único)'}</label>
            <input
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className={inputStyles}
              placeholder={t('gamification.rule_name_ph') || 'Ej: Asistencia perfecta garzones'}
              required
            />
            {errors.ruleName && <p className="text-xs text-red-500">{errors.ruleName}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.field_segment_label') || 'Segmento de Meritocracia (TokenID)'}</label>
            <div className={selectWrapperStyles}>
              <select
                value={segmentTokenId}
                onChange={(e) => setSegmentTokenId(e.target.value)}
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.field_points_label') || 'Puntos de Meritocracia'}</label>
            <input
              type="number"
              min="1"
              value={meritPoints}
              onChange={(e) => setMeritPoints(e.target.value)}
              className={inputStyles}
              required
            />
            {errors.meritPoints && <p className="text-xs text-red-500">{errors.meritPoints}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection title={t('gamification.rule_create_section_logic_title') || '2. Lógica de la Regla'} description={t('gamification.rule_create_section_logic_desc') || 'Elige un template predefinido que determinará cuándo se activa esta regla.'}>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('gamification.field_template_label') || 'Template'}</label>
          <div className={selectWrapperStyles}>
            <select
              value={selectedTemplateKey}
              onChange={(e) => setSelectedTemplateKey(e.target.value)}
              className={selectStyles}
              required
            >
              <option value="">{t('gamification.select_template_ph') || 'Selecciona un template…'}</option>
              {templates.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>{tpl.name}</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-dark-text-secondary" />
          </div>
          {errors.template && <p className="text-xs text-red-500">{errors.template}</p>}
          {selectedTemplate?.description && (
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-2">{selectedTemplate.description}</p>
          )}
          {selectedTemplate?.metrics?.notes && (
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">{selectedTemplate.metrics.notes}</p>
          )}
        </div>
      </FormSection>

      <AnimatePresence>
        {selectedTemplate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <FormSection title={t('gamification.rule_create_section_params_title') || '3. Parámetros del Template'} description={t('gamification.rule_create_section_params_desc') || 'Ajusta los valores específicos para el template seleccionado.'}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(selectedTemplate.required_params || {}).map(([k, meta]) => renderParamField(k, meta))}
              </div>
            </FormSection>
          </motion.div>
        )}
      </AnimatePresence>

      <FormSection
        title={t('gamification.rule_create_section_scope_title') || '4. Destinatarios (Cargos/Secciones)'}
        description={t('gamification.rule_create_section_scope_desc') || 'Opcional: limita la regla a ciertos cargos o secciones. Por defecto aplica a todos.'}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('gamification.scope_type_label') || 'Limitar por'}</label>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} className={radioSelectStyles}>
              <option value="none">{t('gamification.scope_type_none') || 'Ninguno (aplica a todos)'}</option>
              <option value="cargos">{t('gamification.scope_type_cargos') || 'Cargos'}</option>
              <option value="secciones">{t('gamification.scope_type_secciones') || 'Secciones'}</option>
            </select>
          </div>

          {scopeType !== 'none' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-dark-border/10 rounded-lg">
              <div className="flex flex-col gap-1.5 md:col-span-1">
                <label className="text-sm font-medium">{t('gamification.scope_mode_label') || 'Modo'}</label>
                <select value={scopeMode} onChange={(e) => setScopeMode(e.target.value)} className={radioSelectStyles}>
                  <option value="include">{t('gamification.scope_mode_include') || 'Incluir'}</option>
                  <option value="exclude">{t('gamification.scope_mode_exclude') || 'Excluir'}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-medium">
                  {scopeType === 'cargos' ? (t('gamification.scope_cargos_label') || 'Cargos') : (t('gamification.scope_secciones_label') || 'Secciones')}
                </label>
                {scopeType === 'cargos' && (
                  <MultiSelect
                    options={catalogs.cargos || []}
                    value={selectedCargos}
                    onChange={setSelectedCargos}
                    placeholder={t('gamification.filter_cargos') || 'Seleccionar cargos...'}
                  />
                )}
                {scopeType === 'secciones' && (
                  <MultiSelect
                    options={catalogs.secciones || []}
                    value={selectedSecciones}
                    onChange={setSelectedSecciones}
                    placeholder={t('gamification.filter_secciones') || 'Seleccionar secciones...'}
                  />
                )}
                {errors.scope && <p className="text-xs text-red-500">{errors.scope}</p>}
              </div>
            </div>
          )}
        </div>
      </FormSection>

      <div className="flex items-center justify-between mt-8">
        <label htmlFor="is_active_toggle" className="flex items-center cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              id="is_active_toggle"
              className="sr-only"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <div className={`block w-12 h-6 rounded-full transition ${isActive ? 'bg-matrix-green' : 'bg-dark-surface-secondary'}`}></div>
            <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform"></div>
          </div>
          <div className="ml-3 text-sm font-medium">{t('gamification.active_rule_label')}</div>
        </label>
        <style>{`.dot { transform: ${isActive ? 'translateX(1.5rem)' : 'translateX(0)'}; }`}</style>
        
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-matrix-green hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          disabled={isLoading || !selectedTemplate}
        >
          {isLoading ? <LoaderCircle size={20} className="animate-spin" /> : <Save size={20} />}
          {t('gamification.save_rule')}
        </button>
      </div>
      {errors.submit && <p className="text-xs text-red-500 mt-2">{errors.submit}</p>}
    </form>
  );
};

export default RuleCreate;