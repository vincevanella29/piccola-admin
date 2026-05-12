// src/pages/delivery/home/LinkPicker.jsx
// Apple-style link builder — intuitive category/product picker
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaLink, FaSearch, FaTimes, FaTh, FaBox, FaChevronRight } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCategories, fetchProducts } from '../../../utils/cartaData';

const buildCategoryUrl = (catId) => `/carta?menuType=carta&category=${catId}`;
const buildProductUrl = (catId, code) => `/carta?menuType=carta&category=${catId}&productDetail=${code}`;

const LinkPicker = ({ value, onChange, appState }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('category');   // category | product
  const [step, setStep] = useState('pick');        // pick | pickProduct (after selecting category)
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCategories({ token: appState?.token, account: appState?.account, only_active: true });
      const cats = res?.categories || res?.data || res || [];
      setCategories(Array.isArray(cats) ? cats.filter(c => c.id !== 'inicio' && c._id !== 'inicio') : []);
    } catch { setCategories([]); }
    setLoading(false);
  }, [appState]);

  const loadProducts = useCallback(async (catId) => {
    setLoading(true);
    try {
      const res = await fetchProducts({ token: appState?.token, account: appState?.account, category_id: catId, only_active: true });
      const prods = res?.products || res?.data || res || [];
      setProducts(Array.isArray(prods) ? prods : []);
    } catch { setProducts([]); }
    setLoading(false);
  }, [appState]);

  const handleOpen = () => {
    setOpen(true);
    setStep('pick');
    setSearch('');
    setSelectedCat(null);
    if (categories.length === 0) loadCategories();
  };

  const handlePickCategory = (cat) => {
    if (mode === 'category') {
      onChange(buildCategoryUrl(cat._id || cat.id));
      setOpen(false);
    } else {
      // Product mode — drill into products
      setSelectedCat(cat);
      setStep('pickProduct');
      setSearch('');
      loadProducts(cat._id || cat.id);
    }
  };

  const handlePickProduct = (prod) => {
    const catId = selectedCat?._id || selectedCat?.id;
    onChange(buildProductUrl(catId, prod.codigo || prod._id || prod.id));
    setOpen(false);
  };

  const filtered = step === 'pick'
    ? categories.filter(c => !search || (c.nombre || '').toLowerCase().includes(search.toLowerCase()))
    : products.filter(p => !search || (p.nombre || '').toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').includes(search));

  return (
    <div className="relative" ref={ref}>
      {/* Input row */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 relative">
          <input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escribe o selecciona un link..."
            className="w-full px-3 py-2 pr-8 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-[11px] font-mono text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all"
          />
          {value && (
            <button onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 transition-colors">
              <FaTimes size={8} />
            </button>
          )}
        </div>
        <button onClick={() => open ? setOpen(false) : handleOpen()}
          className={`px-2.5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 shrink-0 ${open
            ? 'bg-matrix-green text-white shadow-sm'
            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green border border-light-border/20 dark:border-dark-border/20'}`}>
          <FaLink size={9} />
          Buscar
        </button>
      </div>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/30 dark:border-dark-border/30 shadow-2xl overflow-hidden"
          >
            {/* ── Segmented Control ── */}
            {step === 'pick' && (
              <div className="px-3 pt-3 pb-2">
                <div className="flex bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 rounded-xl p-0.5">
                  <button onClick={() => setMode('category')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all text-center ${mode === 'category'
                      ? 'bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                      : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
                    🗂 Categoría
                  </button>
                  <button onClick={() => setMode('product')}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all text-center ${mode === 'product'
                      ? 'bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                      : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
                    🍕 Producto
                  </button>
                </div>
                <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary mt-1.5 text-center">
                  {mode === 'category'
                    ? 'Selecciona una categoría — el link irá directo a ella'
                    : 'Selecciona una categoría y luego el producto'}
                </p>
              </div>
            )}

            {/* ── Breadcrumb for product step ── */}
            {step === 'pickProduct' && (
              <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-1.5">
                <button onClick={() => { setStep('pick'); setSearch(''); }}
                  className="text-[10px] text-matrix-green font-bold hover:underline">
                  Categorías
                </button>
                <FaChevronRight size={7} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
                <span className="text-[10px] font-bold text-light-text-primary dark:text-dark-text-primary truncate">
                  {selectedCat?.nombre}
                </span>
              </div>
            )}

            {/* ── Search ── */}
            <div className="px-3 pb-2">
              <div className="relative">
                <FaSearch size={9} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={step === 'pick' ? 'Buscar categoría...' : 'Buscar producto...'}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border/10 dark:border-dark-border/10 text-[10px] text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-matrix-green/30 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* ── List ── */}
            <div className="max-h-[240px] overflow-y-auto scrollbar-hide border-t border-light-border/10 dark:border-dark-border/10">
              {loading ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
                  <span className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary">Cargando...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">No encontrado</p>
                </div>
              ) : step === 'pick' ? (
                /* ── Categories ── */
                filtered.map(cat => (
                  <button key={cat._id || cat.id}
                    onClick={() => handlePickCategory(cat)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-matrix-green/5 dark:hover:bg-matrix-green/10 transition-colors text-left group border-b border-light-border/5 dark:border-dark-border/5 last:border-0"
                  >
                    {(cat.image || cat.imagen) ? (
                      <img src={cat.image || cat.imagen} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center shrink-0">
                        <FaTh size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{cat.nombre || cat.name}</p>
                    </div>
                    {mode === 'product' && (
                      <FaChevronRight size={9} className="text-light-text-tertiary dark:text-dark-text-tertiary group-hover:text-matrix-green transition-colors shrink-0" />
                    )}
                    {mode === 'category' && (
                      <span className="text-[8px] text-matrix-green font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Seleccionar
                      </span>
                    )}
                  </button>
                ))
              ) : (
                /* ── Products ── */
                filtered.map(prod => (
                  <button key={prod._id || prod.id || prod.codigo}
                    onClick={() => handlePickProduct(prod)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-matrix-green/5 dark:hover:bg-matrix-green/10 transition-colors text-left group border-b border-light-border/5 dark:border-dark-border/5 last:border-0"
                  >
                    {(prod.image || prod.imagen || prod.images?.[0]) ? (
                      <img src={prod.image || prod.imagen || prod.images?.[0]} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center shrink-0">
                        <FaBox size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{prod.nombre || prod.name}</p>
                      <p className="text-[8px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono mt-0.5">{prod.codigo || ''}</p>
                    </div>
                    {prod.precio != null && (
                      <span className="text-[10px] font-bold text-matrix-green shrink-0">
                        ${typeof prod.precio === 'number' ? prod.precio.toLocaleString('es-CL') : prod.precio}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* ── Quick Shortcuts ── */}
            <div className="px-3 py-2 border-t border-light-border/10 dark:border-dark-border/10 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
              <p className="text-[8px] text-light-text-tertiary dark:text-dark-text-tertiary font-bold uppercase tracking-wider mb-1">Accesos rápidos</p>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: '🏠 Home', url: '/' },
                  { label: '📋 Menú completo', url: '/carta?menuType=carta' },
                ].map(s => (
                  <button key={s.url} onClick={() => { onChange(s.url); setOpen(false); }}
                    className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-light-surface dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green hover:border-matrix-green/30 transition-all border border-light-border/20 dark:border-dark-border/20">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LinkPicker;
