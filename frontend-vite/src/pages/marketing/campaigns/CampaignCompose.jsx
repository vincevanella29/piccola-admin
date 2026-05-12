// src/pages/marketing/campaigns/CampaignCompose.jsx
import React, { useState } from 'react';
import { FaSave, FaTimes, FaPaperPlane } from 'react-icons/fa';

const AUDIENCE_TYPES = [
  { value: 'all', label: 'Todos los clientes', desc: 'Enviar a todos los clientes con email registrado' },
  { value: 'segment', label: 'Segmento', desc: 'Filtrar por criterios específicos' },
];

const CampaignCompose = ({ campaign, templates, onSave, onCancel, onSend }) => {
  const isNew = !campaign?._id;
  const [name, setName] = useState(campaign?.name || '');
  const [templateId, setTemplateId] = useState(campaign?.template_id || '');
  const [audienceType, setAudienceType] = useState(campaign?.audience?.type || 'all');
  const [saving, setSaving] = useState(false);

  const campaignTemplates = templates.filter(t => t.type === 'campaign');

  const handleSave = async () => {
    if (!name.trim() || !templateId) return;
    setSaving(true);
    try {
      const id = await onSave({
        name,
        template_id: templateId,
        audience: { type: audienceType },
        vars: {},
      });
      // If this was a new campaign and user wants to send immediately
      return id;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
          {isNew ? '✨ Nueva Campaña' : `✏️ Editar: ${campaign.name}`}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors"
          >
            <FaTimes size={12} />
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !templateId}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-matrix-green text-black rounded-lg hover:bg-matrix-green/80 transition-colors disabled:opacity-50"
          >
            <FaSave size={12} />
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
            Nombre de la campaña
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Promo de verano 2026"
            className="w-full px-3 py-2.5 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-matrix-green/30 outline-none"
          />
        </div>

        {/* Template selector */}
        <div>
          <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
            Template de email
          </label>
          {campaignTemplates.length === 0 ? (
            <p className="text-sm text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
              ⚠️ No hay templates de tipo "campaña". Crea uno primero en la pestaña Templates.
            </p>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2.5 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-matrix-green/30 outline-none"
            >
              <option value="">Seleccionar template...</option>
              {campaignTemplates.map(t => (
                <option key={t._id} value={t._id}>
                  {t.name} — {t.subject}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Audience */}
        <div>
          <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
            Audiencia
          </label>
          <div className="grid grid-cols-2 gap-3">
            {AUDIENCE_TYPES.map((a) => (
              <button
                key={a.value}
                onClick={() => setAudienceType(a.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  audienceType === a.value
                    ? 'bg-matrix-green/10 border-matrix-green/40'
                    : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 hover:border-matrix-green/20'
                }`}
              >
                <p className={`text-sm font-bold ${audienceType === a.value ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                  {a.label}
                </p>
                <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
                  {a.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 text-[11px] text-blue-400">
          <p className="font-bold mb-1">📬 Cómo funciona el envío masivo:</p>
          <ul className="space-y-0.5 text-blue-400/80">
            <li>• Los emails se encolan y se envían gradualmente (~7/min)</li>
            <li>• Máximo 10,000 emails por día</li>
            <li>• Los emails transaccionales (pedidos) siempre tienen prioridad</li>
            <li>• Puedes cancelar una campaña en cualquier momento</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CampaignCompose;
