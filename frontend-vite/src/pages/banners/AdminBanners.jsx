import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Plus, Globe, Loader2, Link2, MapPin, Settings, Shield } from 'lucide-react';
import useBannersAdmin from '../../hooks/useBannersAdmin';
import usePromotionsData from '../../hooks/usePromotionsData';
import useCartaAdmin from '../../hooks/useCartaAdmin';
import { triggerBannersSync } from '../../utils/cartaData';
import BannerCard from './components/BannerCard';
import BannerModal from './components/BannerModal';
import BannerFilters from './components/BannerFilters';
import NavigationLinksManager from './components/NavigationLinksManager';
import LocationButtonsManager from '../carta/components/LocationButtonsManager';
import CartaProviderManager from './components/CartaProviderManager';

// ── Tab Component ────────────────────────────────────────────────────────────
const ConfigTab = ({ id, active, onClick, icon: Icon, label, count }) => (
    <button
        onClick={() => onClick(id)}
        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            active
                ? 'text-light-text-primary dark:text-dark-text-primary bg-white dark:bg-dark-surface shadow-sm'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}
    >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        {count != null && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                active
                    ? 'bg-light-accent/10 dark:bg-dark-accent/20 text-light-accent dark:text-dark-accent'
                    : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
            }`}>{count}</span>
        )}
    </button>
);

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════

const CartaConfig = ({ appState }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('banners');

    // ── Banners ──────────────────────────────────────────────────────────────
    const {
        banners, isLoading, error, refreshBanners,
        create, update, remove, uploadImage,
    } = useBannersAdmin(appState, t);

    const { locations, menus, categories, isLoading: dataLoading } = usePromotionsData(appState);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [syncState, setSyncState] = useState('idle');
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [targetFilter, setTargetFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState(null);

    useEffect(() => { refreshBanners(); }, [refreshBanners]);

    // ── Location Buttons (reuse from CartaAdmin) ─────────────────────────────
    const {
        locations: cartaLocations,
        categories: cartaCategories,
        isLoading: cartaLoading,
        fetchLocations: cartaFetchLocations,
        updateLocationButtons,
    } = useCartaAdmin(appState);

    // ── Filters ──────────────────────────────────────────────────────────────
    const counts = useMemo(() => {
        const all = banners.length;
        const active = banners.filter(b => b.active).length;
        const inactive = banners.filter(b => !b.active).length;
        const scheduled = banners.filter(b => !!(b.schedule_start || b.schedule_end || b.schedule_days?.length)).length;
        return { all, active, inactive, scheduled };
    }, [banners]);

    const filtered = useMemo(() => {
        let list = banners;
        if (filter === 'active') list = list.filter(b => b.active);
        if (filter === 'inactive') list = list.filter(b => !b.active);
        if (filter === 'scheduled') list = list.filter(b => !!(b.schedule_start || b.schedule_end || b.schedule_days?.length));
        if (targetFilter !== 'all') list = list.filter(b => b.target_type === targetFilter);
        if (locationFilter) list = list.filter(b => (b.location_ids || []).includes(locationFilter));
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(b => (b.title || '').toLowerCase().includes(q));
        }
        return list;
    }, [banners, filter, search, targetFilter, locationFilter]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleEdit = (banner) => {
        setEditingBanner(banner);
        setIsModalOpen(true);
    };

    const handleSave = async (form, id) => {
        try {
            if (id) await update(id, form);
            else await create(form);
            setIsModalOpen(false);
            setEditingBanner(null);
        } catch (err) {
            console.error('Error saving banner:', err);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            return await uploadImage(file);
        } catch (err) {
            alert(`${t('banners.error_upload')}: ${err.message}`);
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleSync = async () => {
        if (syncState === 'loading') return;
        setSyncState('loading');
        try {
            await triggerBannersSync({ token: appState?.token, account: appState?.account });
            setSyncState('ok');
        } catch { setSyncState('error'); }
        finally { setTimeout(() => setSyncState('idle'), 3000); }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2.5">
                        <Settings className="text-light-accent dark:text-dark-accent" size={26} />
                        {t('carta_config.title', 'Configuración Carta')}
                    </h1>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                        {t('carta_config.subtitle', 'Banners, links de navegación y botones por sucursal')}
                    </p>
                </div>

                {/* Actions — context sensitive */}
                {activeTab === 'banners' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSync}
                            disabled={syncState === 'loading'}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm
                                ${syncState === 'ok'
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                                    : syncState === 'error'
                                    ? 'bg-red-500/10 border-red-500 text-red-500'
                                    : 'bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-light-accent dark:hover:border-dark-accent'
                                }`}
                        >
                            <Globe className={`w-4 h-4 ${syncState === 'loading' ? 'animate-spin' : ''}`} />
                            {syncState === 'loading' ? t('banners.syncing') : syncState === 'ok' ? t('banners.synced') : syncState === 'error' ? t('banners.sync_error') : t('banners.sync')}
                        </button>
                        <button
                            onClick={() => { setEditingBanner(null); setIsModalOpen(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-matrix-green text-white rounded-xl font-bold shadow-neon hover:scale-105 transition-transform"
                        >
                            <Plus size={18} /> {t('banners.new')}
                        </button>
                    </div>
                )}
            </div>

            {/* Tab Bar */}
            <div className="mb-6 flex items-center gap-1 p-1 rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/30 w-fit">
                <ConfigTab
                    id="banners"
                    active={activeTab === 'banners'}
                    onClick={setActiveTab}
                    icon={ImageIcon}
                    label={t('carta_config.tab_banners', 'Banners')}
                    count={banners.length}
                />
                <ConfigTab
                    id="navigation"
                    active={activeTab === 'navigation'}
                    onClick={setActiveTab}
                    icon={Link2}
                    label={t('carta_config.tab_navigation', 'Navigation Links')}
                />
                <ConfigTab
                    id="buttons"
                    active={activeTab === 'buttons'}
                    onClick={setActiveTab}
                    icon={MapPin}
                    label={t('carta_config.tab_buttons', 'Botones Sucursal')}
                />
                <ConfigTab
                    id="provider"
                    active={activeTab === 'provider'}
                    onClick={setActiveTab}
                    icon={Shield}
                    label={t('carta_config.tab_provider', 'Conexión')}
                />
            </div>

            {/* ═══ Tab: Banners ═══ */}
            {activeTab === 'banners' && (
                <>
                    <div className="mb-6">
                        <BannerFilters
                            filter={filter} setFilter={setFilter}
                            search={search} setSearch={setSearch}
                            counts={counts}
                            targetFilter={targetFilter} setTargetFilter={setTargetFilter}
                            locationFilter={locationFilter} setLocationFilter={setLocationFilter}
                            locations={locations}
                        />
                    </div>

                    {isLoading && !banners.length ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-light-accent dark:text-dark-accent" size={40} />
                            <p className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm">{t('banners.loading')}</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 rounded-3xl border-2 border-dashed border-light-border dark:border-dark-border">
                            <ImageIcon className="mx-auto text-light-text-secondary dark:text-dark-text-secondary mb-4 opacity-30" size={56} />
                            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">{t('banners.none_title')}</h3>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('banners.none_desc')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filtered.map((banner, idx) => (
                                <BannerCard
                                    key={banner.id}
                                    banner={banner}
                                    index={idx}
                                    onEdit={handleEdit}
                                    onDelete={(id) => remove(id)}
                                    locations={locations}
                                />
                            ))}
                        </div>
                    )}

                    <BannerModal
                        isOpen={isModalOpen}
                        onClose={() => { setIsModalOpen(false); setEditingBanner(null); }}
                        editingBanner={editingBanner}
                        onSave={handleSave}
                        isLoading={isLoading}
                        uploading={uploading}
                        onImageUpload={async (e) => {
                            const url = await handleImageUpload(e);
                            return url;
                        }}
                        locations={locations}
                        categories={categories}
                        menus={menus}
                        appState={appState}
                    />
                </>
            )}

            {/* ═══ Tab: Navigation Links ═══ */}
            {activeTab === 'navigation' && (
                <NavigationLinksManager appState={appState} />
            )}

            {/* ═══ Tab: Location Buttons ═══ */}
            {activeTab === 'buttons' && (
                <LocationButtonsManager
                    locations={cartaLocations}
                    fetchLocations={cartaFetchLocations}
                    updateButtons={updateLocationButtons}
                    categories={cartaCategories}
                    isLoading={cartaLoading}
                />
            )}

            {/* ═══ Tab: Provider Connection ═══ */}
            {activeTab === 'provider' && (
                <CartaProviderManager appState={appState} />
            )}
        </div>
    );
};

export default CartaConfig;

export const pageMetadata = {
    path: '/app/carta-config',
    label: 'carta_config.label',
    category: 'carta.category',
    minRoleLevel: 3,
    maxRoleLevel: 5,
    order: 6,
    locations: ['sidebar'],
    description: 'carta_config.description',
    icon: 'FaCog',
};
