/**
 * ProductsTable — Apple-style product list grouped by category.
 *
 * Desktop: table layout with column headers
 * Mobile:  card grid (2 cols) with image, name, price and status
 *
 * Each category section is collapsible.
 * Inside each category, products that share a product-group are shown
 * under a collapsible amber sub-accordion.
 * Products without a group are rendered normally below grouped ones.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit2, Trash2, CheckSquare, Square, MinusSquare,
    ImageIcon, Sparkles, ChevronDown, ChevronRight,
    Layers, Tag,
} from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────
const CLP = (v) =>
    v != null ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v) : '—';

// ── Animated image slider (up to 4 images, cycles every 3s) ──────────────────
const ImageSlider = ({ images, alt, className }) => {
    const [idx, setIdx] = useState(0);
    const timer = useRef(null);
    useEffect(() => {
        if (!images || images.length <= 1) return;
        timer.current = setInterval(() => setIdx(i => (i + 1) % images.length), 3000);
        return () => clearInterval(timer.current);
    }, [images]);
    if (!images?.length) return null;
    return (
        <div className={`relative overflow-hidden ${className}`}>
            <AnimatePresence mode="wait">
                <motion.img key={idx} src={images[idx]} alt={alt}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="w-full h-full object-cover absolute inset-0" />
            </AnimatePresence>
            {images.length > 1 && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5 z-10">
                    {images.map((_, i) => (
                        <span key={i} className={`block h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-2.5 bg-white' : 'w-1 bg-white/50'}`} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Checkbox helper ───────────────────────────────────────────────────────────
const CheckBtn = ({ checked, indeterminate, onClick, className = '' }) => (
    <button onClick={onClick} className={`p-1 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-colors ${className}`}>
        {indeterminate
            ? <MinusSquare className="w-4 h-4 text-light-accent dark:text-dark-accent" />
            : checked
                ? <CheckSquare className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                : <Square className="w-4 h-4" />}
    </button>
);

// ── Status pill ───────────────────────────────────────────────────────────────
const StatusPill = ({ active, t }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${active
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
        }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {active ? t('carta.active') : t('carta.inactive')}
    </span>
);

// ── Restriction badge ─────────────────────────────────────────────────────────
const REST_COLORS = {
    dinein: 'bg-blue-100/80 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400',
    delivery: 'bg-orange-100/80 dark:bg-orange-900/25 text-orange-600 dark:text-orange-400',
    collection: 'bg-purple-100/80 dark:bg-purple-900/25 text-purple-600 dark:text-purple-400',
};

// ── Category color palette (cycles through) ───────────────────────────────────
const CAT_PALETTES = [
    { bg: 'bg-violet-50  dark:bg-violet-900/10', border: 'border-violet-200/60 dark:border-violet-800/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', chip: 'bg-violet-100 dark:bg-violet-900/25 text-violet-700 dark:text-violet-400' },
    { bg: 'bg-sky-50     dark:bg-sky-900/10', border: 'border-sky-200/60    dark:border-sky-800/30', text: 'text-sky-700    dark:text-sky-300', dot: 'bg-sky-500', chip: 'bg-sky-100    dark:bg-sky-900/25    text-sky-700    dark:text-sky-400' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200/60 dark:border-emerald-800/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', chip: 'bg-emerald-100 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400' },
    { bg: 'bg-amber-50   dark:bg-amber-900/10', border: 'border-amber-200/60  dark:border-amber-800/30', text: 'text-amber-700  dark:text-amber-300', dot: 'bg-amber-500', chip: 'bg-amber-100  dark:bg-amber-900/25  text-amber-700  dark:text-amber-400' },
    { bg: 'bg-rose-50    dark:bg-rose-900/10', border: 'border-rose-200/60   dark:border-rose-800/30', text: 'text-rose-700   dark:text-rose-300', dot: 'bg-rose-500', chip: 'bg-rose-100   dark:bg-rose-900/25   text-rose-700   dark:text-rose-400' },
    { bg: 'bg-teal-50    dark:bg-teal-900/10', border: 'border-teal-200/60   dark:border-teal-800/30', text: 'text-teal-700   dark:text-teal-300', dot: 'bg-teal-500', chip: 'bg-teal-100   dark:bg-teal-900/25   text-teal-700   dark:text-teal-400' },
];

// ── Main component ────────────────────────────────────────────────────────────
const ProductsTable = ({
    products, categories, menuOptions = [],
    selectedIds, onToggle, onToggleAll,
    onEdit, onDelete, onAIImagen,
}) => {
    const { t } = useTranslation();
    const allSelected = products.length > 0 && selectedIds.length === products.length;
    const someSelected = selectedIds.length > 0 && selectedIds.length < products.length;

    // Category collapse state — default all expanded
    const [collapsed, setCollapsed] = useState({});
    const toggleCollapse = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

    // Group sub-accordion collapse state — default all expanded
    const [groupCollapsed, setGroupCollapsed] = useState({});
    const toggleGroupCollapse = (key) => setGroupCollapsed(p => ({ ...p, [key]: !p[key] }));

    // ── Product → group/modifier indexes ─────────────────────────────────────
    const isModifier = (opt) => !!(String(opt?.menu_id || '').trim() && String(opt.menu_id).trim() !== 'None');

    const codigoToGroup = useMemo(() => {
        const map = {};
        for (const opt of menuOptions.filter(o => !isModifier(o))) {
            for (const v of (opt.values || []))
                if (v.codigo) map[v.codigo] = { key: opt.id || opt._id, name: opt.option_name };
        }
        return map;
    }, [menuOptions]);

    const codigoToMods = useMemo(() => {
        const map = {};
        for (const opt of menuOptions.filter(isModifier)) {
            for (const v of (opt.values || [])) {
                if (!v.codigo) continue;
                if (!map[v.codigo]) map[v.codigo] = [];
                if (!map[v.codigo].includes(opt.option_name)) map[v.codigo].push(opt.option_name);
            }
        }
        return map;
    }, [menuOptions]);

    // ── Group products by primary category ───────────────────────────────────
    const catPaletteMap = useMemo(() => {
        const map = {};
        categories.forEach((c, i) => { map[c.id] = CAT_PALETTES[i % CAT_PALETTES.length]; });
        return map;
    }, [categories]);

    const grouped = useMemo(() => {
        const buckets = {};
        const uncategorized = [];
        for (const p of products) {
            const catIds = (p.category_ids || []).filter(Boolean);
            if (catIds.length === 0) { uncategorized.push(p); continue; }
            const primary = catIds[0];
            if (!buckets[primary]) {
                const cat = categories.find(c => c.id === primary);
                buckets[primary] = { catId: primary, cat, products: [] };
            }
            buckets[primary].products.push(p);
        }
        const sorted = Object.values(buckets).sort((a, b) => (a.cat?.prioridad ?? 9999) - (b.cat?.prioridad ?? 9999));
        if (uncategorized.length) sorted.push({ catId: '__none__', cat: null, products: uncategorized });
        return sorted;
    }, [products, categories]);

    const getImages = (p) => {
        if (p.media_images?.length) return p.media_images;
        if (p.media_r2 || p.media_url) return [p.media_r2 || p.media_url];
        return [];
    };

    const cachebust = (url, p) => {
        if (!url || url.includes('?')) return url;
        if (p?.updated_at) return `${url}?v=${new Date(p.updated_at).getTime()}`;
        return url;
    };

    // ── Single product row (desktop) ──────────────────────────────────────────
    const renderRow = (p, isLast = false, extraClass = '') => {
        const sel = selectedIds.includes(p.id);
        const imgs = getImages(p).map(u => cachebust(u, p));
        const g = p.codigo ? codigoToGroup[p.codigo] : null;
        const mods = p.codigo ? codigoToMods[p.codigo] : null;

        return (
            <motion.tr key={p.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
                className={`group border-b border-light-border/30 dark:border-dark-border/30 ${isLast ? 'border-b-0' : ''} transition-colors duration-100 ${sel ? 'bg-light-accent/5 dark:bg-dark-accent/8' : 'hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15'} ${extraClass}`}>

                <td className="pl-4 pr-2 py-3 w-10">
                    <CheckBtn checked={sel} onClick={() => onToggle(p.id)} />
                </td>

                <td className="px-3 py-3 w-14">
                    {imgs.length ? (
                        <ImageSlider images={imgs} alt={p.nombre}
                            className="w-11 h-11 rounded-2xl border border-light-border dark:border-dark-border shadow-sm bg-light-surface-secondary dark:bg-dark-surface-secondary" />
                    ) : (
                        <div className="w-11 h-11 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary opacity-30" />
                        </div>
                    )}
                </td>

                <td className="px-3 py-3 min-w-[180px]">
                    <div className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary leading-tight">{p.nombre}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                        {p.codigo && <span className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</span>}
                        {g && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400 border border-amber-300/40">
                                <Layers className="w-2.5 h-2.5" />{g.name}
                            </span>
                        )}
                        {mods?.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 border border-blue-300/40"
                                title={mods.join(', ')}>
                                🎛 {mods.length}
                            </span>
                        )}
                        {(p.restriccion || []).map(r => (
                            <span key={r} className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${REST_COLORS[r] || 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary'}`}>{r}</span>
                        ))}
                    </div>
                    {p.unused_ai_images?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); onAIImagen?.(p); }}>
                            <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
                            {p.unused_ai_images.slice(0, 4).map((url, i) => (
                                <img key={i} src={url} alt="" className="w-5 h-5 rounded-md object-cover border border-violet-400/30 hover:border-violet-400 transition-colors" />
                            ))}
                            {p.unused_ai_images.length > 4 && (
                                <span className="w-5 h-5 rounded-md bg-violet-500/10 text-violet-500 text-[8px] font-bold flex items-center justify-center border border-violet-400/20">+{p.unused_ai_images.length - 4}</span>
                            )}
                        </div>
                    )}
                </td>

                <td className="px-3 py-3 font-mono font-bold text-sm text-light-text-primary dark:text-dark-text-primary whitespace-nowrap">
                    {CLP(p.precio)}
                </td>

                <td className="px-3 py-3"><StatusPill active={p.estado} t={t} /></td>

                <td className="px-3 py-3 text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium w-14">
                    {p.prioridad ?? '—'}
                </td>

                <td className="px-3 py-3 pr-5">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        {onAIImagen && (
                            <button onClick={() => onAIImagen(p)} title="Aurora IA"
                                className="p-1.5 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-400/20 text-violet-500 hover:from-violet-500/20 hover:to-indigo-500/20 transition-all">
                                <Sparkles className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button onClick={() => onEdit(p)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 text-xs font-semibold transition-all shadow-sm">
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">{t('carta.edit')}</span>
                        </button>
                        <button onClick={() => onDelete(p.id, p.nombre)}
                            className="p-1.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:border-red-400/40 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-sm">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </td>
            </motion.tr>
        );
    };

    // ── Mobile product card ───────────────────────────────────────────────────
    const renderCard = (p) => {
        const sel = selectedIds.includes(p.id);
        const imgs = getImages(p).map(u => cachebust(u, p));
        return (
            <motion.div key={p.id}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-2xl border overflow-hidden transition-colors ${sel ? 'border-light-accent dark:border-dark-accent bg-light-accent/5 dark:bg-dark-accent/8' : 'border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface'}`}>
                <div className="relative w-full aspect-[4/3] bg-light-surface-secondary dark:bg-dark-surface-secondary">
                    {imgs.length ? (
                        <ImageSlider images={imgs} alt={p.nombre} className="absolute inset-0 w-full h-full" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-light-text-secondary dark:text-dark-text-secondary opacity-20" />
                        </div>
                    )}
                    <div className="absolute top-2 left-2">
                        <CheckBtn checked={sel} onClick={() => onToggle(p.id)}
                            className="bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-xl shadow-sm" />
                    </div>
                    <div className="absolute top-2 right-2">
                        <StatusPill active={p.estado} t={t} />
                    </div>
                </div>
                <div className="p-3 space-y-1.5">
                    <div className="font-bold text-sm text-light-text-primary dark:text-dark-text-primary leading-tight line-clamp-2">{p.nombre}</div>
                    <div className="font-mono font-bold text-light-accent dark:text-dark-accent text-sm">{CLP(p.precio)}</div>
                    {p.codigo && <div className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary opacity-60">{p.codigo}</div>}
                    <div className="flex items-center gap-1.5 pt-1">
                        {onAIImagen && (
                            <button onClick={() => onAIImagen(p)}
                                className="p-1.5 rounded-xl bg-violet-500/10 border border-violet-400/20 text-violet-500 hover:bg-violet-500/20 transition-all">
                                <Sparkles className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button onClick={() => onEdit(p)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent hover:border-light-accent/30 transition-all">
                            <Edit2 className="w-3.5 h-3.5" />{t('carta.edit')}
                        </button>
                        <button onClick={() => onDelete(p.id, p.nombre)}
                            className="p-1.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary hover:text-red-500 hover:border-red-400/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    };

    // ── Group accordion — DESKTOP only (tr elements for tbody) ───────────────
    const renderGroupRows = (groupKey, groupName, prods, colCount) => {
        const isOpen = !groupCollapsed[groupKey];
        const allSel = prods.every(p => selectedIds.includes(p.id));
        const someSel = prods.some(p => selectedIds.includes(p.id));
        const toggleGroupSel = () => {
            const ids = prods.map(p => p.id);
            if (allSel) onToggleAll(selectedIds.filter(id => !ids.includes(id)));
            else onToggleAll([...new Set([...selectedIds, ...ids])]);
        };
        return (
            <React.Fragment key={groupKey}>
                {/* Group header row */}
                <tr className="border-b border-amber-200/50 dark:border-amber-800/20 bg-amber-50/60 dark:bg-amber-900/10 cursor-pointer select-none"
                    onClick={() => toggleGroupCollapse(groupKey)}>
                    <td className="pl-4 pr-2 py-2 w-10">
                        <div onClick={e => { e.stopPropagation(); toggleGroupSel(); }}>
                            <CheckBtn checked={allSel && prods.length > 0} indeterminate={someSel && !allSel} />
                        </div>
                    </td>
                    <td colSpan={colCount - 1} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                            {isOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                : <ChevronRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                            <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{groupName}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-200/70 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                                {prods.length} {prods.length === 1 ? 'producto' : 'productos'}
                            </span>
                        </div>
                    </td>
                </tr>
                {/* Product rows */}
                {isOpen && prods.map((p, i) =>
                    renderRow(p, i === prods.length - 1, 'border-l-2 border-l-amber-300/50 dark:border-l-amber-700/40')
                )}
            </React.Fragment>
        );
    };

    // ── Group accordion — MOBILE only (div elements) ──────────────────────────
    const renderGroupMobile = (groupKey, groupName, prods) => {
        const isOpen = !groupCollapsed[groupKey];
        const allSel = prods.every(p => selectedIds.includes(p.id));
        const someSel = prods.some(p => selectedIds.includes(p.id));
        const toggleGroupSel = () => {
            const ids = prods.map(p => p.id);
            if (allSel) onToggleAll(selectedIds.filter(id => !ids.includes(id)));
            else onToggleAll([...new Set([...selectedIds, ...ids])]);
        };
        return (
            <div key={groupKey}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none bg-amber-50/80 dark:bg-amber-900/15 border-b border-amber-200/40 dark:border-amber-800/20"
                    onClick={() => toggleGroupCollapse(groupKey)}>
                    <div onClick={e => { e.stopPropagation(); toggleGroupSel(); }}>
                        <CheckBtn checked={allSel && prods.length > 0} indeterminate={someSel && !allSel} />
                    </div>
                    {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        : <ChevronRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                    <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex-1">{groupName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-200/60 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        {prods.length}
                    </span>
                </div>
                {/* Cards */}
                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                            className="overflow-hidden border-l-2 border-l-amber-300/50 dark:border-l-amber-700/40 ml-2">
                            <div className="p-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {prods.map(p => renderCard(p))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    // ── Category section ──────────────────────────────────────────────────────
    const renderCategory = (bucket, paletteIdx) => {
        const { catId, cat, products: prods } = bucket;
        const palette = catId === '__none__'
            ? { bg: 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/10', border: 'border-light-border dark:border-dark-border', text: 'text-light-text-secondary dark:text-dark-text-secondary', dot: 'bg-light-text-secondary/30', chip: 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary' }
            : (catPaletteMap[catId] || CAT_PALETTES[paletteIdx % CAT_PALETTES.length]);

        const isCollapsed = collapsed[catId];
        const catName = cat?.nombre || 'Sin categoría';
        const catNames = catId === '__none__' ? 'Sin categoría' : catName;
        const catCount = prods.length;

        const allInCatSelected = prods.every(p => selectedIds.includes(p.id));
        const someInCatSelected = prods.some(p => selectedIds.includes(p.id));

        const toggleCategoryAll = () => {
            const ids = prods.map(p => p.id);
            if (allInCatSelected) onToggleAll(selectedIds.filter(id => !ids.includes(id)));
            else onToggleAll([...new Set([...selectedIds, ...ids])]);
        };

        // Split products: grouped vs ungrouped
        const groupBuckets = {};
        const ungrouped = [];

        for (const p of prods) {
            const g = p.codigo ? codigoToGroup[p.codigo] : null;
            if (g) {
                if (!groupBuckets[g.key]) groupBuckets[g.key] = { name: g.name, products: [] };
                groupBuckets[g.key].products.push(p);
            } else {
                ungrouped.push(p);
            }
        }

        const hasGroups = Object.keys(groupBuckets).length > 0;
        const COL_COUNT = 7; // checkbox + image + name + price + status + priority + actions

        return (
            <div key={catId} className={`rounded-2xl border overflow-hidden ${palette.border}`}>
                {/* Category header */}
                <div
                    onClick={() => toggleCollapse(catId)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${palette.bg} hover:opacity-90 transition-opacity`}>
                    <div onClick={e => { e.stopPropagation(); toggleCategoryAll(); }}>
                        <CheckBtn
                            checked={allInCatSelected && catCount > 0}
                            indeterminate={someInCatSelected && !allInCatSelected} />
                    </div>
                    {isCollapsed
                        ? <ChevronRight className={`w-4 h-4 shrink-0 ${palette.text}`} />
                        : <ChevronDown className={`w-4 h-4 shrink-0 ${palette.text}`} />}
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dot}`} />
                    <span className={`font-bold text-sm flex-1 truncate ${palette.text}`}>{catNames}</span>
                    {/* Group count badge */}
                    {hasGroups && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400 border border-amber-300/30 shrink-0">
                            <Layers className="w-2.5 h-2.5" />
                            {Object.keys(groupBuckets).length} grupo{Object.keys(groupBuckets).length > 1 ? 's' : ''}
                        </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${palette.chip}`}>
                        {catCount} {catCount === 1 ? 'producto' : 'productos'}
                    </span>
                    {cat?.prioridad != null && (
                        <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-50">p={cat.prioridad}</span>
                    )}
                </div>

                <AnimatePresence initial={false}>
                    {!isCollapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden">

                            {/* ── Desktop table (only tr/td inside tbody) ── */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-light-border/30 dark:border-dark-border/30">
                                            <th className="w-10 px-4 py-2.5" />
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider w-14">{t('carta.col_image')}</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('carta.col_name')}</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider whitespace-nowrap">{t('carta.col_price')}</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('carta.col_status')}</th>
                                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('carta.col_priority')}</th>
                                            <th className="px-3 py-2.5 pr-5 w-32" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Grouped: only tr elements */}
                                        {Object.entries(groupBuckets).map(([gKey, { name, products: gProds }]) =>
                                            renderGroupRows(gKey, name, gProds, COL_COUNT)
                                        )}
                                        {/* Ungrouped */}
                                        {ungrouped.map((p, i) => renderRow(p, i === ungrouped.length - 1))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Mobile (only div elements) ── */}
                            <div className="md:hidden">
                                {Object.entries(groupBuckets).map(([gKey, { name, products: gProds }]) =>
                                    renderGroupMobile(gKey, name, gProds)
                                )}
                                {ungrouped.length > 0 && (
                                    <div className="p-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {ungrouped.map(p => renderCard(p))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    // ── Empty state ───────────────────────────────────────────────────────────
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-3xl border-2 border-dashed border-light-border dark:border-dark-border">
                <div className="w-16 h-16 rounded-3xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 opacity-25 text-light-text-secondary dark:text-dark-text-secondary" />
                </div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('carta.no_products')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 px-2">
                <CheckBtn
                    checked={allSelected}
                    indeterminate={someSelected}
                    onClick={() => allSelected ? onToggleAll([]) : onToggleAll(products.map(p => p.id))}
                />
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {someSelected || allSelected
                        ? `${selectedIds.length} de ${products.length} seleccionados`
                        : `${products.length} productos en ${grouped.length} ${grouped.length === 1 ? 'categoría' : 'categorías'}`
                    }
                </span>
            </div>
            {grouped.map((bucket, i) => renderCategory(bucket, i))}
        </div>
    );
};

export default ProductsTable;
