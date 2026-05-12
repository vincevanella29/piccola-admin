/**
 * ProductModal — Apple-style unified product editor
 *
 * Consolidated from 6 tabs → 3 clean sections:
 *   🍽  Producto     → details form + gallery (always visible)
 *   ⚙️  Configuración → modifiers + special price
 *   📊  Análisis     → MTZ + nutrition
 *
 * Design principles:
 *   • Wide modal (2xl) with clear visual hierarchy
 *   • iOS-style segmented control for tabs
 *   • Collapsible sections within each tab
 *   • Footer save button always visible on relevant tabs
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, X, Save, Loader2, CheckCircle, AlertTriangle,
    BarChart2, Zap, ListFilter, Apple, ChevronDown, ChevronRight,
    Image as ImageIcon, Settings, PieChart,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';
import { uploadProductVideo } from '../../../../utils/cartaData';

import DetailsTab   from './DetailsTab';
import GalleryTab   from './GalleryTab';
import ModifiersTab from './ModifiersTab';
import EspecialTab  from './EspecialTab';
import MtzTab        from './MtzTab';
import NutritionTab  from './NutritionTab';
import { DAYS }      from './constants.jsx';

// ── Segmented Control ──────────────────────────────────────────────────────────
const SegmentedControl = ({ tabs, active, onChange }) => (
    <div className="flex items-center bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 p-0.5 rounded-xl gap-0.5 border border-light-border/50 dark:border-dark-border/50 w-full">
        {tabs.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => onChange(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
                    active === id
                        ? 'text-light-text-primary dark:text-dark-text-primary bg-white dark:bg-dark-surface shadow-sm'
                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                {badge > 0 && (
                    <span className={`px-1 py-0.5 rounded-full text-[9px] font-bold leading-none ${
                        active === id
                            ? 'bg-light-accent/10 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent'
                            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
                    }`}>{badge}</span>
                )}
            </button>
        ))}
    </div>
);

// ── Collapsible Section ────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, defaultOpen = true, badge, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-2xl border border-light-border/60 dark:border-dark-border/40 overflow-hidden transition-all">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2.5 px-4 py-3 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/15 hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/25 transition-colors text-left">
                <div className="w-6 h-6 rounded-lg bg-light-accent/10 dark:bg-dark-accent/15 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
                </div>
                <span className="flex-1 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">{title}</span>
                {badge != null && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                        {badge}
                    </span>
                )}
                {open
                    ? <ChevronDown className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary shrink-0" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="px-4 py-4">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── ProductModal ───────────────────────────────────────────────────────────────
const ProductModal = ({
    product,
    categories,
    menuOptions = [],
    products    = [],
    onClose,
    onSave,
    uploadImage,
    token,
    account,
    onOpenAurora,
}) => {
    const { t } = useTranslation();
    const isEdit = !!product?.id;

    const initImages = () => {
        const imgs = product?.media_images || [];
        if (imgs.length === 0 && (product?.media_r2 || product?.media_url)) {
            return [product.media_r2 || product.media_url];
        }
        return imgs;
    };

    // ── Core state ─────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('product');
    const [form, setForm] = useState({
        nombre:          product?.nombre || '',
        descripcion:     product?.descripcion || '',
        precio:          product?.precio != null ? String(product.precio).replace(/[^0-9]/g, '') : '',
        precio_delivery: product?.precio_delivery != null ? String(product.precio_delivery).replace(/[^0-9]/g, '') : '',
        estado:          product?.estado ?? true,
        prioridad:       product?.prioridad ?? 0,
        media_r2:        product?.media_r2 || product?.media_url || '',
        currency:        product?.currency || 'CLP',
        codigo:          product?.codigo || '',
        category_ids:    product?.category_ids || [],
        restriccion:     Array.isArray(product?.restriccion) ? product.restriccion : [],
    });
    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    // ── Media ──────────────────────────────────────────────────────────────
    const [images, setImages]   = useState(initImages);
    const [video, setVideo]     = useState(product?.media_video || '');
    const [uploading, setUploading] = useState(false);

    // ── Save ───────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [msg, setMsg]       = useState(null);

    // ── Especial state ─────────────────────────────────────────────────────
    const esp = product?.especial || {};
    const [especial, setEspecial] = useState({
        special_price:          esp.special_price ?? '',
        special_price_delivery: esp.special_price_delivery ?? '',
        special_status:         esp.special_status ?? false,
        validity:               esp.validity || 'recurring',
        recurring_every:        Array.isArray(esp.recurring_every) ? esp.recurring_every : [],
        recurring_from:         esp.recurring_from || '17:00:00',
        recurring_to:           esp.recurring_to   || '23:55:00',
        start_date:             esp.start_date || '',
        end_date:               esp.end_date   || '',
    });
    const [savingEsp, setSavingEsp] = useState(false);
    const [espMsg, setEspMsg]       = useState(null);
    const setEsp = (k, v) => setEspecial(prev => ({ ...prev, [k]: v }));

    // ── MTZ lazy load ──────────────────────────────────────────────────────
    const [mtzData, setMtzData]     = useState(null);
    const [loadingMtz, setLoadingMtz] = useState(false);

    useEffect(() => {
        if (activeTab === 'analytics' && isEdit && !mtzData && !loadingMtz) {
            setLoadingMtz(true);
            cartaApi.fetchProductMtzData({ token, account, productId: product.id })
                .then(data  => setMtzData(data))
                .catch(err  => console.error('[ProductModal] MTZ fetch error:', err))
                .finally(() => setLoadingMtz(false));
        }
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadImage(file);
            if (url) {
                set('media_r2', url);
                setImages(prev => prev.length < 4 ? [...prev, url] : prev);
                setMsg({ type: 'success', text: t('carta.image_success') });
            }
        } catch (err) {
            setMsg({ type: 'error', text: t('carta.image_error', { message: err.message }) });
        } finally { setUploading(false); }
    };

    const handleVideoUpload = async (file) => {
        if (!file) return;
        const res = await uploadProductVideo({ token, account, file });
        if (res?.url) {
            setVideo(res.url);
            setMsg({ type: 'success', text: '✓ Video subido a R2' });
        }
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        setSaving(true);
        try {
            let finalImages    = images;
            let finalPrincipal = images[0] || form.media_r2;

            if (isEdit && images.length > 0) {
                const res = await cartaApi.organizeProductMedia({
                    token, account, productId: product.id,
                    images: images, videoUrl: video || null,
                });
                finalImages    = res.images    || images;
                finalPrincipal = res.principal || finalPrincipal;
                if (res.updated_at) product.updated_at = res.updated_at;
            }

            const payload = {
                nombre: form.nombre, descripcion: form.descripcion,
                precio: form.precio !== '' ? parseFloat(String(form.precio).replace(/[^0-9]/g, '')) : null,
                precio_delivery: form.precio_delivery !== '' ? parseFloat(String(form.precio_delivery).replace(/[^0-9]/g, '')) : null,
                estado: form.estado,
                prioridad: form.prioridad !== '' ? parseInt(form.prioridad, 10) : 0,
                media_r2:     finalPrincipal,
                media_url:    finalPrincipal,
                media_images: finalImages,
                media_video:  video || '',
                currency: form.currency, codigo: form.codigo,
                category_ids: form.category_ids,
                restriccion: form.restriccion.length > 0 ? form.restriccion : null,
            };
            await onSave(product.id, payload);
            onClose();
        } catch (err) {
            setMsg({ type: 'error', text: `Error: ${err.message}` });
        } finally { setSaving(false); }
    };

    const handleSaveEspecial = async () => {
        if (!isEdit) return;
        setSavingEsp(true); setEspMsg(null);
        try {
            const payload = {
                special_price:          especial.special_price !== '' ? parseFloat(especial.special_price) : null,
                special_price_delivery: especial.special_price_delivery !== '' ? parseFloat(especial.special_price_delivery) : null,
                special_status:  especial.special_status,
                validity:        especial.validity,
                recurring_every: especial.validity === 'recurring'   ? especial.recurring_every : null,
                recurring_from:  especial.validity === 'recurring'   ? especial.recurring_from  : null,
                recurring_to:    especial.validity === 'recurring'   ? especial.recurring_to    : null,
                start_date:      especial.validity === 'date_range'  ? (especial.start_date || null) : null,
                end_date:        especial.validity === 'date_range'  ? (especial.end_date   || null) : null,
            };
            await cartaApi.updateProductEspecial({ token, account, productId: product.id, data: payload });
            setEspMsg({ type: 'success', text: '✓ Precio especial guardado' });
        } catch (err) {
            setEspMsg({ type: 'error', text: err.message });
        } finally { setSavingEsp(false); }
    };

    // Tab definitions
    const tabs = [
        { id: 'product', icon: Package, label: t('carta.tab_details', 'Producto') },
        ...(isEdit ? [
            { id: 'config', icon: Settings, label: 'Configuración' },
            { id: 'analytics', icon: PieChart, label: 'Análisis' },
        ] : []),
    ];

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="w-full sm:max-w-2xl bg-light-surface dark:bg-dark-surface sm:rounded-2xl rounded-t-3xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
            >
                {/* Mobile drag handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                    <div className="w-10 h-1 rounded-full bg-light-border dark:bg-dark-border" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/15 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">
                                {isEdit ? (product?.nombre || t('carta.product_modal_edit')) : t('carta.product_modal_new')}
                            </h2>
                            {isEdit && product?.codigo && (
                                <p className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">{product.codigo}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center hover:opacity-80 transition-opacity shrink-0">
                        <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="px-5 sm:px-6 pb-3 shrink-0">
                    <SegmentedControl tabs={tabs} active={activeTab} onChange={setActiveTab} />
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-4">
                    {/* Global alert */}
                    <AnimatePresence>
                        {msg && (
                            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium mb-4 ${
                                    msg.type === 'success'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                }`}>
                                {msg.type === 'success'
                                    ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                                <span className="flex-1 break-all">{msg.text}</span>
                                <button type="button" onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ═══ TAB: Producto ═══ */}
                    {activeTab === 'product' && (
                        <div className="space-y-3">
                            <Section title="Información" icon={Package} defaultOpen={true}>
                                <DetailsTab form={form} set={set} categories={categories} />
                            </Section>

                            <Section title={`Galería (${images.length}/4)`} icon={ImageIcon} defaultOpen={images.length > 0}>
                                <GalleryTab
                                    images={images} video={video} product={product} isEdit={isEdit}
                                    uploading={uploading} onUpload={handleImageUpload}
                                    onRemove={(i) => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                    onMove={(f, t) => setImages(prev => { const a = [...prev]; [a[f], a[t]] = [a[t], a[f]]; return a; })}
                                    onReorder={setImages}
                                    onVideoRemove={() => setVideo('')}
                                    onVideoSet={(url) => setVideo(url)}
                                    onVideoUpload={handleVideoUpload}
                                    token={token} account={account}
                                    onOpenAurora={onOpenAurora} onClose={onClose}
                                />
                            </Section>
                        </div>
                    )}

                    {/* ═══ TAB: Configuración ═══ */}
                    {activeTab === 'config' && isEdit && (
                        <div className="space-y-3">
                            <Section title="Modificadores" icon={ListFilter} defaultOpen={true}>
                                <ModifiersTab
                                    product={product} menuOptions={menuOptions} products={products}
                                    token={token} account={account}
                                />
                            </Section>

                            <Section title="Precio Especial" icon={Zap} defaultOpen={!!esp.special_status}
                                badge={esp.special_status ? '⚡ Activo' : null}>
                                <EspecialTab
                                    especial={especial} setEsp={setEsp}
                                    savingEsp={savingEsp} espMsg={espMsg} setEspMsg={setEspMsg}
                                    onSave={handleSaveEspecial} isEdit={isEdit}
                                />
                            </Section>
                        </div>
                    )}

                    {/* ═══ TAB: Análisis ═══ */}
                    {activeTab === 'analytics' && isEdit && (
                        <div className="space-y-3">
                            <Section title="Rentabilidad & Ventas" icon={BarChart2} defaultOpen={true}>
                                <MtzTab mtzData={mtzData} loading={loadingMtz} />
                            </Section>

                            <Section title="Tabla Nutricional" icon={Apple} defaultOpen={false}>
                                <NutritionTab
                                    product={product}
                                    token={token}
                                    account={account}
                                    mtzData={mtzData}
                                />
                            </Section>
                        </div>
                    )}
                </div>

                {/* Footer — only show save on product tab */}
                {activeTab === 'product' && (
                    <div className="flex gap-2 px-5 sm:px-6 py-3.5 border-t border-light-border dark:border-dark-border bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/10 shrink-0">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                            {t('carta.cancel')}
                        </button>
                        <button type="button" disabled={saving} onClick={handleSave}
                            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? t('carta.saving') : t('carta.save')}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default ProductModal;
