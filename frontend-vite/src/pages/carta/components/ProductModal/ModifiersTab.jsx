/**
 * ModifiersTab — Manage modifier groups for a product.
 *
 * Features:
 *   1. List linked modifiers (unlink button).
 *   2. CREATE new modifier inline with dual add:
 *      - "+ Producto" → opens InlineProductSearch (auto-fills name + codigo)
 *      - "+ Comentario" → blank free-text row (no codigo)
 *   3. LINK existing option group.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    ListFilter, Loader2, Link, Unlink, Search, X,
    CheckCircle, AlertTriangle, Plus, Trash2, Save,
    ShoppingBag, MessageSquare,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

// ── Shared styles ─────────────────────────────────────────────────────────────
const INPUT = 'px-3 py-2 rounded-xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border dark:border-dark-border text-xs text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-blue-400/50 placeholder:text-light-text-secondary/50 transition-shadow w-full';

// ── Alert ─────────────────────────────────────────────────────────────────────
const Alert = ({ msg, onClose }) => {
    if (!msg) return null;
    const ok = msg.type === 'success';
    return (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-start gap-2 px-4 py-3 rounded-2xl text-xs font-medium ${
                ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                   : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
            {ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="flex-1">{msg.text}</span>
            <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
            </button>
        </motion.div>
    );
};

// ── InlineProductSearch ───────────────────────────────────────────────────────
// Pure search input + scrollable product list.
// No wrapper, no header, no absolute positioning — composable inside any container.
const InlineProductSearch = ({ products, onSelect }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        const lower = q.toLowerCase();
        return lower
            ? products.filter(p => p.nombre?.toLowerCase().includes(lower) || p.codigo?.toLowerCase().includes(lower))
            : products;
    }, [products, q]);

    return (
        <>
            {/* Search */}
            <div className="px-3 py-2 border-b border-light-border dark:border-dark-border">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                    <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                        placeholder="Buscar nombre o código…"
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs text-light-text-primary dark:text-dark-text-primary focus:outline-none" />
                </div>
            </div>
            {/* List */}
            <div className="max-h-52 overflow-y-auto">
                {filtered.map(p => (
                    <button key={p.id || p._id} type="button" onClick={() => onSelect(p)}
                        className="w-full text-left px-3 py-2.5 text-xs flex items-center gap-2.5 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                        {(p.media_r2 || p.media_url) && (
                            <img src={p.media_r2 || p.media_url} alt=""
                                className="w-8 h-8 rounded-xl object-cover shrink-0 border border-light-border dark:border-dark-border" />
                        )}
                        <div className="min-w-0">
                            <div className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</div>
                            {p.codigo && <div className="font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</div>}
                        </div>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <p className="px-4 py-5 text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">Sin resultados</p>
                )}
            </div>
        </>
    );
};

