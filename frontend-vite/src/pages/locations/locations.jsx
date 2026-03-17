import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapPin, RefreshCw, Search, Filter, X, Building2, Globe } from 'lucide-react';
import useRestaurantData from '../../hooks/useRestaurantData';
import LocationCard from './components/LocationCard';
import LocationModal from './components/LocationModal';
import { triggerPublicSync } from '../../utils/cartaData';

const Locations = ({ appState }) => {
    const { t } = useTranslation();
    const { locations, isLoading, error, refresh } = useRestaurantData(appState);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [search, setSearch] = useState('');
    const [communeFilter, setCommuneFilter] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [syncState, setSyncState] = useState('idle'); // idle | loading | ok | error

    // All unique communes for the filter
    const communes = useMemo(() => {
        if (!Array.isArray(locations)) return [];
        const s = new Set(locations.map(l => l.commune || l.city || l.state).filter(Boolean));
        return Array.from(s).sort();
    }, [locations]);

    const filtered = useMemo(() => {
        if (!Array.isArray(locations)) return [];
        const q = search.trim().toLowerCase();
        return locations.filter(l => {
            const matchSearch = !q || [l.nombre, l.direccion, l.commune, l.city, l.state, l.telephone]
                .filter(Boolean)
                .some(v => String(v).toLowerCase().includes(q));
            const matchCommune = !communeFilter
                || (l.commune || l.city || l.state) === communeFilter;
            return matchSearch && matchCommune;
        });
    }, [locations, search, communeFilter]);

    // Group by commune for display
    const grouped = useMemo(() => {
        if (communeFilter) {
            // Single commune selected — just return flat
            return [{ commune: communeFilter, items: filtered }];
        }

        if (!search) {
            // Group by commune
            const map = new Map();
            for (const loc of filtered) {
                const c = loc.commune || loc.city || loc.state || 'Sin Comuna';
                if (!map.has(c)) map.set(c, []);
                map.get(c).push(loc);
            }
            return Array.from(map.entries())
                .sort(([a], [b]) => (a === 'Sin Comuna' ? 1 : b === 'Sin Comuna' ? -1 : a.localeCompare(b)))
                .map(([commune, items]) => ({ commune, items }));
        }

        // When searching — flat
        return [{ commune: null, items: filtered }];
    }, [filtered, communeFilter, search]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refresh();
        setIsRefreshing(false);
    };

    const handleSync = async () => {
        if (syncState === 'loading') return;
        setSyncState('loading');
        try {
            await triggerPublicSync({
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

    return (
        <div className="relative min-h-screen bg-transparent">
            <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-12">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="text-3xl sm:text-4xl font-bold font-futurist text-light-text-primary dark:text-dark-text-primary tracking-tight"
                        >
                            {t('location.adminTitle', { base: t('club.locations') })}
                        </motion.h1>
                        {!isLoading && !error && (
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                {locations.length} locales · {communes.length} comunas
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Sync web button */}
                        <button
                            onClick={handleSync}
                            disabled={syncState === 'loading'}
                            title="Sincronizar datos con la carta digital"
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

                        {/* Refresh from DB */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:border-light-accent dark:hover:border-dark-accent transition-all shadow-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Actualizando…' : 'Actualizar'}
                        </button>
                    </div>
                </div>

                {/* Search + Commune Filter toolbar */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, dirección, teléfono…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-shadow shadow-sm"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100">
                                <X className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                            </button>
                        )}
                    </div>

                    {/* Commune filter — only if there are communes */}
                    {communes.length > 1 && (
                        <div className="relative">
                            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                            <select
                                value={communeFilter}
                                onChange={e => setCommuneFilter(e.target.value)}
                                className="pl-9 pr-8 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent appearance-none transition-shadow shadow-sm"
                            >
                                <option value="">Todas las comunas</option>
                                {communes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Active commune chips */}
                    {communeFilter && (
                        <button
                            onClick={() => setCommuneFilter('')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-sm font-semibold hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors"
                        >
                            <MapPin className="w-3.5 h-3.5" />
                            {communeFilter}
                            <X className="w-3 h-3 opacity-60" />
                        </button>
                    )}

                    {/* Result count */}
                    <div className="flex items-center text-xs text-light-text-secondary dark:text-dark-text-secondary px-1">
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* States */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-64 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                )}

                {error && !isLoading && (
                    <div className="flex flex-col items-center py-20 gap-4">
                        <Building2 className="w-12 h-12 text-light-error dark:text-dark-error opacity-40" />
                        <p className="text-light-error dark:text-dark-error text-sm">{error}</p>
                        <button onClick={handleRefresh} className="px-4 py-2 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold">
                            Reintentar
                        </button>
                    </div>
                )}

                {!isLoading && !error && filtered.length === 0 && (
                    <div className="flex flex-col items-center py-20 gap-3 text-light-text-secondary dark:text-dark-text-secondary">
                        <MapPin className="w-10 h-10 opacity-30" />
                        <p className="text-sm">No hay locales para este filtro.</p>
                    </div>
                )}

                {/* Grouped results */}
                {!isLoading && !error && filtered.length > 0 && (
                    <div className="space-y-10">
                        {grouped.map(({ commune, items }) => (
                            <div key={commune ?? '__all__'}>
                                {commune && !communeFilter && (
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-light-accent dark:text-dark-accent shrink-0" />
                                            <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
                                                {commune}
                                            </h2>
                                            <span className="px-2 py-0.5 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary text-xs font-semibold">
                                                {items.length}
                                            </span>
                                        </div>
                                        <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
                                    </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {items.map((location, idx) => (
                                        <LocationCard
                                            key={location._id || location.id}
                                            location={location}
                                            index={idx}
                                            onEdit={() => setSelectedLocation(location)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <LocationModal
                    location={selectedLocation}
                    isOpen={!!selectedLocation}
                    onClose={() => setSelectedLocation(null)}
                    appState={appState}
                />
            </div>
        </div>
    );
};

export default Locations;

export const pageMetadata = {
    path: '/app/analytics/locations',
    label: 'club.locations',
    category: 'analytics.Análisis',
    minRoleLevel: 3,
    maxRoleLevel: 4,
    order: 3,
    locations: ['sidebar', 'header'],
    description: 'location.description',
    icon: 'FaMapMarkerAlt',
    isMainPage: false,
    isSearchable: true,
};
