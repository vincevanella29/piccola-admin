import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Loader2, Image as ImageIcon, Megaphone } from 'lucide-react';
import BannerContentTab from './banner-modal/BannerContentTab';
import BannerDistributionTab from './banner-modal/BannerDistributionTab';
import PhonePreview from './banner-modal/PhonePreview';

const TABS = [
    { key: 'content',      icon: ImageIcon },
    { key: 'distribution', icon: Megaphone },
];

const INITIAL_FORM = {
    title: '', description: '', image_url: '', click_url: '',
    target_type: 'global', target_ids: [], location_ids: [],
    active: true, priority: 0,
    popup_duration_seconds: 0, display_delay_seconds: 0,
    image_size: '3:1',
    display_devices: ['mobile', 'desktop'],
    button_config: { visible: false, text: '', position: 'bottom-right', style: 'solid', color: '#22c55e', text_color: '#ffffff' },
    schedule_start: null, schedule_end: null,
    schedule_days: null, schedule_time_from: null, schedule_time_to: null,
};

const BannerModal = ({
    isOpen, onClose, editingBanner,
    onSave, isLoading, uploading,
    onImageUpload,
    locations, categories, menus,
    appState,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('content');
    const [form, setForm] = useState(INITIAL_FORM);

    React.useEffect(() => {
        if (editingBanner) {
            setForm({
                title: editingBanner.title || '',
                description: editingBanner.description || '',
                image_url: editingBanner.image_url || '',
                click_url: editingBanner.click_url || '',
                target_type: editingBanner.target_type || 'global',
                target_ids: editingBanner.target_ids || [],
                location_ids: editingBanner.location_ids || [],
                active: editingBanner.active !== false,
                priority: editingBanner.priority || 0,
                popup_duration_seconds: editingBanner.popup_duration_seconds || 0,
                display_delay_seconds: editingBanner.display_delay_seconds || 0,
                image_size: editingBanner.image_size || '3:1',
                display_devices: editingBanner.display_devices || ['mobile', 'desktop'],
                button_config: editingBanner.button_config || INITIAL_FORM.button_config,
                schedule_start: editingBanner.schedule_start || null,
                schedule_end: editingBanner.schedule_end || null,
                schedule_days: editingBanner.schedule_days || null,
                schedule_time_from: editingBanner.schedule_time_from || null,
                schedule_time_to: editingBanner.schedule_time_to || null,
            });
        } else {
            setForm(INITIAL_FORM);
        }
        setActiveTab('content');
    }, [editingBanner, isOpen]);

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        onSave(form, editingBanner?.id);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-light-surface dark:bg-dark-surface w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-light-border dark:border-dark-border max-h-[90vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-light-border/50 dark:border-dark-border/50 flex justify-between items-center shrink-0">
                        <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                            {editingBanner ? t('banners.modal_edit') : t('banners.modal_new')}
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* 2 Tabs */}
                    <div className="flex border-b border-light-border/30 dark:border-dark-border/30 px-6 shrink-0">
                        {TABS.map(({ key, icon: Icon }) => (
                            <button
                                key={key} type="button"
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold transition-all border-b-2 -mb-[1px]
                                    ${activeTab === key
                                        ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                                        : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {t(`banners.tabs.${key}`)}
                            </button>
                        ))}
                    </div>

                    {/* Tab content + Phone Preview */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex gap-6 p-6">
                            {/* Main form area */}
                            <form onSubmit={handleSubmit} className="flex-1 min-w-0">
                                {activeTab === 'content' && (
                                    <BannerContentTab
                                        form={form} setForm={setForm}
                                        uploading={uploading}
                                        onImageUpload={async (e) => {
                                            const url = await onImageUpload(e);
                                            if (url) setForm(p => ({ ...p, image_url: url }));
                                        }}
                                        appState={appState}
                                        menus={menus}
                                    />
                                )}
                                {activeTab === 'distribution' && (
                                    <BannerDistributionTab
                                        form={form} setForm={setForm}
                                        locations={locations} categories={categories} menus={menus}
                                    />
                                )}
                            </form>

                            {/* Phone Preview — sticky sidebar */}
                            <div className="hidden md:flex flex-col shrink-0 sticky top-0 self-start pt-2">
                                <PhonePreview form={form} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-light-border/30 dark:border-dark-border/30 flex gap-3 shrink-0">
                        <button
                            type="button" onClick={handleSubmit}
                            disabled={isLoading || !form.image_url || !form.title}
                            className="flex-1 py-3 bg-matrix-green text-white rounded-xl font-bold shadow-neon disabled:opacity-40 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {editingBanner ? t('banners.save') : t('banners.create')}
                        </button>
                        <button
                            type="button" onClick={onClose}
                            className="px-6 py-3 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                        >
                            {t('banners.cancel')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BannerModal;
