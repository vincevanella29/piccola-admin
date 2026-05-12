import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UtensilsCrossed, Truck, ShoppingBag, CalendarDays, CalendarX2, Plus, Trash2 } from 'lucide-react';
import { inputCls, timeCls } from './shared';

// ISO weekday labels (1=Mon … 7=Sun)
const DAYS = [
    { iso: '1', short: 'Lun', long: 'Lunes' },
    { iso: '2', short: 'Mar', long: 'Martes' },
    { iso: '3', short: 'Mié', long: 'Miércoles' },
    { iso: '4', short: 'Jue', long: 'Jueves' },
    { iso: '5', short: 'Vie', long: 'Viernes' },
    { iso: '6', short: 'Sáb', long: 'Sábado' },
    { iso: '7', short: 'Dom', long: 'Domingo' },
];

// ── DayRow ────────────────────────────────────────────────────────────────────
const DayRow = ({ day, value, onChange, closedLabel }) => {
    const isOpen = !!value;
    return (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
            isOpen
                ? 'border-light-accent/40 dark:border-dark-accent/40 bg-light-accent/4 dark:bg-dark-accent/4'
                : 'border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 opacity-60'
        }`}>
            <button type="button" onClick={() => onChange(isOpen ? null : { open: '12:00', close: '23:00' })}
                className={`shrink-0 w-9 h-5 rounded-full transition-all relative ${
                    isOpen ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-border dark:bg-dark-border'
                }`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOpen ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary w-8 shrink-0">{day.short}</span>
            {isOpen ? (
                <div className="flex items-center gap-2 flex-1">
                    <input type="time" value={value?.open || '12:00'} onChange={e => onChange({ ...value, open: e.target.value })} className={timeCls} />
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">→</span>
                    <input type="time" value={value?.close || '23:00'} onChange={e => onChange({ ...value, close: e.target.value })} className={timeCls} />
                </div>
            ) : (
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-1">{closedLabel}</span>
            )}
        </div>
    );
};

// ── ServiceSchedule ───────────────────────────────────────────────────────────
const ServiceSchedule = ({ icon: Icon, label, color, schedule, onChange, copyLabel }) => {
    const setDay = useCallback((iso, val) => {
        const next = { ...schedule };
        if (val === null) { delete next[iso]; } else { next[iso] = val; }
        onChange(next);
    }, [schedule, onChange]);

    const applyAll = () => {
        const mon = schedule['1'];
        if (!mon) return;
        const next = {};
        Object.keys(schedule).forEach(k => { next[k] = { ...mon }; });
        onChange(next);
    };

    const openCount = Object.keys(schedule).length;

    const colorMap = {
        amber:   { border: 'border-amber-500/20 dark:border-amber-400/20',   bg: 'bg-amber-500/8 dark:bg-amber-400/8',     text: 'text-amber-500 dark:text-amber-400' },
        blue:    { border: 'border-blue-500/20 dark:border-blue-400/20',     bg: 'bg-blue-500/8 dark:bg-blue-400/8',       text: 'text-blue-500 dark:text-blue-400' },
        emerald: { border: 'border-emerald-500/20 dark:border-emerald-400/20', bg: 'bg-emerald-500/8 dark:bg-emerald-400/8', text: 'text-emerald-500 dark:text-emerald-400' },
    };
    const cm = colorMap[color] || colorMap.amber;

    return (
        <div className={`rounded-2xl border overflow-hidden ${cm.border}`}>
            <div className={`flex items-center justify-between px-4 py-3 ${cm.bg}`}>
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cm.text}`} />
                    <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{label}</span>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {openCount} día{openCount !== 1 ? 's' : ''} activo{openCount !== 1 ? 's' : ''}
                    </span>
                </div>
                {openCount > 1 && (
                    <button type="button" onClick={applyAll}
                        className="text-[10px] px-2 py-1 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors font-semibold">
                        {copyLabel}
                    </button>
                )}
            </div>
            <div className="p-3 space-y-1.5">
                {DAYS.map(day => (
                    <DayRow key={day.iso} day={day} value={schedule[day.iso] ?? null}
                        onChange={val => setDay(day.iso, val)} closedLabel="Cerrado" />
                ))}
            </div>
        </div>
    );
};

