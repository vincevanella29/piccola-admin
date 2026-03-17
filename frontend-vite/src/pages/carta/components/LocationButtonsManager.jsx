import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronDown, GripVertical, ExternalLink, Trash2, Plus, CheckCircle, Loader2, Save } from 'lucide-react';

const INPUT = 'w-full px-3 py-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-shadow';

const LocationButtonsManager = ({ locations, fetchLocations, updateButtons, categories, isLoading }) => {
    const { t } = useTranslation();
    const [selectedId, setSelectedId] = useState('');
    const [localButtons, setLocalButtons] = useState([]);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => { if (!locations.length) fetchLocations(); }, [fetchLocations, locations.length]);
    useEffect(() => {
        if (selectedId) {
            const loc = locations.find(l => l.id === selectedId);
            setLocalButtons(loc?.custom_buttons || []);
            setShowSuccess(false);
        } else {
            setLocalButtons([]);
        }
    }, [selectedId, locations]);

    const handleAdd = () => { setLocalButtons(p => [...p, { label: '', action_type: 'abrir_menu', target: '' }]); setShowSuccess(false); };
    const handleRemove = (idx) => { setLocalButtons(p => p.filter((_, i) => i !== idx)); setShowSuccess(false); };
    const handleChange = (idx, field, val) => { const n = [...localButtons]; n[idx][field] = val; setLocalButtons(n); setShowSuccess(false); };
    const handleSave = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            await updateButtons(selectedId, localButtons);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) { alert(t('carta.error_save_buttons', { message: err.message })); }
        finally { setSaving(false); }
    };

    return (
        <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-light-border dark:border-dark-border bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/10">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-1">
                        <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                            {t('carta.btn_manager_title')}
                        </h3>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {t('carta.btn_manager_desc')}
                        </p>
                    </div>
                    {/* Location selector */}
                    <div className="relative min-w-[220px]">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-accent dark:text-dark-accent pointer-events-none" />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                            className="w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent shadow-sm">
                            <option value="">{t('carta.select_branch')}</option>
                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.nombre}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-6">
                {!selectedId ? (
                    <div className="py-16 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
                            <MapPin className="w-7 h-7 text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-xs">{t('carta.no_branch_selected')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Button rows */}
                        <div className="space-y-2">
                            <AnimatePresence initial={false}>
                                {localButtons.map((btn, idx) => (
                                    <motion.div key={idx} layout
                                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                                        className="flex items-center gap-3 p-3.5 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 border border-light-border/50 dark:border-dark-border/50">
                                        <div className="hidden sm:flex text-light-text-secondary dark:text-dark-text-secondary cursor-grab shrink-0">
                                            <GripVertical className="w-4 h-4 opacity-40" />
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5 ml-0.5">
                                                    {t('carta.btn_label')}
                                                </label>
                                                <input type="text" placeholder="Ej: Ver Menú" value={btn.label} onChange={e => handleChange(idx, 'label', e.target.value)} className={INPUT} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5 ml-0.5">
                                                    {t('carta.btn_action')}
                                                </label>
                                                <select value={btn.action_type} onChange={e => handleChange(idx, 'action_type', e.target.value)} className={INPUT}>
                                                    <option value="abrir_menu">{t('carta.action_open_menu')}</option>
                                                    <option value="link_externo">{t('carta.action_external')}</option>
                                                    <option value="scroll_categoria">{t('carta.action_scroll')}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1.5 ml-0.5">
                                                    {t('carta.btn_target')}
                                                </label>
                                                {btn.action_type === 'scroll_categoria' ? (
                                                    <select value={btn.target} onChange={e => handleChange(idx, 'target', e.target.value)} className={INPUT}>
                                                        <option value="">{t('carta.select_category')}</option>
                                                        {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                                    </select>
                                                ) : (
                                                    <div className="relative">
                                                        <input type="text"
                                                            placeholder={btn.action_type === 'abrir_menu' ? 'Opcional (ID)' : 'https://...'} value={btn.target}
                                                            onChange={e => handleChange(idx, 'target', e.target.value)} className={INPUT} />
                                                        {btn.action_type === 'link_externo' && <ExternalLink className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary" />}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemove(idx)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/15 rounded-lg transition-colors shrink-0">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {localButtons.length === 0 && (
                                <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-2xl py-10 text-center bg-light-surface-secondary/10">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('carta.no_buttons')}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-light-border/50 dark:border-dark-border/50">
                            <button onClick={handleAdd}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-all shadow-sm">
                                <Plus className="w-4 h-4" /> {t('carta.add_button')}
                            </button>
                            <div className="flex items-center gap-3">
                                <AnimatePresence>
                                    {showSuccess && (
                                        <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle className="w-3.5 h-3.5" /> {t('carta.saved_success')}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold shadow-neon hover:opacity-90 transition-opacity disabled:opacity-50">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {t('carta.save_buttons')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationButtonsManager;