// ── ValueRow ─────────────────────────────────────────────────────────────────
// Single option row inside NewModifierForm.
const ValueRow = ({ val, idx, onChange, onRemove }) => {
    const isProduct = val._type === 'product';
    return (
        <div className={`flex items-start gap-2 p-3 rounded-xl border transition-colors ${
            isProduct
                ? 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-200/60 dark:border-blue-700/30'
                : 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/15 border-light-border dark:border-dark-border'
        }`}>
            {/* Type dot */}
            <span className={`shrink-0 mt-2.5 w-2 h-2 rounded-full ${
                isProduct ? 'bg-blue-500' : 'bg-light-text-secondary/30 dark:bg-dark-text-secondary/30'
            }`} title={isProduct ? 'Producto' : 'Comentario'} />

            <div className="flex-1 grid grid-cols-3 gap-1.5">
                <input type="text"
                    placeholder={isProduct ? 'Nombre del producto' : 'Texto de la opción *'}
                    value={val.name}
                    onChange={e => onChange(idx, 'name', e.target.value)}
                    className={`col-span-3 sm:col-span-1 ${INPUT}`} />
                <input type="text"
                    placeholder={isProduct ? 'Código' : 'Código (opcional)'}
                    value={val.codigo}
                    onChange={e => onChange(idx, 'codigo', e.target.value)}
                    className={`col-span-3 sm:col-span-1 font-mono ${INPUT}`} />
                <input type="number"
                    placeholder="+$ precio"
                    value={val.price || ''}
                    onChange={e => onChange(idx, 'price', parseFloat(e.target.value) || 0)}
                    className={`col-span-3 sm:col-span-1 ${INPUT}`} />
            </div>
            <button type="button" onClick={() => onRemove(idx)}
                className="p-1.5 mt-1 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

// ── NewModifierForm ───────────────────────────────────────────────────────────
const NewModifierForm = ({ product, products = [], token, account, onCreated, onCancel, t }) => {
    const [name, setName]           = useState('');
    const [values, setValues]       = useState([]);
    const [saving, setSaving]       = useState(false);
    const [err, setErr]             = useState(null);
    const [showPicker, setShowPicker] = useState(false);

    const addComment = () => setValues(v => [...v, { _type: 'comment', name: '', codigo: '', price: 0 }]);

    const addFromProduct = (p) => {
        setValues(v => [...v, {
            _type:   'product',
            _ref_id: p.id || p._id,
            name:    p.nombre || '',
            codigo:  p.codigo  || '',
            price:   0,
        }]);
        setShowPicker(false);
    };

    const updateValue = (i, key, val) => setValues(v => {
        const clone = [...v];
        clone[i] = { ...clone[i], [key]: val };
        return clone;
    });
    const removeValue = (i) => setValues(v => v.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        if (!name.trim()) { setErr(t('mod.err_name')); return; }
        if (values.length === 0 || values.every(v => !v.name.trim())) {
            setErr(t('mod.err_options')); return;
        }
        setSaving(true); setErr(null);
        try {
            const cleanValues = values
                .filter(v => v.name.trim())
                .map((v, i) => ({
                    name:     v.name.trim(),
                    codigo:   (v.codigo || '').trim(),
                    price:    parseFloat(v.price) || 0,
                    priority: i,
                }));

            const res = await cartaApi.createMenuOptionGroup({
                token, account,
                data: {
                    option_name:  name.trim(),
                    display_type: 'select',
                    required:     false,
                    priority:     0,
                    min_selected: 0,
                    max_selected: 1,
                    menu_id:      product.id || product._id || '',
                    values:       cleanValues,
                },
            });

            const newId = res?.id || res?._id || res?.option_id;
            if (newId) {
                await cartaApi.linkModifierToProduct({ token, account, optionId: newId, productId: product.id });
            }
            onCreated(t('mod.created_ok', { name: name.trim() }));
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <div className="border border-blue-200/60 dark:border-blue-800/30 rounded-2xl bg-blue-50/30 dark:bg-blue-950/20 p-4 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                            <ListFilter className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{t('mod.new_title')}</p>
                    </div>
                    <button type="button" onClick={onCancel}
                        className="p-1 rounded-full opacity-50 hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    </button>
                </div>

                {/* Error */}
                {err && (
                    <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{err}
                    </p>
                )}

                {/* Group name */}
                <div>
                    <label className="block text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
                        {t('mod.group_name')} *
                    </label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder={t('mod.group_name_placeholder')}
                        className={INPUT} autoFocus />
                </div>

            {/* Options header + add buttons */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                            {t('mod.options')} ({values.length})
                        </label>
                        <div className="flex items-center gap-1.5">
                            {/* Pick from product catalog */}
                            <button type="button"
                                onClick={() => setShowPicker(v => !v)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                                    showPicker
                                        ? 'bg-blue-500/20 border-blue-400 text-blue-600 dark:text-blue-400'
                                        : 'bg-blue-500/10 border-blue-400/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
                                }`}>
                                <ShoppingBag className="w-3 h-3" />
                                {t('mod.add_product')}
                            </button>
                            {/* Free-text comment */}
                            <button type="button" onClick={addComment}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-light-border dark:border-dark-border text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 transition-all">
                                <MessageSquare className="w-3 h-3" />
                                {t('mod.add_comment')}
                            </button>
                        </div>
                    </div>

                    {/* Inline product picker — expands in document flow, never clipped */}
                    <AnimatePresence>
                        {showPicker && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-light-surface dark:bg-dark-surface border border-blue-300/40 dark:border-blue-700/30 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 border-b border-light-border dark:border-dark-border flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                                            Seleccionar producto
                                        </span>
                                        <button type="button" onClick={() => setShowPicker(false)}
                                            className="opacity-50 hover:opacity-100 transition-opacity">
                                            <X className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                                        </button>
                                    </div>
                                    <InlineProductSearch
                                        products={products}
                                        onSelect={addFromProduct}
                                        onClose={() => setShowPicker(false)}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {values.length === 0 && (
                        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary italic px-1">
                            {t('mod.options_hint')}
                        </p>
                    )}

                    <div className="space-y-1.5">
                        {values.map((val, i) => (
                            <ValueRow key={i} val={val} idx={i}
                                onChange={updateValue} onRemove={removeValue} />
                        ))}
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                        {t('mod.cancel')}
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-40 active:scale-[0.98]">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {saving ? t('mod.creating') : t('mod.create_link')}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// ── MAIN TAB ──────────────────────────────────────────────────────────────────
const ModifiersTab = ({ product, menuOptions, products = [], token, account }) => {
    const { t } = useTranslation();
    const [modifiers, setModifiers]     = useState([]);
    const [loading, setLoading]         = useState(false);
    const [msg, setMsg]                 = useState(null);
    const [linkingId, setLinkingId]     = useState(null);
    const [unlinkingId, setUnlinkingId] = useState(null);
    const [mode, setMode]               = useState(null); // null | 'create' | 'pick'
    const [search, setSearch]           = useState('');

    const load = () => {
        if (!product?.id) return;
        setLoading(true);
        cartaApi.fetchProductModifiers({ token, account, productId: product.id })
            .then(data => setModifiers(Array.isArray(data) ? data : []))
            .catch(err => console.error('[ModifiersTab]', err))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const linkedIds = useMemo(() => new Set(modifiers.map(m => String(m.id || m._id))), [modifiers]);

    const available = useMemo(() => {
        const q = search.toLowerCase();
        return (menuOptions || [])
            .filter(o => !linkedIds.has(String(o.id || o._id)))
            .filter(o => !q || o.option_name?.toLowerCase().includes(q));
    }, [menuOptions, linkedIds, search]);

    const handleLink = async (opt) => {
        const optId = opt.id || opt._id;
        setLinkingId(optId); setMsg(null);
        try {
            await cartaApi.linkModifierToProduct({ token, account, optionId: optId, productId: product.id });
            setMsg({ type: 'success', text: t('mod.linked_ok', { name: opt.option_name }) });
            setMode(null); setSearch('');
            load();
        } catch (e) { setMsg({ type: 'error', text: e.message }); }
        finally { setLinkingId(null); }
    };

    const handleUnlink = async (mod) => {
        const modId = mod.id || mod._id;
        setUnlinkingId(modId); setMsg(null);
        try {
            await cartaApi.linkModifierToProduct({ token, account, optionId: modId, productId: '' });
            setMsg({ type: 'success', text: t('mod.unlinked_ok', { name: mod.option_name }) });
            load();
        } catch (e) { setMsg({ type: 'error', text: e.message }); }
        finally { setUnlinkingId(null); }
    };

    return (
        <div className="space-y-4">

            {/* Alert */}
            <AnimatePresence>
                {msg && <Alert msg={msg} onClose={() => setMsg(null)} />}
            </AnimatePresence>

            {/* Description */}
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                {t('mod.description')}
            </p>

            {/* Linked modifiers */}
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
            ) : modifiers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 border-2 border-dashed border-light-border dark:border-dark-border rounded-2xl">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <ListFilter className="w-5 h-5 text-blue-500 opacity-60" />
                    </div>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">{t('mod.empty_title')}</p>
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary opacity-60">{t('mod.empty_hint')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {modifiers.map(mod => {
                        const modId = mod.id || mod._id;
                        return (
                            <div key={modId}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/25">
                                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                                    <ListFilter className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{mod.option_name}</p>
                                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                        {(mod.values || []).length} {t('mod.options_count')} · {mod.display_type} · {mod.required ? t('mod.required') : t('mod.optional')}
                                    </p>
                                </div>
                                <button type="button" onClick={() => handleUnlink(mod)} disabled={unlinkingId === modId}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-800/30 text-red-500 dark:text-red-400 text-[11px] font-semibold hover:bg-red-50 dark:hover:bg-red-900/15 transition-all disabled:opacity-40 shrink-0">
                                    {unlinkingId === modId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                                    {t('mod.unlink')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action buttons */}
            {mode === null && (
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setMode('create')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700/40 text-sm font-semibold text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all">
                        <Plus className="w-4 h-4" />
                        {t('mod.new_btn')}
                    </button>
                    <button type="button" onClick={() => setMode('pick')}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-blue-400/60 hover:text-blue-500 transition-all">
                        <Link className="w-4 h-4" />
                        {t('mod.link_btn')}
                    </button>
                </div>
            )}

            <AnimatePresence mode="wait">
                {/* CREATE */}
                {mode === 'create' && (
                    <NewModifierForm key="create"
                        product={product} products={products}
                        token={token} account={account}
                        t={t}
                        onCreated={(text) => { setMsg({ type: 'success', text }); setMode(null); load(); }}
                        onCancel={() => setMode(null)}
                    />
                )}

                {/* PICK EXISTING */}
                {mode === 'pick' && (
                    <motion.div key="pick"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="border border-light-border dark:border-dark-border rounded-2xl bg-light-surface dark:bg-dark-surface overflow-hidden">
                            <div className="p-3 border-b border-light-border dark:border-dark-border flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                                    <input value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder={t('mod.search_existing')} autoFocus
                                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-400/30 placeholder:text-light-text-secondary/50" />
                                </div>
                                <button type="button" onClick={() => { setMode(null); setSearch(''); }}
                                    className="p-2 rounded-xl hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors text-light-text-secondary dark:text-dark-text-secondary">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                                {available.length === 0 ? (
                                    <p className="text-center text-xs text-light-text-secondary dark:text-dark-text-secondary py-6">
                                        {search ? t('mod.no_results') : t('mod.all_linked')}
                                    </p>
                                ) : available.map(opt => {
                                    const optId = opt.id || opt._id;
                                    const isLinking = linkingId === optId;
                                    return (
                                        <button key={optId} type="button" onClick={() => handleLink(opt)} disabled={isLinking}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors text-left disabled:opacity-40">
                                            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <ListFilter className="w-3.5 h-3.5 text-blue-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{opt.option_name}</p>
                                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                                    {(opt.values || []).length} {t('mod.options_count')} · {opt.display_type}
                                                </p>
                                            </div>
                                            {isLinking
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                                                : <Link className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ModifiersTab;
