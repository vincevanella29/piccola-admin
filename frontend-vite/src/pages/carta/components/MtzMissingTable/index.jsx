/**
 * MtzMissingTable — productos MTZ sin carta digital
 *
 * Tabs:
 *   • Activos   — productos que aún se venden pero faltan en la carta
 *   • Inactivos — familias/productos marcados como "dados de baja"
 *                 Badge rojo si algún inactivo tiene ventas recientes.
 *
 * Agrupado por FAMILIA para visibilidad rápida.
 * Se puede marcar toda una familia (o productos individuales) como inactivo.
 * El estado de inactivos persiste en localStorage.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Search, Loader2, AlertCircle, BarChart2, EyeOff, Eye,
} from 'lucide-react';
import useCartaAdmin from '../../../../hooks/useCartaAdmin';
import { MONTH_LABEL, loadInactive, saveInactive } from './utils';
import SummaryCards from './SummaryCards';
import Toolbar from './Toolbar';
import FamilyGroup from './FamilyGroup';

// ── Tab button ─────────────────────────────────────────────────────────────────
const TabBtn = ({ id, active, onClick, label, badge, badgeRed = false }) => (
    <button
        onClick={() => onClick(id)}
        className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 mr-6 shrink-0 ${
            active
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}>
        {label}
        {badge > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                badgeRed
                    ? 'bg-red-500 text-white animate-pulse'
                    : active
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
            }`}>{badge}</span>
        )}
    </button>
);

// ── Main ────────────────────────────────────────────────────────────────────────
const MtzMissingTable = ({ appState, onCreateProduct }) => {
    const { t } = useTranslation();
    const { fetchMtzMissingProducts } = useCartaAdmin(appState);

    const [rawData, setRawData]    = useState({ missing_products: [], available_mesanos: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState(null);

    // Active/inactive tab
    const [activeTab, setActiveTab] = useState('active');

    // Filters
    const [search, setSearch]           = useState('');
    const [familiaFilter, setFamiliaFilter] = useState('');
    const [sortBy, setSortBy]           = useState('total_vendido');

    // Inactive codigos (persisted)
    const [inactiveCodigos, setInactiveCodigos] = useState(loadInactive);

    const toggleInactive = useCallback((codigo, makeInactive) => {
        setInactiveCodigos(prev => {
            const next = new Set(prev);
            if (makeInactive) next.add(codigo);
            else next.delete(codigo);
            saveInactive(next);
            return next;
        });
    }, []);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetchMtzMissingProducts()
            .then(res => setRawData({
                missing_products:  res?.missing_products  || [],
                available_mesanos: res?.available_mesanos || [],
            }))
            .catch(err => { console.error('[MtzMissingTable]', err); setError(t('mtz.missing.error')); })
            .finally(() => setIsLoading(false));
    }, [fetchMtzMissingProducts]); // eslint-disable-line react-hooks/exhaustive-deps

    const allProducts      = rawData.missing_products;
    const availableMesanos = rawData.available_mesanos;

    // Partition active / inactive
    const activeProducts   = useMemo(() => allProducts.filter(p => !inactiveCodigos.has(p.codigo)), [allProducts, inactiveCodigos]);
    const inactiveProducts = useMemo(() => allProducts.filter(p =>  inactiveCodigos.has(p.codigo)), [allProducts, inactiveCodigos]);

    // Inactive with sales → red badge
    const inactiveWithSales = useMemo(() =>
        inactiveProducts.filter(p => (p.total_vendido || 0) > 0).length,
    [inactiveProducts]);

    // Max qty for bar scaling (across visible set)
    const sourceProducts = activeTab === 'active' ? activeProducts : inactiveProducts;
    const maxQty = useMemo(() => Math.max(1, ...sourceProducts.map(p => p.total_vendido || 0)), [sourceProducts]);

    // Families for filter
    const families = useMemo(() => {
        const s = new Set(sourceProducts.map(p => p.familia).filter(Boolean));
        return Array.from(s).sort();
    }, [sourceProducts]);

    // Filtered + sorted
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return sourceProducts
            .filter(p => {
                const matchSearch = !q || p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
                    || p.familia?.toLowerCase().includes(q) || p.subfamilia?.toLowerCase().includes(q);
                const matchFamilia = !familiaFilter || p.familia === familiaFilter;
                return matchSearch && matchFamilia;
            })
            .sort((a, b) => {
                if (sortBy === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '');
                if (sortBy === 'precio_sugerido') return (b.precio_sugerido || 0) - (a.precio_sugerido || 0);
                if (sortBy === 'total_venta') return (b.total_venta || 0) - (a.total_venta || 0);
                return (b.total_vendido || 0) - (a.total_vendido || 0);
            });
    }, [sourceProducts, search, familiaFilter, sortBy]);

    // Group filtered by familia
    const grouped = useMemo(() => {
        const map = {};
        filtered.forEach(p => {
            const key = p.familia || t('mtz.missing.no_family');
            if (!map[key]) map[key] = [];
            map[key].push(p);
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered, t]);

    // ── Loading / Error ──────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex flex-col items-center py-28 gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('mtz.missing.loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center py-20 gap-3">
                <AlertCircle className="w-10 h-10 text-red-500 opacity-60" />
                <p className="text-sm text-red-500">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary — only active products */}
            <SummaryCards products={activeProducts} t={t} />

            {/* Tabs */}
            <div className="flex border-b border-light-border dark:border-dark-border overflow-x-auto">
                <TabBtn id="active"   active={activeTab === 'active'}   onClick={setActiveTab}
                    label={t('mtz.missing.tab_active', { count: activeProducts.length })} badge={activeProducts.length} />
                <TabBtn id="inactive" active={activeTab === 'inactive'} onClick={setActiveTab}
                    label={t('mtz.missing.tab_inactive', { count: inactiveProducts.length })}
                    badge={inactiveProducts.length}
                    badgeRed={inactiveWithSales > 0} />
            </div>

            {/* Inactive explanation */}
            {activeTab === 'inactive' && (
                <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-xs ${
                    inactiveWithSales > 0
                        ? 'bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-800/30 text-red-600 dark:text-red-400'
                        : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/20 border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary'
                }`}>
                    {inactiveWithSales > 0
                        ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                        : <EyeOff className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>
                        {inactiveWithSales > 0
                            ? t('mtz.missing.inactive_warning', { count: inactiveWithSales })
                            : t('mtz.missing.inactive_desc')}
                    </span>
                </div>
            )}

            {/* Toolbar */}
            <Toolbar
                search={search} setSearch={setSearch}
                familiaFilter={familiaFilter} setFamiliaFilter={setFamiliaFilter}
                sortBy={sortBy} setSortBy={setSortBy}
                families={families} filteredCount={filtered.length} t={t}
            />

            {/* Groups by familia */}
            {grouped.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-light-text-secondary dark:text-dark-text-secondary">
                    <AlertCircle className="w-10 h-10 opacity-30 text-amber-500" />
                    <p className="text-sm">{t('mtz.missing.empty')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {grouped.map(([familia, prods]) => (
                        <FamilyGroup
                            key={familia}
                            familia={familia}
                            products={prods}
                            availableMesanos={availableMesanos}
                            maxQty={maxQty}
                            inactiveCodigos={inactiveCodigos}
                            onToggleInactive={toggleInactive}
                            onCreateProduct={activeTab === 'active' ? onCreateProduct : null}
                            t={t}
                        />
                    ))}
                </div>
            )}

            {/* Legend */}
            {availableMesanos.length > 0 && (
                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1.5">
                    <BarChart2 className="w-3 h-3 shrink-0" />
                    {t('mtz.missing.legend', { months: availableMesanos.slice(0, 3).map(MONTH_LABEL).join(', ') })}
                </p>
            )}
        </div>
    );
};

export default MtzMissingTable;
