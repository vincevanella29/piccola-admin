import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, EyeOff, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';
import { CLP, NUM, MONTH_LABEL } from './utils';
import SalesBar from './SalesBar';

/**
 * Expandable family group showing all products within the family.
 * Each family can be marked "inactive" to filter those products to the inactive tab.
 */
const FamilyGroup = ({ familia, products, availableMesanos, maxQty, inactiveCodigos, onToggleInactive, onCreateProduct, t }) => {
    const [expanded, setExpanded] = useState(true);

    const familyInactive = products.every(p => inactiveCodigos.has(p.codigo));
    const anyInactive    = products.some(p => inactiveCodigos.has(p.codigo));
    const totalUnits     = products.reduce((a, p) => a + (p.total_vendido || 0), 0);
    const totalRev       = products.reduce((a, p) => a + (p.total_venta  || 0), 0);

    const toggleEntireFamily = () => {
        products.forEach(p => onToggleInactive(p.codigo, !familyInactive));
    };

    return (
        <div className={`rounded-2xl border overflow-hidden transition-colors ${
            familyInactive
                ? 'border-light-border/40 dark:border-dark-border/30 opacity-60'
                : 'border-light-border dark:border-dark-border'
        } bg-light-surface dark:bg-dark-surface`}>

            {/* Family header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/20 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}>
                <div className="text-light-text-secondary dark:text-dark-text-secondary shrink-0">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${familyInactive ? 'line-through text-light-text-secondary dark:text-dark-text-secondary' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                        {familia}
                    </p>
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                        {products.length} {t('mtz.missing.products')} · {NUM(totalUnits)} un. · {CLP(totalRev)}
                    </p>
                </div>
                {/* Mark entire family inactive */}
                <button type="button"
                    onClick={e => { e.stopPropagation(); toggleEntireFamily(); }}
                    title={familyInactive ? t('mtz.missing.activate_family') : t('mtz.missing.deactivate_family')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                        familyInactive
                            ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-300/50 dark:border-amber-700/30'
                            : 'text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border hover:border-red-300 dark:hover:border-red-700/40 hover:text-red-500'
                    }`}>
                    <EyeOff className="w-3 h-3" />
                    {familyInactive ? t('mtz.missing.inactive') : t('mtz.missing.deactivate')}
                </button>
            </div>

            {/* Products */}
            <AnimatePresence initial={false}>
            {expanded && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <tbody>
                                {products.map((p, idx) => {
                                    const isInactive = inactiveCodigos.has(p.codigo);
                                    return (
                                        <motion.tr key={p.codigo}
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            transition={{ delay: Math.min(idx * 0.01, 0.3) }}
                                            className={`border-t border-light-border/30 dark:border-dark-border/30 group transition-colors ${
                                                isInactive
                                                    ? 'opacity-50 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/10'
                                                    : 'hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/10'
                                            }`}>
                                            {/* Código */}
                                            <td className="px-4 py-2.5 font-mono font-semibold text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap w-24">
                                                {p.codigo}
                                            </td>
                                            {/* Nombre */}
                                            <td className="px-3 py-2.5 max-w-[200px]">
                                                <div className={`font-semibold leading-tight truncate ${isInactive ? 'line-through text-light-text-secondary dark:text-dark-text-secondary' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                                                    {p.nombre}
                                                </div>
                                                {p.subfamilia && (
                                                    <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60 truncate">{p.subfamilia}</div>
                                                )}
                                            </td>
                                            {/* Sales bars */}
                                            <td className="px-3 py-2.5">
                                                <SalesBar ventas_meses={p.ventas_meses} maxQty={maxQty} availableMesanos={availableMesanos} />
                                            </td>
                                            {/* Units */}
                                            <td className="px-3 py-2.5 font-mono font-bold text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <ShoppingBag className="w-3 h-3 text-amber-400 shrink-0" />
                                                    {NUM(p.total_vendido)}
                                                </div>
                                            </td>
                                            {/* Revenue */}
                                            <td className="px-3 py-2.5 font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                {CLP(p.total_venta)}
                                            </td>
                                            {/* MTZ price */}
                                            <td className="px-3 py-2.5 font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                                {CLP(p.precio_sugerido)}
                                            </td>
                                            {/* Actions */}
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => onToggleInactive(p.codigo, !isInactive)}
                                                        title={isInactive ? t('mtz.missing.activate') : t('mtz.missing.deactivate')}
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            isInactive
                                                                ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600'
                                                                : 'text-light-text-secondary hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-500'
                                                        }`}>
                                                        <EyeOff className="w-3.5 h-3.5" />
                                                    </button>
                                                    {onCreateProduct && !isInactive && (
                                                        <button
                                                            onClick={() => onCreateProduct({ nombre: p.nombre?.trim() || '', codigo: p.codigo || '', precio: p.precio_sugerido || 0, familia: p.familia || '', estado: true, prioridad: 0 })}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-light-accent dark:bg-dark-accent text-white text-[10px] font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all whitespace-nowrap">
                                                            + {t('mtz.missing.create')}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    );
};

export default FamilyGroup;
