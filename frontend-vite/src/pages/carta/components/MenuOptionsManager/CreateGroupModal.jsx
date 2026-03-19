// CreateGroupModal — groups products together in the digital menu (carta).
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Boxes, Search, Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

/* ─── CreateGroupModal ─────────────────────────────────────────────────────── */
const CreateGroupModal = ({ onClose, onCreated, token, account, products = [], editData = null }) => {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState(() => {
    if (editData) {
      return {
        option_name: editData.option_name || '',
        display_type: editData.display_type || 'select',
        required: editData.required || false,
        priority: editData.priority || 0,
        min_selected: editData.min_selected || 0,
        max_selected: editData.max_selected || 1,
        values: (editData.values || []).map(v => ({
          ...v, _ref_id: v.id || v.option_value_id || v._ref_id,
        })),
      };
    }
    return {
      option_name: '', display_type: 'select', required: false,
      priority: 0, min_selected: 0, max_selected: 1, values: [],
    };
  });
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Selected product IDs
  const selected = useMemo(
    () => (form.values || []).map(v => v._ref_id).filter(Boolean),
    [form.values],
  );

  // Filtered products
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? products.filter(p => p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))
      : products;
  }, [products, search]);

  const toggle = p => {
    const pid = p.id || p._id;
    if (selected.includes(pid)) {
      setForm(f => ({ ...f, values: f.values.filter(v => v._ref_id !== pid) }));
    } else {
      setForm(f => ({
        ...f,
        values: [
          ...f.values,
          { _ref_id: pid, name: p.nombre, codigo: p.codigo || '', price: p.precio || 0, priority: f.values.length },
        ],
      }));
    }
  };

  const isValid = () => form.option_name.trim() && form.values.length >= 2;

  const handleSave = async () => {
    if (!isValid()) { setMsg({ type: 'error', text: t('carta.grp_validation_error') }); return; }
    setSaving(true); setMsg(null);
    try {
      const cleanValues = form.values.map(({ _ref_id, ...rest }) => rest);
      const payload = {
        option_name: form.option_name.trim(), display_type: form.display_type,
        required: form.required, priority: parseInt(form.priority, 10) || 0,
        min_selected: parseInt(form.min_selected, 10) || 0,
        max_selected: parseInt(form.max_selected, 10) || 1,
        menu_id: '', option_type: 'product_group', values: cleanValues,
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
          {/* Drag pill mobile */}
          <div className="flex justify-center mb-3 sm:hidden">
            <div className="w-9 h-1 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-secondary" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5 text-light-accent dark:text-dark-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{isEdit ? t('carta.grp_edit_title') : t('carta.grp_title')}</h2>
              <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary leading-tight mt-0.5">{t('carta.grp_desc')}</p>
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
          {/* Group name */}
          <div className="px-5 pt-4 pb-3">
            <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
              {t('carta.grp_name')} <span className="text-light-error dark:text-dark-error">*</span>
            </label>
            <input type="text" value={form.option_name}
              onChange={e => setField('option_name', e.target.value)}
              placeholder={t('carta.grp_name_ph')} autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all" />
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-light-border dark:border-dark-border" />

          {/* Product selector */}
          <div className="px-5 pt-3 pb-4 space-y-3">
            {/* Row: label + counter */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                {t('carta.grp_products_label')}
              </span>
              <span className={`text-xs font-bold tabular-nums ${selected.length >= 2 ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {selected.length}
                <span className="font-normal text-light-text-secondary dark:text-dark-text-secondary">/{products.length}</span>
                {selected.length < 2 && <span className="ml-1 text-[10px] font-normal">({t('carta.grp_min_2')})</span>}
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('carta.grp_search_products')}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-light-surface dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-light-accent dark:focus:ring-dark-accent transition-all" />
            </div>

            {/* Selected chips */}
            <AnimatePresence>
              {selected.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="flex flex-wrap gap-1.5">
                    {form.values.map((v, i) => (
                      <motion.span key={v._ref_id || i}
                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-[11px] font-semibold border border-light-accent/20 dark:border-dark-accent/20">
                        <span className="truncate max-w-[80px]">{v.name}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, values: f.values.filter((_, idx) => idx !== i) }))}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Product grid list */}
            <div className="rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
              <div className="max-h-64 overflow-y-auto scrollbar-none divide-y divide-light-border/50 dark:divide-dark-border/50">
                {filtered.map(p => {
                  const pid = p.id || p._id;
                  const isSel = selected.includes(pid);
                  return (
                    <button key={pid} type="button" onClick={() => toggle(p)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-all ${
                        isSel
                          ? 'bg-light-accent/5 dark:bg-dark-accent/5'
                          : 'hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50'
                      }`}>
                      {/* Checkbox */}
                      <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSel
                          ? 'bg-light-accent dark:bg-dark-accent border-light-accent dark:border-dark-accent'
                          : 'border-light-border dark:border-dark-border'
                      }`}>
                        {isSel && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Thumb */}
                      {(p.media_r2 || p.media_url) ? (
                        <img src={p.media_r2 || p.media_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-light-border dark:border-dark-border" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary shrink-0 flex items-center justify-center">
                          <Boxes className="w-3 h-3 text-light-text-secondary/30 dark:text-dark-text-secondary/30" />
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate transition-colors ${
                          isSel ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-primary dark:text-dark-text-primary'
                        }`}>{p.nombre}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {p.codigo && <span className="font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{p.codigo}</span>}
                          {p.precio > 0 && <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">${Number(p.precio).toLocaleString('es-CL')}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-4 py-6 text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">{t('carta.grp_no_results')}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="shrink-0 flex gap-2.5 px-5 py-3.5 border-t border-light-border dark:border-dark-border bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface dark:hover:bg-dark-surface transition-colors active:scale-[0.98]">
            {t('carta.grp_cancel')}
          </button>
          <button type="button" disabled={saving || !isValid()} onClick={handleSave}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98] shadow-neon">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('carta.grp_saving')}</>
              : <><Save className="w-4 h-4" /> {isEdit ? t('carta.grp_save') : t('carta.grp_create')}</>
            }
          </button>
        </footer>
      </motion.div>
    </div>
  );
};

export default CreateGroupModal;
