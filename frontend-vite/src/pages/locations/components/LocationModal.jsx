import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, MapPin } from 'lucide-react';
import useRestaurantData from '../../../hooks/useRestaurantData';
import { numberOrNull } from './location-modal/shared';
import InfoTab from './location-modal/InfoTab';
import HorariosTab from './location-modal/HorariosTab';
import MediaTab from './location-modal/MediaTab';
import QrTab from './location-modal/QrTab';

// ── Empty defaults ────────────────────────────────────────────────────────────
const EMPTY_OPENING_HOURS = () => ({ dinein: {}, delivery: {} });
const EMPTY_SPECIAL_DATES = () => [];

// ── Main Modal ────────────────────────────────────────────────────────────────
const LocationModal = ({ location, isOpen, onClose, appState, liveVisitors = {} }) => {
    const { t } = useTranslation();
    const tm = (k) => t(`location.modal.${k}`);
    const { updateLocation, uploadLocationPhotos, actionLoading, actionError } = useRestaurantData(appState);

    // ── State ──────────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        capacidad_personas: '', cantidad_mesas: '', cantidad_sillas: '',
        descripcion: '', commune: '', telephone: '',
        direccion: '', horario: '', qr_redirect_url: '',
    });
    const [openingHours, setOpeningHours] = useState(EMPTY_OPENING_HOURS());
    const [specialDates, setSpecialDates] = useState(EMPTY_SPECIAL_DATES());
    const [coverFile, setCoverFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [deletedUrls, setDeletedUrls] = useState([]);
    const [activeTab, setActiveTab] = useState('info');
    const [copied, setCopied] = useState(false);

    const loading = actionLoading.updateLocation || actionLoading.uploadPhotos;
    const locationId = location ? String(location._id ?? location.id) : null;

    // ── Reset on open ──────────────────────────────────────────────────────
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
                qr_redirect_url: location.qr_redirect_url ?? '',
            });
            setOpeningHours(
                location.opening_hours && typeof location.opening_hours === 'object'
                    ? { dinein: location.opening_hours.dinein || {}, delivery: location.opening_hours.delivery || {} }
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

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleChange = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
    const handleCoverChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };
    const handleGalleryChange = (e) => setGalleryFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    const removeNewGalleryFile = (idx) => setGalleryFiles(prev => prev.filter((_, i) => i !== idx));
    const toggleDeleteUrl = (url) => setDeletedUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);

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
            special_dates: specialDates.filter(d => d.date),
            qr_redirect_url: form.qr_redirect_url || '',
        };
        // Auto-generate and persist the QR URL based on slug
        if (location.permalink_slug) {
            payload.qr_url = `${window.location.origin}/api/go/${location.permalink_slug}`;
        }
        if (deletedUrls.length > 0) {
            payload.media_urls = (location.media_urls || []).filter(u => !deletedUrls.includes(u));
        }
        // Clean nulls but ALWAYS keep qr_redirect_url and qr_url (even empty)
        Object.keys(payload).forEach(k => {
            if (k === 'qr_redirect_url' || k === 'qr_url') return;
            if (payload[k] === null) delete payload[k];
        });

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

    // ── Tab config ─────────────────────────────────────────────────────────
    const existingMedia = (location.media_urls || []).filter(Boolean);
    const dineinDays = Object.keys(openingHours.dinein || {}).length;
    const deliveryDays = Object.keys(openingHours.delivery || {}).length;
    const specialCount = specialDates.filter(d => d.date).length;

    const TABS = [
        { id: 'info', label: tm('tabs.info') },
        { id: 'horarios', label: tm('tabs.schedule') },
        { id: 'media', label: `${tm('tabs.media')}${existingMedia.length > 0 ? ` (${existingMedia.length})` : ''}` },
        { id: 'qr', label: tm('tabs.qr') },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
                    <motion.div
                        className="relative w-full sm:max-w-2xl h-[100dvh] sm:h-[88vh] flex flex-col bg-light-background dark:bg-dark-surface sm:rounded-3xl shadow-2xl border-0 sm:border border-light-border dark:border-dark-border overflow-hidden"
                        initial={{ scale: 0.95, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 24 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0">
                                    <MapPin className="w-4.5 h-4.5 text-light-accent dark:text-dark-accent" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary truncate">{location.nombre}</h3>
                                    {(form.commune || form.direccion) && (
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                                            {[form.commune, form.direccion].filter(Boolean).join(' · ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button onClick={onClose} disabled={loading}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary hover:text-light-error dark:hover:text-dark-error transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-0 px-6 pt-4 shrink-0">
                            {TABS.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                                        activeTab === tab.id
                                            ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent bg-light-accent/5 dark:bg-dark-accent/5'
                                            : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                                    }`}>
                                    {tab.label}
                                    {tab.id === 'horarios' && (dineinDays + deliveryDays + specialCount > 0) && (
                                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-light-accent dark:bg-dark-accent text-white">
                                            {dineinDays + deliveryDays + specialCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Content — min-h-0 is critical for flex overflow scroll */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 overscroll-contain">
                            {activeTab === 'info' && <InfoTab form={form} handleChange={handleChange} />}
                            {activeTab === 'horarios' && (
                                <HorariosTab openingHours={openingHours} setOpeningHours={setOpeningHours}
                                    specialDates={specialDates} setSpecialDates={setSpecialDates} />
                            )}
                            {activeTab === 'media' && (
                                <MediaTab coverPreview={coverPreview} coverFile={coverFile} onCoverChange={handleCoverChange}
                                    existingMedia={existingMedia} galleryFiles={galleryFiles} onGalleryChange={handleGalleryChange}
                                    onRemoveNewFile={removeNewGalleryFile} deletedUrls={deletedUrls} onToggleDelete={toggleDeleteUrl}
                                    loading={loading} />
                            )}
                            {activeTab === 'qr' && (
                                <QrTab location={location} form={form} handleChange={handleChange}
                                    appState={appState} copied={copied} setCopied={setCopied}
                                    liveVisitors={liveVisitors.counts?.[location?.permalink_slug] || 0} />
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
                            <button onClick={onClose} disabled={loading}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                                {tm('cancel')}
                            </button>
                            <button onClick={handleSave} disabled={loading}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-bold shadow-neon hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2">
                                {loading
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {tm('saving')}</>
                                    : <><Save className="w-4 h-4" /> {tm('saveChanges')}</>
                                }
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LocationModal;
