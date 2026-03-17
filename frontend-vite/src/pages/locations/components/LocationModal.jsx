import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, Upload, Loader2, ImagePlus, MapPin, Phone, Clock,
    Users, LayoutGrid, Armchair, Trash2, Star, Plus, Truck,
    UtensilsCrossed, CalendarX2, CalendarDays,
} from 'lucide-react';
import useRestaurantData from '../../../hooks/useRestaurantData';

// ── Helpers ───────────────────────────────────────────────────────────────────
const Field = ({ label, children, className = '' }) => (
    <label className={`block ${className}`}>
        <span className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 uppercase tracking-wider">
            {label}
        </span>
        {children}
    </label>
);

const inputCls = "w-full rounded-xl px-3.5 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-sm outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition placeholder:text-light-text-secondary/40 dark:placeholder:text-dark-text-secondary/40";

const timeCls = "rounded-lg px-2.5 py-1.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-xs outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition w-24";

const numberOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

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

// ── Day-row for a service type ────────────────────────────────────────────────
const DayRow = ({ day, value, onChange }) => {
    const isOpen = !!value;
    return (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
            isOpen
                ? 'border-light-accent/40 dark:border-dark-accent/40 bg-light-accent/4 dark:bg-dark-accent/4'
                : 'border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 opacity-60'
        }`}>
            {/* Toggle */}
            <button
                type="button"
                onClick={() => onChange(isOpen ? null : { open: '12:00', close: '23:00' })}
                className={`shrink-0 w-9 h-5 rounded-full transition-all relative ${
                    isOpen ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-border dark:bg-dark-border'
                }`}
            >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOpen ? 'translate-x-4' : ''}`} />
            </button>

            {/* Day name */}
            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary w-8 shrink-0">
                {day.short}
            </span>

            {/* Times */}
            {isOpen ? (
                <div className="flex items-center gap-2 flex-1">
                    <input
                        type="time"
                        value={value?.open || '12:00'}
                        onChange={e => onChange({ ...value, open: e.target.value })}
                        className={timeCls}
                    />
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">→</span>
                    <input
                        type="time"
                        value={value?.close || '23:00'}
                        onChange={e => onChange({ ...value, close: e.target.value })}
                        className={timeCls}
                    />
                </div>
            ) : (
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex-1">Cerrado</span>
            )}
        </div>
    );
};

