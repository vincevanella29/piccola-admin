/**
 * ProductsTable — Apple-style product list grouped by category
 * with @dnd-kit sortable drag-and-drop (60fps CSS-transform based).
 *
 * Each category is a self-contained SortableContext.
 * DragOverlay renders a premium floating ghost card via portal.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit2, Trash2, CheckSquare, Square, MinusSquare,
    ImageIcon, Sparkles, ChevronDown, ChevronRight,
    Layers, GripVertical, Save, Loader2, TrendingUp, ArrowUpDown, Pencil, Check, X,
} from 'lucide-react';
import {
    DndContext, DragOverlay, closestCenter,
    PointerSensor, useSensor, useSensors,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Formatters ────────────────────────────────────────────────────────────────
const CLP = (v) =>
    v != null ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v) : '—';
const fmtK = (v) => v == null ? '—' : v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toLocaleString('es-CL');

// ── Inline Price Editor ───────────────────────────────────────────────────────
const InlinePrice = ({ value, productId, onSave, accentClass }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);

    const startEdit = (e) => {
        e.stopPropagation();
        setDraft(String(value || ''));
        setEditing(true);
    };

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const save = async () => {
        const num = parseInt(draft, 10);
        if (isNaN(num) || num < 0) { setEditing(false); return; }
        if (num === value) { setEditing(false); return; }
        setSaving(true);
        try {
            await onSave(productId, num);
        } catch (err) {
            console.error('Price update error:', err);
        } finally {
            setSaving(false);
            setEditing(false);
        }
    };

    const cancel = () => setEditing(false);

    const handleKey = (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancel();
    };

    if (editing) {
        return (
            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-medium">$</span>
                <input
                    ref={inputRef}
                    type="number"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKey}
                    onBlur={save}
                    disabled={saving}
                    className="w-16 px-1.5 py-1 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-accent/50 dark:border-dark-accent/50 text-sm font-mono font-bold text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {saving && <Loader2 className="w-3 h-3 animate-spin text-light-accent dark:text-dark-accent" />}
            </div>
        );
    }

    return (
        <button
            onClick={startEdit}
            className={`group/price flex items-center gap-1 font-mono font-bold text-sm ${accentClass || 'text-light-text-primary dark:text-dark-text-primary'} hover:text-light-accent dark:hover:text-dark-accent transition-colors cursor-text`}
            title="Click para editar precio"
        >
            {CLP(value)}
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/price:opacity-40 transition-opacity" />
        </button>
    );
};

const MarginPill = ({ pct }) => {
    if (pct == null) return <span className="text-[10px] text-light-text-secondary/30 dark:text-dark-text-secondary/30">—</span>;
    const color = pct >= 30
        ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
        : pct >= 15
            ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
            : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400';
    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${color}`}>
            <TrendingUp className="w-2.5 h-2.5" />{pct.toFixed(0)}%
        </span>
    );
};

// ── Image slider ─────────────────────────────────────────────────────────────
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

// ── Small helpers ─────────────────────────────────────────────────────────────
const CheckBtn = ({ checked, indeterminate, onClick, className = '' }) => (
    <button onClick={onClick} className={`p-1 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-colors ${className}`}>
        {indeterminate
            ? <MinusSquare className="w-4 h-4 text-light-accent dark:text-dark-accent" />
            : checked
                ? <CheckSquare className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                : <Square className="w-4 h-4" />}
    </button>
);

const StatusToggle = ({ active, loading, onToggle }) => (
    <button onClick={e => { e.stopPropagation(); onToggle?.(); }} disabled={loading}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            active ? 'bg-light-success dark:bg-dark-success' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
        }`}
        role="switch" aria-checked={active}>
        {loading
            ? <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 animate-spin text-white" />
            : <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                active ? 'translate-x-4' : 'translate-x-0.5'
            }`} />}
    </button>
);

const REST_COLORS = {
    dinein:     'bg-blue-100/80 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400',
    delivery:   'bg-orange-100/80 dark:bg-orange-900/25 text-orange-600 dark:text-orange-400',
    collection: 'bg-purple-100/80 dark:bg-purple-900/25 text-purple-600 dark:text-purple-400',
};

const CAT_PALETTES = [
    { bg: 'bg-violet-50  dark:bg-violet-900/10', border: 'border-violet-200/60 dark:border-violet-800/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', chip: 'bg-violet-100 dark:bg-violet-900/25 text-violet-700 dark:text-violet-400' },
    { bg: 'bg-sky-50     dark:bg-sky-900/10',    border: 'border-sky-200/60    dark:border-sky-800/30',    text: 'text-sky-700    dark:text-sky-300',    dot: 'bg-sky-500',    chip: 'bg-sky-100    dark:bg-sky-900/25    text-sky-700    dark:text-sky-400'    },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200/60 dark:border-emerald-800/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', chip: 'bg-emerald-100 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400' },
    { bg: 'bg-amber-50   dark:bg-amber-900/10',  border: 'border-amber-200/60  dark:border-amber-800/30',  text: 'text-amber-700  dark:text-amber-300',  dot: 'bg-amber-500',  chip: 'bg-amber-100  dark:bg-amber-900/25  text-amber-700  dark:text-amber-400'  },
    { bg: 'bg-rose-50    dark:bg-rose-900/10',   border: 'border-rose-200/60   dark:border-rose-800/30',   text: 'text-rose-700   dark:text-rose-300',   dot: 'bg-rose-500',   chip: 'bg-rose-100   dark:bg-rose-900/25   text-rose-700   dark:text-rose-400'   },
    { bg: 'bg-teal-50    dark:bg-teal-900/10',   border: 'border-teal-200/60   dark:border-teal-800/30',   text: 'text-teal-700   dark:text-teal-300',   dot: 'bg-teal-500',   chip: 'bg-teal-100   dark:bg-teal-900/25   text-teal-700   dark:text-teal-400'   },
];


// Helper: composite ID for sortable items (catId::productId)
const makeSortId = (catId, pid) => `${catId}::${pid}`;
const parseSortId = (sid) => {
    const idx = sid.indexOf('::');
    if (idx === -1) return { catId: '', pid: sid };
    return { catId: sid.slice(0, idx), pid: sid.slice(idx + 2) };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SortableRow — uses @dnd-kit's useSortable hook
//  Renders as a <div> row (not <tr>) for CSS transform compatibility.
// ═══════════════════════════════════════════════════════════════════════════════
const SortableRow = ({
    product, idx, catId, sortableId, isLast, extraClass, hasPending, multiCatCount,
    selectedIds, onToggle, onEdit, onDelete, onAIImagen, onToggleStatus, togglingId,
    codigoToGroup, codigoToMods, getImages, cachebust, t, mtzSummary = {},
    onQuickPriceUpdate, onQuickDeliveryPriceUpdate, showDeliveryPrice,
}) => {
    const p = product;
    const sel = selectedIds.includes(p.id);
    const imgs = getImages(p).map(u => cachebust(u, p));
    const g = p.codigo ? codigoToGroup[p.codigo] : null;
    const mods = p.codigo ? codigoToMods[p.codigo] : null;
    const mtz = p.codigo ? mtzSummary[p.codigo] : null;

    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: sortableId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-0 border-b border-light-border/30 dark:border-dark-border/30 ${isLast ? 'border-b-0' : ''} transition-shadow duration-200 ${
                isDragging
                    ? 'opacity-50 shadow-2xl shadow-light-accent/10 dark:shadow-dark-accent/10 ring-1 ring-light-accent/20 dark:ring-dark-accent/20 bg-light-surface dark:bg-dark-surface rounded-xl scale-[1.02]'
                    : sel
                        ? 'bg-light-accent/5 dark:bg-dark-accent/8'
                        : 'hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15'
            } ${extraClass}`}
        >
            {/* Drag handle */}
            <div className="w-9 shrink-0 flex items-center justify-center py-3"
                {...attributes} {...listeners}>
                <div className={`cursor-grab active:cursor-grabbing p-1.5 rounded-xl transition-all ${
                    isDragging
                        ? 'text-light-accent dark:text-dark-accent bg-light-accent/15 dark:bg-dark-accent/15'
                        : 'text-light-text-secondary/30 dark:text-dark-text-secondary/30 hover:text-light-accent dark:hover:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10'
                }`}>
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>

            {/* Checkbox */}
            <div className="w-8 shrink-0 flex items-center py-3">
                <CheckBtn checked={sel} onClick={() => onToggle(p.id)} />
            </div>

            {/* Image */}
            <div className="w-14 shrink-0 px-2 py-2.5">
                {imgs.length ? (
                    <ImageSlider images={imgs} alt={p.nombre}
                        className="w-11 h-11 rounded-2xl border border-light-border dark:border-dark-border shadow-sm bg-light-surface-secondary dark:bg-dark-surface-secondary" />
                ) : (
                    <div className="w-11 h-11 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary opacity-30" />
                    </div>
                )}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0 px-2 py-2.5">
                <div className="font-semibold text-sm text-light-text-primary dark:text-dark-text-primary leading-tight truncate">{p.nombre}</div>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {p.codigo && <span className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</span>}
                    {g && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400 border border-amber-300/40">
                            <Layers className="w-2.5 h-2.5" />{g.name}
                        </span>
                    )}
                    {mods?.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 border border-blue-300/40"
                            title={mods.join(', ')}>🎛 {mods.length}</span>
                    )}
                    {(p.restriccion || []).map(r => (
                        <span key={r} className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${REST_COLORS[r] || 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary'}`}>{r}</span>
                    ))}
                    {multiCatCount > 1 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/25 text-indigo-600 dark:text-indigo-400 border border-indigo-300/40"
                            title={`En ${multiCatCount} categorías`}>📌 {multiCatCount} cats</span>
                    )}
                </div>
                {p.unused_ai_images?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onAIImagen?.(p); }}>
                        <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
                        {p.unused_ai_images.slice(0, 4).map((url, i) => (
                            <img key={i} src={url} alt="" className="w-5 h-5 rounded-md object-cover border border-violet-400/30 hover:border-violet-400 transition-colors" />
                        ))}
                        {p.unused_ai_images.length > 4 && (
                            <span className="w-5 h-5 rounded-md bg-violet-500/10 text-violet-500 text-[8px] font-bold flex items-center justify-center border border-violet-400/20">+{p.unused_ai_images.length - 4}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Price — inline editable */}
            <div className="w-20 shrink-0 px-1 py-2.5 whitespace-nowrap hidden sm:block">
                {onQuickPriceUpdate ? (
                    <InlinePrice value={p.precio} productId={p.id} onSave={onQuickPriceUpdate} />
                ) : (
                    <span className="font-mono font-bold text-sm text-light-text-primary dark:text-dark-text-primary">{CLP(p.precio)}</span>
                )}
            </div>

            {/* MTZ Price reference (puven) — read-only */}
            <div className="w-20 shrink-0 px-1 py-2.5 whitespace-nowrap hidden lg:block">
                {mtz?.puven != null ? (
                    <div>
                        <span className={`font-mono text-[11px] font-semibold ${
                            p.precio && mtz.puven !== p.precio
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-light-text-secondary/60 dark:text-dark-text-secondary/60'
                        }`}>
                            {CLP(mtz.puven)}
                        </span>
                        {p.precio && mtz.puven !== p.precio && (() => {
                            const diff = p.precio - mtz.puven;
                            const pct = Math.round((diff / mtz.puven) * 100);
                            return (
                                <div className={`text-[9px] font-mono font-bold mt-0.5 ${
                                    diff > 0
                                        ? 'text-emerald-500'
                                        : 'text-red-500'
                                }`}>
                                    {diff > 0 ? '+' : ''}{pct}%
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <span className="text-[10px] text-light-text-secondary/30 dark:text-dark-text-secondary/30">—</span>
                )}
            </div>

            {/* Delivery Price — inline editable, shown when menu type selected */}
            {showDeliveryPrice && (
                <div className="w-24 shrink-0 px-1 py-2.5 whitespace-nowrap hidden sm:block">
                    <div className="flex items-center gap-1">
                        <span className="text-[9px] text-cyan-500 font-bold">🛵</span>
                        {onQuickDeliveryPriceUpdate ? (
                            <InlinePrice
                                value={p.precio_delivery || p.precio}
                                productId={p.id}
                                onSave={onQuickDeliveryPriceUpdate}
                                accentClass="text-cyan-600 dark:text-cyan-400"
                            />
                        ) : (
                            <span className="font-mono font-bold text-sm text-cyan-600 dark:text-cyan-400">{CLP(p.precio_delivery || p.precio)}</span>
                        )}
                    </div>
                    {p.precio_delivery && p.precio_delivery !== p.precio && (
                        <div className="text-[9px] text-light-text-secondary/50 dark:text-dark-text-secondary/50 font-mono mt-0.5">
                            Local: {CLP(p.precio)}
                        </div>
                    )}
                </div>
            )}

            {/* MTZ: Margin */}
            <div className="w-16 shrink-0 px-1 py-2.5 hidden lg:flex items-center justify-center">
                <MarginPill pct={mtz?.margin_pct} />
            </div>

            {/* MTZ: Qty Sold */}
            <div className="w-16 shrink-0 px-1 py-2.5 hidden lg:flex items-center justify-end">
                <span className="text-[11px] font-mono font-semibold text-light-text-secondary dark:text-dark-text-secondary">{mtz ? fmtK(mtz.cantidad) : '—'}</span>
            </div>

            {/* MTZ: Total Sales */}
            <div className="w-20 shrink-0 px-1 py-2.5 hidden lg:flex items-center justify-end">
                <span className="text-[11px] font-mono font-semibold text-light-text-primary dark:text-dark-text-primary">{mtz ? fmtK(mtz.total_venta) : '—'}</span>
            </div>

            {/* Status */}
            <div className="w-14 shrink-0 px-1 py-2.5 hidden sm:flex items-center">
                <StatusToggle active={p.estado} loading={togglingId === p.id} onToggle={() => onToggleStatus?.(p.id, p.estado)} />
            </div>

            {/* Priority / Position */}
            <div className="w-10 shrink-0 px-1 py-2.5 hidden sm:flex items-center justify-center">
                {hasPending ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-light-accent/15 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent text-[10px] font-bold">
                        {idx + 1}
                    </span>
                ) : (
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">{p.prioridad ?? '—'}</span>
                )}
            </div>

            {/* Actions */}
            <div className="w-32 shrink-0 px-2 py-2.5 pr-4 flex items-center gap-1 justify-end opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
                style={{ opacity: isDragging ? 0 : undefined }}>
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
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
//  DragOverlay ghost card — rendered in portal for butter-smooth 60fps
// ═══════════════════════════════════════════════════════════════════════════════
const GhostCard = ({ product }) => {
    if (!product) return null;
    const img = product.media_r2 || product.media_url || (product.media_images || [])[0];
    return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-light-surface dark:bg-dark-surface border-2 border-light-accent/50 dark:border-dark-accent/50 shadow-2xl shadow-black/15 dark:shadow-black/40 backdrop-blur-xl min-w-[260px] max-w-[340px] rotate-[1.5deg]">
            {img ? (
                <img src={img} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 border border-light-border/50" />
            ) : (
                <div className="w-11 h-11 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 opacity-30" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{product.nombre}</p>
                <p className="text-xs font-mono font-semibold text-light-accent dark:text-dark-accent">{CLP(product.precio)}</p>
            </div>
            <GripVertical className="w-4 h-4 text-light-accent/40 dark:text-dark-accent/40 shrink-0" />
        </div>
    );
};

const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: { active: { opacity: '0.5' } },
    }),
};


// ═══════════════════════════════════════════════════════════════════════════════
//  SortableGroupRow — renders a group as a collapsible draggeable block
// ═══════════════════════════════════════════════════════════════════════════════
const SortableGroupRow = ({
    sortableId, groupOpt, groupProducts, idx, isLast, hasPending,
    selectedIds, onToggle, onEdit, onDelete, onAIImagen, onToggleStatus, togglingId,
    codigoToGroup, codigoToMods, getImages, cachebust, t, mtzSummary = {},
    onQuickPriceUpdate, onQuickDeliveryPriceUpdate, showDeliveryPrice,
}) => {
    const [expanded, setExpanded] = useState(false);
    const groupName = groupOpt.option_name || 'Grupo';
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: sortableId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative',
    };

    // Collect first image from each group product for mini-thumbs
    const thumbs = groupProducts.slice(0, 4).map(p => {
        const imgs = getImages(p);
        return imgs.length ? cachebust(imgs[0], p) : null;
    }).filter(Boolean);

    return (
        <div ref={setNodeRef} style={style}>
            {/* Group header row */}
            <div
                className={`flex items-center gap-0 border-b border-light-border/30 dark:border-dark-border/30 ${isLast ? 'border-b-0' : ''} transition-shadow duration-200 ${
                    isDragging
                        ? 'opacity-50 shadow-2xl ring-1 ring-amber-400/30 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl scale-[1.01]'
                        : 'bg-amber-50/30 dark:bg-amber-900/8 hover:bg-amber-50/60 dark:hover:bg-amber-900/15'
                }`}
            >
                {/* Drag handle */}
                <div className="w-9 shrink-0 flex items-center justify-center py-3"
                    {...attributes} {...listeners}>
                    <div className={`cursor-grab active:cursor-grabbing p-1.5 rounded-xl transition-all ${
                        isDragging
                            ? 'text-amber-500 bg-amber-500/15'
                            : 'text-amber-400/40 hover:text-amber-500 hover:bg-amber-500/10'
                    }`}>
                        <GripVertical className="w-4 h-4" />
                    </div>
                </div>

                {/* Expand toggle */}
                <div className="w-8 shrink-0 flex items-center py-3">
                    <button onClick={() => setExpanded(e => !e)} className="p-1 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors">
                        {expanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                    </button>
                </div>

                {/* Group icon + thumbs */}
                <div className="w-14 shrink-0 px-2 py-2.5">
                    <div className="relative w-11 h-11">
                        {thumbs.length > 0 ? (
                            <div className="w-11 h-11 rounded-2xl overflow-hidden border border-amber-300/30 dark:border-amber-500/20 grid grid-cols-2 grid-rows-2">
                                {thumbs.slice(0, 4).map((url, i) => (
                                    <img key={i} src={url} alt="" className="w-full h-full object-cover" />
                                ))}
                            </div>
                        ) : (
                            <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/25 border border-amber-300/30 flex items-center justify-center">
                                <Layers className="w-5 h-5 text-amber-500" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Group name + badges */}
                <div className="flex-1 min-w-0 px-2 py-2.5" onClick={() => setExpanded(e => !e)} style={{cursor:'pointer'}}>
                    <div className="font-bold text-sm text-amber-700 dark:text-amber-400 leading-tight truncate flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 shrink-0" />
                        {groupName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400 border border-amber-300/40">
                            {groupProducts.length} productos
                        </span>
                        {/* Price range */}
                        {(() => {
                            const prices = groupProducts.map(p => p.precio).filter(Boolean);
                            if (!prices.length) return null;
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return (
                                <span className="text-[10px] font-mono text-amber-600/60 dark:text-amber-400/50">
                                    {min === max ? CLP(min) : `${CLP(min)} – ${CLP(max)}`}
                                </span>
                            );
                        })()}
                    </div>
                </div>

                {/* Priority */}
                <div className="w-12 shrink-0 px-2 py-2.5 hidden sm:flex items-center justify-center">
                    {hasPending ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                            {idx + 1}
                        </span>
                    ) : (
                        <span className="text-xs text-amber-500/50 font-medium">{groupOpt.category_priority ?? '—'}</span>
                    )}
                </div>

                {/* Spacers to match product row widths */}
                <div className="w-24 shrink-0 hidden sm:block" />
                <div className="w-20 shrink-0 hidden sm:block" />
                <div className="w-32 shrink-0" />
            </div>

            {/* Expanded sub-rows */}
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-l-2 border-l-amber-400/60 dark:border-l-amber-500/40 ml-4"
                    >
                        {groupProducts.map((p, pi) => (
                            <SortableRow
                                key={`grp-sub-${p.id}`}
                                sortableId={`__nosort__${p.id}`}
                                product={p}
                                idx={pi}
                                catId="__sub__"
                                isLast={pi === groupProducts.length - 1}
                                extraClass=""
                                hasPending={false}
                                multiCatCount={1}
                                selectedIds={selectedIds}
                                onToggle={onToggle}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onAIImagen={onAIImagen}
                                onToggleStatus={onToggleStatus}
                                togglingId={togglingId}
                                codigoToGroup={codigoToGroup}
                                codigoToMods={codigoToMods}
                                getImages={getImages}
                                cachebust={cachebust}
                                t={t}
                                mtzSummary={mtzSummary}
                                onQuickPriceUpdate={onQuickPriceUpdate}
                                onQuickDeliveryPriceUpdate={onQuickDeliveryPriceUpdate}
                                showDeliveryPrice={showDeliveryPrice}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
//  SortableCategory — wraps a category's mixed items in SortableContext
// ═══════════════════════════════════════════════════════════════════════════════
const SortableCategory = ({
    catId, items, hasPending, isSaving, multiCatCounts,
    selectedIds, onToggle, onEdit, onDelete, onAIImagen, onToggleStatus, togglingId,
    codigoToGroup, codigoToMods, getImages, cachebust, t, mtzSummary = {},
    onQuickPriceUpdate, onQuickDeliveryPriceUpdate, showDeliveryPrice,
}) => {
    // items = array of { type: 'product', product } | { type: 'group', groupId, groupOpt, products }
    const sortIds = useMemo(() => items.map(item =>
        item.type === 'group' ? makeSortId(catId, `grp_${item.groupId}`) : makeSortId(catId, item.product.id)
    ), [items, catId]);

    return (
        <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
            {/* Column headers */}
            <div className="hidden sm:flex items-center gap-0 border-b border-light-border/30 dark:border-dark-border/30 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                <div className="w-9 shrink-0 px-1 py-2" />
                <div className="w-8 shrink-0 py-2" />
                <div className="w-14 shrink-0 px-2 py-2">{t('carta.col_image')}</div>
                <div className="flex-1 px-2 py-2">{t('carta.col_name')}</div>
                <div className="w-20 shrink-0 px-1 py-2 hidden sm:block">{t('carta.col_price')}</div>
                <div className="w-20 shrink-0 px-1 py-2 hidden lg:block text-amber-600 dark:text-amber-400">MTZ $</div>
                {showDeliveryPrice && <div className="w-24 shrink-0 px-1 py-2 hidden sm:block text-cyan-600 dark:text-cyan-400">🛵 Delivery</div>}
                <div className="w-16 shrink-0 px-1 py-2 hidden lg:block text-center">Margen</div>
                <div className="w-16 shrink-0 px-1 py-2 hidden lg:block text-right">Vendido</div>
                <div className="w-20 shrink-0 px-1 py-2 hidden lg:block text-right">Venta $</div>
                <div className="w-14 shrink-0 px-1 py-2 hidden sm:block">{t('carta.col_status')}</div>
                <div className="w-10 shrink-0 px-1 py-2 hidden sm:block text-center">
                    {hasPending ? '🔄' : '#'}
                </div>
                <div className="w-32 shrink-0 px-2 py-2 pr-4" />
            </div>

            {/* Sortable rows — mixed products and groups */}
            {items.map((item, idx) => {
                if (item.type === 'group') {
                    return (
                        <SortableGroupRow
                            key={makeSortId(catId, `grp_${item.groupId}`)}
                            sortableId={makeSortId(catId, `grp_${item.groupId}`)}
                            groupOpt={item.groupOpt}
                            groupProducts={item.products}
                            idx={idx}
                            isLast={idx === items.length - 1}
                            hasPending={hasPending}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onAIImagen={onAIImagen}
                            onToggleStatus={onToggleStatus}
                            togglingId={togglingId}
                            codigoToGroup={codigoToGroup}
                            codigoToMods={codigoToMods}
                            getImages={getImages}
                            cachebust={cachebust}
                            t={t}
                            mtzSummary={mtzSummary}
                            onQuickPriceUpdate={onQuickPriceUpdate}
                            onQuickDeliveryPriceUpdate={onQuickDeliveryPriceUpdate}
                            showDeliveryPrice={showDeliveryPrice}
                        />
                    );
                }
                return (
                    <SortableRow
                        key={makeSortId(catId, item.product.id)}
                        sortableId={makeSortId(catId, item.product.id)}
                        product={item.product}
                        idx={idx}
                        catId={catId}
                        isLast={idx === items.length - 1}
                        extraClass=""
                        hasPending={hasPending}
                        multiCatCount={multiCatCounts[item.product.id] || 1}
                        selectedIds={selectedIds}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onAIImagen={onAIImagen}
                        onToggleStatus={onToggleStatus}
                        togglingId={togglingId}
                        codigoToGroup={codigoToGroup}
                        codigoToMods={codigoToMods}
                        getImages={getImages}
                        cachebust={cachebust}
                        onQuickPriceUpdate={onQuickPriceUpdate}
                        onQuickDeliveryPriceUpdate={onQuickDeliveryPriceUpdate}
                        showDeliveryPrice={showDeliveryPrice}
                        t={t}
                        mtzSummary={mtzSummary}
                    />
                );
            })}
        </SortableContext>
    );
};


// ═══════════════════════════════════════════════════════════════════════════════
//  Mobile card (unchanged — no drag on mobile)
// ═══════════════════════════════════════════════════════════════════════════════
const MobileCard = ({ p, sel, imgs, onToggle, onEdit, onDelete, onAIImagen, onQuickPriceUpdate, t }) => (
    <motion.div
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
                <CheckBtn checked={sel} onClick={() => onToggle(p.id)} className="bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-xl shadow-sm" />
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <StatusToggle active={p.estado} />
            </div>
        </div>
        <div className="p-3 space-y-1.5">
            <div className="font-bold text-sm text-light-text-primary dark:text-dark-text-primary leading-tight line-clamp-2">{p.nombre}</div>
            <div className="text-sm">
                {onQuickPriceUpdate ? (
                    <InlinePrice value={p.precio} productId={p.id} onSave={onQuickPriceUpdate} />
                ) : (
                    <span className="font-mono font-bold text-light-accent dark:text-dark-accent">{CLP(p.precio)}</span>
                )}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
                {onAIImagen && (
                    <button onClick={() => onAIImagen(p)} className="p-1.5 rounded-xl bg-violet-500/10 border border-violet-400/20 text-violet-500 hover:bg-violet-500/20 transition-all">
                        <Sparkles className="w-3.5 h-3.5" />
                    </button>
                )}
                <button onClick={() => onEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent hover:border-light-accent/30 transition-all">
                    <Edit2 className="w-3.5 h-3.5" />{t('carta.edit')}
                </button>
                <button onClick={() => onDelete(p.id, p.nombre)} className="p-1.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary hover:text-red-500 hover:border-red-400/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    </motion.div>
);


// ═══════════════════════════════════════════════════════════════════════════════
//  ProductsTable — main component
// ═══════════════════════════════════════════════════════════════════════════════
const ProductsTable = ({
    products, categories, menuOptions = [], mtzSummary = {},
    selectedMenuType,
    selectedIds, onToggle, onToggleAll,
    onEdit, onDelete, onAIImagen, onReorder, onReorderGroups, onReorderCategoryProducts,
    onToggleStatus, onRefresh, onQuickPriceUpdate, onQuickDeliveryPriceUpdate,
}) => {
    const { t } = useTranslation();
    const allSelected  = products.length > 0 && selectedIds.length === products.length;
    const someSelected = selectedIds.length > 0 && selectedIds.length < products.length;

    // Show delivery price column when a specific menu type is selected
    const showDeliveryPrice = Boolean(selectedMenuType);

    const [collapsed, setCollapsed] = useState({});
    const toggleCollapse = (k) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

    const [pendingReorder, setPendingReorder] = useState({});
    const [saving, setSaving] = useState({});
    const [activeItem, setActiveItem] = useState(null); // { type, product?, groupOpt? }
    const [togglingId, setTogglingId] = useState(null);

    const handleToggleStatus = async (productId, currentEstado) => {
        if (!onToggleStatus) return;
        setTogglingId(productId);
        try { await onToggleStatus(productId, !currentEstado); }
        finally { setTogglingId(null); }
    };

    // ── Sensors ──────────────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    );

    // ── Indexes ──────────────────────────────────────────────────────────────
    const isModifier = (opt) => !!(String(opt?.menu_id || '').trim() && String(opt.menu_id).trim() !== 'None');

    const codigoToGroup = useMemo(() => {
        const map = {};
        for (const opt of menuOptions.filter(o => !isModifier(o)))
            for (const v of (opt.values || []))
                if (v.codigo) map[v.codigo] = { key: opt.id || opt._id, name: opt.option_name };
        return map;
    }, [menuOptions]);

    const codigoToMods = useMemo(() => {
        const map = {};
        for (const opt of menuOptions.filter(isModifier))
            for (const v of (opt.values || [])) {
                if (!v.codigo) continue;
                if (!map[v.codigo]) map[v.codigo] = [];
                if (!map[v.codigo].includes(opt.option_name)) map[v.codigo].push(opt.option_name);
            }
        return map;
    }, [menuOptions]);

    // Build a map: groupId -> groupOpt object (product_groups only)
    const productGroupsById = useMemo(() => {
        const map = {};
        for (const opt of menuOptions.filter(o => !isModifier(o))) {
            const gid = opt.id || opt._id;
            if (gid) map[gid] = opt;
        }
        return map;
    }, [menuOptions]);

    const catPaletteMap = useMemo(() => {
        const map = {};
        categories.forEach((c, i) => { map[c.id] = CAT_PALETTES[i % CAT_PALETTES.length]; });
        return map;
    }, [categories]);

    // ── Build mixed items list per category using category.menu_ids as source of truth ──
    const grouped = useMemo(() => {
        // Index all products by ID for O(1) lookup
        const productById = {};
        for (const p of products) productById[String(p.id)] = p;

        const usedProductIds = new Set();
        const buckets = [];

        for (const cat of categories) {
            const menuIds = (cat.menu_ids || []).map(String);
            // Build position index from menu_ids (canonical ordering)
            const posIndex = {};
            menuIds.forEach((id, i) => { posIndex[id] = i; });

            // Collect products from menu_ids that exist in our products list
            const catProducts = menuIds
                .map(mid => productById[mid])
                .filter(Boolean);

            // Also include products that have this category in their category_ids but aren't in menu_ids
            for (const p of products) {
                const pId = String(p.id);
                if (!posIndex.hasOwnProperty(pId) && (p.category_ids || []).includes(cat.id)) {
                    catProducts.push(p);
                    posIndex[pId] = menuIds.length + catProducts.length; // append at end
                }
            }

            if (catProducts.length === 0) {
                // Still show empty categories so admin knows they exist
                buckets.push({ catId: cat.id, cat, products: [], items: [] });
                continue;
            }

            catProducts.forEach(p => usedProductIds.add(String(p.id)));

            const groupedProductIds = new Set();
            const groupItems = [];

            // Find all product groups and their members in this category
            for (const p of catProducts) {
                const g = p.codigo ? codigoToGroup[p.codigo] : null;
                if (g) {
                    groupedProductIds.add(p.id);
                    const existing = groupItems.find(gi => gi.type === 'group' && gi.groupId === g.key);
                    if (existing) {
                        existing.products.push(p);
                    } else {
                        const groupOpt = productGroupsById[g.key];
                        if (groupOpt) {
                            const firstPos = posIndex[String(p.id)] ?? 9999;
                            groupItems.push({
                                type: 'group',
                                groupId: g.key,
                                groupOpt,
                                products: [p],
                                sortPriority: groupOpt.category_priority ?? firstPos,
                            });
                        }
                    }
                }
            }

            // Solo products — use position in menu_ids for ordering
            const soloItems = catProducts
                .filter(p => !groupedProductIds.has(p.id))
                .map(p => ({
                    type: 'product',
                    product: p,
                    sortPriority: posIndex[String(p.id)] ?? (p.prioridad ?? 9999),
                }));

            // Merge and sort by position in menu_ids
            const mixed = [...soloItems, ...groupItems].sort((a, b) => a.sortPriority - b.sortPriority);
            buckets.push({ catId: cat.id, cat, products: catProducts, items: mixed });
        }

        // Sort categories by prioridad
        buckets.sort((a, b) => (a.cat?.prioridad ?? 9999) - (b.cat?.prioridad ?? 9999));

        // Uncategorized: products not in any category's menu_ids
        const uncategorized = products.filter(p => !usedProductIds.has(String(p.id)));
        if (uncategorized.length) {
            uncategorized.sort((a, b) => (a.prioridad ?? 9999) - (b.prioridad ?? 9999));
            buckets.push({
                catId: '__none__', cat: null,
                products: uncategorized,
                items: uncategorized.map(p => ({ type: 'product', product: p, sortPriority: p.prioridad ?? 9999 })),
            });
        }
        return buckets;
    }, [products, categories, codigoToGroup, productGroupsById]);

    // Count how many categories each product belongs to (for badge)
    const multiCatCounts = useMemo(() => {
        const counts = {};
        for (const p of products) {
            const catIds = (p.category_ids || []).filter(Boolean);
            counts[p.id] = catIds.length;
        }
        return counts;
    }, [products]);

    const getItems = useCallback((catId, src) => pendingReorder[catId] || src, [pendingReorder]);

    const getImages = useCallback((p) => {
        if (p.media_images?.length) return p.media_images;
        if (p.media_r2 || p.media_url) return [p.media_r2 || p.media_url];
        return [];
    }, []);

    const cachebust = useCallback((url, p) => {
        if (!url || url.includes('?')) return url;
        if (p?.updated_at) return `${url}?v=${new Date(p.updated_at).getTime()}`;
        return url;
    }, []);

    // ── Product lookup by ID ─────────────────────────────────────────────────
    const productById = useMemo(() => {
        const map = {};
        for (const p of products) map[p.id] = p;
        return map;
    }, [products]);

    // ── dnd-kit event handlers (composite IDs: catId::productId or catId::grp_groupId) ──
    const handleDragStart = useCallback((event) => {
        const { pid } = parseSortId(event.active.id);
        if (pid.startsWith('grp_')) {
            const groupId = pid.replace('grp_', '');
            const groupOpt = productGroupsById[groupId];
            setActiveItem(groupOpt ? { type: 'group', groupOpt } : null);
        } else {
            setActiveItem(productById[pid] ? { type: 'product', product: productById[pid] } : null);
        }
    }, [productById, productGroupsById]);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveItem(null);
        if (!over || active.id === over.id) return;

        const a = parseSortId(active.id);
        const o = parseSortId(over.id);
        // Only allow reorder within the same category
        if (a.catId !== o.catId) return;

        const catId = a.catId;
        const bucket = grouped.find(g => g.catId === catId);
        if (!bucket) return;

        const current = pendingReorder[catId] || [...bucket.items];
        const getItemKey = (item) => item.type === 'group' ? `grp_${item.groupId}` : item.product.id;
        const oldIndex = current.findIndex(item => getItemKey(item) === a.pid);
        const newIndex = current.findIndex(item => getItemKey(item) === o.pid);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const newList = arrayMove(current, oldIndex, newIndex);
        setPendingReorder(prev => ({ ...prev, [catId]: newList }));
    }, [grouped, pendingReorder]);

    const handleDragCancel = useCallback(() => setActiveItem(null), []);

    // ── Save / discard ───────────────────────────────────────────────────────
    const saveReorder = useCallback(async (catId) => {
        const list = pendingReorder[catId];
        if (!list) return;
        setSaving(p => ({ ...p, [catId]: true }));
        try {
            const promises = [];

            if (catId === '__none__') {
                // Uncategorized bucket: update global prioridad (no category to save menu_ids on)
                const productItems = [];
                const groupItems = [];
                list.forEach((item, i) => {
                    if (item.type === 'group') {
                        groupItems.push({ id: item.groupId, category_priority: i });
                    } else {
                        productItems.push({ id: item.product.id, prioridad: i });
                    }
                });
                if (productItems.length && onReorder) promises.push(onReorder(productItems));
                if (groupItems.length && onReorderGroups) promises.push(onReorderGroups(groupItems));
            } else {
                // Real category: ONLY update menu_ids on this category
                // This keeps each category's order independent — no global prioridad contamination
                if (onReorderCategoryProducts) {
                    const orderedProductIds = list.flatMap(item =>
                        item.type === 'group'
                            ? item.products.map(p => p.id)
                            : [item.product.id]
                    );
                    promises.push(onReorderCategoryProducts(catId, orderedProductIds));
                }
            }

            await Promise.all(promises);
            setPendingReorder(p => { const n = { ...p }; delete n[catId]; return n; });
            // Refresh data from backend so products reflect new priorities
            if (onRefresh) onRefresh();
        } catch (err) { alert(`Error: ${err.message}`); }
        finally { setSaving(p => ({ ...p, [catId]: false })); }
    }, [pendingReorder, onReorder, onReorderGroups, onReorderCategoryProducts]);

    const discard = useCallback((catId) => {
        setPendingReorder(p => { const n = { ...p }; delete n[catId]; return n; });
    }, []);

    // ── Render category ──────────────────────────────────────────────────────
    const renderCategory = (bucket, paletteIdx) => {
        const { catId, cat, products: srcProds, items: srcItems } = bucket;
        const items = getItems(catId, srcItems);
        const hasPending = !!pendingReorder[catId];
        const isSaving = !!saving[catId];

        const palette = catId === '__none__'
            ? { bg: 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/10', border: 'border-light-border dark:border-dark-border', text: 'text-light-text-secondary dark:text-dark-text-secondary', dot: 'bg-light-text-secondary/30', chip: 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary' }
            : (catPaletteMap[catId] || CAT_PALETTES[paletteIdx % CAT_PALETTES.length]);

        const isCol = collapsed[catId];
        const catName = catId === '__none__' ? 'Sin categoría' : (cat?.nombre || 'Sin categoría');
        const totalProducts = srcProds?.length || items.reduce((sum, item) => sum + (item.type === 'group' ? item.products.length : 1), 0);
        const allSel = srcProds?.length > 0 && srcProds.every(p => selectedIds.includes(p.id));
        const someSel = srcProds?.some(p => selectedIds.includes(p.id));
        const toggleAll = () => {
            const ids = (srcProds || []).map(p => p.id);
            if (allSel) onToggleAll(selectedIds.filter(id => !ids.includes(id)));
            else onToggleAll([...new Set([...selectedIds, ...ids])]);
        };

        return (
            <div key={catId} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${palette.border} ${hasPending ? 'ring-2 ring-light-accent/40 dark:ring-dark-accent/40 shadow-lg shadow-light-accent/5' : ''}`}>
                {/* Header */}
                <div onClick={() => toggleCollapse(catId)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${palette.bg} hover:opacity-90 transition-opacity`}>
                    <div onClick={e => { e.stopPropagation(); toggleAll(); }}>
                        <CheckBtn checked={allSel && totalProducts > 0} indeterminate={someSel && !allSel} />
                    </div>
                    {isCol ? <ChevronRight className={`w-4 h-4 shrink-0 ${palette.text}`} /> : <ChevronDown className={`w-4 h-4 shrink-0 ${palette.text}`} />}
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dot}`} />
                    <span className={`font-bold text-sm flex-1 truncate ${palette.text}`}>{catName}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${palette.chip}`}>
                        {totalProducts} {totalProducts === 1 ? 'producto' : 'productos'}
                    </span>
                    {cat?.prioridad != null && (
                        <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-50">p={cat.prioridad}</span>
                    )}
                    {hasPending && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => saveReorder(catId)} disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-[11px] font-bold shadow-neon hover:opacity-90 transition-opacity disabled:opacity-50">
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Guardar
                            </button>
                            <button onClick={() => discard(catId)}
                                className="px-2.5 py-1.5 rounded-xl border border-light-border dark:border-dark-border text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:border-red-400/30 transition-colors">
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                <AnimatePresence initial={false}>
                    {!isCol && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="overflow-hidden">

                            {/* Desktop — sortable */}
                            <div className="hidden md:block">
                                <SortableCategory
                                    catId={catId} items={items} hasPending={hasPending} isSaving={isSaving}
                                    multiCatCounts={multiCatCounts}
                                    selectedIds={selectedIds} onToggle={onToggle}
                                    onEdit={onEdit} onDelete={onDelete} onAIImagen={onAIImagen}
                                    onToggleStatus={handleToggleStatus} togglingId={togglingId}
                                    codigoToGroup={codigoToGroup} codigoToMods={codigoToMods}
                                    getImages={getImages} cachebust={cachebust} t={t}
                                    mtzSummary={mtzSummary}
                                    onQuickPriceUpdate={onQuickPriceUpdate}
                                    onQuickDeliveryPriceUpdate={onQuickDeliveryPriceUpdate}
                                    showDeliveryPrice={showDeliveryPrice}
                                />
                            </div>

                            {/* Mobile — cards (no drag) */}
                            <div className="md:hidden p-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {(srcProds || []).map(p => {
                                    const imgs = getImages(p).map(u => cachebust(u, p));
                                    return <MobileCard key={p.id} p={p} sel={selectedIds.includes(p.id)} imgs={imgs} onQuickPriceUpdate={onQuickPriceUpdate}
                                        onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onAIImagen={onAIImagen} t={t} />;
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    // ── Empty state ──────────────────────────────────────────────────────────
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                    <CheckBtn
                        checked={allSelected} indeterminate={someSelected}
                        onClick={() => allSelected ? onToggleAll([]) : onToggleAll(products.map(p => p.id))}
                    />
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {someSelected || allSelected
                            ? `${selectedIds.length} de ${products.length} seleccionados`
                            : `${products.length} productos en ${grouped.length} ${grouped.length === 1 ? 'categoría' : 'categorías'}`}
                    </span>
                    <span className="text-[10px] text-light-text-secondary/40 dark:text-dark-text-secondary/40 flex items-center gap-1 select-none">
                        <GripVertical className="w-3 h-3" /> Arrastra ⋮⋮ para ordenar
                    </span>
                </div>

                {grouped.map((bucket, i) => renderCategory(bucket, i))}
            </div>

            {/* Portal-rendered ghost overlay — CSS transform, no layout thrash */}
            <DragOverlay dropAnimation={dropAnimation}>
                {activeItem?.type === 'product' && activeItem.product ? (
                    <GhostCard product={activeItem.product} />
                ) : activeItem?.type === 'group' && activeItem.groupOpt ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-400/60 shadow-2xl">
                        <Layers className="w-5 h-5 text-amber-500" />
                        <span className="font-bold text-sm text-amber-700 dark:text-amber-400">
                            {activeItem.groupOpt.option_name || 'Grupo'}
                        </span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default ProductsTable;
