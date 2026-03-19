// CreateModifierModal — product modifier creation (sauces, cooking, sizes, extras).
// Supports linking to MULTIPLE products and both product-reference and free-text values.
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sliders, Search, Save, Loader2, AlertTriangle, CheckCircle,
  Package, Type, Trash2, Lock, ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

const DISPLAY_TYPES = ['select', 'quantity', 'checkbox'];

/* ─── Shared field style ───────────────────────────────────────────────────── */
const fieldCls = `w-full px-3.5 py-2.5 rounded-xl text-sm
  bg-light-surface dark:bg-dark-surface-secondary
  border border-light-border dark:border-dark-border
  text-light-text-primary dark:text-dark-text-primary
  placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50
  focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all`;

const cellCls = `w-full px-3 py-2 rounded-xl text-xs
  bg-light-surface dark:bg-dark-surface-secondary
  border border-light-border dark:border-dark-border
  text-light-text-primary dark:text-dark-text-primary
  focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent transition-all`;

/* ─── Toggle switch ────────────────────────────────────────────────────────── */
const Toggle = ({ checked, onToggle, label }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none">
    <button type="button" onClick={onToggle}
      className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
        checked ? 'bg-light-accent dark:bg-dark-accent' : 'bg-light-surface-tertiary dark:bg-dark-surface-secondary'
      }`}>
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-[20px]' : 'translate-x-0.5'
      }`} />
    </button>
    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
  </label>
);

