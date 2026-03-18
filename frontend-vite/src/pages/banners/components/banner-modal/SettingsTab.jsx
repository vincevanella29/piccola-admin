import React from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, MousePointer } from 'lucide-react';
import { Field, inputCls, Pill } from './shared';

const IMAGE_SIZES = [
    { key: '3:1',  label: '3:1',  desc: 'Panorámico', w: 96, h: 32 },
    { key: '2:1',  label: '2:1',  desc: 'Banner',     w: 80, h: 40 },
    { key: '16:9', label: '16:9', desc: 'Wide',       w: 80, h: 45 },
    { key: '4:3',  label: '4:3',  desc: 'Clásico',    w: 64, h: 48 },
    { key: '1:1',  label: '1:1',  desc: 'Cuadrado',   w: 48, h: 48 },
];

const BUTTON_POSITIONS = [
    { key: 'bottom-left',   label: '↙ Izq' },
    { key: 'bottom-center', label: '↓ Centro' },
    { key: 'bottom-right',  label: '↘ Der' },
    { key: 'center',        label: '⊕ Centro' },
];

const BUTTON_STYLES = [
    { key: 'solid',   label: 'Sólido' },
    { key: 'outline', label: 'Borde' },
    { key: 'glass',   label: 'Glass' },
];

const SettingsTab = ({ form, setForm }) => {
    const { t } = useTranslation();
    const q = (k) => t(`banners.settings.${k}`);

    const btn = form.button_config || {};
    const setBtn = (updates) => setForm(p => ({
        ...p,
        button_config: { ...p.button_config, ...updates }
    }));

    return (
        <div className="space-y-5">
            {/* ── Image Size ────────────────────────────────────────── */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Maximize2 className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
                    <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{q('image_size')}</span>
                </div>
                <div className="flex gap-2">
                    {IMAGE_SIZES.map(s => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, image_size: s.key }))}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                                ${form.image_size === s.key
                                    ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10'
                                    : 'border-light-border/30 dark:border-dark-border/30 hover:border-light-accent/30 dark:hover:border-dark-accent/30'
                                }`}
                        >
                            <div
                                className={`rounded border-2 transition-colors ${form.image_size === s.key ? 'border-light-accent dark:border-dark-accent bg-light-accent/20 dark:bg-dark-accent/20' : 'border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30'}`}
                                style={{ width: s.w / 2, height: s.h / 2 }}
                            />
                            <span className="text-[9px] font-bold">{s.label}</span>
                            <span className="text-[8px] opacity-50">{s.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Priority / Popup / Delay ──────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
                <Field label={q('priority')} hint={q('priority_hint')}>
                    <input
                        type="number"
                        className={inputCls}
                        value={form.priority}
                        onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                    />
                </Field>
                <Field label={q('popup_duration')} hint={q('popup_hint')}>
                    <input
                        type="number"
                        className={inputCls}
                        value={form.popup_duration_seconds}
                        onChange={e => setForm(p => ({ ...p, popup_duration_seconds: parseInt(e.target.value) || 0 }))}
                    />
                </Field>
                <Field label={q('delay')} hint={q('delay_hint')}>
                    <input
                        type="number"
                        className={inputCls}
                        value={form.display_delay_seconds}
                        onChange={e => setForm(p => ({ ...p, display_delay_seconds: parseInt(e.target.value) || 0 }))}
                    />
                </Field>
            </div>

            {/* ── Click URL ─────────────────────────────────────────── */}
            <Field label={q('click_url')} hint={q('click_url_hint')}>
                <input
                    className={inputCls}
                    value={form.click_url || ''}
                    onChange={e => setForm(p => ({ ...p, click_url: e.target.value }))}
                    placeholder={q('click_url_placeholder')}
                />
            </Field>

            {/* ── CTA Button Config ─────────────────────────────────── */}
            <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MousePointer className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
                        <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{q('button_title')}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setBtn({ visible: !btn.visible })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${btn.visible ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${btn.visible ? 'translate-x-5' : ''}`} />
                    </button>
                </div>

                {btn.visible && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Field label={q('button_text')}>
                            <input
                                className={inputCls}
                                value={btn.text || ''}
                                onChange={e => setBtn({ text: e.target.value })}
                                placeholder={q('button_text_placeholder')}
                            />
                        </Field>

                        <Field label={q('button_position')}>
                            <div className="flex gap-1.5 mt-1">
                                {BUTTON_POSITIONS.map(p => (
                                    <Pill key={p.key} active={btn.position === p.key} onClick={() => setBtn({ position: p.key })}>
                                        {p.label}
                                    </Pill>
                                ))}
                            </div>
                        </Field>

                        <div className="flex gap-3">
                            <Field label={q('button_style')} className="flex-1">
                                <div className="flex gap-1.5 mt-1">
                                    {BUTTON_STYLES.map(s => (
                                        <Pill key={s.key} active={btn.style === s.key} onClick={() => setBtn({ style: s.key })}>
                                            {s.label}
                                        </Pill>
                                    ))}
                                </div>
                            </Field>
                            <Field label={q('button_color')}>
                                <div className="flex gap-1.5 mt-1">
                                    <input
                                        type="color"
                                        value={btn.color || '#22c55e'}
                                        onChange={e => setBtn({ color: e.target.value })}
                                        className="w-8 h-8 rounded-lg border border-light-border/30 dark:border-dark-border/30 cursor-pointer"
                                    />
                                    <input
                                        type="color"
                                        value={btn.text_color || '#ffffff'}
                                        onChange={e => setBtn({ text_color: e.target.value })}
                                        className="w-8 h-8 rounded-lg border border-light-border/30 dark:border-dark-border/30 cursor-pointer"
                                        title="Color texto"
                                    />
                                </div>
                            </Field>
                        </div>

                        {/* Live preview */}
                        <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-xl p-3 flex justify-center">
                            <div
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all
                                    ${btn.style === 'outline' ? 'border-2' : ''}
                                    ${btn.style === 'glass' ? 'backdrop-blur-sm bg-opacity-50' : ''}
                                `}
                                style={{
                                    backgroundColor: btn.style === 'outline' ? 'transparent' : (btn.style === 'glass' ? `${btn.color}80` : btn.color),
                                    color: btn.text_color,
                                    borderColor: btn.style === 'outline' ? btn.color : 'transparent',
                                }}
                            >
                                {btn.text || 'Ver más'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsTab;
