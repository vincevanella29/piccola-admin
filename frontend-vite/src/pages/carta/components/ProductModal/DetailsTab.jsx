import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { INPUT, CHANNELS, DAYS, Field } from './constants.jsx';

/**
 * Details tab — nombre, código, descripción, precio, prioridad,
 * estado (activo/inactivo), restricción de canal, categorías.
 */
const DetailsTab = ({ form, set, categories }) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            {/* Grid: nombre + código */}
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                    <Field label={t('carta.field_name')}>
                        <input
                            type="text" value={form.nombre}
                            onChange={e => set('nombre', e.target.value)}
                            className={INPUT} placeholder="Ej: Salmón al horno"
                        />
                    </Field>
                </div>
                <div className="col-span-2 sm:col-span-1">
                    <Field label={t('carta.field_code')}>
                        <input
                            type="text" value={form.codigo}
                            onChange={e => set('codigo', e.target.value)}
                            className={INPUT} placeholder="P001"
                        />
                    </Field>
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                    <Field label={t('carta.field_description')}>
                        <textarea
                            rows={2} value={form.descripcion}
                            onChange={e => set('descripcion', e.target.value)}
                            className={`${INPUT} resize-none`} placeholder="Descripción breve..."
                        />
                    </Field>
                </div>

                {/* Precio + Prioridad */}
                <div>
                    <Field label={`${t('carta.field_price')} (${form.currency})`}>
                        <input
                            type="number" value={form.precio}
                            onChange={e => set('precio', e.target.value)}
                            className={INPUT}
                        />
                    </Field>
                </div>
                <div>
                    <Field label={t('carta.field_priority')}>
                        <input
                            type="number" value={form.prioridad}
                            onChange={e => set('prioridad', e.target.value)}
                            className={INPUT}
                        />
                    </Field>
                </div>

                {/* Estado */}
                <div className="col-span-2">
                    <Field label={t('carta.field_status')}>
                        <button
                            type="button" onClick={() => set('estado', !form.estado)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                form.estado
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            }`}>
                            <span className={`w-2 h-2 rounded-full transition-colors ${form.estado ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {form.estado ? t('carta.active') : t('carta.inactive')}
                        </button>
                    </Field>
                </div>

                {/* Restricción de canal */}
                <div className="col-span-2">
                    <Field label={t('carta.field_channel_restriction', 'Restricción de canal')}>
                        <div className="space-y-1.5">
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
                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                {form.restriccion.length === 0
                                    ? t('carta.channel_no_restriction', 'Sin restricción — visible en todos los canales')
                                    : `${t('carta.channel_only', 'Solo visible en')}: ${form.restriccion.join(', ')}`}
                            </p>
                        </div>
                    </Field>
                </div>
            </div>

            {/* Categorías */}
            <Field label={t('carta.field_categories')}>
                <div className="flex flex-wrap gap-2 p-3 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/40 border border-light-border dark:border-dark-border rounded-xl max-h-28 overflow-y-auto">
                    {(categories || []).map(cat => {
                        const isSelected = form.category_ids.includes(cat.id);
                        return (
                            <button key={cat.id} type="button"
                                onClick={() => set('category_ids',
                                    isSelected
                                        ? form.category_ids.filter(id => id !== cat.id)
                                        : [...form.category_ids, cat.id]
                                )}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
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
            </Field>
        </div>
    );
};

export default DetailsTab;
