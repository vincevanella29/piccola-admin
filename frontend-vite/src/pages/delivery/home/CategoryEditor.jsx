// src/pages/delivery/home/CategoryEditor.jsx
// Editor for featured_categories — objects with { slug, name, image }
// Supports: image upload to R2, pick from assets/templates, or use product images
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaSpinner, FaPlus, FaTrash, FaTh, FaSearch, FaUpload, FaImage, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCategories } from '../../../utils/cartaData';

const inputCls = "w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all";
const labelCls = "block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-1";

// Resolve images from delivery local paths to admin template endpoint
const resolveImgUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/assets/')) {
    const filename = url.split('/').pop();
    return `/api/delivery/home-config/templates/${filename}`;
  }
  return url;
};

// ── Single Category Card (selected) ─────────────────────────
const SelectedCategoryCard = ({ cat, index, total, onChange, onRemove, onMove, onUploadImage, uploading }) => {
  const inputRef = useRef(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="p-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20"
    >
      <div className="flex items-start gap-2">
        {/* Image preview */}
        {cat.image ? (
          <img src={resolveImgUrl(cat.image)} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-light-border/20 dark:border-dark-border/20" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-dashed border-light-border/30 dark:border-dark-border/30 flex items-center justify-center shrink-0">
            <FaTh size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {/* Header with controls */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-matrix-green font-mono">#{index + 1}</span>
            <div className="flex items-center gap-0.5">
              {index > 0 && <button onClick={() => onMove(-1)} className="p-0.5 rounded hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary"><FaArrowUp size={7} /></button>}
              {index < total - 1 && <button onClick={() => onMove(1)} className="p-0.5 rounded hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary"><FaArrowDown size={7} /></button>}
              <button onClick={onRemove} className="p-0.5 rounded hover:bg-red-500/10 text-red-500"><FaTrash size={7} /></button>
            </div>
          </div>

          {/* Name input */}
          <div>
            <label className={labelCls}>Nombre</label>
            <input value={cat.name || ''} onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Pizzas" className={`${inputCls} text-xs`} />
          </div>

          {/* Slug */}
          <div>
            <label className={labelCls}>Slug</label>
            <input value={cat.slug || ''} onChange={(e) => onChange({ slug: e.target.value })}
              placeholder="pizzas" className={`${inputCls} text-xs font-mono`} />
          </div>

          {/* Image upload */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="px-2 py-0.5 rounded-lg text-[9px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary border border-light-border/10 dark:border-dark-border/10 text-light-text-primary dark:text-dark-text-primary transition-colors flex items-center gap-1">
              {uploading ? <FaSpinner size={7} className="animate-spin" /> : <FaUpload size={7} />}
              Subir
            </button>
            {cat.image && (
              <button onClick={() => onChange({ image: '' })}
                className="px-2 py-0.5 rounded-lg text-[9px] text-red-500 hover:bg-red-500/10 transition-colors">
                Quitar
              </button>
            )}
            <input ref={inputRef} type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) { const url = await onUploadImage(f); if (url) onChange({ image: url }); e.target.value = ''; }
            }} className="hidden" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main CategoryEditor ──────────────────────────────────────
const CategoryEditor = ({ featuredCategories = [], onUpdate, appState, onUploadImage, uploading }) => {
  const [allCategories, setAllCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await fetchCategories({
        token: appState?.token,
        account: appState?.account,
        only_active: true,
      });
      const cats = res?.categories || res?.data || res || [];
      setAllCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.warn('[CategoryEditor] Error loading categories:', err);
      setAllCategories([]);
    }
    setLoadingCats(false);
  }, [appState]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Helpers
  const update = (idx, fields) => {
    const arr = [...featuredCategories];
    arr[idx] = { ...arr[idx], ...fields };
    onUpdate(arr);
  };
  const remove = (idx) => {
    const arr = [...featuredCategories];
    arr.splice(idx, 1);
    onUpdate(arr);
  };
  const move = (idx, dir) => {
    const arr = [...featuredCategories];
    const ni = idx + dir;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    onUpdate(arr);
  };
  const addFromCatalog = (cat) => {
    const name = cat.nombre || cat.name || '';
    const slug = cat.slug || name.toLowerCase();
    // Don't add duplicates
    if (featuredCategories.some(c => c.slug === slug)) return;
    onUpdate([...featuredCategories, {
      slug,
      name,
      image: cat.image || cat.imagen || '',
    }]);
  };
  const addEmpty = () => {
    onUpdate([...featuredCategories, { slug: '', name: '', image: '' }]);
  };

  const isSelected = (cat) => {
    const name = (cat.nombre || cat.name || '').toLowerCase();
    const slug = (cat.slug || '').toLowerCase();
    return featuredCategories.some(c =>
      (c.slug || '').toLowerCase() === slug || (c.slug || '').toLowerCase() === name
    );
  };

  const filteredCats = allCategories.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.nombre || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-1.5">
          <FaTh size={11} className="text-matrix-green" />
          Categorías ({featuredCategories.length})
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={addEmpty}
            className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors flex items-center gap-1 border border-light-border/10 dark:border-dark-border/10">
            <FaPlus size={6} /> Manual
          </button>
          <button onClick={() => setShowPicker(!showPicker)}
            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors flex items-center gap-1 ${showPicker
              ? 'bg-matrix-green text-white'
              : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary border border-light-border/10 dark:border-dark-border/10'}`}>
            <FaSearch size={6} /> Catálogo
          </button>
        </div>
      </div>

      <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
        Categorías del Home. Si está vacío se muestran las primeras 6 del menú.
      </p>

      {/* Selected categories */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-hide pr-0.5">
        <AnimatePresence>
          {featuredCategories.map((cat, idx) => (
            <SelectedCategoryCard
              key={cat.slug || idx}
              cat={cat}
              index={idx}
              total={featuredCategories.length}
              onChange={(fields) => update(idx, fields)}
              onRemove={() => remove(idx)}
              onMove={(dir) => move(idx, dir)}
              onUploadImage={onUploadImage}
              uploading={uploading}
            />
          ))}
        </AnimatePresence>
      </div>

      {featuredCategories.length === 0 && (
        <div className="text-center py-6 border border-dashed border-matrix-green/20 rounded-xl">
          <FaTh className="mx-auto text-matrix-green/30 mb-1.5" size={20} />
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
            Sin categorías — se mostrarán las primeras 6 del menú
          </p>
        </div>
      )}

      {/* Catalog picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 space-y-2">
              <p className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary">Agregar del catálogo</p>
              <div className="relative">
                <FaSearch size={9} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..." className={`${inputCls} pl-7 text-[10px]`} />
              </div>
              {loadingCats ? (
                <div className="flex justify-center py-4">
                  <FaSpinner size={14} className="animate-spin text-matrix-green" />
                </div>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-hide">
                  {filteredCats.map(cat => {
                    const selected = isSelected(cat);
                    const catName = cat.nombre || cat.name || '?';
                    return (
                      <button
                        key={cat._id || cat.id || catName}
                        onClick={() => !selected && addFromCatalog(cat)}
                        disabled={selected}
                        className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-all text-left ${selected
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary cursor-pointer'
                        }`}
                      >
                        {(cat.image || cat.imagen) ? (
                          <img src={cat.image || cat.imagen} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-light-surface-secondary dark:bg-dark-surface-secondary shrink-0 flex items-center justify-center">
                            <FaImage size={8} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary truncate">{catName}</p>
                        </div>
                        {!selected && (
                          <span className="text-[8px] text-matrix-green font-bold">+ Agregar</span>
                        )}
                        {selected && (
                          <span className="text-[8px] text-light-text-tertiary dark:text-dark-text-tertiary">Agregado</span>
                        )}
                      </button>
                    );
                  })}
                  {filteredCats.length === 0 && (
                    <p className="text-center py-3 text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
                      No encontrado
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryEditor;
