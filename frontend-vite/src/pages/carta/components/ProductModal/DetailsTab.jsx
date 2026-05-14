import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Hash, FileText, DollarSign, ArrowUpDown, ToggleLeft, Radio, FolderOpen, Truck } from 'lucide-react';
import { INPUT, CHANNELS, Field } from './constants.jsx';

/**
 * DetailsTab — Clean Apple-style product form
 *
 * Layout:
 *   Row 1: Name (wide) + Code (compact)
 *   Row 2: Description (full width)
 *   Row 3: Price + Priority + Status
 *   Row 4: Channel restriction
 *   Row 5: Categories
 */
const DetailsTab = ({ form, set, categories }) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-5">

            {/* ── Identity ─────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                    <Field label={t('carta.field_name')}>
                        <input
                            type="text" value={form.nombre}
                            onChange={e => set('nombre', e.target.value)}
                            className={INPUT} placeholder="Ej: Salmón al horno"
                        />
                    </Field>
                </div>
                <div>
                    <Field label={t('carta.field_code')}>
                        <input
                            type="text" value={form.codigo}
                            onChange={e => set('codigo', e.target.value)}
                            className={`${INPUT} font-mono`} placeholder="P001"
                        />
                    </Field>
                </div>
            </div>

            {/* Description */}
            <Field label={t('carta.field_description')}>
                <textarea
                    rows={2} value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    className={`${INPUT} resize-none`} placeholder="Descripción breve del producto..."
                />
            </Field>

            {/* ── Pricing & Priority ───────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label={`${t('carta.field_price')} Local (${form.currency})`}>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                            type="number" value={form.precio}
                            onChange={e => set('precio', e.target.value)}
                            className={`${INPUT} pl-8`}
                        />
                    </div>
                </Field>
                <Field label={t('carta.field_priority')}>
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                            type="number" value={form.prioridad}
                            onChange={e => set('prioridad', e.target.value)}
                            className={`${INPUT} pl-8`}
                        />
                    </div>
                </Field>

                {/* Status toggle */}
                <div className="col-span-2 sm:col-span-1">
                    <Field label={t('carta.field_status')}>
                        <button
                            type="button" onClick={() => set('estado', !form.estado)}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                form.estado
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30'
                            }`}>
                            <span className={`w-2 h-2 rounded-full transition-colors ${form.estado ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {form.estado ? t('carta.active') : t('carta.inactive')}
                        </button>
                    </Field>
                </div>
            </div>


            {/* ── Channel Restriction ─────────────────── */}
            <div className="p-3.5 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/15 border border-light-border/50 dark:border-dark-border/30 space-y-2.5">
                <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    <span className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                        {t('carta.field_channel_restriction', 'Restricción de canal')}
                    </span>
                </div>
                <div className="flex gap-2">
                    {CHANNELS.map(({ key, label, color }) => {
                        const active = form.restriccion.includes(key);
                        const toggle = () => set('restriccion',
                            active
                                ? form.restriccion.filter(r => r !== key)
                                : [...form.restriccion, key]
                        );
                        const activeClass = {
                            blue:   'bg-blue-100 dark:bg-blue-900/20 border-blue-400 text-blue-700 dark:text-blue-300',
                            orange: 'bg-orange-100 dark:bg-orange-900/20 border-orange-400 text-orange-700 dark:text-orange-300',
                            purple: 'bg-purple-100 dark:bg-purple-900/20 border-purple-400 text-purple-700 dark:text-purple-300',
                        }[color];
                        return (
                            <button key={key} type="button" onClick={toggle}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    active ? activeClass : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-light-accent/40 dark:hover:border-dark-accent/40'
                                }`}>
                                {label}
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                    {form.restriccion.length === 0
                        ? t('carta.channel_no_restriction', 'Sin restricción — visible en todos los canales')
                        : `${t('carta.channel_only', 'Solo visible en')}: ${form.restriccion.join(', ')}`}
                </p>
            </div>

            {/* ── Categories ──────────────────────────── */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    <span className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
                        {t('carta.field_categories')}
                    </span>
                    {form.category_ids.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-light-accent/10 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent">
                            {form.category_ids.length}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/25 border border-light-border/50 dark:border-dark-border/30 rounded-xl max-h-32 overflow-y-auto">
                    {(categories || []).map(cat => {
                        const isSelected = form.category_ids.includes(cat.id);
                        return (
                            <button key={cat.id} type="button"
                                onClick={() => set('category_ids',
                                    isSelected
                                        ? form.category_ids.filter(id => id !== cat.id)
                                        : [...form.category_ids, cat.id]
                                )}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                    isSelected
                                        ? 'bg-light-accent dark:bg-dark-accent text-white border-transparent shadow-sm'
                                        : 'bg-light-surface dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary border-light-border dark:border-dark-border hover:border-light-accent/40 dark:hover:border-dark-accent/40'
                                }`}>
                                {cat.nombre}
                            </button>
                        );
                    })}
                    {(!categories || categories.length === 0) && (
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary py-1">
                            {t('carta.no_categories_available')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetailsTab;