// ── ServiceSchedule (dinein or delivery) ─────────────────────────────────────
const ServiceSchedule = ({ icon: Icon, label, color, schedule, onChange }) => {
    const setDay = useCallback((iso, val) => {
        const next = { ...schedule };
        if (val === null) {
            delete next[iso];
        } else {
            next[iso] = val;
        }
        onChange(next);
    }, [schedule, onChange]);

    const applyAll = () => {
        // copy Mon's hours to every open day
        const mon = schedule['1'];
        if (!mon) return;
        const next = {};
        Object.keys(schedule).forEach(k => { next[k] = { ...mon }; });
        onChange(next);
    };

    const openCount = Object.keys(schedule).length;

    return (
        <div className={`rounded-2xl border overflow-hidden ${
            color === 'amber'
                ? 'border-amber-500/20 dark:border-amber-400/20'
                : 'border-blue-500/20 dark:border-blue-400/20'
        }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${
                color === 'amber'
                    ? 'bg-amber-500/8 dark:bg-amber-400/8'
                    : 'bg-blue-500/8 dark:bg-blue-400/8'
            }`}>
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${
                        color === 'amber'
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'text-blue-500 dark:text-blue-400'
                    }`} />
                    <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                        {label}
                    </span>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {openCount} día{openCount !== 1 ? 's' : ''} activo{openCount !== 1 ? 's' : ''}
                    </span>
                </div>
                {openCount > 1 && (
                    <button
                        type="button"
                        onClick={applyAll}
                        className="text-[10px] px-2 py-1 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors font-semibold"
                    >
                        Copiar hora Lun → todos
                    </button>
                )}
            </div>

            {/* Day rows */}
            <div className="p-3 space-y-1.5">
                {DAYS.map(day => (
                    <DayRow
                        key={day.iso}
                        day={day}
                        value={schedule[day.iso] ?? null}
                        onChange={val => setDay(day.iso, val)}
                    />
                ))}
            </div>
        </div>
    );
};

// ── SpecialDate editor ────────────────────────────────────────────────────────
const EMPTY_SPECIAL = { date: '', label: '', closed: true, open: '', close: '' };

const SpecialDatesEditor = ({ dates, onChange }) => {
    const add = () => onChange([...dates, { ...EMPTY_SPECIAL, date: '' }]);
    const remove = (i) => onChange(dates.filter((_, idx) => idx !== i));
    const update = (i, patch) => onChange(dates.map((d, idx) => idx === i ? { ...d, ...patch } : d));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                    Fechas especiales / Cierres
                </span>
                <button
                    type="button"
                    onClick={add}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-xs font-semibold hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Agregar fecha
                </button>
            </div>

            {dates.length === 0 && (
                <div className="flex flex-col items-center py-6 gap-2 opacity-40">
                    <CalendarX2 className="w-7 h-7 text-light-text-secondary dark:text-dark-text-secondary" />
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        Sin fechas especiales configuradas
                    </p>
                </div>
            )}

            {dates.map((sd, i) => (
                <div
                    key={i}
                    className={`rounded-xl p-3 border space-y-2 ${
                        sd.closed
                            ? 'border-red-500/20 dark:border-red-400/20 bg-red-500/4 dark:bg-red-400/4'
                            : 'border-emerald-500/20 dark:border-emerald-400/20 bg-emerald-500/4 dark:bg-emerald-400/4'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {/* Date */}
                        <input
                            type="date"
                            value={sd.date}
                            onChange={e => update(i, { date: e.target.value })}
                            className={`${timeCls} w-36`}
                        />
                        {/* Label */}
                        <input
                            type="text"
                            placeholder="Ej: Navidad, Año nuevo…"
                            value={sd.label}
                            onChange={e => update(i, { label: e.target.value })}
                            className={`${inputCls} flex-1 py-1.5 text-xs`}
                        />
                        {/* Remove */}
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Closed toggle */}
                    <div className="flex items-center gap-3 pl-1">
                        <button
                            type="button"
                            onClick={() => update(i, { closed: !sd.closed })}
                            className={`shrink-0 w-9 h-5 rounded-full transition-all relative ${
                                sd.closed ? 'bg-red-500' : 'bg-emerald-500'
                            }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sd.closed ? '' : 'translate-x-4'}`} />
                        </button>
                        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                            {sd.closed ? 'Cerrado este día' : 'Abierto con horario especial'}
                        </span>

                        {!sd.closed && (
                            <div className="flex items-center gap-2 ml-auto">
                                <input
                                    type="time"
                                    value={sd.open}
                                    onChange={e => update(i, { open: e.target.value })}
                                    className={timeCls}
                                />
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">→</span>
                                <input
                                    type="time"
                                    value={sd.close}
                                    onChange={e => update(i, { close: e.target.value })}
                                    className={timeCls}
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Default empty schedule ────────────────────────────────────────────────────
const EMPTY_OPENING_HOURS = () => ({ dinein: {}, delivery: {} });
const EMPTY_SPECIAL_DATES = () => [];

// ── Main Modal ────────────────────────────────────────────────────────────────
const LocationModal = ({ location, isOpen, onClose, appState }) => {
    const { updateLocation, uploadLocationPhotos, actionLoading, actionError } = useRestaurantData(appState);

    const [form, setForm] = useState({
        capacidad_personas: '',
        cantidad_mesas: '',
        cantidad_sillas: '',
        descripcion: '',
        commune: '',
        telephone: '',
        direccion: '',
        horario: '',    // legacy plain-text kept for backward compat
    });

    const [openingHours, setOpeningHours] = useState(EMPTY_OPENING_HOURS());
    const [specialDates, setSpecialDates] = useState(EMPTY_SPECIAL_DATES());

    const [coverFile, setCoverFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [deletedUrls, setDeletedUrls] = useState([]);
    const [activeTab, setActiveTab] = useState('info'); // 'info' | 'horarios' | 'media'

    const coverInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const loading = actionLoading.updateLocation || actionLoading.uploadPhotos;
    const locationId = location ? String(location._id ?? location.id) : null;

    useEffect(() => {
        if (isOpen && location) {
            setForm({
                capacidad_personas: location.capacidad_personas ?? '',
                cantidad_mesas: location.cantidad_mesas ?? '',
                cantidad_sillas: location.cantidad_sillas ?? '',
                descripcion: location.descripcion ?? '',
                commune: location.commune ?? location.city ?? '',
                telephone: location.telephone ?? location.phone ?? location.telefono ?? '',
                direccion: location.direccion ?? '',
                horario: location.horario ?? '',
            });
            setOpeningHours(location.opening_hours && typeof location.opening_hours === 'object'
                ? {
                    dinein:    location.opening_hours.dinein    || {},
                    delivery:  location.opening_hours.delivery  || {},
                  }
                : EMPTY_OPENING_HOURS()
            );
            setSpecialDates(Array.isArray(location.special_dates) ? location.special_dates : EMPTY_SPECIAL_DATES());
            setCoverFile(null);
            setCoverPreview(location.cover_image_url || (location.media_urls || [])[0] || location.media_r2 || null);
            setGalleryFiles([]);
            setDeletedUrls([]);
            setActiveTab('info');
        }
    }, [isOpen, location]);

    if (!isOpen || !location) return null;

    const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const handleCoverChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    const handleGalleryChange = (e) => {
        setGalleryFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    };

    const removeNewGalleryFile = (idx) => setGalleryFiles(prev => prev.filter((_, i) => i !== idx));

    const toggleDeleteUrl = (url) => {
        setDeletedUrls(prev =>
            prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
        );
    };

    const handleSave = async () => {
        if (!locationId) return;

        const payload = {
            capacidad_personas: numberOrNull(form.capacidad_personas),
            cantidad_mesas: numberOrNull(form.cantidad_mesas),
            cantidad_sillas: numberOrNull(form.cantidad_sillas),
            descripcion: form.descripcion || null,
            commune: form.commune || null,
            telephone: form.telephone || null,
            direccion: form.direccion || null,
            horario: form.horario || null,
            opening_hours: openingHours,
            special_dates: specialDates.filter(d => d.date), // skip incomplete rows
        };

        if (deletedUrls.length > 0) {
            payload.media_urls = (location.media_urls || []).filter(u => !deletedUrls.includes(u));
        }

        Object.keys(payload).forEach(k => payload[k] === null && delete payload[k]);

        const updated = await updateLocation({ locationId, data: payload });

        let allNewFiles = [...galleryFiles];
        if (coverFile) allNewFiles = [coverFile, ...allNewFiles];

        if (updated && allNewFiles.length > 0) {
            const urls = await uploadLocationPhotos({ locationId, files: allNewFiles });
            if (coverFile && urls?.length > 0) {
                await updateLocation({ locationId, data: { cover_image_url: urls[0] } });
            }
        }

        if (!actionError.updateLocation && !actionError.uploadPhotos) onClose?.();
    };

    const existingMedia = (location.media_urls || []).filter(Boolean);
    const TABS = [
        { id: 'info',     label: 'Información' },
        { id: 'horarios', label: 'Horarios' },
        { id: 'media',    label: `Fotos${existingMedia.length > 0 ? ` (${existingMedia.length})` : ''}` },
    ];

    // Counts for badge
    const dineinDays   = Object.keys(openingHours.dinein   || {}).length;
    const deliveryDays = Object.keys(openingHours.delivery || {}).length;
    const specialCount = specialDates.filter(d => d.date).length;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-light-background dark:bg-dark-surface rounded-3xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden"
                        initial={{ scale: 0.92, opacity: 0, y: 24 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 24 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0">
                                    <MapPin className="w-4.5 h-4.5 text-light-accent dark:text-dark-accent" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary truncate">
                                        {location.nombre}
                                    </h3>
                                    {(form.commune || form.direccion) && (
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                                            {[form.commune, form.direccion].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-0 px-6 pt-4 shrink-0">
                            {TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                                        activeTab === tab.id
                                            ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent bg-light-accent/5 dark:bg-dark-accent/5'
                                            : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                                    }`}
                                >
                                    {tab.label}
                                    {tab.id === 'horarios' && (dineinDays + deliveryDays + specialCount > 0) && (
                                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-light-accent dark:bg-dark-accent text-white">
                                            {dineinDays + deliveryDays + specialCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-5">

                            {/* ── INFO TAB ─────────────────────────────── */}
                            {activeTab === 'info' && (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Dirección">
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                                                <input type="text" value={form.direccion} onChange={handleChange('direccion')}
                                                    placeholder="Av. Italia 123" className={`${inputCls} pl-9`} />
                                            </div>
                                        </Field>
                                        <Field label="Comuna / Barrio">
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                                                <input type="text" value={form.commune} onChange={handleChange('commune')}
                                                    placeholder="Providencia" className={`${inputCls} pl-9`} />
                                            </div>
                                        </Field>
                                        <Field label="Teléfono">
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                                                <input type="tel" value={form.telephone} onChange={handleChange('telephone')}
                                                    placeholder="+56 2 1234 5678" className={`${inputCls} pl-9`} />
                                            </div>
                                        </Field>
                                        <Field label="Horario (texto libre, vista rápida)">
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                                                <input type="text" value={form.horario} onChange={handleChange('horario')}
                                                    placeholder='Lun-Dom 12:00 – 23:00' className={`${inputCls} pl-9`} />
                                            </div>
                                        </Field>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <Field label={<span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Personas</span>}>
                                            <input type="number" min="0" value={form.capacidad_personas}
                                                onChange={handleChange('capacidad_personas')}
                                                placeholder="120" className={inputCls} />
                                        </Field>
                                        <Field label={<span className="flex items-center gap-1"><LayoutGrid className="w-3.5 h-3.5" /> Mesas</span>}>
                                            <input type="number" min="0" value={form.cantidad_mesas}
                                                onChange={handleChange('cantidad_mesas')}
                                                placeholder="30" className={inputCls} />
                                        </Field>
                                        <Field label={<span className="flex items-center gap-1"><Armchair className="w-3.5 h-3.5" /> Sillas</span>}>
                                            <input type="number" min="0" value={form.cantidad_sillas}
                                                onChange={handleChange('cantidad_sillas')}
                                                placeholder="100" className={inputCls} />
                                        </Field>
                                    </div>

                                    <Field label="Descripción / Notas internas">
                                        <textarea rows={3} value={form.descripcion}
                                            onChange={handleChange('descripcion')}
                                            placeholder="Notas sobre el local, características especiales, etc."
                                            className={`${inputCls} resize-y`} />
                                    </Field>
                                </div>
                            )}

                            {/* ── HORARIOS TAB ─────────────────────────── */}
                            {activeTab === 'horarios' && (
                                <div className="space-y-5">
                                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-light-accent/5 dark:bg-dark-accent/5 border border-light-accent/15 dark:border-dark-accent/15">
                                        <CalendarDays className="w-4 h-4 text-light-accent dark:text-dark-accent shrink-0 mt-0.5" />
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                            Configura el horario de <strong>Dine‑in</strong> (comedor) y <strong>Delivery</strong> por separado para cada día.
                                            También puedes agregar cierres o horarios especiales por fecha.
                                        </p>
                                    </div>

                                    {/* Dine-in schedule */}
                                    <ServiceSchedule
                                        icon={UtensilsCrossed}
                                        label="Dine-in (Comedor)"
                                        color="amber"
                                        schedule={openingHours.dinein || {}}
                                        onChange={s => setOpeningHours(h => ({ ...h, dinein: s }))}
                                    />

                                    {/* Delivery schedule */}
                                    <ServiceSchedule
                                        icon={Truck}
                                        label="Delivery"
                                        color="blue"
                                        schedule={openingHours.delivery || {}}
                                        onChange={s => setOpeningHours(h => ({ ...h, delivery: s }))}
                                    />

                                    {/* Special dates */}
                                    <div className="rounded-2xl border border-light-border/40 dark:border-dark-border/40 overflow-hidden">
                                        <div className="px-4 py-3 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border-b border-light-border/30 dark:border-dark-border/30">
                                            <SpecialDatesEditor
                                                dates={specialDates}
                                                onChange={setSpecialDates}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── MEDIA TAB ────────────────────────────── */}
                            {activeTab === 'media' && (
                                <div className="space-y-6">
                                    {/* Cover image */}
                                    <div>
                                        <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
                                            Imagen Principal (Cover)
                                        </p>
                                        <div
                                            className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-dashed border-light-border dark:border-dark-border cursor-pointer hover:border-light-accent dark:hover:border-dark-accent transition-colors group"
                                            onClick={() => coverInputRef.current?.click()}
                                        >
                                            {coverPreview ? (
                                                <>
                                                    <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <div className="text-white text-sm font-semibold flex items-center gap-2">
                                                            <ImagePlus className="w-5 h-5" /> Cambiar imagen
                                                        </div>
                                                    </div>
                                                    {coverFile && (
                                                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                                            <Star className="w-3 h-3" /> Nueva
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                                                    <ImagePlus className="w-8 h-8 opacity-40" />
                                                    <span className="text-sm">Click para subir imagen de portada</span>
                                                </div>
                                            )}
                                        </div>
                                        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={loading} />
                                    </div>

                                    {/* Gallery */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                                                Galería ({existingMedia.length + galleryFiles.length} fotos)
                                            </p>
                                            <button
                                                onClick={() => galleryInputRef.current?.click()}
                                                disabled={loading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-xs font-semibold hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors"
                                            >
                                                <Upload className="w-3.5 h-3.5" /> Agregar fotos
                                            </button>
                                        </div>
                                        <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryChange} disabled={loading} />

                                        <div className="grid grid-cols-3 gap-2">
                                            {existingMedia.map((url, idx) => (
                                                <div key={idx} className="relative rounded-xl overflow-hidden aspect-square group/img">
                                                    <img src={url} alt={`media-${idx}`} className="w-full h-full object-cover" />
                                                    <div className={`absolute inset-0 transition-all ${deletedUrls.includes(url) ? 'bg-red-500/60' : 'bg-black/0 group-hover/img:bg-black/30'}`} />
                                                    <button
                                                        onClick={() => toggleDeleteUrl(url)}
                                                        className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all
                                                            ${deletedUrls.includes(url)
                                                                ? 'bg-red-500 text-white opacity-100'
                                                                : 'bg-black/50 text-white opacity-0 group-hover/img:opacity-100'}`}
                                                        title={deletedUrls.includes(url) ? 'Deshacer borrar' : 'Eliminar'}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    {deletedUrls.includes(url) && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold">Borrar</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {galleryFiles.map((file, idx) => (
                                                <div key={`new-${idx}`} className="relative rounded-xl overflow-hidden aspect-square group/img">
                                                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all" />
                                                    <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                                        Nuevo
                                                    </div>
                                                    <button
                                                        onClick={() => removeNewGalleryFile(idx)}
                                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {existingMedia.length === 0 && galleryFiles.length === 0 && (
                                                <div className="col-span-3 flex flex-col items-center justify-center py-8 gap-2 text-light-text-secondary dark:text-dark-text-secondary opacity-50">
                                                    <ImagePlus className="w-8 h-8" />
                                                    <p className="text-xs">Sin fotos aún</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {(actionError.updateLocation || actionError.uploadPhotos) && (
                            <div className="mx-6 mb-0 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium">
                                {actionError.updateLocation || actionError.uploadPhotos}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex gap-3 px-6 py-4 border-t border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shrink-0">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-bold shadow-neon hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Guardar cambios</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LocationModal;
