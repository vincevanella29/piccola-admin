import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, Clock, Users, LayoutGrid, Armchair } from 'lucide-react';
import { Field, inputCls } from './shared';

const InfoTab = ({ form, handleChange }) => {
    const { t } = useTranslation();
    const m = (k) => t(`location.modal.info.${k}`);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={m('address')}>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input type="text" value={form.direccion} onChange={handleChange('direccion')}
                            placeholder={m('addressPlaceholder')} className={`${inputCls} pl-9`} />
                    </div>
                </Field>
                <Field label={m('commune')}>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input type="text" value={form.commune} onChange={handleChange('commune')}
                            placeholder={m('communePlaceholder')} className={`${inputCls} pl-9`} />
                    </div>
                </Field>
                <Field label={m('phone')}>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input type="tel" value={form.telephone} onChange={handleChange('telephone')}
                            placeholder={m('phonePlaceholder')} className={`${inputCls} pl-9`} />
                    </div>
                </Field>
                <Field label={m('schedule')}>
                    <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input type="text" value={form.horario} onChange={handleChange('horario')}
                            placeholder={m('schedulePlaceholder')} className={`${inputCls} pl-9`} />
                    </div>
                </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <Field label={<span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {m('people')}</span>}>
                    <input type="number" min="0" value={form.capacidad_personas}
                        onChange={handleChange('capacidad_personas')} placeholder="120" className={inputCls} />
                </Field>
                <Field label={<span className="flex items-center gap-1"><LayoutGrid className="w-3.5 h-3.5" /> {m('tables')}</span>}>
                    <input type="number" min="0" value={form.cantidad_mesas}
                        onChange={handleChange('cantidad_mesas')} placeholder="30" className={inputCls} />
                </Field>
                <Field label={<span className="flex items-center gap-1"><Armchair className="w-3.5 h-3.5" /> {m('chairs')}</span>}>
                    <input type="number" min="0" value={form.cantidad_sillas}
                        onChange={handleChange('cantidad_sillas')} placeholder="100" className={inputCls} />
                </Field>
            </div>

            <Field label={m('description')}>
                <textarea rows={3} value={form.descripcion}
                    onChange={handleChange('descripcion')}
                    placeholder={m('descriptionPlaceholder')}
                    className={`${inputCls} resize-y`} />
            </Field>
        </div>
    );
};

export default InfoTab;
