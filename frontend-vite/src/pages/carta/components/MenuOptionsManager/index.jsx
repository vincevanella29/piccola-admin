// MenuOptionsManager — manages product groups and modifier groups.
// Two tabs: "Grupos de productos" and "Modificadores".
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Boxes, Sliders, ChevronDown, ChevronRight, Search, Edit2, Trash2,
  AlertTriangle, CheckCircle, Loader2, X, ArrowRightLeft, Plus, Unlink, Link2, Pencil,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

import DuplicatesPanel     from './DuplicatesPanel';
import EditValueModal      from './EditValueModal';
import CreateGroupModal    from './CreateGroupModal';
import CreateModifierModal from './CreateModifierModal';

/* ── helpers ────────────────────────────────────────────────────────────────── */
const CURRENCY = v =>
  v != null ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v) : '—';

const isModifierOpt = opt => {
  if (opt?.option_type === 'modifier') return true;
  const mid = String(opt?.menu_id || '').trim();
  return !!(mid && mid !== 'None');
};
const inferType = opt => isModifierOpt(opt) ? 'modifier' : 'product_group';

/* ── OptionGroupList ────────────────────────────────────────────────────────── */
const OptionGroupList = ({
  options, sameTypeOptions, products, token, account,
  onRefresh, t,
  emptyLabel, emptyIcon: EmptyIcon,
  showLinkActions = false,
  productsById,
  defaultMode = 'product_group',
}) => {
  const [search, setSearch]                     = useState('');
  const [expandedGroups, setExpandedGroups]      = useState({});
  const [editingValue, setEditingValue]          = useState(null);
  const [movingValue, setMovingValue]            = useState(null);
  const [showCreateGroup, setShowCreateGroup]    = useState(false);
  const [showCreateModifier, setShowCreateModifier] = useState(false);
  const [editingGroup, setEditingGroup]          = useState(null);
  const [editingModifier, setEditingModifier]    = useState(null);
  const [msg, setMsg]                            = useState(null);
  const [deleting, setDeleting]                  = useState(null);
  const [moving, setMoving]                      = useState(null);
  const [linking, setLinking]                    = useState(null);

  const toggleGroup = id => setExpandedGroups(p => ({ ...p, [id]: !p[id] }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options.filter(opt =>
      !q || opt.option_name?.toLowerCase().includes(q) ||
      (opt.values || []).some(v => v.name?.toLowerCase().includes(q) || v.codigo?.toLowerCase().includes(q))
    );
  }, [options, search]);

  /* ── CRUD handlers ─ */
  const handleDeleteValue = async (optId, val) => {
    if (!confirm(t('carta.options_confirm_delete_value', { name: val.name }))) return;
    setDeleting(`${optId}-${val.id}`);
    try { await cartaApi.deleteMenuOptionValue({ token, account, optionId: optId, valueId: val.id }); setMsg({ type: 'success', text: t('carta.options_deleted') }); onRefresh(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setDeleting(null); }
  };

  const handleMoveValue = async (srcId, val, tgtId) => {
    setMoving(`${srcId}-${val.id}`); setMovingValue(null);
    try { await cartaApi.moveMenuOptionValue({ token, account, optionId: srcId, valueId: val.id, targetOptionId: tgtId }); setMsg({ type: 'success', text: `"${val.name}" movido ✓` }); onRefresh(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setMoving(null); }
  };

  const handleDeleteOption = async opt => {
    if (!confirm(t('carta.options_confirm_delete_option', { name: opt.option_name }))) return;
    setDeleting(opt.id);
    try { await cartaApi.deleteMenuOption({ token, account, optionId: opt.id }); setMsg({ type: 'success', text: t('carta.options_deleted') }); onRefresh(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setDeleting(null); }
  };

  const handleUnlinkModifier = async opt => {
    if (!confirm(`¿Desvincular "${opt.option_name}" de su producto?`)) return;
    setLinking(opt.id);
    try { await cartaApi.linkModifierToProduct({ token, account, optionId: opt.id, productId: '' }); setMsg({ type: 'success', text: `"${opt.option_name}" desvinculado ✓` }); onRefresh(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setLinking(null); }
  };

  const isMod = defaultMode === 'modifier';

  return (
    <div className="space-y-3">
      {/* Alert */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
              msg.type === 'success'
                ? 'bg-light-success/5 dark:bg-dark-success/5 text-light-success dark:text-dark-success border-light-success/20 dark:border-dark-success/20'
                : 'bg-light-error/5 dark:bg-dark-error/5 text-light-error dark:text-dark-error border-light-error/20 dark:border-dark-error/20'
            }`}>
            {msg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            <span className="flex-1">{msg.text}</span>
            <button onClick={() => setMsg(null)} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isMod ? 'Buscar modificador…' : 'Buscar grupo…'}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all" />
        </div>
        <button onClick={() => isMod ? setShowCreateModifier(true) : setShowCreateGroup(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white text-xs font-bold transition-all active:scale-[0.97] shadow-neon shrink-0">
          <Plus className="w-3.5 h-3.5" />
          {isMod ? t('carta.mod_btn_create') : t('carta.grp_btn_create')}
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2.5 text-light-text-secondary dark:text-dark-text-secondary">
          <div className="w-12 h-12 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
            <EmptyIcon className="w-6 h-6 opacity-30" />
          </div>
          <p className="text-xs">{emptyLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(opt => {
            const optId       = opt.id || opt._id;
            const isExpanded  = expandedGroups[optId] !== false;
            const values      = opt.values || [];
            const noCodeCount = values.filter(v => !v.codigo?.trim()).length;
            const optType     = inferType(opt);

            // For modifiers — resolve linked product names
            const linkedIds = opt.menu_ids?.length ? opt.menu_ids : (opt.menu_id ? [opt.menu_id] : []);
            const linkedProducts = linkedIds.map(id => productsById[id]).filter(Boolean);

            return (
              <div key={optId} className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
                {/* ── Group header ── */}
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition-colors"
                  onClick={() => toggleGroup(optId)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-light-accent dark:text-dark-accent shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary shrink-0" />}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      optType === 'modifier' ? 'bg-light-accent/10 dark:bg-dark-accent/10' : 'bg-light-accent/10 dark:bg-dark-accent/10'
                    }`}>
                      {optType === 'modifier'
                        ? <Sliders className="w-4 h-4 text-light-accent dark:text-dark-accent" />
                        : <Boxes className="w-4 h-4 text-light-accent dark:text-dark-accent" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{opt.option_name}</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-[10px] font-bold shrink-0">
                          {values.length} {values.length === 1 ? 'valor' : 'valores'}
                        </span>
                        {noCodeCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error text-[10px] font-bold shrink-0">
                            {noCodeCount} sin código
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex-wrap">
                        <span>{opt.display_type}</span>
                        <span>·</span>
                        <span>{opt.required ? 'Obligatorio' : 'Opcional'}</span>
                        {linkedProducts.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5 text-light-accent dark:text-dark-accent font-semibold">
                              <Link2 className="w-2.5 h-2.5" />
                              {linkedProducts.map(p => p.nombre).join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Edit */}
                    <button onClick={() => {
                        if (optType === 'modifier') setEditingModifier(opt);
                        else setEditingGroup(opt);
                      }}
                      className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all"
                      title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {showLinkActions && (
                      <button onClick={() => handleUnlinkModifier(opt)} disabled={linking === optId}
                        className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all disabled:opacity-40"
                        title="Desvincular">
                        {linking === optId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button onClick={() => handleDeleteOption(opt)} disabled={deleting === optId}
                      className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error hover:border-light-error/30 dark:hover:border-dark-error/30 transition-all disabled:opacity-40">
                      {deleting === optId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* ── Values table ── */}
                <AnimatePresence>
                  {isExpanded && values.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="border-t border-light-border dark:border-dark-border">
                        {/* Table header */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_120px_100px_90px] gap-1 px-4 py-2 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/20 border-b border-light-border/50 dark:border-dark-border/50">
                          <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Nombre</span>
                          <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider hidden sm:block">Código</span>
                          <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider hidden sm:block">Precio</span>
                          <span />
                        </div>

                        {values.map((val, idx) => {
                          const hasCode   = val.codigo?.trim();
                          const isDel     = deleting === `${optId}-${val.id}`;
                          const isMov     = moving === `${optId}-${val.id}`;
                          const isMovOpen = movingValue?.optionId === optId && movingValue?.value?.id === val.id;

                          return (
                            <div key={val.id || idx}
                              className="group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_100px_90px] gap-1 items-center px-4 py-2 border-b border-light-border/20 dark:border-dark-border/20 last:border-0 hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/10 transition-colors">
                              {/* Name */}
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-light-text-primary dark:text-dark-text-primary truncate">{val.name}</p>
                                {/* Mobile-only code + price */}
                                <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                                  {hasCode
                                    ? <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent">{val.codigo}</span>
                                    : <span className="text-[10px] text-light-error dark:text-dark-error font-semibold">sin código</span>}
                                  <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{CURRENCY(val.price)}</span>
                                </div>
                              </div>
                              {/* Code (desktop) */}
                              <div className="hidden sm:block">
                                {hasCode
                                  ? <span className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-light-accent/5 dark:bg-dark-accent/5 text-light-accent dark:text-dark-accent border border-light-accent/10 dark:border-dark-accent/10">{val.codigo}</span>
                                  : <span className="inline-flex items-center gap-1 text-[10px] text-light-error dark:text-dark-error font-semibold"><AlertTriangle className="w-2.5 h-2.5" />sin código</span>}
                              </div>
                              {/* Price (desktop) */}
                              <span className="hidden sm:block font-mono text-xs font-semibold text-light-text-primary dark:text-dark-text-primary">{CURRENCY(val.price)}</span>
                              {/* Actions */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end relative">
                                <button onClick={() => setEditingValue({ optionId: optId, value: val })}
                                  className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                {/* Move — only show same-type targets */}
                                <div className="relative">
                                  <button disabled={isMov}
                                    onClick={() => setMovingValue(mv => mv?.value?.id === val.id ? null : { optionId: optId, value: val })}
                                    className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all disabled:opacity-40"
                                    title="Mover">
                                    {isMov ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                                  </button>
                                  {isMovOpen && (
                                    <div className="absolute right-0 top-8 z-50 w-52 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-xl overflow-hidden">
                                      <p className="px-3 py-2 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider border-b border-light-border dark:border-dark-border">
                                        Mover a:
                                      </p>
                                      <div className="max-h-48 overflow-y-auto scrollbar-none">
                                        {sameTypeOptions.filter(o => (o.id || o._id) !== optId).map(o => (
                                          <button key={o.id || o._id}
                                            onClick={() => handleMoveValue(optId, val, o.id || o._id)}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors flex items-center gap-2">
                                            {inferType(o) === 'modifier'
                                              ? <Sliders className="w-3 h-3 text-light-accent dark:text-dark-accent shrink-0" />
                                              : <Boxes className="w-3 h-3 text-light-accent dark:text-dark-accent shrink-0" />}
                                            <span className="truncate font-medium text-light-text-primary dark:text-dark-text-primary">{o.option_name}</span>
                                          </button>
                                        ))}
                                        {sameTypeOptions.filter(o => (o.id || o._id) !== optId).length === 0 && (
                                          <p className="px-3 py-3 text-[11px] text-center text-light-text-secondary dark:text-dark-text-secondary">
                                            No hay otros {isMod ? 'modificadores' : 'grupos'}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <button onClick={() => handleDeleteValue(optId, val)} disabled={isDel}
                                  className="p-1.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error hover:border-light-error/30 dark:hover:border-dark-error/30 transition-all disabled:opacity-40">
                                  {isDel ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
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
        {showCreateGroup && (
          <CreateGroupModal
            onClose={() => setShowCreateGroup(false)}
            onCreated={() => { setMsg({ type: 'success', text: t('carta.grp_created') }); onRefresh(); }}
            token={token} account={account} products={products}
          />
        )}
      </AnimatePresence>

      {/* Edit Group Modal */}
      <AnimatePresence>
        {editingGroup && (
          <CreateGroupModal
            editData={editingGroup}
            onClose={() => setEditingGroup(null)}
            onCreated={() => { setMsg({ type: 'success', text: t('carta.grp_updated') }); onRefresh(); }}
            token={token} account={account} products={products}
          />
        )}
      </AnimatePresence>

      {/* Create Modifier Modal */}
      <AnimatePresence>
        {showCreateModifier && (
          <CreateModifierModal
            onClose={() => setShowCreateModifier(false)}
            onCreated={() => { setMsg({ type: 'success', text: t('carta.mod_created') }); onRefresh(); }}
            token={token} account={account} products={products}
          />
        )}
      </AnimatePresence>

      {/* Edit Modifier Modal */}
      <AnimatePresence>
        {editingModifier && (
          <CreateModifierModal
            editData={editingModifier}
            onClose={() => setEditingModifier(null)}
            onCreated={() => { setMsg({ type: 'success', text: t('carta.mod_updated') }); onRefresh(); }}
            token={token} account={account} products={products}
          />
        )}
      </AnimatePresence>
    </div>
  );
};


/* ── Main component ─────────────────────────────────────────────────────────── */
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

  const productGroups = useMemo(() => menuOptions.filter(o => !isModifierOpt(o)), [menuOptions]);
  const modifiers     = useMemo(() => menuOptions.filter(o =>  isModifierOpt(o)), [menuOptions]);

  const noCodeGroups = productGroups.reduce(
    (a, o) => a + (o.values || []).filter(v => !v.codigo?.trim()).length, 0
  );

  const Tab = ({ id, label, icon: Icon, count }) => (
    <button onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 pb-2.5 text-xs font-bold transition-colors border-b-2 mr-5 shrink-0 ${
        activeTab === id
          ? 'border-light-accent dark:border-dark-accent text-light-text-primary dark:text-dark-text-primary'
          : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
      }`}>
      <Icon className="w-4 h-4" />{label}
      {count != null && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          activeTab === id
            ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent'
            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
        }`}>{count}</span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-light-border dark:border-dark-border overflow-x-auto scrollbar-none">
        <Tab id="groups"    label="Grupos de productos" icon={Boxes}   count={productGroups.length} />
        <Tab id="modifiers" label="Modificadores"       icon={Sliders} count={modifiers.length} />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        {activeTab === 'groups' && noCodeGroups > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-error/5 dark:bg-dark-error/5 border border-light-error/15 dark:border-dark-error/15">
            <AlertTriangle className="w-3 h-3 text-light-error dark:text-dark-error" />
            <span className="font-bold text-light-error dark:text-dark-error">{noCodeGroups}</span>
            <span className="text-light-error/70 dark:text-dark-error/70">valores sin código</span>
          </div>
        )}
        {activeTab === 'modifiers' && (
          <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
            Un modificador puede vincularse a múltiples productos. Usa el modal para configurarlo.
          </p>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <DuplicatesPanel token={token} account={account} onRefresh={onRefresh} />
          <OptionGroupList
            options={productGroups} sameTypeOptions={productGroups} products={products} productsById={productsById}
            token={token} account={account} onRefresh={onRefresh} t={t}
            emptyLabel="Sin grupos de productos" emptyIcon={Boxes}
            showLinkActions={false} defaultMode="product_group"
          />
        </div>
      )}
      {activeTab === 'modifiers' && (
        <OptionGroupList
          options={modifiers} sameTypeOptions={modifiers} products={products} productsById={productsById}
          token={token} account={account} onRefresh={onRefresh} t={t}
          emptyLabel="Sin modificadores — créalos desde aquí o desde la edición de un producto" emptyIcon={Sliders}
          showLinkActions={true} defaultMode="modifier"
        />
      )}
    </div>
  );
};

export default MenuOptionsManager;
