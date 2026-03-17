import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Users, LayoutGrid, Armchair, Pencil, ChevronRight, ImageOff, UtensilsCrossed, Truck } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const Pill = ({ icon: Icon, label, color = 'zinc' }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
        bg-${color}-100/80 dark:bg-${color}-800/40 text-${color}-700 dark:text-${color}-300 border border-${color}-200/60 dark:border-${color}-700/40`}>
        {Icon && <Icon className="w-3 h-3 shrink-0" />}
        {label}
    </span>
);

const Stat = ({ icon: Icon, value, label }) => (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl bg-white/50 dark:bg-black/20 border border-white/40 dark:border-white/5 text-center min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent mb-0.5 shrink-0" />}
        <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary leading-none">{value ?? '—'}</span>
        <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide leading-none mt-0.5">{label}</span>
    </div>
);

// ── Opening hours logic ───────────────────────────────────────────────────────
function getNowChile() {
    // Returns { isoDay: '1'–'7', hhmm: 'HH:MM' } in America/Santiago
    const now = new Date();
    const chileTZ = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(now);
    const rawDay  = chileTZ.find(p => p.type === 'weekday')?.value ?? '';
    const hour    = chileTZ.find(p => p.type === 'hour')?.value ?? '00';
    const minute  = chileTZ.find(p => p.type === 'minute')?.value ?? '00';
    const hhmm    = `${hour}:${minute}`;

    // Convert Spanish weekday name (from es-CL locale) to ISO number 1=Mon…7=Sun
    const MAP = {
        'lunes': '1', 'martes': '2', 'miércoles': '3', 'jueves': '4',
        'viernes': '5', 'sábado': '6', 'domingo': '7',
    };
    const isoDay = MAP[rawDay.toLowerCase()] ?? String(((now.getDay() + 6) % 7) + 1);
    return { isoDay, hhmm };
}

function isWithinHours(open, close, now) {
    // Simple string comparison works for HH:MM (no midnight crossing)
    if (!open || !close) return false;
    if (close <= open) {
        // overnight shift: open to midnight + midnight to close
        return now >= open || now <= close;
    }
    return now >= open && now <= close;
}

function getServiceStatus(schedule, specialDates) {
    if (!schedule || Object.keys(schedule).length === 0) return null;
    const { isoDay, hhmm } = getNowChile();
    const today = new Date().toISOString().slice(0, 10);

    // Check special date first
    const special = (specialDates || []).find(s => s.date === today);
    if (special) {
        if (special.closed) return { open: false, label: 'Cerrado hoy' };
        if (special.open && special.close) {
            const isOpen = isWithinHours(special.open, special.close, hhmm);
            return {
                open: isOpen,
                label: isOpen
                    ? `Abierto hasta ${special.close}`
                    : `Abre ${special.open}`,
            };
        }
    }

    const slot = schedule[isoDay];
    if (!slot) return { open: false, label: 'Cerrado hoy' };
    const isOpen = isWithinHours(slot.open, slot.close, hhmm);
    return {
        open: isOpen,
        label: isOpen ? `Abierto hasta ${slot.close}` : `Abre ${slot.open}`,
    };
}

// ── Card ──────────────────────────────────────────────────────────────────────
const LocationCard = ({ location, onEdit, index = 0 }) => {
    const [imgError, setImgError] = useState(false);

    const cover    = (!imgError && (location.cover_image_url || (location.media_urls || [])[0] || location.media_r2)) || null;
    const telefono = location.telephone || location.phone || location.telefono;
    const commune  = location.commune  || location.city || location.state;
    const horario  = location.horario;

    const oh = location.opening_hours || {};
    const specialDates = location.special_dates || [];

    const dineinStatus   = useMemo(() => getServiceStatus(oh.dinein,   specialDates), [oh.dinein,   specialDates]);
    const deliveryStatus = useMemo(() => getServiceStatus(oh.delivery, specialDates), [oh.delivery, specialDates]);

    const hasStructuredHours = !!(
        Object.keys(oh.dinein   || {}).length ||
        Object.keys(oh.delivery || {}).length
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.5) }}
            className="group rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm hover:shadow-xl hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all duration-300 overflow-hidden flex flex-col"
        >
            {/* Cover image */}
            <div className="relative h-44 bg-gradient-to-br from-light-surface-secondary to-light-border dark:from-dark-surface-secondary dark:to-dark-border flex-shrink-0 overflow-hidden">
                {cover ? (
                    <img
                        src={cover}
                        alt={location.nombre}
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-30">
                        <ImageOff className="w-10 h-10 text-light-text-secondary dark:text-dark-text-secondary" />
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Sin imagen</span>
                    </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Commune badge */}
                {commune && (
                    <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold">
                            <MapPin className="w-3 h-3" />
                            {commune}
                        </span>
                    </div>
                )}

                {/* Edit button */}
                <button
                    onClick={onEdit}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-light-accent dark:hover:bg-dark-accent"
                    title="Editar local"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>

                {/* Name at bottom of cover */}
                <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-base font-bold text-white leading-tight drop-shadow-lg truncate">
                        {location.nombre}
                    </h3>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-3 p-4 flex-1">
                {/* Address */}
                {location.direccion && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-start gap-1.5 leading-relaxed">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-light-accent dark:text-dark-accent" />
                        {location.direccion}
                    </p>
                )}

                {/* Service status badges (if structured hours configured) */}
                {hasStructuredHours ? (
                    <div className="flex flex-wrap gap-1.5">
                        {telefono && <Pill icon={Phone} label={telefono} color="blue" />}
                        {dineinStatus && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                dineinStatus.open
                                    ? 'bg-amber-100/80 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-700/40'
                                    : 'bg-zinc-100/80 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-700/40'
                            }`}>
                                <UtensilsCrossed className="w-3 h-3 shrink-0" />
                                {dineinStatus.label}
                            </span>
                        )}
                        {deliveryStatus && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                deliveryStatus.open
                                    ? 'bg-blue-100/80 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-700/40'
                                    : 'bg-zinc-100/80 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-700/40'
                            }`}>
                                <Truck className="w-3 h-3 shrink-0" />
                                {deliveryStatus.label}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {telefono && <Pill icon={Phone} label={telefono} color="blue" />}
                        {horario  && <Pill icon={Clock}  label={horario}  color="amber" />}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-1.5">
                    <Stat icon={Users}      value={location.capacidad_personas} label="Personas" />
                    <Stat icon={LayoutGrid} value={location.cantidad_mesas}    label="Mesas" />
                    <Stat icon={Armchair}   value={location.cantidad_sillas}   label="Sillas" />
                </div>

                {/* Description */}
                {location.descripcion && (
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed line-clamp-2">
                        {location.descripcion}
                    </p>
                )}

                {/* CTA */}
                <button
                    onClick={onEdit}
                    className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-xs font-bold shadow hover:opacity-90 active:scale-95 transition-all"
                >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar local
                    <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </button>
            </div>
        </motion.div>
    );
};

export default LocationCard;
