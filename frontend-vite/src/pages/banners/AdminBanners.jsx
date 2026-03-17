import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Plus, Trash2, Edit2, Save, X, MapPin, Globe, Loader2, Tag } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import useBannersAdmin from '../../hooks/useBannersAdmin';
import usePromotionsData from '../../hooks/usePromotionsData';
import { triggerBannersSync } from '../../utils/cartaData';


const AdminBanners = ({ appState }) => {
    const { t } = useTranslation();
    const {
        banners,
        isLoading: bannersLoading,
        error: bannersError,
        refreshBanners,
        create,
        update,
        remove,
        uploadImage
    } = useBannersAdmin(appState, t);

    const {
        locations,
        menus,
        categories,
        isLoading: dataLoading
    } = usePromotionsData(appState);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [syncState, setSyncState] = useState('idle'); // idle | loading | ok | error

    const [form, setForm] = useState({
        title: '',
        image_url: '',
        click_url: '',
        target_type: 'global',
        target_ids: [],
        active: true,
        priority: 0,
        popup_duration_seconds: 0,
        display_delay_seconds: 0
    });

    useEffect(() => {
        refreshBanners();
    }, [refreshBanners]);

    const resetForm = () => {
        setForm({
            title: '',
            image_url: '',
            click_url: '',
            target_type: 'global',
            target_ids: [],
            active: true,
            priority: 0,
            popup_duration_seconds: 0,
            display_delay_seconds: 0
        });
        setEditingBanner(null);
    };

    const handleEdit = (banner) => {
        setEditingBanner(banner);
        setForm({
            title: banner.title,
            image_url: banner.image_url,
            click_url: banner.click_url || '',
            target_type: banner.target_type,
            target_ids: banner.target_ids || [],
            active: banner.active,
            priority: banner.priority || 0,
            popup_duration_seconds: banner.popup_duration_seconds || 0,
            display_delay_seconds: banner.display_delay_seconds || 0
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingBanner) {
                await update(editingBanner.id, form);
            } else {
                await create(form);
            }
            setIsModalOpen(false);
            resetForm();
        } catch (err) {
            console.error("Error saving banner:", err);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadImage(file);
            setForm(prev => ({ ...prev, image_url: url }));
        } catch (err) {
            alert(`${t('banners.error_upload')}: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleSync = async () => {
        if (syncState === 'loading') return;
        setSyncState('loading');
        try {
            await triggerBannersSync({
                token: appState?.token,
                account: appState?.account,
            });
            setSyncState('ok');
        } catch {
            setSyncState('error');
        } finally {
            setTimeout(() => setSyncState('idle'), 3000);
        }
    };

    const getProductCode = (menu) => menu?.codigo || menu?.id || menu?._id || '';

    const locationOptions = useMemo(() =>
        locations.map(l => ({ value: String(l.id || l._id), label: l.nombre })),
        [locations]);

    const dishOptions = useMemo(() =>
        menus.map(m => ({ value: String(getProductCode(m)), label: m.nombre })),
        [menus]);

    const categoryOptions = useMemo(() =>
        categories.map(c => ({ value: String(c.id || c._id), label: c.nombre })),
        [categories]);

    const targetOptions = useMemo(() => {
        if (form.target_type === 'location') return locationOptions;
        if (form.target_type === 'dish') return dishOptions;
        if (form.target_type === 'category') return categoryOptions;
        return [];
    }, [form.target_type, locationOptions, dishOptions, categoryOptions]);

    const targetTypeOptions = [
        { value: 'global', label: t('banners.target_global') },
        { value: 'location', label: t('banners.target_location') },
        { value: 'category', label: t('banners.target_category') },
        { value: 'dish', label: t('banners.target_dish') },
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
                        <ImageIcon className="text-matrix-green" size={32} />
                        {t('banners.title')}
                    </h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mt-1">
                        {t('banners.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Sync web button */}
                    <button
                        onClick={handleSync}
                        disabled={syncState === 'loading'}
                        title="Sincronizar banners con la carta digital"
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm
                            ${
                                syncState === 'ok'
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                                    : syncState === 'error'
                                    ? 'bg-red-500/10 border-red-500 text-red-500'
                                    : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:border-light-accent dark:hover:border-dark-accent'
                            }`}
                    >
                        <Globe className={`w-4 h-4 ${syncState === 'loading' ? 'animate-spin' : ''}`} />
                        {syncState === 'loading' ? 'Sincronizando…' : syncState === 'ok' ? '¡Listo!' : syncState === 'error' ? 'Error' : 'Sync web'}
                    </button>

                    {/* New banner button */}
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-matrix-green text-white rounded-xl font-bold shadow-neon hover:scale-105 transition-transform"
                    >
                        <Plus size={20} /> {t('banners.new')}
                    </button>
                </div>
            </div>

            {bannersLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-matrix-green" size={48} />
                    <p className="text-light-text-secondary animate-pulse">{t('banners.loading')}</p>
                </div>
            ) : banners.length === 0 ? (
                <div className="text-center py-20 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-3xl border-2 border-dashed border-light-border dark:border-dark-border">
                    <ImageIcon className="mx-auto text-light-text-secondary dark:text-dark-text-secondary mb-4" size={64} />
                    <h3 className="text-xl font-bold">{t('banners.none_title')}</h3>
                    <p className="text-light-text-secondary mt-2">{t('banners.none_desc')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {banners.map(banner => (
                        <div
                            key={banner.id}
                            className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden group hover:shadow-xl transition-all"
                        >
                            <div className="relative h-40 overflow-hidden bg-black/5 flex items-center justify-center">
                                <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute top-2 left-2 flex gap-2">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${banner.active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {banner.active ? t('banners.active') : t('banners.inactive')}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg">{banner.title}</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(banner)} className="p-2 hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 rounded-lg transition-colors text-light-text-secondary">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => { if (confirm('¿Seguro?')) remove(banner.id); }} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-light-text-secondary">
                                    <span className="flex items-center gap-1">
                                        {banner.target_type === 'global' && <Globe size={14} />}
                                        {banner.target_type === 'location' && <MapPin size={14} />}
                                        {banner.target_type === 'dish' && <Tag size={14} />}
                                        <span className="capitalize">{banner.target_type}</span>
                                    </span>
                                    <span>{t('banners.priority_label', { value: banner.priority })}</span>
                                    {banner.display_delay_seconds > 0 && (
                                        <span className="text-matrix-green">{t('banners.delay_label', { value: banner.display_delay_seconds })}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-light-surface dark:bg-dark-surface w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-light-border dark:border-dark-border"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="px-6 py-4 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                                <h2 className="text-xl font-bold">{editingBanner ? t('banners.modal_edit') : t('banners.modal_new')}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary">
                                    <X />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold">{t('banners.field_title')}</label>
                                        <input
                                            required
                                            className="w-full px-4 py-2 rounded-xl border bg-transparent border-light-border dark:border-dark-border focus:ring-2 focus:ring-matrix-green outline-none"
                                            value={form.title}
                                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                            placeholder="Ej: Promo Pizza Familiar"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">{t('banners.field_image')}</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border overflow-hidden flex items-center justify-center bg-black/5 group relative">
                                            {form.image_url ? (
                                                <img src={form.image_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="text-light-text-secondary" />
                                            )}
                                            {uploading && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <Loader2 className="animate-spin text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                id="banner-upload"
                                            />
                                            <label
                                                htmlFor="banner-upload"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg cursor-pointer hover:bg-light-text-primary hover:text-white transition-colors text-sm font-bold"
                                            >
                                                {form.image_url ? t('banners.image_change') : t('banners.image_upload')}
                                            </label>
                                            <p className="text-[10px] text-light-text-secondary mt-1">{t('banners.image_hint')}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold">{t('banners.field_target_type')}</label>
                                        <CustomSelect
                                            options={targetTypeOptions}
                                            value={targetTypeOptions.find(o => o.value === form.target_type)}
                                            onChange={selected => setForm(p => ({ ...p, target_type: selected.value, target_ids: [] }))}
                                            placeholder={t('banners.select_placeholder')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold">{t('banners.field_priority')}</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 rounded-xl border bg-transparent border-light-border dark:border-dark-border outline-none"
                                            value={form.priority}
                                            onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold flex items-center gap-2">
                                            {t('banners.field_popup_duration')}
                                            <span className="text-[10px] font-normal text-light-text-secondary">{t('banners.popup_manual_hint')}</span>
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 rounded-xl border bg-transparent border-light-border dark:border-dark-border outline-none"
                                            value={form.popup_duration_seconds}
                                            onChange={e => setForm(p => ({ ...p, popup_duration_seconds: parseInt(e.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold flex items-center gap-2">
                                            {t('banners.field_delay')}
                                            <span className="text-[10px] font-normal text-light-text-secondary">{t('banners.delay_hint')}</span>
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 rounded-xl border bg-transparent border-light-border dark:border-dark-border outline-none"
                                            value={form.display_delay_seconds}
                                            onChange={e => setForm(p => ({ ...p, display_delay_seconds: parseInt(e.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>

                                {form.target_type !== 'global' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold">
                                            {form.target_type === 'location' ? t('banners.target_location_label') :
                                                form.target_type === 'category' ? t('banners.target_category_label') :
                                                    t('banners.target_dish_label')}
                                        </label>
                                        <CustomSelect
                                            isMulti
                                            isLoading={dataLoading}
                                            options={targetOptions}
                                            value={targetOptions.filter(o => form.target_ids.includes(o.value))}
                                            onChange={selected => setForm(p => ({ ...p, target_ids: selected ? selected.map(o => o.value) : [] }))}
                                            placeholder={t('banners.select_placeholder')}
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">{t('banners.field_click_url')}</label>
                                    <input
                                        className="w-full px-4 py-2 rounded-xl border bg-transparent border-light-border dark:border-dark-border outline-none"
                                        value={form.click_url}
                                        onChange={e => setForm(p => ({ ...p, click_url: e.target.value }))}
                                        placeholder="Ej: /app/menus/123"
                                    />
                                    <p className="text-[10px] text-light-text-secondary italic">{t('banners.click_url_hint')}</p>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="is-active"
                                        checked={form.active}
                                        onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                                        className="w-5 h-5 accent-matrix-green"
                                    />
                                    <label htmlFor="is-active" className="text-sm font-bold cursor-pointer">{t('banners.field_active')}</label>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={bannersLoading || !form.image_url || !form.title}
                                        className="flex-1 py-3 bg-matrix-green text-white rounded-xl font-bold shadow-neon disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {bannersLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                        {editingBanner ? t('banners.save') : t('banners.create')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-3 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl font-bold"
                                    >
                                        {t('banners.cancel')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminBanners;

export const pageMetadata = {
    path: '/app/marketing/banners',
    label: 'banners.label',
    category: 'admin.category',
    minRoleLevel: 3,
    maxRoleLevel: 5,
    order: 5,
    locations: ['sidebar'],
    description: 'banners.description',
    icon: 'FaImage',
};
