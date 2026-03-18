/**
 * BannerDistributionTab — Dónde y cuándo se muestra el banner
 * Targeting + Locations + Schedule (con presets rápidos) + Settings compactos
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, MapPin, Tag, Layers, Calendar, Zap } from 'lucide-react';
import CustomSelect from '../../../../components/common/CustomSelect';
import { Field, inputCls, timeCls, Pill, SectionTitle } from './shared';

const TARGET_TYPES = [
    { key: 'global', icon: Globe },
    { key: 'location', icon: MapPin },
    { key: 'category', icon: Layers },
    { key: 'dish', icon: Tag },
];

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

const DAY_PRESETS = [
    { key: 'all',     days: null,     label: '🗓 Todos' },
    { key: 'weekday', days: WEEKDAYS, label: '💼 Lun-Vie' },
    { key: 'weekend', days: WEEKEND,  label: '🎉 Finde' },
];

const TIME_PRESETS = [
    { key: 'allday',  from: null,    to: null,    label: '⏰ Todo el día' },
    { key: 'lunch',   from: '12:00', to: '16:00', label: '🍽 Almuerzo' },
    { key: 'dinner',  from: '19:00', to: '23:30', label: '🌙 Cena' },
    { key: 'happy',   from: '17:00', to: '20:00', label: '🍻 Happy Hour' },
];

// Only z-index + sizing — CustomSelect handles dark/light colors internally via useTheme()
const selectPortal = {
    menuPortalTarget: typeof document !== 'undefined' ? document.body : undefined,
    menuPosition: 'fixed',
    styles: {
        menuPortal: (base) => ({ ...base, zIndex: 99999 }),
        menu: (base) => ({ ...base, zIndex: 99999 }),
        control: (base) => ({ ...base, minHeight: 42 }),
    },
};

const arraysEqual = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
};

const BannerDistributionTab = ({ form, setForm, locations = [], categories = [], menus = [] }) => {
    const { t } = useTranslation();
    const qt = (k) => t(`banners.targeting.${k}`);
    const qc = (k) => t(`banners.schedule.${k}`);
    const qs = (k) => t(`banners.settings.${k}`);

    const getProductCode = (m) => m?.codigo || m?.id || m?._id || '';

    const locationOptions = useMemo(() =>
        locations.map(l => ({ value: String(l.id || l._id), label: l.nombre })), [locations]);
    const categoryOptions = useMemo(() =>
        categories.map(c => ({ value: String(c.id || c._id), label: c.nombre })), [categories]);
    const dishOptions = useMemo(() =>
        menus.map(m => ({ value: String(getProductCode(m)), label: m.nombre })), [menus]);

    const targetOptions = form.target_type === 'location' ? locationOptions
        : form.target_type === 'category' ? categoryOptions
        : form.target_type === 'dish' ? dishOptions : [];

    const toggleDay = (d) => {
        const current = form.schedule_days || [];
        const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d].sort();
        setForm(p => ({ ...p, schedule_days: next.length ? next : null }));
    };

    const applyDayPreset = (days) => setForm(p => ({ ...p, schedule_days: days }));
    const applyTimePreset = (from, to) => setForm(p => ({ ...p, schedule_time_from: from, schedule_time_to: to }));

    const activeDayPreset = DAY_PRESETS.find(p =>
        p.days === null ? form.schedule_days === null : arraysEqual(form.schedule_days, p.days)
    )?.key || 'custom';

    const activeTimePreset = TIME_PRESETS.find(p =>
        p.from === form.schedule_time_from && p.to === form.schedule_time_to
    )?.key || 'custom';

    return (
        <div className="space-y-5">
            {/* ── Targeting ──────────────────────────────────────────── */}
            <div className="space-y-3">
                <SectionTitle icon={MapPin}>{qt('title')}</SectionTitle>

                <div className="flex gap-1.5 flex-wrap">
                    {TARGET_TYPES.map(({ key, icon: Icon }) => (
                        <Pill key={key} active={form.target_type === key}
                            onClick={() => setForm(p => ({ ...p, target_type: key, target_ids: [] }))}>
                            <span className="flex items-center gap-1"><Icon className="w-3 h-3" />{qt(`type_${key}`)}</span>
                        </Pill>
                    ))}
                </div>

                {form.target_type !== 'global' && (
                    <div className="relative" style={{ zIndex: 60 }}>
                        <CustomSelect isMulti options={targetOptions}
                            value={targetOptions.filter(o => (form.target_ids || []).includes(o.value))}
                            onChange={sel => setForm(p => ({ ...p, target_ids: sel ? sel.map(o => o.value) : [] }))}
                            placeholder={qt('select_placeholder')}
                            menuPlacement="auto" maxMenuHeight={180} {...selectPortal} />
                    </div>
                )}

                <Field label={qt('locations')} hint={qt('locations_hint')}>
                    <div className="relative" style={{ zIndex: 50 }}>
                        <CustomSelect isMulti options={locationOptions}
                            value={locationOptions.filter(o => (form.location_ids || []).includes(o.value))}
                            onChange={sel => setForm(p => ({ ...p, location_ids: sel ? sel.map(o => o.value) : [] }))}
                            placeholder={qt('select_placeholder')}
                            menuPlacement="auto" maxMenuHeight={180} {...selectPortal} />
                    </div>
                </Field>
            </div>

            {/* ── Schedule ───────────────────────────────────────────── */}
            <div className="space-y-3">
                <SectionTitle icon={Calendar}>{qc('title')}</SectionTitle>

                {/* Date range — compact */}
                <div className="grid grid-cols-2 gap-2">
                    <Field label={qc('start_date')}>
                        <input type="date" className={inputCls} value={form.schedule_start || ''}
                            onChange={e => setForm(p => ({ ...p, schedule_start: e.target.value || null }))} />
                    </Field>
                    <Field label={qc('end_date')}>
                        <input type="date" className={inputCls} value={form.schedule_end || ''}
                            onChange={e => setForm(p => ({ ...p, schedule_end: e.target.value || null }))} />
                    </Field>
                </div>

                {/* Day presets — 1 click */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{qc('days')}</span>
                    <div className="flex gap-1.5">
                        {DAY_PRESETS.map(p => (
                            <button key={p.key} type="button" onClick={() => applyDayPreset(p.days)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                                    ${activeDayPreset === p.key
                                        ? 'border-light-accent dark:border-dark-accent bg-light-accent/15 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent'
                                        : 'border-light-border/30 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary hover:border-light-accent/30 dark:hover:border-dark-accent/30'
                                    }`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Individual days — always visible for fine-tuning */}
                    <div className="flex gap-1 mt-1">
                        {DAYS.map(d => (
                            <button key={d} type="button" onClick={() => toggleDay(d)}
                                className={`w-9 h-9 rounded-xl text-[10px] font-bold transition-all
                                    ${(form.schedule_days === null || (form.schedule_days || []).includes(d))
                                        ? 'bg-light-accent/20 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent border border-light-accent/30 dark:border-dark-accent/30'
                                        : 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 text-light-text-secondary/50 dark:text-dark-text-secondary/50 border border-transparent'
                                    }`}>
                                {qc(`days_label.${d}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Time presets — 1 click */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Horario</span>
                    <div className="flex gap-1.5 flex-wrap">
                        {TIME_PRESETS.map(p => (
                            <button key={p.key} type="button" onClick={() => applyTimePreset(p.from, p.to)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
                                    ${activeTimePreset === p.key
                                        ? 'border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                        : 'border-light-border/30 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary hover:border-purple-500/30'
                                    }`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Manual time — always visible */}
                    <div className="flex items-center gap-2 mt-1">
                        <input type="time" className={timeCls} value={form.schedule_time_from || ''}
                            onChange={e => setForm(p => ({ ...p, schedule_time_from: e.target.value || null }))} />
                        <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">→</span>
                        <input type="time" className={timeCls} value={form.schedule_time_to || ''}
                            onChange={e => setForm(p => ({ ...p, schedule_time_to: e.target.value || null }))} />
                    </div>
                </div>
            </div>

            {/* ── Settings — compact inline ───────────────────────────── */}
            <div className="rounded-xl border border-light-border/20 dark:border-dark-border/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-light-accent dark:text-dark-accent" />
                    <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider">{qs('title')}</span>
                </div>
                <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[80px]">
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">{qs('priority')}</span>
                        <input type="number" className={`${inputCls} !py-1.5 !text-xs`} value={form.priority}
                            onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="flex-1 min-w-[80px]">
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">{qs('popup_duration')}</span>
                        <input type="number" className={`${inputCls} !py-1.5 !text-xs`} value={form.popup_duration_seconds}
                            onChange={e => setForm(p => ({ ...p, popup_duration_seconds: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="flex-1 min-w-[80px]">
                        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">{qs('delay')}</span>
                        <input type="number" className={`${inputCls} !py-1.5 !text-xs`} value={form.display_delay_seconds}
                            onChange={e => setForm(p => ({ ...p, display_delay_seconds: parseInt(e.target.value) || 0 }))} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BannerDistributionTab;
