import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Globe, MapPin, Tag, Layers } from 'lucide-react';

const STATUS_FILTERS = ['all', 'active', 'inactive', 'scheduled'];
const TARGET_FILTERS = [
    { key: 'all',      icon: null },
    { key: 'global',   icon: Globe },
    { key: 'location', icon: MapPin },
    { key: 'category', icon: Layers },
    { key: 'dish',     icon: Tag },
];

const BannerFilters = ({
    filter, setFilter, search, setSearch,
    counts = {},
    locationFilter, setLocationFilter,
    targetFilter, setTargetFilter,
    locations = [],
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-2">
            {/* Row 1: Status + Search */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Status tabs */}
                <div className="flex bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl p-0.5">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5
                                ${filter === f
                                    ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                                }`}
                        >
                            {t(`banners.filter_${f}`)}
                            {counts[f] !== undefined && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold min-w-[18px] text-center
                                    ${filter === f
                                        ? 'bg-light-accent/15 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent'
                                        : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
                                    }`}
                                >
                                    {counts[f]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('banners.search_placeholder')}
                        className="pl-9 pr-4 py-2 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-sm outline-none border border-transparent focus:border-light-accent dark:focus:border-dark-accent transition text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/40 dark:placeholder:text-dark-text-secondary/40 w-52"
                    />
                </div>
            </div>

            {/* Row 2: Target type + Location */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Target type filter */}
                <div className="flex gap-1">
                    {TARGET_FILTERS.map(({ key, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setTargetFilter(key)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all border
                                ${targetFilter === key
                                    ? 'border-light-accent/40 dark:border-dark-accent/40 bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent'
                                    : 'border-transparent text-light-text-secondary/60 dark:text-dark-text-secondary/60 hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30'
                                }`}
                        >
                            {Icon && <Icon className="w-3 h-3" />}
                            {key === 'all' ? t('banners.filter_all') : t(`banners.targeting.type_${key}`)}
                        </button>
                    ))}
                </div>

                {/* Location filter */}
                {locations.length > 0 && (
                    <select
                        value={locationFilter || ''}
                        onChange={e => setLocationFilter(e.target.value || null)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-primary dark:text-dark-text-primary border border-light-border/30 dark:border-dark-border/30 outline-none focus:border-light-accent dark:focus:border-dark-accent transition cursor-pointer"
                    >
                        <option value="">{t('banners.all_locations')}</option>
                        {locations.map(l => (
                            <option key={l.id || l._id} value={String(l.id || l._id)}>
                                {l.nombre}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
};

export default BannerFilters;
