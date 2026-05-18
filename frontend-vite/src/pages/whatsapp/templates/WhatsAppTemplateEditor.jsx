// src/pages/whatsapp/templates/WhatsAppTemplateEditor.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'react-toastify';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = [
  { code: 'es', label: 'Español' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'pt_BR', label: 'Português (BR)' },
];

const WhatsAppTemplateEditor = ({ wa, onClose }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('es');
  const [components, setComponents] = useState([
    { type: 'BODY', text: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const addComponent = (type) => {
    if (components.find(c => c.type === type)) return;
    setComponents(prev => [...prev, { type, text: '', ...(type === 'BUTTONS' ? { buttons: [{ type: 'QUICK_REPLY', text: '' }] } : {}) }]);
  };

  const updateComponent = (index, updates) => {
    setComponents(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeComponent = (index) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nombre del template requerido'); return; }
    const bodyComp = components.find(c => c.type === 'BODY');
    if (!bodyComp?.text?.trim()) { toast.error('El Body del template es requerido'); return; }
    
    // Validate name format
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    setSaving(true);
    try {
      const payload = {
        name: cleanName,
        category,
        language,
        components: components.filter(c => c.text || c.buttons).map(c => {
          if (c.type === 'BUTTONS') {
            return { type: 'BUTTONS', buttons: c.buttons };
          }
          return { type: c.type, text: c.text };
        }),
      };
      await wa.createTemplate(payload);
      toast.success(`✅ Template "${cleanName}" creado. Esperando aprobación de Meta.`);
      onClose();
    } catch (e) {
      toast.error(`Error: ${e.message || 'No se pudo crear el template'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all"><ArrowLeft size={20} /></button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Crear Template</h2>
          <p className="text-sm text-gray-500">Los templates requieren aprobación de Meta antes de poder usarse.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="p-6 rounded-[2rem] bg-white/70 dark:bg-[#1c1c1e]/70 border border-gray-200/50 dark:border-white/5 shadow-sm space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nombre del Template</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="promo_semanal" className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30" />
            <p className="text-[11px] text-gray-400">Solo minúsculas, números y guiones bajos.</p>
          </div>

          {/* Category + Language */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 appearance-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Idioma</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 appearance-none">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>

          {/* Components */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Componentes</label>
              <div className="flex gap-1.5">
                {['HEADER', 'FOOTER', 'BUTTONS'].filter(t => !components.find(c => c.type === t)).map(t => (
                  <button key={t} onClick={() => addComponent(t)} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20">+ {t}</button>
                ))}
              </div>
            </div>

            {components.map((comp, i) => (
              <div key={comp.type} className="p-4 rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200/50 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-green-500">{comp.type}</span>
                  {comp.type !== 'BODY' && (
                    <button onClick={() => removeComponent(i)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </div>
                {comp.type === 'BUTTONS' ? (
                  <div className="space-y-2">
                    {(comp.buttons || []).map((btn, j) => (
                      <div key={j} className="flex gap-2">
                        <select value={btn.type} onChange={e => { const btns = [...comp.buttons]; btns[j].type = e.target.value; updateComponent(i, { buttons: btns }); }} className="px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/5 text-xs">
                          <option value="QUICK_REPLY">Quick Reply</option>
                          <option value="URL">URL</option>
                          <option value="PHONE_NUMBER">Phone</option>
                        </select>
                        <input type="text" value={btn.text} onChange={e => { const btns = [...comp.buttons]; btns[j].text = e.target.value; updateComponent(i, { buttons: btns }); }} placeholder="Texto del botón" className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/5 text-sm text-gray-900 dark:text-white focus:outline-none" />
                        <button onClick={() => { const btns = comp.buttons.filter((_, k) => k !== j); updateComponent(i, { buttons: btns }); }} className="text-red-400"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => updateComponent(i, { buttons: [...(comp.buttons || []), { type: 'QUICK_REPLY', text: '' }] })} className="text-xs text-green-500 font-bold">+ Botón</button>
                  </div>
                ) : (
                  <textarea value={comp.text} onChange={e => updateComponent(i, { text: e.target.value })} rows={comp.type === 'BODY' ? 4 : 2} placeholder={comp.type === 'BODY' ? 'Hola {{1}}, tenemos una promo especial para ti! 🎉' : comp.type === 'HEADER' ? 'Título del mensaje' : 'Piccola Italia · Delivery'} className="w-full px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/5 text-sm resize-none text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                )}
              </div>
            ))}
          </div>

          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="w-full px-6 py-3.5 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-50">
            <Save size={18} /> {saving ? 'Creando...' : 'Crear Template en Meta'}
          </motion.button>
        </div>

        {/* Preview */}
        <div className="p-6 rounded-[2rem] bg-[#e5ddd5] dark:bg-[#0b141a] border border-gray-200/50 dark:border-white/5 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
          <p className="text-xs font-bold uppercase text-gray-500 mb-4 tracking-wider">Preview</p>
          <div className="w-full max-w-sm">
            <div className="bg-white dark:bg-[#1f2c34] rounded-2xl p-4 shadow-md space-y-2 relative">
              <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white dark:bg-[#1f2c34] rotate-45" />
              {components.find(c => c.type === 'HEADER')?.text && (
                <p className="font-bold text-sm text-gray-900 dark:text-white">{components.find(c => c.type === 'HEADER').text}</p>
              )}
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {components.find(c => c.type === 'BODY')?.text || 'El contenido del mensaje aparecerá aquí...'}
              </p>
              {components.find(c => c.type === 'FOOTER')?.text && (
                <p className="text-xs text-gray-400 mt-2">{components.find(c => c.type === 'FOOTER').text}</p>
              )}
              <p className="text-[10px] text-gray-400 text-right mt-1">12:00 ✓✓</p>
            </div>
            {components.find(c => c.type === 'BUTTONS')?.buttons?.map((btn, i) => (
              <button key={i} className="w-full mt-1.5 px-4 py-2.5 bg-white dark:bg-[#1f2c34] rounded-xl text-sm font-semibold text-[#00a884] text-center shadow-sm border border-gray-200/50 dark:border-white/5">
                {btn.text || 'Botón'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppTemplateEditor;
