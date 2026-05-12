import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Zap, Loader2, DollarSign,
} from 'lucide-react';
import { INPUT, DAYS, InlineAlert, Field } from './constants.jsx';

/**
 * Precio Especial tab.
 * Shows special price configuration: status, validity type,
 * recurring days + hours, or date range.
 */
const EspecialTab = ({ especial, setEsp, savingEsp, espMsg, setEspMsg, onSave, isEdit }) => {
    const { t } = useTranslation();

    const toggleDay = (day) => setEsp('recurring_every',
        especial.recurring_every.includes(day)
            ? especial.recurring_every.filter(d => d !== day)
            : [...especial.recurring_every, day]
    );

    if (!isEdit) return (
        <div className="py-12 flex flex-col items-center gap-2 text-center text-light-text-secondary dark:text-dark-text-secondary">
            <Zap className="w-8 h-8 opacity-20" />
            <p className="text-sm">Guarda el producto primero para configurar precio especial.</p>
        </div>
    );

    return (
        <div className="space-y-5">
            <InlineAlert msg={espMsg} onClose={() => setEspMsg(null)} />

            {/* Active toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl border border-light-border dark:border-dark-border bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20">
                <div>
                    <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">Precio especial activo</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Se mostrará el precio especial en la carta digital</p>
                </div>
                <button type="button" onClick={() => setEsp('special_status', !especial.special_status)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${especial.special_status ? 'bg-amber-500' : 'bg-light-border dark:bg-dark-border'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${especial.special_status ? 'translate-x-5' : ''}`} />
                </button>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
                <Field label="Precio especial Local (CLP)">
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                        <input type="number" value={especial.special_price} onChange={e => setEsp('special_price', e.target.value)}
                            className={`${INPUT} pl-9`} placeholder="0" />
                    </div>
                </Field>
                <Field label="Precio especial Delivery (CLP)">
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                        <input type="number" value={especial.special_price_delivery} onChange={e => setEsp('special_price_delivery', e.target.value)}
                            className={`${INPUT} pl-9`} placeholder="= Local" />
                    </div>
                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        Vacío = usa el precio especial local
                    </p>
                </Field>
            </div>

            {/* Validity type */}
            <Field label="Tipo de vigencia">
                <div className="flex gap-2">
                    {[
                        { key: 'recurring',   label: '🔁 Recurrente' },
                        { key: 'date_range',  label: '📅 Fechas' },
                        { key: 'forever',     label: '∞ Siempre' },
                    ].map(({ key, label }) => (
                        <button key={key} type="button" onClick={() => setEsp('validity', key)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                especial.validity === key
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-300'
                                    : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-amber-400/40'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>
            </Field>

            {/* Recurring — days + hours */}
            <AnimatePresence>
                {especial.validity === 'recurring' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
                        <Field label="Días activos">
                            <div className="flex gap-1.5">
                                {DAYS.map(({ key, label }) => (
                                    <button key={key} type="button" onClick={() => toggleDay(key)}
                                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                            especial.recurring_every.includes(key)
                                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-700 dark:text-amber-300'
                                                : 'border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary'
                                        }`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Desde">
                                <input type="time" step="60" value={especial.recurring_from?.slice(0, 5)} onChange={e => setEsp('recurring_from', `${e.target.value}:00`)} className={INPUT} />
                            </Field>
                            <Field label="Hasta">
                                <input type="time" step="60" value={especial.recurring_to?.slice(0, 5)} onChange={e => setEsp('recurring_to', `${e.target.value}:00`)} className={INPUT} />
                            </Field>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Date range */}
            <AnimatePresence>
                {especial.validity === 'date_range' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Inicio">
                                <input type="date" value={especial.start_date || ''} onChange={e => setEsp('start_date', e.target.value)} className={INPUT} />
                            </Field>
                            <Field label="Fin">
                                <input type="date" value={especial.end_date || ''} onChange={e => setEsp('end_date', e.target.value)} className={INPUT} />
                            </Field>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Save button */}
            <button type="button" onClick={onSave} disabled={savingEsp}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors shadow-md disabled:opacity-50">
                {savingEsp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {savingEsp ? 'Guardando…' : 'Guardar precio especial'}
            </button>
        </div>
    );
};

export default EspecialTab;
