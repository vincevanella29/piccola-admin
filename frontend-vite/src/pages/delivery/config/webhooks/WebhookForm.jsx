import React, { useState } from 'react';
import { FaSpinner, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { EVENTS, PRESETS } from './templates';

const cls = 'w-full px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-matrix-green/20 text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary';
const lbl = 'text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1';

const WebhookForm = ({ webhook, onSave, onCancel }) => {
  const isEdit = !!webhook;
  const inferPreset = () => {
    if (webhook?.url?.includes('piccolaitalia')) return 'piccola';
    if (webhook?.payload_template) return 'custom';
    return 'generic';
  };

  const [preset, setPreset] = useState(isEdit ? inferPreset() : 'piccola');
  const [name, setName] = useState(webhook?.name || 'POS Piccola Italia');
  const [url, setUrl] = useState(webhook?.url || PRESETS[0].url);
  const [events, setEvents] = useState(webhook?.events || ['order.created', 'order.status_changed']);
  const [template, setTemplate] = useState(webhook?.payload_template || PRESETS[0].template);
  const [apiToken, setApiToken] = useState('');
  const [showTpl, setShowTpl] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickPreset = (key) => {
    const p = PRESETS.find(x => x.key === key);
    setPreset(key);
    if (p.template) setTemplate(p.template);
    if (p.url) setUrl(p.url);
    if (p.events) setEvents(p.events);
    if (key === 'piccola' && !webhook) setName('POS Piccola Italia');
  };

  const toggleEv = (k) => setEvents(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) return toast.error('Nombre y URL obligatorios');
    if (!events.length) return toast.error('Selecciona al menos un evento');
    setSaving(true);
    try {
      const raw = apiToken.trim().replace(/^Bearer\s+/i, '');
      const headers = { ...(webhook?.headers || {}) };
      if (raw) headers['Authorization'] = `Bearer ${raw}`;
      await onSave({ name, url, events, payload_template: template || null, headers, retry_count: 3 });
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-light-accent/20 dark:border-dark-accent/20 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-light-border/5 dark:border-dark-border/5 flex items-center justify-between">
        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{isEdit ? '✏️ Editar' : '🔗 Nuevo Webhook'}</p>
        <button onClick={onCancel} className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error">Cancelar</button>
      </div>
      <div className="p-5 space-y-4">
        {/* Preset */}
        <div>
          <p className={lbl}>Template</p>
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => pickPreset(p.key)}
                className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold text-center border transition-all ${preset === p.key ? 'bg-matrix-green/10 border-matrix-green/30 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* Name + URL */}
        <div className="grid grid-cols-2 gap-3">
          <div><p className={lbl}>Nombre</p><input className={cls} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><p className={lbl}>URL destino</p><input className={cls} value={url} onChange={e => setUrl(e.target.value)} /></div>
        </div>
        {/* Token */}
        <div>
          <p className={lbl}>API Token <span className="font-normal normal-case">(solo el token, sin Bearer)</span></p>
          <input className={`${cls} font-mono`} value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder={isEdit ? '••• dejar vacío si no cambia' : 'abc123...'} />
          <p className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary mt-1 font-mono">→ Header: Authorization: Bearer &lt;token&gt;</p>
        </div>
        {/* Events */}
        <div>
          <p className={lbl}>Eventos</p>
          <div className="grid grid-cols-2 gap-1.5">
            {EVENTS.map(ev => (
              <button key={ev.key} onClick={() => toggleEv(ev.key)}
                className={`px-3 py-2 rounded-xl text-[11px] text-left border transition-all ${events.includes(ev.key) ? 'bg-matrix-green/10 border-matrix-green/20 text-matrix-green font-bold' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 dark:border-dark-border/10 text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {ev.label}
              </button>
            ))}
          </div>
        </div>
        {/* Template editor */}
        <div>
          <button onClick={() => setShowTpl(!showTpl)} className="text-[10px] text-matrix-green font-bold hover:underline">{showTpl ? '▲ Ocultar' : '▼ Ver/editar'} template JSON</button>
          {showTpl && <textarea className={`${cls} font-mono text-[10px] h-40 resize-y mt-2`} value={template} onChange={e => setTemplate(e.target.value)} />}
        </div>
        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-xl bg-matrix-green text-black text-xs font-bold hover:bg-matrix-green/80 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
          {saving ? <FaSpinner className="animate-spin" size={11} /> : <FaCheckCircle size={11} />}
          {isEdit ? 'Guardar cambios' : 'Crear webhook'}
        </button>
      </div>
    </div>
  );
};

export default WebhookForm;
