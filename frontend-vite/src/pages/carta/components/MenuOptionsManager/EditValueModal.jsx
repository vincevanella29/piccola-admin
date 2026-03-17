import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, X, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

const INPUT = 'w-full px-3.5 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-shadow placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary';

const EditValueModal = ({ value, optionId, onClose, onSaved, token, account, t }) => {
    const [form, setForm] = useState({
        name:     value.name     || '',
        codigo:   value.codigo   || '',
        price:    value.price    != null ? String(value.price)    : '0',
        priority: value.priority != null ? String(value.priority) : '0',
    });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const data = {};
            if (form.name   !== (value.name   || ''))   data.name   = form.name;
            if (form.codigo !== (value.codigo || ''))   data.codigo = form.codigo;
            const newPrice = parseFloat(form.price) || 0;
            if (newPrice !== (value.price || 0))        data.price  = newPrice;
            const newPrio  = parseInt(form.priority, 10) || 0;
            if (newPrio  !== (value.priority || 0))     data.priority = newPrio;

            if (Object.keys(data).length === 0) { onClose(); return; }

            await cartaApi.updateMenuOptionValue({ token, account, optionId, valueId: value.id, data });
            onSaved();
            onClose();
        } catch (err) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-dark-background-70 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="w-full max-w-md bg-light-surface dark:bg-dark-surface rounded-2xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-light-accent-10 dark:bg-dark-accent-10 flex items-center justify-center">
                            <Edit2 className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                        </div>
                        <h2 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                            {t?.('carta.options_edit_modal_title') || 'Editar Valor'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center hover:opacity-80 transition-opacity">
                        <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {msg && (
                        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium border ${
                            msg.type === 'error'
                                ? 'bg-light-error-10 dark:bg-dark-error-10 text-light-error dark:text-dark-error border-light-error-30 dark:border-dark-error-30'
                                : 'bg-light-success-10 dark:bg-dark-success-10 text-light-success dark:text-dark-success border-light-success-30 dark:border-dark-success-30'
                        }`}>
                            {msg.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                            <span>{msg.text}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary tracking-wide">Nombre</label>
                        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className={INPUT} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary tracking-wide">Código</label>
                        <input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)} className={INPUT} placeholder="Ej: 0801103" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary tracking-wide">Precio (+)</label>
                            <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className={INPUT} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary tracking-wide">Prioridad</label>
                            <input type="number" value={form.priority} onChange={e => set('priority', e.target.value)} className={INPUT} />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 px-6 py-4 border-t border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                        Cancelar
                    </button>
                    <button disabled={saving} onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-neon disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default EditValueModal;
