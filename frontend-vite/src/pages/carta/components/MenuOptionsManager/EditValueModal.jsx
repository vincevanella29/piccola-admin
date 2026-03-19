// EditValueModal — edit a single value within an option group.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, X, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

const fieldCls = `w-full px-3.5 py-2.5 rounded-xl text-sm
  bg-light-surface dark:bg-dark-surface-secondary
  border border-light-border dark:border-dark-border
  text-light-text-primary dark:text-dark-text-primary
  placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50
  focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all`;

const EditValueModal = ({ value, optionId, onClose, onSaved, token, account, t }) => {
  const [form, setForm] = useState({
    name:     value.name     || '',
    codigo:   value.codigo   || '',
    price:    value.price    != null ? String(value.price) : '0',
    priority: value.priority != null ? String(value.priority) : '0',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const isProduct = Boolean(value.codigo?.trim());
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const data = {};
      if (form.name   !== (value.name   || '')) data.name     = form.name;
      if (form.codigo !== (value.codigo || '')) data.codigo   = form.codigo;
      const newPrice = parseFloat(form.price) || 0;
      if (newPrice !== (value.price || 0))     data.price    = newPrice;
      const newPrio  = parseInt(form.priority, 10) || 0;
      if (newPrio  !== (value.priority || 0))  data.priority = newPrio;
      if (!Object.keys(data).length) { onClose(); return; }
      await cartaApi.updateMenuOptionValue({ token, account, optionId, valueId: value.id, data });
      onSaved(); onClose();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center">
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative z-10 w-full sm:max-w-md bg-light-surface dark:bg-dark-surface rounded-t-3xl sm:rounded-3xl shadow-modal border border-light-border dark:border-dark-border overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-light-border dark:border-dark-border">
          <div className="flex justify-center w-full mb-0 sm:hidden absolute top-2 left-0 right-0">
            <div className="w-9 h-1 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-secondary" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
              <Edit2 className="w-4 h-4 text-light-accent dark:text-dark-accent" />
            </div>
            <h2 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
              {t?.('carta.options_edit_modal_title') || 'Editar valor'}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors active:scale-90">
            <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
          </button>
        </header>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Alert */}
          {msg && (
            <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
              msg.type === 'error'
                ? 'bg-light-error/5 dark:bg-dark-error/5 text-light-error dark:text-dark-error border-light-error/20 dark:border-dark-error/20'
                : 'bg-light-success/5 dark:bg-dark-success/5 text-light-success dark:text-dark-success border-light-success/20 dark:border-dark-success/20'
            }`}>
              {msg.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
              <span className="flex-1">{msg.text}</span>
            </div>
          )}

          {/* Product lock notice */}
          {isProduct && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-light-accent/5 dark:bg-dark-accent/5 border border-light-accent/15 dark:border-dark-accent/15 text-[11px] text-light-accent dark:text-dark-accent">
              <span>🔒</span>
              Nombre, código y precio provienen del producto. Solo se puede editar la prioridad.
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Nombre</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              readOnly={isProduct} className={`${fieldCls} ${isProduct ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </div>

          {/* Code */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Código</label>
            <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)}
              readOnly={isProduct} placeholder="Ej: 0801103"
              className={`${fieldCls} font-mono ${isProduct ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </div>

          {/* Price + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Precio (+)</label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
                readOnly={isProduct} className={`${fieldCls} ${isProduct ? 'opacity-50 cursor-not-allowed' : ''}`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Prioridad</label>
              <input type="number" value={form.priority} onChange={e => set('priority', e.target.value)} className={fieldCls} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex gap-2.5 px-5 py-3.5 border-t border-light-border dark:border-dark-border bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface dark:hover:bg-dark-surface transition-colors active:scale-[0.98]">
            Cancelar
          </button>
          <button disabled={saving} onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98] shadow-neon">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default EditValueModal;
