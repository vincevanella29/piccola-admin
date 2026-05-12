// src/pages/delivery/home/BannerEditor.jsx
// Editor panel for hero banners
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaImage, FaPlus, FaTrash, FaSpinner, FaArrowUp, FaArrowDown,
  FaUpload, FaEye, FaEyeSlash,
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

// ── Image Upload Inline ──────────────────────────────────────
const ImgUp = ({ currentUrl, onUpload, uploading, label = 'Imagen' }) => {
  const inputRef = useRef(null);
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        {currentUrl ? (
          <img src={resolveImgUrl(currentUrl)} alt="" className="w-14 h-9 rounded-lg object-cover border border-light-border/20 dark:border-dark-border/20" />
        ) : (
          <div className="w-14 h-9 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-dashed border-light-border/30 dark:border-dark-border/30 flex items-center justify-center">
            <FaImage size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
          </div>
        )}
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary border border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary transition-colors flex items-center gap-1">
          {uploading ? <FaSpinner size={8} className="animate-spin" /> : <FaUpload size={8} />} Subir
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await onUpload(f); e.target.value = ''; } }} className="hidden" />
      </div>
    </div>
  );
};

// ── Single Banner Card ───────────────────────────────────────
const BannerCard = ({ banner, index, onChange, onRemove, onMove, total, onUploadImage, uploading, appState }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    className="p-3 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20"
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-matrix-green font-mono">#{index + 1}</span>
        <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary truncate max-w-[160px]">
          {banner.title || 'Sin título'}
        </span>
        <button onClick={() => onChange({ active: !banner.active })}
          className={`p-0.5 rounded ${banner.active ? 'text-green-500' : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
          {banner.active ? <FaEye size={10} /> : <FaEyeSlash size={10} />}
        </button>
      </div>
      <div className="flex items-center gap-0.5">
        {index > 0 && <button onClick={() => onMove(-1)} className="p-1 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary"><FaArrowUp size={8} /></button>}
        {index < total - 1 && <button onClick={() => onMove(1)} className="p-1 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary"><FaArrowDown size={8} /></button>}
        <button onClick={onRemove} className="p-1 rounded-lg hover:bg-red-500/10 text-red-500"><FaTrash size={8} /></button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <ImgUp currentUrl={banner.image} label="Imagen" uploading={uploading}
        onUpload={async (file) => { const url = await onUploadImage(file); if (url) onChange({ image: url }); }} />
      <div>
        <label className={labelCls}>Título</label>
        <input value={banner.title || ''} onChange={(e) => onChange({ title: e.target.value })} placeholder="LAS MEJORES" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Subtítulo</label>
        <input value={banner.subtitle || ''} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="PIZZAS ARTESANALES" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Precio</label>
        <input value={banner.promo_price || ''} onChange={(e) => onChange({ promo_price: e.target.value })} placeholder="$12.990" className={`${inputCls} font-mono`} />
      </div>
      <div>
        <label className={labelCls}>Badge</label>
        <input value={banner.badge || ''} onChange={(e) => onChange({ badge: e.target.value })} placeholder="Familiar" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CTA</label>
        <input value={banner.cta_text || ''} onChange={(e) => onChange({ cta_text: e.target.value })} placeholder="Pide Ahora" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className={labelCls}>CTA Link</label>
        <LinkPicker value={banner.cta_link || ''} onChange={(v) => onChange({ cta_link: v })} appState={appState} />
      </div>
    </div>
  </motion.div>
);

// ── BannerEditor ─────────────────────────────────────────────
const BannerEditor = ({ banners = [], onUpdate, onUploadImage, uploading, appState }) => {
  const add = () => {
    const newBanners = [...banners, { id: '', image: '', title: '', subtitle: '', promo_price: '', badge: '', cta_text: 'Pide Ahora', cta_link: '', active: true, priority: banners.length }];
    onUpdate(newBanners);
  };
  const update = (idx, fields) => { const b = [...banners]; b[idx] = { ...b[idx], ...fields }; onUpdate(b); };
  const remove = (idx) => { const b = [...banners]; b.splice(idx, 1); onUpdate(b); };
  const move = (idx, dir) => { const b = [...banners]; const ni = idx + dir; [b[idx], b[ni]] = [b[ni], b[idx]]; onUpdate(b); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">
          Banners ({banners.length})
        </h2>
        <button onClick={add}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-1 shadow-sm">
          <FaPlus size={7} /> Agregar
        </button>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide pr-1">
        <AnimatePresence>
          {banners.map((banner, idx) => (
            <BannerCard key={banner.id || idx} banner={banner} index={idx} total={banners.length}
              onChange={(f) => update(idx, f)} onRemove={() => remove(idx)} onMove={(d) => move(idx, d)}
              onUploadImage={onUploadImage} uploading={uploading} appState={appState} />
          ))}
        </AnimatePresence>
      </div>
      {banners.length === 0 && (
        <div className="text-center py-8 border border-dashed border-matrix-green/20 rounded-2xl">
          <FaImage className="mx-auto text-matrix-green/30 mb-2" size={24} />
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Sin banners — agrega uno</p>
        </div>
      )}
    </div>
  );
};

export default BannerEditor;
