import React from 'react';
import { useTranslation } from 'react-i18next';
import { inputCls, textareaCls, Field } from './shared';

const GeneralTab = ({ form, setForm }) => {
    const { t } = useTranslation();
    const q = (k) => t(`banners.general.${k}`);

    return (
        <div className="space-y-4">
            <Field label={q('title')}>
                <input
                    required
                    className={inputCls}
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder={q('title_placeholder')}
                />
            </Field>

            <Field label={q('description')}>
                <textarea
                    className={textareaCls}
                    value={form.description || ''}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={q('description_placeholder')}
                    rows={3}
                />
            </Field>

            <div className="flex items-center gap-3 pt-1">
                <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'}`}
                >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-5' : ''}`} />
                </button>
                <div>
                    <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{q('active')}</span>
                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{q('active_hint')}</p>
                </div>
            </div>
        </div>
    );
};

export default GeneralTab;