// ── SpecialDatesEditor ────────────────────────────────────────────────────────
const EMPTY_SPECIAL = { date: '', label: '', closed: true, open: '', close: '' };

const SpecialDatesEditor = ({ dates, onChange, s }) => {
    const add = () => onChange([...dates, { ...EMPTY_SPECIAL }]);
    const remove = (i) => onChange(dates.filter((_, idx) => idx !== i));
    const update = (i, patch) => onChange(dates.map((d, idx) => idx === i ? { ...d, ...patch } : d));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    {s('specialDates')}
                </span>
                <button type="button" onClick={add}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-xs font-semibold hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> {s('addDate')}
                </button>
            </div>
            {dates.length === 0 && (
                <div className="flex flex-col items-center py-6 gap-2 opacity-40">
                    <CalendarX2 className="w-7 h-7 text-light-text-secondary dark:text-dark-text-secondary" />
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{s('noSpecialDates')}</p>
                </div>
            )}
            {dates.map((sd, i) => (
                <div key={i} className={`rounded-xl p-3 border space-y-2 ${
                    sd.closed
                        ? 'border-red-500/20 dark:border-red-400/20 bg-red-500/4 dark:bg-red-400/4'
                        : 'border-emerald-500/20 dark:border-emerald-400/20 bg-emerald-500/4 dark:bg-emerald-400/4'
                }`}>
                    <div className="flex items-center gap-2">
                        <input type="date" value={sd.date} onChange={e => update(i, { date: e.target.value })} className={`${timeCls} w-36`} />
                        <input type="text" placeholder={s('datePlaceholder')} value={sd.label}
                            onChange={e => update(i, { label: e.target.value })} className={`${inputCls} flex-1 py-1.5 text-xs`} />
                        <button type="button" onClick={() => remove(i)}
                            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 pl-1">
                        <button type="button" onClick={() => update(i, { closed: !sd.closed })}
                            className={`shrink-0 w-9 h-5 rounded-full transition-all relative ${sd.closed ? 'bg-red-500' : 'bg-emerald-500'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sd.closed ? '' : 'translate-x-4'}`} />
                        </button>
                        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                            {sd.closed ? s('closedDay') : s('specialHours')}
                        </span>
                        {!sd.closed && (
                            <div className="flex items-center gap-2 ml-auto">
                                <input type="time" value={sd.open} onChange={e => update(i, { open: e.target.value })} className={timeCls} />
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">→</span>
                                <input type="time" value={sd.close} onChange={e => update(i, { close: e.target.value })} className={timeCls} />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Main HorariosTab ──────────────────────────────────────────────────────────
const HorariosTab = ({ openingHours, setOpeningHours, specialDates, setSpecialDates }) => {
    const { t } = useTranslation();
    const s = (k) => t(`location.modal.schedule.${k}`);

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-light-accent/5 dark:bg-dark-accent/5 border border-light-accent/15 dark:border-dark-accent/15">
                <CalendarDays className="w-4 h-4 text-light-accent dark:text-dark-accent shrink-0 mt-0.5" />
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                    {s('dineinHint')}
                </p>
            </div>

            <ServiceSchedule icon={UtensilsCrossed} label={s('dinein')} color="amber"
                schedule={openingHours.dinein || {}} onChange={v => setOpeningHours(h => ({ ...h, dinein: v }))}
                copyLabel={s('copyMon')} />

            <ServiceSchedule icon={Truck} label={s('delivery')} color="blue"
                schedule={openingHours.delivery || {}} onChange={v => setOpeningHours(h => ({ ...h, delivery: v }))}
                copyLabel={s('copyMon')} />

            <ServiceSchedule icon={ShoppingBag} label={s('pickup')} color="emerald"
                schedule={openingHours.pickup || {}} onChange={v => setOpeningHours(h => ({ ...h, pickup: v }))}
                copyLabel={s('copyMon')} />

            <div className="rounded-2xl border border-light-border/40 dark:border-dark-border/40 overflow-hidden">
                <div className="px-4 py-3 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border-b border-light-border/30 dark:border-dark-border/30">
                    <SpecialDatesEditor dates={specialDates} onChange={setSpecialDates} s={s} />
                </div>
            </div>
        </div>
    );
};

export default HorariosTab;
