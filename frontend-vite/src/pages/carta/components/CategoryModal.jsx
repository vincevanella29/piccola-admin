/**
 * CategoryModal — Editar / crear categoría con tab de productos.
 *
 * Tabs:
 *   1. Info      — nombre, alias, prioridad, estado
 *   2. Productos — lista de productos vinculados, búsqueda inline para agregar/quitar
 *
 * Los productos se guardan como `menu_ids` en la categoría (array de product IDs).
 * Al agregar un producto, también se llama `onAddProductToCategory` para que
 * AdminCarta pueda actualizar el campo `category_ids` del producto si es necesario.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tags, X, Loader2, Save, AlertTriangle, Package,
    Search, Plus, Minus, ImageIcon, ChevronRight,
} from 'lucide-react';

const INPUT = 'w-full px-3.5 py-2.5 rounded-xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-shadow';

const Field = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{label}</label>
        {children}
    </div>
);

// ── Tab pill ─────────────────────────
const TabBtn = ({ active, onClick, icon: Icon, label, count }) => (
    <button type="button" onClick={onClick}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            active
                ? 'bg-light-accent/10 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
        {count != null && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                active ? 'bg-light-accent/20 text-light-accent dark:bg-dark-accent/25 dark:text-dark-accent' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
            }`}>{count}</span>
        )}
    </button>
);

// ── Product thumb ─────────────────────
const ProductThumb = ({ p }) => {
    const img = p.media_r2 || p.media_url || (p.media_images || [])[0];
    return (
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border shrink-0 flex items-center justify-center">
            {img ? <img src={img} alt={p.nombre} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 opacity-30 text-light-text-secondary" />}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
const CategoryModal = ({ category, onClose, onSave, products = [] }) => {
    const { t } = useTranslation();
    const isEdit = !!category?.id;

    // ── Form state ────────────────────────────────────────────────────────────
    const [tab, setTab] = useState('info');
    const [form, setForm] = useState({
        nombre:    category?.nombre    || '',
        alias:     category?.alias     || '',
        estado:    category?.estado    ?? true,
        prioridad: category?.prioridad ?? 0,
    });

    // menu_ids = product IDs linked to this category
    const [linkedIds, setLinkedIds] = useState(() => new Set(category?.menu_ids || []));

    const [saving, setSaving]    = useState(false);
    const [msg, setMsg]          = useState(null);
    const [productSearch, setProductSearch] = useState('');

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    // ── Products split: linked vs available ───────────────────────────────────
    const linkedProducts = useMemo(() =>
        products.filter(p => linkedIds.has(p.id || p._id)),
    [products, linkedIds]);

    const searchLower = productSearch.toLowerCase();
    const availableProducts = useMemo(() =>
        products.filter(p => {
            if (linkedIds.has(p.id || p._id)) return false;
            if (!searchLower) return true;
            return p.nombre?.toLowerCase().includes(searchLower) || p.codigo?.toLowerCase().includes(searchLower);
        }),
    [products, linkedIds, searchLower]);

    const toggleLink = (p) => {
        const id = p.id || p._id;
        setLinkedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) { setMsg('El nombre es requerido.'); return; }
        setSaving(true); setMsg(null);
        try {
            await onSave(category?.id, {
                nombre:    form.nombre.trim(),
                alias:     form.alias.trim(),
                estado:    form.estado,
                prioridad: form.prioridad !== '' ? parseInt(form.prioridad, 10) : 0,
                menu_ids:  [...linkedIds],
            });
            onClose();
        } catch (err) {
            setMsg(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const linkedCount = linkedIds.size;

    return (
        <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="w-full sm:max-w-xl bg-light-surface dark:bg-dark-surface sm:rounded-2xl rounded-t-3xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden flex flex-col max-h-[92dvh]"
            >
                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-light-border dark:bg-dark-border" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/15 flex items-center justify-center">
                            <Tags className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                                {isEdit ? t('carta.category_modal_edit') : t('carta.category_modal_new')}
                            </h2>
                            {isEdit && form.nombre && (
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{form.nombre}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center hover:opacity-80 transition-opacity">
                        <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                <div className="h-px bg-light-border dark:bg-dark-border mx-6" />

                {/* Tabs */}
                <div className="flex items-center gap-1 px-6 py-3 border-b border-light-border dark:border-dark-border shrink-0">
                    <TabBtn active={tab === 'info'}     onClick={() => setTab('info')}     icon={Tags}    label="Información" />
                    <TabBtn active={tab === 'products'} onClick={() => setTab('products')} icon={Package} label="Productos" count={linkedCount} />
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {tab === 'info' && (
                            <motion.div key="info"
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                                className="px-6 py-5 space-y-4">

                                {msg && (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                                        <AlertTriangle className="w-4 h-4 shrink-0" /> {msg}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <Field label={t('carta.field_name')}>
                                            <input type="text" value={form.nombre}
                                                onChange={e => set('nombre', e.target.value)}
                                                className={INPUT} placeholder="Ej: Pastas" autoFocus />
                                        </Field>
                                    </div>
                                    <Field label={t('carta.field_alias')}>
                                        <input type="text" value={form.alias}
                                            onChange={e => set('alias', e.target.value)}
                                            className={INPUT} placeholder="pastas" />
                                    </Field>
                                    <Field label={t('carta.field_priority')}>
                                        <input type="number" value={form.prioridad}
                                            onChange={e => set('prioridad', e.target.value)}
                                            className={INPUT} />
                                    </Field>
                                    <div className="col-span-2">
                                        <Field label={t('carta.field_status')}>
                                            <button type="button" onClick={() => set('estado', !form.estado)}
                                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${form.estado
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                                                <span className={`w-2 h-2 rounded-full ${form.estado ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {form.estado ? t('carta.active_f') : t('carta.inactive_f')}
                                            </button>
                                        </Field>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {tab === 'products' && (
                            <motion.div key="products"
                                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                                className="flex flex-col h-full">

                                {/* Linked products list */}
                                <div className="px-6 pt-4 pb-2">
                                    <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">
                                        Productos en esta categoría ({linkedCount})
                                    </p>
                                    {linkedProducts.length === 0 ? (
                                        <div className="flex flex-col items-center py-8 gap-2 text-light-text-secondary dark:text-dark-text-secondary border-2 border-dashed border-light-border dark:border-dark-border rounded-2xl">
                                            <Package className="w-8 h-8 opacity-25" />
                                            <p className="text-xs">Sin productos vinculados aún</p>
                                            <p className="text-[11px] opacity-60">Búscalos abajo y toca + para agregar</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {linkedProducts.map(p => (
                                                <div key={p.id || p._id}
                                                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-light-border dark:border-dark-border bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 group">
                                                    <ProductThumb p={p} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</div>
                                                        {p.codigo && <div className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</div>}
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                                        p.estado ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                                    }`}>
                                                        {p.estado ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                    <button type="button" onClick={() => toggleLink(p)}
                                                        className="p-1.5 rounded-xl border border-red-200/60 dark:border-red-800/30 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 transition-all shrink-0">
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-light-border dark:bg-dark-border mx-6 my-2" />

                                {/* Add products panel */}
                                <div className="px-6 pb-4 flex-1 flex flex-col gap-2">
                                    <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                                        Agregar productos
                                    </p>
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                                        <input type="text" value={productSearch}
                                            onChange={e => setProductSearch(e.target.value)}
                                            placeholder="Buscar por nombre o código…"
                                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent" />
                                    </div>
                                    {/* Available list */}
                                    <div className="space-y-1.5 overflow-y-auto max-h-52 pr-1">
                                        {availableProducts.length === 0 ? (
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center py-6 opacity-60">
                                                {productSearch ? 'Sin resultados' : 'Todos los productos ya están vinculados'}
                                            </p>
                                        ) : availableProducts.map(p => (
                                            <div key={p.id || p._id}
                                                className="flex items-center gap-3 px-3 py-2 rounded-xl border border-light-border dark:border-dark-border hover:border-light-accent/30 dark:hover:border-dark-accent/30 hover:bg-light-accent/3 dark:hover:bg-dark-accent/5 transition-colors group">
                                                <ProductThumb p={p} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</div>
                                                    {p.codigo && <div className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</div>}
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold hidden sm:inline shrink-0 ${
                                                    p.estado ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                                }`}>
                                                    {p.estado ? 'Activo' : 'Inactivo'}
                                                </span>
                                                <button type="button" onClick={() => toggleLink(p)}
                                                    className="p-1.5 rounded-xl border border-light-accent/30 dark:border-dark-accent/30 text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all shrink-0">
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 py-4 border-t border-light-border dark:border-dark-border bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/10 shrink-0">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                        {t('carta.cancel')}
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-neon disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? t('carta.saving') : t('carta.save')}
                        {linkedCount > 0 && !saving && (
                            <span className="text-white/70 text-xs font-normal">• {linkedCount} prods</span>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default CategoryModal;
