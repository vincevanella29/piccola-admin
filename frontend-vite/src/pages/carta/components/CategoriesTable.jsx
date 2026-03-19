/**
 * CategoriesTable — Apple-style category table with product preview thumbnails
 * and "Move to" / "Copy products to" functionality.
 *
 * Each row shows:
 *   - Name + alias
 *   - Menu type badge (click to move)
 *   - Up to 3 product thumbnail images (stacked)
 *   - Real product count
 *   - Priority + Status
 *   - Edit / Move / Copy / Delete actions
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Edit2, Trash2, CheckSquare, Square, MinusSquare,
    Tags, ImageIcon, Package, Loader2,
} from 'lucide-react';
import { MoveToDropdown, CopyToDropdown, BulkMoveDropdown } from './CategoryDropdowns';

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

const StatusToggle = ({ active, loading, onToggle }) => (
    <button onClick={e => { e.stopPropagation(); onToggle(); }} disabled={loading}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            active ? 'bg-light-success dark:bg-dark-success' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
        }`}
        role="switch" aria-checked={active}>
        {loading
            ? <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-white" />
            : <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                active ? 'translate-x-5' : 'translate-x-0.5'
            }`} />}
    </button>
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

// ── Menu type badge ───────────────────────────────────────────────────────────
const MenuTypeBadge = ({ menuType, menuTypes = [] }) => {
    const mt = menuTypes.find(m => m.slug === menuType) || { name: menuType || 'carta', color: '#607D8B' };
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
            style={{ backgroundColor: `${mt.color}15`, borderColor: `${mt.color}30`, color: mt.color }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mt.color }} />
            {mt.name}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
const CategoriesTable = ({
    categories,
    products = [],
    menuTypes = [],
    selectedIds, onToggle, onToggleAll,
    onEdit, onDelete,
    onToggleStatus,            // (categoryId, newEstado) => Promise
    onMoveCategory,            // (categoryId, newMenuType) => Promise
    onBulkMoveCategories,      // (categoryIds, newMenuType) => Promise
    onCopyCategory,            // (categoryId, targetMenuType) => Promise
}) => {
    const { t } = useTranslation();
    const allSelected  = categories.length > 0 && selectedIds.length === categories.length;
    const someSelected = selectedIds.length > 0 && selectedIds.length < categories.length;
    const [movingId, setMovingId] = useState(null);
    const [bulkMoving, setBulkMoving] = useState(false);
    const [copyingId, setCopyingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const handleToggleStatus = async (catId, currentEstado) => {
        if (!onToggleStatus) return;
        setTogglingId(catId);
        try { await onToggleStatus(catId, !currentEstado); }
        finally { setTogglingId(null); }
    };

    const productById = useMemo(() => {
        const map = {};
        for (const p of products) map[p.id || p._id] = p;
        return map;
    }, [products]);

    const catProducts = useMemo(() => {
        const map = {};
        for (const cat of categories) {
            const byMenuIds = (cat.menu_ids || []).map(id => productById[id]).filter(Boolean);
            const byCatIds  = products.filter(p => (p.category_ids || []).includes(cat.id));
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

    const handleMove = async (catId, newType) => {
        if (!onMoveCategory) return;
        setMovingId(catId);
        try { await onMoveCategory(catId, newType); }
        finally { setMovingId(null); }
    };

    const handleBulkMove = async (newType) => {
        if (!onBulkMoveCategories || selectedIds.length === 0) return;
        setBulkMoving(true);
        try { await onBulkMoveCategories(selectedIds, newType); }
        finally { setBulkMoving(false); }
    };

    const handleCopy = async (catId, targetMenuType) => {
        if (!onCopyCategory) return;
        setCopyingId(catId);
        try { await onCopyCategory(catId, targetMenuType); }
        finally { setCopyingId(null); }
    };

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
            {/* Header */}
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
                    {(someSelected || allSelected) && menuTypes.length > 1 && (
                        <BulkMoveDropdown menuTypes={menuTypes} count={selectedIds.length} onBulkMove={handleBulkMove} loading={bulkMoving} />
                    )}
                </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-light-border dark:border-dark-border">
                            <th className="w-10 px-4 py-3" />
                            {[t('carta.col_name'), t('carta.col_alias'), 'Menú', 'Productos', t('carta.col_priority'), t('carta.col_status'), ''].map((h, i) => (
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
                                        isSelected ? 'bg-light-accent/5 dark:bg-dark-accent/8' : 'hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15'
                                    }`}>
                                    <td className="pl-4 pr-2 py-3"><CheckBtn checked={isSelected} onClick={() => onToggle(c.id)} /></td>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-light-text-primary dark:text-dark-text-primary">{c.nombre}</div>
                                        {c.alias && <div className="text-[11px] font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{c.alias}</div>}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-light-text-secondary dark:text-dark-text-secondary">{c.alias || '—'}</td>
                                    <td className="px-4 py-3"><MenuTypeBadge menuType={c.menu_type} menuTypes={menuTypes} /></td>
                                    <td className="px-4 py-3"><ProductStack products={prods} /></td>
                                    <td className="px-4 py-3 text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">{c.prioridad ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <StatusToggle active={c.estado} loading={togglingId === c.id} onToggle={() => handleToggleStatus(c.id, c.estado)} />
                                    </td>
                                    <td className="px-4 py-3 pr-5">
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                            {menuTypes.length > 1 && (
                                                <MoveToDropdown currentType={c.menu_type || 'carta'} menuTypes={menuTypes} onMove={(nt) => handleMove(c.id, nt)} loading={movingId === c.id} />
                                            )}
                                            {menuTypes.length > 1 && (
                                                <CopyToDropdown currentType={c.menu_type || 'carta'} menuTypes={menuTypes} onCopy={(mt) => handleCopy(c.id, mt)} loading={copyingId === c.id} />
                                            )}
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

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-light-border/40 dark:divide-dark-border/40">
                {categories.map((c, idx) => {
                    const isSelected = selectedIds.includes(c.id);
                    const prods      = catProducts[c.id] || [];
                    return (
                        <motion.div key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                            className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isSelected ? 'bg-light-accent/5 dark:bg-dark-accent/8' : ''}`}>
                            <CheckBtn checked={isSelected} onClick={() => onToggle(c.id)} />
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary">{c.nombre}</div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <MenuTypeBadge menuType={c.menu_type} menuTypes={menuTypes} />
                                    <StatusToggle active={c.estado} loading={togglingId === c.id} onToggle={() => handleToggleStatus(c.id, c.estado)} />
                                    <ProductStack products={prods} limit={2} />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {menuTypes.length > 1 && (
                                    <MoveToDropdown currentType={c.menu_type || 'carta'} menuTypes={menuTypes} onMove={(nt) => handleMove(c.id, nt)} loading={movingId === c.id} align="right" />
                                )}
                                {menuTypes.length > 1 && (
                                    <CopyToDropdown currentType={c.menu_type || 'carta'} menuTypes={menuTypes} onCopy={(mt) => handleCopy(c.id, mt)} loading={copyingId === c.id} align="right" />
                                )}
                                <button onClick={() => onEdit(c)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent hover:border-light-accent/30 transition-all">
                                    <Edit2 className="w-3.5 h-3.5" /> Editar
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoriesTable;
