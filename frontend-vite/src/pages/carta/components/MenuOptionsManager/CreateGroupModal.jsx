/**
 * CreateGroupModal — Apple-style, two modes:
 *   modifier      → customisation options linked to a parent product
 *   product_group → N products grouped together in the digital menu
 *
 * ONLY uses Tailwind classes defined in tailwind.config.js.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Sliders, Boxes, Search, Plus, Trash2, Save,
    Loader2, AlertTriangle, CheckCircle, ChevronDown,
    Package,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

// ─── constants ────────────────────────────────────────────────────────────────
const MODE_MODIFIER      = 'modifier';
const MODE_PRODUCT_GROUP = 'product_group';
const DISPLAY_TYPES      = ['select', 'quantity', 'checkbox'];

// ─── shared input classes (only config colours) ───────────────────────────────
const INPUT = [
    'w-full px-4 py-2.5 rounded-xl text-sm',
    'bg-light-surface dark:bg-dark-surface-secondary',
    'border border-light-border dark:border-dark-border',
    'text-light-text-primary dark:text-dark-text-primary',
    'placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary',
    'focus:outline-none focus:ring-2',
    'focus:ring-light-accent dark:focus:ring-dark-accent',
    'transition-all',
].join(' ');

const SELECT = `${INPUT} appearance-none cursor-pointer`;

const CELL = [
    'w-full px-3 py-2 rounded-lg text-xs',
    'bg-light-surface dark:bg-dark-surface-secondary',
    'border border-light-border dark:border-dark-border',
    'text-light-text-primary dark:text-dark-text-primary',
    'focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent',
].join(' ');

// ─── Toggle ───────────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
            type="button"
            onClick={onChange}
            style={{ minWidth: 40, height: 24 }}
            className={`relative rounded-full transition-colors duration-200 ${
                checked
                    ? 'bg-light-accent dark:bg-dark-accent'
                    : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
            }`}
        >
            <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-light-surface dark:bg-dark-text-primary shadow transition-transform duration-200 ${
                    checked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
            />
        </button>
        <span className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
            {label}
        </span>
    </label>
);

// ─── Dropdown product picker ──────────────────────────────────────────────────
const ProductPicker = ({ products, value, onChange, placeholder, clearable = false }) => {
    const [open, setOpen]     = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    const selected = products.find(p => (p.id || p._id) === value);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return q
            ? products.filter(p =>
                p.nombre?.toLowerCase().includes(q) ||
                p.codigo?.toLowerCase().includes(q)
              )
            : products;
    }, [products, search]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`${INPUT} text-left flex items-center justify-between gap-2`}>
                <span className={`truncate ${selected ? '' : 'opacity-50'}`}>
                    {selected
                        ? `${selected.nombre}${selected.codigo ? ` — ${selected.codigo}` : ''}`
                        : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full top-full mt-1.5 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow-modal overflow-hidden">
                        <div className="p-2 border-b border-light-border dark:border-dark-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                                <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
                                    placeholder="Buscar…"
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent" />
                            </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto scrollbar-none">
                            {clearable && value && (
                                <button type="button"
                                    onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
                                    className="w-full text-left px-4 py-2.5 text-xs italic text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                                    (ninguno)
                                </button>
                            )}
                            {filtered.map(p => (
                                <button key={p.id || p._id} type="button"
                                    onClick={() => { onChange(p); setOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-3 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors ${
                                        (p.id || p._id) === value
                                            ? 'bg-light-accent-10 dark:bg-dark-accent-10'
                                            : ''
                                    }`}>
                                    {(p.media_r2 || p.media_url) && (
                                        <img src={p.media_r2 || p.media_url} alt=""
                                            className="w-8 h-8 rounded-lg object-cover shrink-0 border border-light-border dark:border-dark-border" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</div>
                                        {p.codigo && <div className="font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</div>}
                                    </div>
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <p className="px-4 py-4 text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">Sin resultados</p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Inline search (inside panels) ───────────────────────────────────────────
const SearchInline = ({ products, onPick }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        const lq = q.toLowerCase();
        return lq
            ? products.filter(p =>
                p.nombre?.toLowerCase().includes(lq) ||
                p.codigo?.toLowerCase().includes(lq)
              )
            : products;
    }, [products, q]);

    return (
        <div>
            <div className="relative mb-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Buscar…"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent" />
            </div>
            <div className="max-h-48 overflow-y-auto scrollbar-none">
                {filtered.map(p => (
                    <button key={p.id || p._id} type="button" onClick={() => onPick(p)}
                        className="w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors rounded-lg">
                        {(p.media_r2 || p.media_url) && (
                            <img src={p.media_r2 || p.media_url} alt=""
                                className="w-7 h-7 rounded-lg object-cover shrink-0 border border-light-border dark:border-dark-border" />
                        )}
                        <div className="min-w-0">
                            <div className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</div>
                            {p.codigo && <div className="font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</div>}
                        </div>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <p className="px-3 py-3 text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">Sin resultados</p>
                )}
            </div>
        </div>
    );
};

// ─── Modifier form ────────────────────────────────────────────────────────────
const ModifierForm = ({ form, setForm, products, t }) => {
    const [showPicker, setShowPicker] = useState(false);

    const updateValue = (i, key, val) => setForm(f => {
        const vs = [...f.values];
        vs[i] = { ...vs[i], [key]: val };
        return { ...f, values: vs };
    });
    const removeValue  = (i) => setForm(f => ({ ...f, values: f.values.filter((_, idx) => idx !== i) }));
    const addComment   = () => setForm(f => ({
        ...f, values: [...f.values, { _type: 'comment', name: '', codigo: '', price: 0, priority: f.values.length }]
    }));
    const addFromProduct = (p) => {
        if (!p) return;
        setForm(f => ({
            ...f, values: [...f.values, {
                _type: 'product', _ref_id: p.id || p._id,
                name: p.nombre, codigo: p.codigo || '',
                price: 0, priority: f.values.length,
            }]
        }));
        setShowPicker(false);
    };

    return (
        <div className="space-y-5">
            {/* Parent product */}
            <div className="space-y-1.5">
                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase">
                    {t('carta.cg_parent_product')}{' '}
                    <span className="font-normal normal-case">{t('carta.cg_parent_optional')}</span>
                </label>
                <ProductPicker
                    products={products}
                    value={form.menu_id}
                    onChange={p => setForm(f => ({ ...f, menu_id: p ? (p.id || p._id) : '' }))}
                    placeholder={t('carta.cg_parent_placeholder')}
                    clearable
                />
            </div>

            {/* Options list */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase">
                        {t('carta.cg_options')} <span className="font-normal">({form.values.length})</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setShowPicker(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                showPicker
                                    ? 'bg-light-accent-15 dark:bg-dark-accent-15 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                                    : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent'
                            }`}>
                            <Package className="w-3.5 h-3.5" />
                            {t('carta.cg_add_product')}
                        </button>
                        <button type="button" onClick={addComment}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-all">
                            <Plus className="w-3.5 h-3.5" />
                            {t('carta.cg_add_free')}
                        </button>
                    </div>
                </div>

                {/* Inline picker */}
                <AnimatePresence>
                    {showPicker && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden">
                            <div className="bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-light-border dark:border-dark-border">
                                    <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                                        {t('carta.cg_select_product')}
                                    </span>
                                    <button type="button" onClick={() => setShowPicker(false)}
                                        className="opacity-50 hover:opacity-100 transition-opacity">
                                        <X className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                                    </button>
                                </div>
                                <div className="p-2">
                                    <SearchInline products={products} onPick={addFromProduct} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {form.values.length === 0 && (
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic px-1 py-1">
                        {t('carta.cg_options_hint')}
                    </p>
                )}

                <div className="space-y-2">
                    {form.values.map((val, i) => {
                        const isProduct = val._type === 'product' || (val.codigo && val._ref_id);
                        return (
                            <motion.div key={i}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                className={`flex items-start gap-2 p-3 rounded-2xl border ${
                                    isProduct
                                        ? 'bg-light-accent-5 dark:bg-dark-accent-5 border-light-accent-20 dark:border-dark-accent-20'
                                        : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border dark:border-dark-border'
                                }`}>
                                <span className={`shrink-0 mt-3 w-1.5 h-1.5 rounded-full ${
                                    isProduct
                                        ? 'bg-light-accent dark:bg-dark-accent'
                                        : 'bg-light-text-secondary dark:bg-dark-text-secondary'
                                }`} />
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                    <input type="text"
                                        placeholder={isProduct ? t('carta.cg_field_name') : `${t('carta.cg_field_text')} *`}
                                        value={val.name} onChange={e => updateValue(i, 'name', e.target.value)}
                                        className={`col-span-3 sm:col-span-1 ${CELL}`} />
                                    <input type="text"
                                        placeholder={isProduct ? t('carta.cg_field_code') : `${t('carta.cg_field_code')} (opt.)`}
                                        value={val.codigo} onChange={e => updateValue(i, 'codigo', e.target.value)}
                                        className={`col-span-3 sm:col-span-1 font-mono ${CELL}`} />
                                    <input type="number"
                                        placeholder={`+${t('carta.cg_field_price')}`}
                                        value={val.price} onChange={e => updateValue(i, 'price', parseFloat(e.target.value) || 0)}
                                        className={`col-span-3 sm:col-span-1 ${CELL}`} />
                                </div>
                                <button type="button" onClick={() => removeValue(i)}
                                    className="p-1.5 mt-0.5 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error hover:bg-light-surface dark:hover:bg-dark-surface-tertiary transition-colors shrink-0">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── Product Group form ───────────────────────────────────────────────────────
const ProductGroupForm = ({ form, setForm, products, t }) => {
    const [search, setSearch] = useState('');
    const selected = useMemo(() => (form.values || []).map(v => v._ref_id).filter(Boolean), [form.values]);
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return q
            ? products.filter(p =>
                p.nombre?.toLowerCase().includes(q) ||
                p.codigo?.toLowerCase().includes(q)
              )
            : products;
    }, [products, search]);

    const toggle = (p) => {
        const pid = p.id || p._id;
        if (selected.includes(pid)) {
            setForm(f => ({ ...f, values: f.values.filter(v => v._ref_id !== pid) }));
        } else {
            setForm(f => ({
                ...f, values: [...f.values, {
                    _ref_id: pid, name: p.nombre,
                    codigo: p.codigo || '', price: 0, priority: f.values.length,
                }]
            }));
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase">
                        {t('carta.cg_products_label')}
                    </label>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {selected.length} / {products.length}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('carta.cg_search_products')}
                        className={`${INPUT} pl-10`} />
                </div>
            </div>

            {/* Scrollable list */}
            <div className="max-h-64 overflow-y-auto scrollbar-none rounded-2xl border border-light-border dark:border-dark-border divide-y divide-light-border dark:divide-dark-border">
                {filtered.map(p => {
                    const pid = p.id || p._id;
                    const isSel = selected.includes(pid);
                    return (
                        <button key={pid} type="button" onClick={() => toggle(p)}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                                isSel
                                    ? 'bg-light-accent-8 dark:bg-dark-accent-8 hover:bg-light-accent-12 dark:hover:bg-dark-accent-12'
                                    : 'hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'
                            }`}>
                            {/* Checkbox */}
                            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                isSel
                                    ? 'bg-light-accent dark:bg-dark-accent border-light-accent dark:border-dark-accent'
                                    : 'border-light-border dark:border-dark-border'
                            }`}>
                                {isSel && (
                                    <svg className="w-2.5 h-2.5 text-light-surface dark:text-dark-background" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                            {(p.media_r2 || p.media_url) && (
                                <img src={p.media_r2 || p.media_url} alt=""
                                    className="w-9 h-9 rounded-xl object-cover shrink-0 border border-light-border dark:border-dark-border" />
                            )}
                            <div className="min-w-0">
                                <div className={`text-sm font-semibold truncate transition-colors ${
                                    isSel
                                        ? 'text-light-accent dark:text-dark-accent'
                                        : 'text-light-text-primary dark:text-dark-text-primary'
                                }`}>
                                    {p.nombre}
                                </div>
                                <div className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">
                                    {p.codigo || '—'}
                                </div>
                            </div>
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <p className="px-4 py-6 text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
                        {t('carta.cg_no_results')}
                    </p>
                )}
            </div>

            {/* Selected chips */}
            <AnimatePresence>
                {selected.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {form.values.map((v, i) => (
                                <motion.span key={v._ref_id || i}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-light-accent-12 dark:bg-dark-accent-12 text-light-accent dark:text-dark-accent text-xs font-semibold border border-light-accent-20 dark:border-dark-accent-20">
                                    {v.name}
                                    <button type="button"
                                        onClick={() => setForm(f => ({ ...f, values: f.values.filter((_, idx) => idx !== i) }))}
                                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-light-accent-20 dark:hover:bg-dark-accent-20 transition-colors">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Main modal ───────────────────────────────────────────────────────────────
const CreateGroupModal = ({
    onClose, onCreated, token, account,
    products = [], defaultMode = MODE_MODIFIER,
}) => {
    const { t } = useTranslation();
    const [mode, setMode]     = useState(defaultMode);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg]       = useState(null);

    const [form, setForm] = useState({
        option_name:  '',
        display_type: 'select',
        required:     false,
        priority:     0,
        min_selected: 0,
        max_selected: 1,
        menu_id:      '',
        values:       [],
    });

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const switchMode = (m) => {
        setMode(m);
        setMsg(null);
        setForm(f => ({ ...f, menu_id: '', values: [], max_selected: 1 }));
    };

    const isValid = () => {
        if (!form.option_name.trim()) return false;
        if (mode === MODE_PRODUCT_GROUP && form.values.length === 0) return false;
        return true;
    };

    const handleSave = async () => {
        if (!isValid()) {
            setMsg({ type: 'error', text: t('carta.cg_validation_error') });
            return;
        }
        setSaving(true);
        setMsg(null);
        try {
            const cleanValues = form.values.map(({ _ref_id, _type, ...rest }) => rest);
            const payload = {
                option_name:  form.option_name.trim(),
                display_type: form.display_type,
                required:     form.required,
                priority:     parseInt(form.priority, 10) || 0,
                min_selected: parseInt(form.min_selected, 10) || 0,
                max_selected: parseInt(form.max_selected, 10) || 1,
                menu_id:      mode === MODE_MODIFIER ? (form.menu_id || '') : '',
                option_type:  mode,   // persisted in DB
                values:       cleanValues,
            };
            const res = await cartaApi.createMenuOptionGroup({ token, account, data: payload });
            onCreated(res?.id || res?._id);
            onClose();
        } catch (err) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    // Mode visual config — using ONLY project colours
    const isModifier = mode === MODE_MODIFIER;
    const ModeIcon   = isModifier ? Sliders : Boxes;

    return (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
                className="absolute inset-0 bg-dark-background-70 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
            />

            {/* Sheet / Dialog */}
            <motion.div
                initial={{ opacity: 0, y: 60, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                className="relative z-10 w-full sm:max-w-xl flex flex-col max-h-[96dvh] sm:max-h-[88vh] bg-light-surface dark:bg-dark-surface sm:rounded-3xl rounded-t-3xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden">

                {/* ── Header ── */}
                <div className="relative shrink-0 px-5 pt-5 pb-4 border-b border-light-border dark:border-dark-border">
                    {/* Drag handle (mobile only) */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-secondary sm:hidden" />

                    <div className="flex items-start gap-4 mt-2 sm:mt-0">
                        {/* Mode icon badge */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                            isModifier
                                ? 'bg-light-accent-15 dark:bg-dark-accent-15'
                                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
                        }`}>
                            <ModeIcon className={`w-6 h-6 ${
                                isModifier
                                    ? 'text-light-accent dark:text-dark-accent'
                                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                            }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">
                                {isModifier ? t('carta.cg_title_modifier') : t('carta.cg_title_group')}
                            </h2>
                            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-relaxed">
                                {isModifier ? t('carta.cg_desc_modifier') : t('carta.cg_desc_group')}
                            </p>
                        </div>

                        <button onClick={onClose}
                            className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary flex items-center justify-center transition-colors shrink-0">
                            <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                        </button>
                    </div>

                    {/* Mode switcher */}
                    <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-2xl">
                        {[
                            { id: MODE_MODIFIER,      Icon: Sliders, label: t('carta.cg_mode_modifier') },
                            { id: MODE_PRODUCT_GROUP, Icon: Boxes,   label: t('carta.cg_mode_group') },
                        ].map(({ id, Icon, label }) => (
                            <button key={id} type="button" onClick={() => switchMode(id)}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    mode === id
                                        ? 'bg-light-surface dark:bg-dark-surface-tertiary shadow-sm text-light-text-primary dark:text-dark-text-primary'
                                        : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                                }`}>
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Info strip */}
                    <div className={`mt-3 px-3.5 py-2.5 rounded-xl text-[11px] leading-relaxed border ${
                        isModifier
                            ? 'bg-light-accent-5 dark:bg-dark-accent-5 border-light-accent-20 dark:border-dark-accent-20 text-light-accent dark:text-dark-accent'
                            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary'
                    }`}>
                        <span className="mr-1.5">{isModifier ? '⚙️' : '🗂️'}</span>
                        {isModifier ? t('carta.cg_info_modifier') : t('carta.cg_info_group')}
                    </div>
                </div>

                {/* ── Alert ── */}
                <AnimatePresence>
                    {msg && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`shrink-0 mx-5 mt-3 flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium ${
                                msg.type === 'error'
                                    ? 'bg-light-error-10 dark:bg-dark-error-10 text-light-error dark:text-dark-error border border-light-error-30 dark:border-dark-error-30'
                                    : 'bg-light-success-10 dark:bg-dark-success-10 text-light-success dark:text-dark-success border border-light-success-30 dark:border-dark-success-30'
                            }`}>
                            {msg.type === 'error'
                                ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                            <span className="flex-1">{msg.text}</span>
                            <button onClick={() => setMsg(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Scrollable body ── */}
                <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-5 space-y-5">
                    {/* Common fields */}
                    <div className="space-y-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase">
                                {t('carta.cg_group_name')} <span className="text-light-error dark:text-dark-error">*</span>
                            </label>
                            <input type="text" value={form.option_name}
                                onChange={e => setField('option_name', e.target.value)}
                                placeholder={isModifier ? t('carta.cg_name_ph_modifier') : t('carta.cg_name_ph_group')}
                                className={INPUT}
                                autoFocus />
                        </div>

                        {/* Settings row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase">
                                    {t('carta.cg_display_type')}
                                </label>
                                <select value={form.display_type} onChange={e => setField('display_type', e.target.value)} className={SELECT}>
                                    {DISPLAY_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-widest uppercase">
                                    {t('carta.cg_min_max')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input type="number" min="0" value={form.min_selected}
                                        onChange={e => setField('min_selected', e.target.value)}
                                        className="flex-1 px-3 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary text-center focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent" />
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary text-xs">—</span>
                                    <input type="number" min="0" value={form.max_selected}
                                        onChange={e => setField('max_selected', e.target.value)}
                                        className="flex-1 px-3 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary text-center focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent" />
                                </div>
                            </div>
                        </div>

                        {/* Required */}
                        <Toggle
                            checked={form.required}
                            onChange={() => setField('required', !form.required)}
                            label={t('carta.cg_required')}
                        />
                    </div>

                    {/* Divider */}
                    <div className="border-t border-light-border dark:border-dark-border" />

                    {/* Mode-specific section */}
                    <AnimatePresence mode="wait">
                        <motion.div key={mode}
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                            {isModifier
                                ? <ModifierForm form={form} setForm={setForm} products={products} t={t} />
                                : <ProductGroupForm form={form} setForm={setForm} products={products} t={t} />
                            }
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 flex gap-3 px-5 py-4 border-t border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 rounded-2xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface dark:hover:bg-dark-surface transition-colors">
                        {t('carta.cg_cancel')}
                    </button>
                    <button type="button" disabled={saving || !isValid()} onClick={handleSave}
                        className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-light-surface dark:text-dark-background text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98] shadow-neon">
                        {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('carta.cg_saving')}</>
                            : <><Save className="w-4 h-4" /> {isModifier ? t('carta.cg_create_modifier') : t('carta.cg_create_group')}</>
                        }
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default CreateGroupModal;
