import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock } from 'lucide-react';
import { Field, inputCls, timeCls, Pill, SectionTitle } from './shared';

const DAYS = [0, 1, 2, 3, 4, 5, 6];

const ScheduleTab = ({ form, setForm }) => {
    const { t } = useTranslation();
    const q = (k) => t(`banners.schedule.${k}`);

    const hasSchedule = !!(form.schedule_start || form.schedule_end || form.schedule_days?.length || form.schedule_time_from || form.schedule_time_to);
    const [enabled, setEnabled] = useState(hasSchedule);

    const toggleDay = (day) => {
        const current = form.schedule_days || [];
        const next = current.includes(day)
            ? current.filter(d => d !== day)
            : [...current, day].sort();
        setForm(p => ({ ...p, schedule_days: next.length ? next : null }));
    };

    const clearSchedule = () => {
        setEnabled(false);
        setForm(p => ({
            ...p,
            schedule_start: null,
            schedule_end: null,
            schedule_days: null,
            schedule_time_from: null,
            schedule_time_to: null,
        }));
    };

    return (
        <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center gap-3">
                <Pill active={!enabled} onClick={clearSchedule}>{q('always')}</Pill>
                <Pill active={enabled} onClick={() => setEnabled(true)}>{q('custom')}</Pill>
            </div>

            {!enabled ? (
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary px-1 opacity-60">
                    {q('no_schedule')}
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={q('start_date')}>
                            <input
                                type="date"
                                className={inputCls}
                                value={form.schedule_start || ''}
                                onChange={e => setForm(p => ({ ...p, schedule_start: e.target.value || null }))}
                            />
                        </Field>
                        <Field label={q('end_date')}>
                            <input
                                type="date"
                                className={inputCls}
                                value={form.schedule_end || ''}
                                onChange={e => setForm(p => ({ ...p, schedule_end: e.target.value || null }))}
                            />
                        </Field>
                    </div>

                    {/* Days */}
                    <Field label={q('days')}>
                        <div className="flex gap-1.5 mt-1">
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDay(day)}
                                    className={`w-10 h-10 rounded-xl text-xs font-bold transition-all
                                        ${(form.schedule_days || []).includes(day)
                                            ? 'bg-light-accent dark:bg-dark-accent text-white shadow-sm scale-105'
                                            : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:scale-105'
                                        }`}
                                >
                                    {q(`days_label.${day}`)}
                                </button>
                            ))}
                        </div>
                    </Field>

                    {/* Time range */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label={q('time_from')}>
                            <input
                                type="time"
                                className={timeCls}
                                value={form.schedule_time_from || ''}
                                onChange={e => setForm(p => ({ ...p, schedule_time_from: e.target.value || null }))}
                            />
                        </Field>
                        <Field label={q('time_to')}>
                            <input
                                type="time"
                                className={timeCls}
                                value={form.schedule_time_to || ''}
                                onChange={e => setForm(p => ({ ...p, schedule_time_to: e.target.value || null }))}
                            />
                        </Field>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleTab;
