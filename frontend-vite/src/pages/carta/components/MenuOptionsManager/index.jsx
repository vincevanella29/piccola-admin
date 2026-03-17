/**
 * MenuOptionsManager — index
 *
 * Tabs:
 *   Grupos de productos  — option groups WITHOUT menu_id
 *                          values = actual products (rule: 1 group per product)
 *   Modificadores        — option groups WITH menu_id set (linked to parent product)
 *                          values = modifier options (poco queso, extra salsa, etc.)
 *                          A single product can have MULTIPLE modifier groups.
 *
 * Sub-components:
 *   DuplicatesPanel  — detector / limpiador de codigos duplicados en grupos
 *   EditValueModal   — editar un valor dentro de un grupo
 *   CreateGroupModal — crear nuevo grupo (modificadores o grupo de productos)
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Layers, Boxes, ListFilter, ChevronDown, ChevronRight, Search, Edit2, Trash2,
    AlertTriangle, CheckCircle, Loader2, X, ArrowRightLeft, Plus, Link, Unlink,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

import DuplicatesPanel  from './DuplicatesPanel';
import EditValueModal   from './EditValueModal';
import CreateGroupModal from './CreateGroupModal';

const CURRENCY_FORMAT = (v) =>
    v != null ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v) : null;

// helpers
const isModifierOpt = (opt) => {
    const mid = String(opt?.menu_id || '').trim();
    return !!(mid && mid !== 'None');
};

const inferType = (opt) => isModifierOpt(opt) ? 'modifier' : 'product_group';

// ── OptionGroupList ───────────────────────────────────────────────────────────
// Shared accordion list used by both tabs.
const OptionGroupList = ({
    options, menuOptions, products, token, account,
    onRefresh, t,
    emptyLabel, emptyIcon: EmptyIcon,
    showLinkActions = false,
    productsById,
    defaultMode = 'product_group',  // 'modifier' | 'product_group'
}) => {
    const [search, setSearch]         = useState('');
    const [expandedGroups, setExpandedGroups] = useState({});
    const [editingValue, setEditingValue]     = useState(null);
    const [movingValue, setMovingValue]       = useState(null);
    const [showCreate, setShowCreate]         = useState(false);
    const [msg, setMsg]                       = useState(null);
    const [deleting, setDeleting]             = useState(null);
    const [moving, setMoving]                 = useState(null);
    const [linking, setLinking]               = useState(null);

    const toggleGroup = (id) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return options.filter(opt =>
            !q || opt.option_name?.toLowerCase().includes(q) ||
            (opt.values || []).some(v => v.name?.toLowerCase().includes(q) || v.codigo?.toLowerCase().includes(q))
        );
    }, [options, search]);

    const handleDeleteValue = async (optId, val) => {
        if (!confirm(t('carta.options_confirm_delete_value', { name: val.name }))) return;
        setDeleting(`${optId}-${val.id}`);
        try {
            await cartaApi.deleteMenuOptionValue({ token, account, optionId: optId, valueId: val.id });
            setMsg({ type: 'success', text: t('carta.options_deleted') });
            onRefresh();
        } catch (err) { setMsg({ type: 'error', text: err.message }); }
        finally { setDeleting(null); }
    };

    const handleMoveValue = async (srcId, val, tgtId) => {
        const key = `${srcId}-${val.id}`;
        setMoving(key); setMovingValue(null);
        try {
            await cartaApi.moveMenuOptionValue({ token, account, optionId: srcId, valueId: val.id, targetOptionId: tgtId });
            setMsg({ type: 'success', text: `"${val.name}" movido` });
            onRefresh();
        } catch (err) { setMsg({ type: 'error', text: err.message }); }
        finally { setMoving(null); }
    };

    const handleDeleteOption = async (opt) => {
        if (!confirm(t('carta.options_confirm_delete_option', { name: opt.option_name }))) return;
        setDeleting(opt.id);
        try {
            await cartaApi.deleteMenuOption({ token, account, optionId: opt.id });
            setMsg({ type: 'success', text: t('carta.options_deleted') });
            onRefresh();
        } catch (err) { setMsg({ type: 'error', text: err.message }); }
        finally { setDeleting(null); }
    };

    const handleUnlinkModifier = async (opt) => {
        if (!confirm(`¿Desvincular el modificador "${opt.option_name}" de su producto?`)) return;
        setLinking(opt.id);
        try {
            await cartaApi.linkModifierToProduct({ token, account, optionId: opt.id, productId: '' });
            setMsg({ type: 'success', text: `"${opt.option_name}" desvinculado` });
            onRefresh();
        } catch (err) { setMsg({ type: 'error', text: err.message }); }
        finally { setLinking(null); }
    };

    return (
        <div className="space-y-3">
            {/* Alert */}
            <AnimatePresence>
                {msg && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium ${
                            msg.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        }`}>
                        {msg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                        <span className="flex-1">{msg.text}</span>
                        <button onClick={() => setMsg(null)}><X className="w-3.5 h-3.5 opacity-60" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo o valor…"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent placeholder:text-light-text-secondary/50" />
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-md active:scale-95 shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Crear grupo
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-light-text-secondary dark:text-dark-text-secondary">
                    <div className="w-14 h-14 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
                        <EmptyIcon className="w-7 h-7 opacity-40" />
                    </div>
                    <p className="text-sm">{emptyLabel}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(opt => {
                        const optId    = opt.id || opt._id;
                        const isExpanded = expandedGroups[optId] !== false;
                        const values   = opt.values || [];
                        const noCodeCount = values.filter(v => !v.codigo || v.codigo.trim() === '').length;
                        const parentProduct = opt.menu_id ? productsById[opt.menu_id] : null;

                        return (
                            <div key={optId} className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition-colors"
                                    onClick={() => toggleGroup(optId)}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        {isExpanded
                                            ? <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" />
                                            : <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />}
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${inferType(opt) === 'modifier' ? 'bg-blue-500/10' : 'bg-amber-500/10'}`}>
                                            {inferType(opt) === 'modifier'
                                                ? <ListFilter className="w-4 h-4 text-blue-500" />
                                                : <Boxes className="w-4 h-4 text-amber-500" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{opt.option_name}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold shrink-0">{values.length} valores</span>
                                                {noCodeCount > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0">{noCodeCount} sin código</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex-wrap">
                                                <span>{opt.display_type}</span>
                                                <span>·</span>
                                                <span>{opt.required ? 'Obligatorio' : 'Opcional'}</span>
                                                {parentProduct && (
                                                    <><span>·</span><span className="text-blue-500 dark:text-blue-400 font-semibold">→ {parentProduct.nombre}</span></>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                        {showLinkActions && (
                                            <button onClick={() => handleUnlinkModifier(opt)} disabled={linking === optId}
                                                className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 hover:border-blue-400/30 transition-all shadow-sm disabled:opacity-40"
                                                title="Desvincular de producto">
                                                {linking === optId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteOption(opt)} disabled={deleting === optId}
                                            className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-sm disabled:opacity-40">
                                            {deleting === optId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Values Table */}
                                <AnimatePresence>
                                    {isExpanded && values.length > 0 && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                            <div className="border-t border-light-border dark:border-dark-border">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/20 border-b border-light-border/50 dark:border-dark-border/50">
                                                            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Nombre</th>
                                                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Código</th>
                                                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Precio</th>
                                                            <th className="px-4 py-2.5 w-28"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {values.map((val, idx) => {
                                                            const hasCode    = val.codigo && val.codigo.trim() !== '';
                                                            const isDeleting = deleting === `${optId}-${val.id}`;
                                                            const isMoving   = moving === `${optId}-${val.id}`;
                                                            return (
                                                                <tr key={val.id || idx}
                                                                    className="group border-b border-light-border/30 dark:border-dark-border/30 last:border-0 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15 transition-colors">
                                                                    <td className="px-5 py-2.5 font-medium text-light-text-primary dark:text-dark-text-primary">{val.name}</td>
                                                                    <td className="px-4 py-2.5">
                                                                        {hasCode ? (
                                                                            <span className="font-mono text-xs px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">{val.codigo}</span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-[11px] font-semibold border border-red-200/50 dark:border-red-800/30">
                                                                                <AlertTriangle className="w-3 h-3" /> sin código
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 font-mono font-semibold text-light-text-primary dark:text-dark-text-primary text-sm">
                                                                        {CURRENCY_FORMAT(val.price) || '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5">
                                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                                                                            <button onClick={() => setEditingValue({ optionId: optId, value: val })}
                                                                                className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 transition-all shadow-sm">
                                                                                <Edit2 className="w-3 h-3" />
                                                                            </button>
                                                                            <div className="relative">
                                                                                <button disabled={isMoving}
                                                                                    onClick={() => setMovingValue(mv => mv?.value?.id === val.id ? null : { optionId: optId, value: val })}
                                                                                    className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-blue-500 hover:border-blue-400/30 transition-all shadow-sm disabled:opacity-40"
                                                                                    title="Mover a otro grupo">
                                                                                    {isMoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                                                                                </button>
                                                                                {movingValue?.optionId === optId && movingValue?.value?.id === val.id && (
                                                                                    <div className="absolute right-0 top-8 z-50 w-52 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-xl overflow-hidden">
                                                                                        <p className="px-3 py-2 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider border-b border-light-border dark:border-dark-border">Mover a:</p>
                                                                                        <div className="max-h-48 overflow-y-auto">
                                                                                            {menuOptions.filter(o => (o.id || o._id) !== optId).map(o => (
                                                                                                <button key={o.id || o._id} onClick={() => handleMoveValue(optId, val, o.id || o._id)}
                                                                                                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors flex items-center gap-2">
                                                                                                    <Layers className="w-3 h-3 text-amber-500 shrink-0" />
                                                                                                    <span className="truncate font-medium text-light-text-primary dark:text-dark-text-primary">{o.option_name}</span>
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <button onClick={() => handleDeleteValue(optId, val)} disabled={isDeleting}
                                                                                className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all shadow-sm disabled:opacity-40">
                                                                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
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
                    })}
                </div>
            )}

            {/* Edit Value Modal */}
            <AnimatePresence>
                {editingValue && (
                    <EditValueModal value={editingValue.value} optionId={editingValue.optionId}
                        onClose={() => setEditingValue(null)} onSaved={onRefresh} token={token} account={account} t={t} />
                )}
            </AnimatePresence>

            {/* Create Group Modal */}
            <AnimatePresence>
                {showCreate && (
                    <CreateGroupModal
                        onClose={() => setShowCreate(false)}
                        onCreated={() => { setMsg({ type: 'success', text: 'Grupo creado ✓' }); onRefresh(); }}
                        token={token} account={account} products={products}
                        defaultMode={defaultMode}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};


// ── Main ──────────────────────────────────────────────────────────────────────

const MenuOptionsManager = ({ menuOptions = [], products = [], onRefresh, token, account }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('groups');

    const productsById = useMemo(() => {
        const m = {};
        for (const p of products) {
            if (p.id)  m[String(p.id)]  = p;
            if (p._id) m[String(p._id)] = p;
        }
        return m;
    }, [products]);

    const productGroups = useMemo(() =>
        menuOptions.filter(o => !isModifierOpt(o)),
    [menuOptions]);

    const modifiers = useMemo(() =>
        menuOptions.filter(o => isModifierOpt(o)),
    [menuOptions]);

    // Stats bar
    const noCodeGroups   = productGroups.reduce((a, o) => a + (o.values || []).filter(v => !v.codigo || !v.codigo.trim()).length, 0);
    const totalModifiers = modifiers.length;

    const TAB = ({ id, label, icon: Icon, count, accent }) => (
        <button onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 mr-6 shrink-0 ${
                activeTab === id
                    ? `border-${accent || 'light-accent dark:border-dark-accent'} text-light-text-primary dark:text-dark-text-primary`
                    : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
            {count != null && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === id ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
                }`}>{count}</span>
            )}
        </button>
    );

    return (
        <div className="space-y-4">

            {/* Tabs */}
            <div className="flex border-b border-light-border dark:border-dark-border overflow-x-auto">
                <TAB id="groups"    label="Grupos de productos" icon={Boxes}      count={productGroups.length} />
                <TAB id="modifiers" label="Modificadores"       icon={ListFilter} count={totalModifiers} />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 flex-wrap text-xs">
                {activeTab === 'groups' && noCodeGroups > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/50 dark:border-red-800/30">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        <span className="font-bold text-red-600 dark:text-red-400">{noCodeGroups}</span>
                        <span className="text-red-500/80 dark:text-red-500/60">valores sin código</span>
                    </div>
                )}
                {activeTab === 'modifiers' && (
                    <p className="text-light-text-secondary dark:text-dark-text-secondary text-[11px]">
                        Un producto puede tener múltiples modificadores. Usa el panel de producto para vincularlos rápidamente.
                    </p>
                )}
            </div>

            {/* Tab content */}
            {activeTab === 'groups' && (
                <div className="space-y-4">
                    {/* Duplicates panel — only relevant for product groups */}
                    <DuplicatesPanel token={token} account={account} onRefresh={onRefresh} />
                    <OptionGroupList
                        options={productGroups} menuOptions={menuOptions} products={products} productsById={productsById}
                        token={token} account={account} onRefresh={onRefresh} t={t}
                        emptyLabel="Sin grupos de productos" emptyIcon={Boxes}
                        showLinkActions={false}
                        defaultMode="product_group"
                    />
                </div>
            )}
            {activeTab === 'modifiers' && (
                <OptionGroupList
                    options={modifiers} menuOptions={menuOptions} products={products} productsById={productsById}
                    token={token} account={account} onRefresh={onRefresh} t={t}
                    emptyLabel="Sin modificadores — créalos desde aquí o desde la edición de un producto" emptyIcon={ListFilter}
                    showLinkActions={true}
                    defaultMode="modifier"
                />
            )}
        </div>
    );
};

export default MenuOptionsManager;
