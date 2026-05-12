// src/pages/delivery/home/PromoEditor.jsx
// Editor panel for featured promos
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaImage, FaPlus, FaTrash, FaSpinner, FaUpload, FaToggleOn, FaToggleOff, FaTags,
} from 'react-icons/fa';
import LinkPicker from './LinkPicker';

// Resolve image URL — remap delivery local paths to admin template endpoint
const resolveImgUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/assets/')) {
    const filename = url.split('/').pop();
    return `/api/delivery/home-config/templates/${filename}`;
  }
  return url;
};

const inputCls = "w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all";
const labelCls = "block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-1";

const PromoCard = ({ promo, onChange, onRemove, onUploadImage, uploading, appState }) => {
  const inputRef = useRef(null);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20"
    >
      <div className="flex items-start gap-2.5">
        {promo.image ? (
          <img src={resolveImgUrl(promo.image)} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 border border-light-border/20 dark:border-dark-border/20" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-dashed border-light-border/30 dark:border-dark-border/30 flex items-center justify-center shrink-0">
            <FaImage size={12} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary truncate max-w-[120px]">{promo.title || 'Sin título'}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => onChange({ active: !promo.active })}
                className={`p-0.5 rounded ${promo.active ? 'text-green-500' : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
                {promo.active ? <FaToggleOn size={12} /> : <FaToggleOff size={12} />}
              </button>
              <button onClick={onRemove} className="p-1 rounded-lg hover:bg-red-500/10 text-red-500"><FaTrash size={8} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className={labelCls}>Título</label>
              <input value={promo.title || ''} onChange={(e) => onChange({ title: e.target.value })} placeholder="Combo" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Precio</label>
              <input value={promo.price || ''} onChange={(e) => onChange({ price: e.target.value })} placeholder="$15.990" className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Link</label>
            <LinkPicker value={promo.link || ''} onChange={(v) => onChange({ link: v })} appState={appState} />
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="px-2 py-1 rounded-lg text-[9px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary border border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary transition-colors flex items-center gap-1">
            {uploading ? <FaSpinner size={7} className="animate-spin" /> : <FaUpload size={7} />} Imagen
          </button>
          <input ref={inputRef} type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]; if (f) { const url = await onUploadImage(f); if (url) onChange({ image: url }); e.target.value = ''; }
          }} className="hidden" />
        </div>
      </div>
    </motion.div>
  );
};

const PromoEditor = ({ promos = [], onUpdate, onUploadImage, uploading, appState }) => {
  const add = () => {
    const newPromos = [...promos, { id: '', image: '', title: '', price: '', link: '', active: true }];
    onUpdate(newPromos);
  };
  const update = (idx, fields) => { const p = [...promos]; p[idx] = { ...p[idx], ...fields }; onUpdate(p); };
  const remove = (idx) => { const p = [...promos]; p.splice(idx, 1); onUpdate(p); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">
          Promos ({promos.length})
        </h2>
        <button onClick={add}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-1 shadow-sm">
          <FaPlus size={7} /> Agregar
        </button>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide pr-1">
        <AnimatePresence>
          {promos.map((promo, idx) => (
            <PromoCard key={promo.id || idx} promo={promo}
              onChange={(f) => update(idx, f)} onRemove={() => remove(idx)}
              onUploadImage={onUploadImage} uploading={uploading} appState={appState} />
          ))}
        </AnimatePresence>
      </div>
      {promos.length === 0 && (
        <div className="text-center py-8 border border-dashed border-matrix-green/20 rounded-2xl">
          <FaTags className="mx-auto text-matrix-green/30 mb-2" size={24} />
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Sin promos — agrega una</p>
        </div>
      )}
    </div>
  );
};

export default PromoEditor;
