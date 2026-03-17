/**
 * CategoriesTable — Apple-style category table with product preview thumbnails.
 *
 * Each row shows:
 *   - Name + alias
 *   - Up to 3 product thumbnail images (stacked)
 *   - Real product count
 *   - Priority + Status
 *   - Edit / Delete actions
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Edit2, Trash2, CheckSquare, Square, MinusSquare, Tags, ImageIcon, Package } from 'lucide-react';

const CheckBtn = ({ checked, indeterminate, onClick }) => (
    <button onClick={onClick}
        className="p-1 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-colors">
        {indeterminate
            ? <MinusSquare className="w-4 h-4 text-light-accent dark:text-dark-accent" />
            : checked
                ? <CheckSquare className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                : <Square className="w-4 h-4" />}
    </button>
);

const StatusPill = ({ active, t }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
        active
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
    }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {active ? t('carta.active_f') : t('carta.inactive_f')}
    </span>
);

// ── Product thumbnail stack ───────────────────────────────────────────────────
const ProductStack = ({ products, limit = 3 }) => {
    const shown = products.slice(0, limit);
    const extra = products.length - limit;

    if (products.length === 0) {
        return (
            <div className="flex items-center gap-1.5 text-light-text-secondary dark:text-dark-text-secondary opacity-40">
                <Package className="w-3.5 h-3.5" />
                <span className="text-xs">–</span>
            </div>
        );
    }

    return (
        <div className="flex items-center">
            <div className="flex -space-x-2">
                {shown.map((p, i) => {
                    const img = p.media_r2 || p.media_url || (p.media_images || [])[0];
                    return (
                        <div key={p.id || p._id} title={p.nombre}
                            style={{ zIndex: shown.length - i }}
                            className="relative w-8 h-8 rounded-xl border-2 border-light-surface dark:border-dark-surface overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary shrink-0">
                            {img
                                ? <img src={img} alt={p.nombre} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-3 h-3 opacity-30 text-light-text-secondary" /></div>}
                        </div>
                    );
                })}
                {extra > 0 && (
                    <div className="relative w-8 h-8 rounded-xl border-2 border-light-surface dark:border-dark-surface bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary shrink-0">
                        +{extra}
                    </div>
                )}
            </div>
            <span className="ml-2.5 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                {products.length}
            </span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
const CategoriesTable = ({
    categories,
    products = [],
    selectedIds, onToggle, onToggleAll,
    onEdit, onDelete,
}) => {
    const { t } = useTranslation();
    const allSelected  = categories.length > 0 && selectedIds.length === categories.length;
    const someSelected = selectedIds.length > 0 && selectedIds.length < categories.length;

    // Build product lookup by ID for each category's menu_ids
    const productById = useMemo(() => {
        const map = {};
        for (const p of products) map[p.id || p._id] = p;
        return map;
    }, [products]);

    // Also build category_ids reverse index: catId → products[]
    const catProducts = useMemo(() => {
        const map = {};
        for (const cat of categories) {
            const byMenuIds = (cat.menu_ids || []).map(id => productById[id]).filter(Boolean);
            // Also capture products that have this catId in their category_ids
            const byCatIds  = products.filter(p => (p.category_ids || []).includes(cat.id));
            // Merge deduplicated
            const seen = new Set(byMenuIds.map(p => p.id || p._id));
            const merged = [...byMenuIds];
            for (const p of byCatIds) {
                const pid = p.id || p._id;
                if (!seen.has(pid)) { seen.add(pid); merged.push(p); }
            }
            map[cat.id] = merged;
        }
        return map;
    }, [categories, products, productById]);

    if (categories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-3xl border-2 border-dashed border-light-border dark:border-dark-border">
                <div className="w-16 h-16 rounded-3xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
                    <Tags className="w-8 h-8 opacity-25 text-light-text-secondary dark:text-dark-text-secondary" />
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('carta.no_categories')}</p>
            </div>
        );
    }

    return (
        <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border shadow-sm overflow-hidden">
            {/* Header info */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-light-border dark:border-dark-border bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20">
                <div className="flex items-center gap-3">
                    <CheckBtn
                        checked={allSelected}
                        indeterminate={someSelected}
                        onClick={() => allSelected ? onToggleAll([]) : onToggleAll(categories.map(c => c.id))}
                    />
                    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                        {someSelected || allSelected
                            ? `${selectedIds.length} de ${categories.length} seleccionadas`
                            : `${categories.length} ${t('carta.tab_categories').toLowerCase()}`}
                    </span>
                </div>
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-light-border dark:border-dark-border">
                            <th className="w-10 px-4 py-3" />
                            {[t('carta.col_name'), t('carta.col_alias'), 'Productos', t('carta.col_priority'), t('carta.col_status'), ''].map((h, i) => (
                                <th key={i} className="px-4 py-3 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((c, idx) => {
                            const isSelected = selectedIds.includes(c.id);
                            const prods      = catProducts[c.id] || [];
                            return (
                                <motion.tr key={c.id}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                                    className={`group border-b border-light-border/40 dark:border-dark-border/40 last:border-0 transition-colors duration-100 ${
                                        isSelected
                                            ? 'bg-light-accent/5 dark:bg-dark-accent/8'
                                            : 'hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15'
                                    }`}>
                                    <td className="pl-4 pr-2 py-3">
                                        <CheckBtn checked={isSelected} onClick={() => onToggle(c.id)} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-light-text-primary dark:text-dark-text-primary">{c.nombre}</div>
                                        {c.alias && <div className="text-[11px] font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{c.alias}</div>}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                        {c.alias || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <ProductStack products={prods} />
                                    </td>
                                    <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">
                                        {c.prioridad ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusPill active={c.estado} t={t} />
                                    </td>
                                    <td className="px-4 py-3 pr-5">
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                            <button onClick={() => onEdit(c)}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 text-xs font-semibold transition-all shadow-sm">
                                                <Edit2 className="w-3.5 h-3.5" /> {t('carta.edit')}
                                            </button>
                                            <button onClick={() => onDelete(c.id, c.nombre)}
                                                className="p-1.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:border-red-400/40 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-sm">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Mobile card list ── */}
            <div className="sm:hidden divide-y divide-light-border/40 dark:divide-dark-border/40">
                {categories.map((c, idx) => {
                    const isSelected = selectedIds.includes(c.id);
                    const prods      = catProducts[c.id] || [];
                    return (
                        <motion.div key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                            className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                                isSelected ? 'bg-light-accent/5 dark:bg-dark-accent/8' : ''
                            }`}>
                            <CheckBtn checked={isSelected} onClick={() => onToggle(c.id)} />
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary">{c.nombre}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <StatusPill active={c.estado} t={t} />
                                    <ProductStack products={prods} limit={2} />
                                </div>
                            </div>
                            <button onClick={() => onEdit(c)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent hover:border-light-accent/30 transition-all">
                                <Edit2 className="w-3.5 h-3.5" /> Editar
                            </button>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoriesTable;
