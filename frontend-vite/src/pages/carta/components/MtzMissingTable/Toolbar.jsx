import React from 'react';
import { Search, Filter, ArrowUpDown, X } from 'lucide-react';

/**
 * Toolbar: search input + familia select + sort select.
 */
const Toolbar = ({ search, setSearch, familiaFilter, setFamiliaFilter, sortBy, setSortBy, families, filteredCount, t }) => {
    const SORT_OPTS = [
        { value: 'total_vendido',   label: t('mtz.missing.sort_units') },
        { value: 'total_venta',     label: t('mtz.missing.sort_revenue') },
        { value: 'precio_sugerido', label: t('mtz.missing.sort_price') },
        { value: 'nombre',          label: t('mtz.missing.sort_name') },
    ];
    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                <input
                    type="text"
                    placeholder={t('mtz.missing.search_placeholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent placeholder:text-light-text-secondary/50 transition-shadow"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                        <X className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                )}
            </div>

            {/* Familia filter */}
            {families.length > 0 && (
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                    <select
                        value={familiaFilter}
                        onChange={e => setFamiliaFilter(e.target.value)}
                        className="pl-8 pr-8 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent appearance-none"
                    >
                        <option value="">{t('mtz.missing.all_families')}</option>
                        {families.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
            )}

            {/* Sort */}
            <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="pl-8 pr-8 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent appearance-none"
                >
                    {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium px-2">
                {filteredCount} {t('mtz.missing.results')}
            </div>
        </div>
    );
};

export default Toolbar;
