import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, LoaderCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Reuso EXACTO de los Steps del Create
import Step1_General from './RuleCreate/Step1_General.jsx';
import Step2_Logic   from './RuleCreate/Step2_Logic.jsx';
import Step3_Scope   from './RuleCreate/Step3_Scope.jsx';

export default function RuleEditModal({
  open,
  rule,                 // regla original
  isSaving = false,
  onClose,
  onSave,               // async (payload)
  loadTemplates,        // () => Promise<{templates:[]}> | []
  loadSegments,         // () => Promise<{segments:[]}>
  loadCatalogs,         // () => Promise<{cargos:[], secciones:[]}>
}) {
  const [apiData, setApiData] = useState({
    templates: [],
    segments: [],
    catalogs: { cargos: [], secciones: [] },
  });

  // Estado maestro idéntico al Create
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

  const [error, setError] = useState(null);

  // Carga templates/segments/catalogs al abrir
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const [tplRes, segRes, catRes] = await Promise.all([
          typeof loadTemplates === 'function' ? loadTemplates() : [],
          typeof loadSegments === 'function'  ? loadSegments()  : { segments: [] },
          typeof loadCatalogs === 'function'  ? loadCatalogs()  : { cargos: [], secciones: [] },
        ]);
        if (!alive) return;
        setApiData({
          templates: Array.isArray(tplRes) ? tplRes : (tplRes?.templates || []),
          segments: segRes?.segments || segRes?.data?.segments || [],
          catalogs: {
            cargos: catRes?.cargos || catRes?.data?.cargos || [],
            secciones: catRes?.secciones || catRes?.data?.secciones || [],
          },
        });
      } catch {
        // no-op
      }
    })();
    return () => { alive = false; };
  }, [open, loadTemplates, loadSegments, loadCatalogs]);

  // Prefill desde la regla
  useEffect(() => {
    if (!open || !rule) return;

    // Inferir scope -> UI
    const scope = rule.scope || null;
    let scopeType = 'none';
    let scopeMode = 'include';
    let selectedCargos = [];
    let selectedSecciones = [];

    if (scope?.cargos) {
      scopeType = 'cargos';
      const inc = scope.cargos?.include || [];
      const exc = scope.cargos?.exclude || [];
      scopeMode = inc.length ? 'include' : 'exclude';
      selectedCargos = inc.length ? inc : exc;
    } else if (scope?.secciones) {
      scopeType = 'secciones';
      const inc = scope.secciones?.include || [];
      const exc = scope.secciones?.exclude || [];
      scopeMode = inc.length ? 'include' : 'exclude';
      selectedSecciones = inc.length ? inc : exc;
    }

    setFormData({
      ruleName: rule.rule_name || '',
      meritPoints: Number(rule.merit_points || 1),
      segmentTokenId: rule.segment_token_id != null ? String(rule.segment_token_id) : '',
      selectedTemplateKey: rule.template_key || rule.trigger_type || '',
      params: { ...(rule.params || rule.trigger_params || {}) },
      isActive: !!rule.is_active,

      scopeType,
      scopeMode,
      selectedCargos,
      selectedSecciones,
    });
    setError(null);
  }, [open, rule]);

  // Template seleccionado
  const selectedTemplate = useMemo(() => {
    return apiData.templates.find((t) => t.key === formData.selectedTemplateKey) || null;
  }, [apiData.templates, formData.selectedTemplateKey]);

  // Completar defaults de parámetros requeridos cuando cambie el template
  useEffect(() => {
    if (!selectedTemplate) return;
    const req = selectedTemplate.required_params || {};
    const withDefaults = { ...(formData.params || {}) };
    Object.entries(req).forEach(([k, meta]) => {
      if (withDefaults[k] === undefined && meta?.default !== undefined) {
        withDefaults[k] = meta.default;
      }
    });
    setFormData((p) => ({ ...p, params: withDefaults }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.key]);

  // Validación (misma que Create)
  const validate = () => {
    if (!formData.ruleName.trim()) return 'El nombre es obligatorio.';
    if (!formData.segmentTokenId) return 'El segmento es obligatorio.';
    if (!formData.meritPoints || Number(formData.meritPoints) <= 0) return 'Los puntos deben ser > 0.';
    if (!selectedTemplate) return 'El template es obligatorio.';
    const req = selectedTemplate.required_params || {};
    for (const k of Object.keys(req)) {
      if (formData.params[k] === undefined || formData.params[k] === '') {
        return `El parámetro ${k} es obligatorio.`;
      }
    }
    if (formData.scopeType === 'cargos' && formData.selectedCargos.length === 0) {
      return 'Debes seleccionar al menos un cargo.';
    }
    if (formData.scopeType === 'secciones' && formData.selectedSecciones.length === 0) {
      return 'Debes seleccionar al menos una sección.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    // Scope → shape backend
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
      identifier: rule.rule_name, // clave original
      rule_name: formData.ruleName.trim(),
      segment_token_id: Number(formData.segmentTokenId),
      template_key: selectedTemplate.key,
      params: { ...formData.params },
      merit_points: Number(formData.meritPoints),
      is_active: !!formData.isActive,
      validate: true,
      ...(Object.keys(scope).length ? { scope } : {}),
    };

    await onSave?.(payload);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center p-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <div className="w-full max-w-5xl rounded-2xl border border-dark-border/20 bg-light-surface/40 dark:bg-dark-surface-secondary/40 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border/20 bg-dark-surface-secondary/40">
                <div className="text-lg font-semibold">Editar regla</div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-surface-secondary border border-dark-border/30" aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>

              {/* Body: Steps reutilizados */}
              <div className="p-5 space-y-6 max-h-[60vh] overflow-auto">
                {error && (
                  <div className="p-3 rounded-lg border border-rose-400/30 bg-rose-400/10 text-sm">{error}</div>
                )}

                <Step1_General
                  formData={formData}
                  setFormData={setFormData}
                  errors={{}}
                  segments={apiData.segments}
                />
                <Step2_Logic
                  formData={formData}
                  setFormData={setFormData}
                  errors={{}}
                  templates={apiData.templates}
                  selectedTemplate={apiData.templates.find(t => t.key === formData.selectedTemplateKey) || null}
                />
                <Step3_Scope
                  formData={formData}
                  setFormData={setFormData}
                  errors={{}}
                  catalogs={apiData.catalogs}
                />
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-dark-border/20 bg-dark-surface-secondary/40 flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-dark-border/30 hover:bg-dark-surface-secondary"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-matrix-green text-white dark:text-dark-text-secondary disabled:bg-matrix-green/40"
                  disabled={isSaving}
                >
                  {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