/* ─── MultiProductPicker ───────────────────────────────────────────────────── */
const MultiProductPicker = ({ products, selectedIds, onChange, t }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? products.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const toggle = p => {
    const pid = p.id || p._id;
    onChange(selectedIds.includes(pid) ? selectedIds.filter(id => id !== pid) : [...selectedIds, pid]);
  };

  const selectedProducts = products.filter(p => selectedIds.includes(p.id || p._id));

  return (
    <div className="space-y-2">
      {/* Chips */}
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedProducts.map(p => (
            <span key={p.id || p._id}
              className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 border border-light-accent/20 dark:border-dark-accent/20">
              {(p.media_r2 || p.media_url) && <img src={p.media_r2 || p.media_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
              <span className="text-[11px] font-semibold text-light-accent dark:text-dark-accent truncate max-w-[90px]">{p.nombre}</span>
              <button type="button" onClick={() => toggle(p)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors">
                <X className="w-2.5 h-2.5 text-light-accent dark:text-dark-accent" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Collapsible picker */}
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs transition-all ${
          open
            ? 'border-light-accent dark:border-dark-accent ring-2 ring-light-accent/15 dark:ring-dark-accent/15'
            : 'border-light-border dark:border-dark-border hover:border-light-accent/40 dark:hover:border-dark-accent/40'
        } bg-light-surface dark:bg-dark-surface-secondary`}>
        <span className={selectedIds.length > 0
          ? 'text-light-text-primary dark:text-dark-text-primary font-semibold'
          : 'text-light-text-secondary/60 dark:text-dark-text-secondary/60'
        }>
          {selectedIds.length > 0
            ? `${selectedIds.length} ${t('carta.mod_products_linked')}`
            : t('carta.mod_products_placeholder')}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
               : <ChevronDown className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-light-border dark:border-dark-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
                  <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
                    placeholder={t('carta.mod_search_products')}
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-light-surface dark:bg-dark-surface text-[11px] border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent" />
                </div>
              </div>
              {/* List */}
              <div className="max-h-40 overflow-y-auto scrollbar-none divide-y divide-light-border/40 dark:divide-dark-border/40">
                {filtered.map(p => {
                  const pid = p.id || p._id;
                  const isSel = selectedIds.includes(pid);
                  return (
                    <button key={pid} type="button" onClick={() => toggle(p)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] transition-colors ${
                        isSel ? 'bg-light-accent/5 dark:bg-dark-accent/5' : 'hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50'
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-all ${
                        isSel ? 'bg-light-accent dark:bg-dark-accent border-light-accent dark:border-dark-accent' : 'border-light-border dark:border-dark-border'
                      }`}>
                        {isSel && <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      {(p.media_r2 || p.media_url) && <img src={p.media_r2 || p.media_url} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />}
                      <span className={`truncate ${isSel ? 'font-semibold text-light-accent dark:text-dark-accent' : 'text-light-text-primary dark:text-dark-text-primary'}`}>{p.nombre}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && <p className="px-3 py-3 text-[11px] text-center text-light-text-secondary dark:text-dark-text-secondary">{t('carta.mod_no_results')}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Inline product search for adding values ──────────────────────────────── */
const ValueProductPicker = ({ products, onPick }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return lq ? products.filter(p => p.nombre?.toLowerCase().includes(lq) || p.codigo?.toLowerCase().includes(lq)) : products;
  }, [products, q]);

  return (
    <div className="rounded-xl border border-light-accent/30 dark:border-dark-accent/30 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 overflow-hidden">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Buscar producto…"
            className="w-full pl-7 pr-3 py-1.5 rounded-lg text-[11px] bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent" />
        </div>
      </div>
      <div className="max-h-36 overflow-y-auto scrollbar-none divide-y divide-light-border/30 dark:divide-dark-border/30">
        {filtered.map(p => (
          <button key={p.id || p._id} type="button" onClick={() => onPick(p)}
            className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
            {(p.media_r2 || p.media_url) && <img src={p.media_r2 || p.media_url} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</p>
              <div className="flex items-center gap-1.5">
                {p.codigo && <span className="font-mono text-[9px] text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</span>}
                {p.precio > 0 && <span className="text-[9px] text-light-accent dark:text-dark-accent font-bold">${Number(p.precio).toLocaleString('es-CL')}</span>}
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="px-3 py-3 text-[11px] text-center text-light-text-secondary dark:text-dark-text-secondary">Sin resultados</p>}
      </div>
    </div>
  );
};

/* ─── CreateModifierModal ──────────────────────────────────────────────────── */
const CreateModifierModal = ({ onClose, onCreated, token, account, products = [], editData = null }) => {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [saving, setSaving]                 = useState(false);
  const [msg, setMsg]                       = useState(null);
  const [showValueProductPicker, setShowVPP] = useState(false);

  const [form, setForm] = useState(() => {
    if (editData) {
      const mids = editData.menu_ids?.length ? editData.menu_ids
                 : (editData.menu_id ? [editData.menu_id] : []);
      return {
        option_name: editData.option_name || '',
        display_type: editData.display_type || 'select',
        required: editData.required || false,
        priority: editData.priority || 0,
        min_selected: editData.min_selected || 0,
        max_selected: editData.max_selected || 1,
        menu_ids: mids.filter(x => x && String(x).trim() && String(x).trim() !== 'None'),
        values: (editData.values || []).map(v => ({
          ...v,
          _type: (v.codigo?.trim()) ? 'product' : 'comment',
          _ref_id: v.id || v.option_value_id || v._ref_id,
        })),
      };
    }
    return {
      option_name: '', display_type: 'select', required: false,
      priority: 0, min_selected: 0, max_selected: 1,
      menu_ids: [], values: [],
    };
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateValue = (i, key, val) => setForm(f => {
    const vs = [...f.values]; vs[i] = { ...vs[i], [key]: val }; return { ...f, values: vs };
  });
  const removeValue = i => setForm(f => ({ ...f, values: f.values.filter((_, idx) => idx !== i) }));
  const addFreeText = () => setForm(f => ({
    ...f, values: [...f.values, { _type: 'comment', name: '', codigo: '', price: 0, priority: f.values.length }],
  }));
  const addFromProduct = p => {
    if (!p || form.values.find(v => v.codigo === p.codigo && v._type === 'product')) return;
    setForm(f => ({
      ...f,
      values: [...f.values, { _type: 'product', _ref_id: p.id || p._id, name: p.nombre, codigo: p.codigo || '', price: p.precio || 0, priority: f.values.length }],
    }));
    setShowVPP(false);
  };

  const isValid = () => !!form.option_name.trim();

  const handleSave = async () => {
    if (!isValid()) { setMsg({ type: 'error', text: t('carta.mod_validation_error') }); return; }
    setSaving(true); setMsg(null);
    try {
      const cleanValues = form.values.map(({ _ref_id, _type, ...rest }) => rest);
      const payload = {
        option_name: form.option_name.trim(), display_type: form.display_type,
        required: form.required, priority: parseInt(form.priority, 10) || 0,
        min_selected: parseInt(form.min_selected, 10) || 0,
        max_selected: parseInt(form.max_selected, 10) || 1,
        menu_id: form.menu_ids[0] || '', menu_ids: form.menu_ids,
        option_type: 'modifier', values: cleanValues,
      };
      if (isEdit) {
        await cartaApi.updateMenuOptionGroup({ token, account, optionId: editData.id || editData._id, data: payload });
      } else {
        await cartaApi.createMenuOptionGroup({ token, account, data: payload });
      }
      onCreated();
      onClose();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />

      {/* Sheet */}
      <motion.div
        initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative z-10 w-full sm:max-w-lg flex flex-col max-h-[94dvh] sm:max-h-[86vh]
          bg-light-surface dark:bg-dark-surface rounded-t-3xl sm:rounded-3xl shadow-modal
          border border-light-border dark:border-dark-border overflow-hidden"
      >
        {/* ── Header ── */}
        <header className="shrink-0 px-5 pt-4 pb-3 border-b border-light-border dark:border-dark-border">
          <div className="flex justify-center mb-3 sm:hidden">
            <div className="w-9 h-1 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-secondary" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-light-accent dark:text-dark-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{isEdit ? t('carta.mod_edit_title') : t('carta.mod_title')}</h2>
              <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-tight mt-0.5">{t('carta.mod_desc')}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center shrink-0 hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors active:scale-90">
              <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
            </button>
          </div>
        </header>

        {/* ── Alert ── */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`shrink-0 mx-4 mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                msg.type === 'error'
                  ? 'bg-light-error/5 dark:bg-dark-error/5 text-light-error dark:text-dark-error border-light-error/20 dark:border-dark-error/20'
                  : 'bg-light-success/5 dark:bg-dark-success/5 text-light-success dark:text-dark-success border-light-success/20 dark:border-dark-success/20'
              }`}>
              {msg.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
              <span className="flex-1">{msg.text}</span>
              <button onClick={() => setMsg(null)} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {/* ─ Section 1: Name ─ */}
          <div className="px-5 pt-4 pb-3">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
              {t('carta.mod_name')} <span className="text-light-error dark:text-dark-error">*</span>
            </label>
            <input type="text" value={form.option_name}
              onChange={e => setField('option_name', e.target.value)}
              placeholder={t('carta.mod_name_ph')} autoFocus className={fieldCls} />
          </div>

          {/* ─ Section 2: Linked products ─ */}
          <div className="px-5 pb-3">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
              {t('carta.mod_linked_products')}{' '}
              <span className="font-normal normal-case text-light-text-secondary/60 dark:text-dark-text-secondary/60">{t('carta.mod_linked_optional')}</span>
            </label>
            <MultiProductPicker products={products} selectedIds={form.menu_ids}
              onChange={ids => setField('menu_ids', ids)} t={t} />
          </div>

          {/* ─ Section 3: Settings ─ */}
          <div className="mx-5 border-t border-light-border dark:border-dark-border" />
          <div className="px-5 pt-3 pb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Display type */}
              <div>
                <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
                  {t('carta.mod_display_type')}
                </label>
                <select value={form.display_type} onChange={e => setField('display_type', e.target.value)}
                  className={`${fieldCls} appearance-none cursor-pointer`}>
                  {DISPLAY_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                </select>
              </div>
              {/* Min / Max */}
              <div>
                <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
                  {t('carta.mod_min_max')}
                </label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" value={form.min_selected}
                    onChange={e => setField('min_selected', e.target.value)}
                    className={`${cellCls} text-center flex-1`} />
                  <span className="text-light-text-secondary dark:text-dark-text-secondary text-xs">—</span>
                  <input type="number" min="0" value={form.max_selected}
                    onChange={e => setField('max_selected', e.target.value)}
                    className={`${cellCls} text-center flex-1`} />
                </div>
              </div>
            </div>
            <Toggle checked={form.required} onToggle={() => setField('required', !form.required)} label={t('carta.mod_required')} />
          </div>

          {/* ─ Section 4: Values ─ */}
          <div className="mx-5 border-t border-light-border dark:border-dark-border" />
          <div className="px-5 pt-3 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                {t('carta.mod_options')} <span className="font-normal">({form.values.length})</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setShowVPP(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    showValueProductPicker
                      ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                      : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent'
                  }`}>
                  <Package className="w-3 h-3" />{t('carta.mod_add_product')}
                </button>
                <button type="button" onClick={addFreeText}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent transition-all">
                  <Type className="w-3 h-3" />{t('carta.mod_add_free')}
                </button>
              </div>
            </div>

            {/* Value product picker */}
            <AnimatePresence>
              {showValueProductPicker && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <ValueProductPicker products={products} onPick={addFromProduct} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {form.values.length === 0 && (
              <div className="text-center py-5">
                <div className="w-10 h-10 mx-auto rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center mb-2">
                  <Sliders className="w-5 h-5 text-light-text-secondary/40 dark:text-dark-text-secondary/40" />
                </div>
                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('carta.mod_options_hint')}</p>
              </div>
            )}

            {/* Values list */}
            <div className="space-y-2">
              {form.values.map((val, i) => {
                const isProd = val._type === 'product';
                return (
                  <motion.div key={val._ref_id || `v-${i}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="group rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-secondary overflow-hidden">
                    {/* Top bar: type badge + delete */}
                    <div className="flex items-center justify-between px-3 pt-2 pb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isProd
                          ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent'
                          : 'bg-light-surface-secondary dark:bg-dark-surface-tertiary text-light-text-secondary dark:text-dark-text-secondary'
                      }`}>
                        {isProd ? <><Package className="w-2.5 h-2.5" />{t('carta.mod_type_product')}</> : <><Type className="w-2.5 h-2.5" />{t('carta.mod_type_free')}</>}
                      </span>
                      <button type="button" onClick={() => removeValue(i)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error hover:bg-light-error/10 dark:hover:bg-dark-error/10 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="px-3 pb-2.5">
                      {isProd ? (
                        /* Product value — read only */
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{val.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {val.codigo && <span className="font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{val.codigo}</span>}
                              {val.price > 0 && <span className="text-[10px] font-bold text-light-accent dark:text-dark-accent">+${Number(val.price).toLocaleString('es-CL')}</span>}
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-[9px] text-light-text-secondary/50 dark:text-dark-text-secondary/50 shrink-0">
                            <Lock className="w-2.5 h-2.5" />{t('carta.mod_product_locked')}
                          </span>
                        </div>
                      ) : (
                        /* Free text — editable */
                        <div className="space-y-1.5">
                          <input value={val.name} onChange={e => updateValue(i, 'name', e.target.value)}
                            placeholder={t('carta.mod_freetext_name_ph')} autoFocus={!val.name}
                            className={cellCls} />
                          <div className="grid grid-cols-3 gap-1.5">
                            <input value={val.codigo} onChange={e => updateValue(i, 'codigo', e.target.value)}
                              placeholder={t('carta.mod_field_code')} className={`${cellCls} font-mono`} />
                            <input type="number" value={val.price || ''} onChange={e => updateValue(i, 'price', parseFloat(e.target.value) || 0)}
                              placeholder={t('carta.mod_price_optional')} className={`${cellCls} text-center`} />
                            <input type="number" value={val.priority} onChange={e => updateValue(i, 'priority', parseInt(e.target.value) || 0)}
                              placeholder="#" className={`${cellCls} text-center`} />
                          </div>
                          <p className="text-[9px] text-light-text-secondary/60 dark:text-dark-text-secondary/60">{t('carta.mod_freetext_hint')}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 flex gap-2.5 px-5 py-3.5 border-t border-light-border dark:border-dark-border bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface dark:hover:bg-dark-surface transition-colors active:scale-[0.98]">
            {t('carta.mod_cancel')}
          </button>
          <button type="button" disabled={saving || !isValid()} onClick={handleSave}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98] shadow-neon">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('carta.mod_saving')}</>
              : <><Save className="w-4 h-4" /> {isEdit ? t('carta.mod_save') : t('carta.mod_create')}</>
            }
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default CreateModifierModal;
