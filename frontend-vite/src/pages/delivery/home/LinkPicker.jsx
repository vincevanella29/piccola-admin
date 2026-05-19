// src/pages/delivery/home/LinkPicker.jsx
// Apple-style universal link builder — Pages / Carta / External
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaLink, FaSearch, FaTimes, FaTh, FaBox, FaChevronRight,
  FaHome, FaUtensils, FaUser, FaMapMarkerAlt, FaShieldAlt, FaExternalLinkAlt, FaGlobe,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCategories, fetchProducts } from '../../../utils/cartaData';

// ── Internal pages registry (matches Delivery app's pageMetadata paths) ──
const INTERNAL_PAGES = [
  { path: '/',                       label: 'Home',              icon: FaHome,         emoji: '🏠' },
  { path: '/carta?menuType=carta',   label: 'Menú Completo',     icon: FaUtensils,     emoji: '📋' },
  { path: '/mi-perfil',              label: 'Mi Perfil',         icon: FaUser,         emoji: '👤' },
  { path: '/locales',                label: 'Sucursales',        icon: FaMapMarkerAlt, emoji: '🏪' },
  { path: '/legal/pagos',            label: 'Política de Pagos', icon: FaShieldAlt,    emoji: '🔒' },
];

const buildCategoryUrl = (catId) => `/carta?menuType=carta&category=${catId}`;
const buildProductUrl = (catId, code) => `/carta?menuType=carta&category=${catId}&productDetail=${code}`;

// ── Resolve a link value to a friendly label ──
const resolveLinkLabel = (val) => {
  if (!val) return null;
  // Check internal pages
  const page = INTERNAL_PAGES.find(p => p.path === val);
  if (page) return { emoji: page.emoji, label: page.label, type: 'page' };
  // External
  if (val.startsWith('http')) return { emoji: '🌐', label: val.replace(/^https?:\/\//, '').slice(0, 40), type: 'external' };
  // Carta deep link
  if (val.includes('category=') && val.includes('productDetail=')) return { emoji: '🍕', label: 'Producto', type: 'product' };
  if (val.includes('category=')) return { emoji: '🗂', label: 'Categoría', type: 'category' };
  // Generic internal
  return { emoji: '📱', label: val, type: 'internal' };
};

const LinkPicker = ({ value, onChange, appState }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('pages');       // pages | carta | external
  const [cartaMode, setCartaMode] = useState('category');  // category | product
  const [step, setStep] = useState('pick');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [extUrl, setExtUrl] = useState('');
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
    setExtUrl(value?.startsWith('http') ? value : '');
    // Detect current tab from value
    if (value?.startsWith('http')) setTab('external');
    else if (value?.includes('category=') || value?.includes('productDetail=')) setTab('carta');
    else setTab('pages');
    if (categories.length === 0) loadCategories();
  };

  const handlePickCategory = (cat) => {
    if (cartaMode === 'category') {
      onChange(buildCategoryUrl(cat._id || cat.id));
      setOpen(false);
    } else {
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

  const handlePickPage = (page) => {
    onChange(page.path);
    setOpen(false);
  };

  const handleSetExternal = () => {
    if (extUrl.trim()) {
      const url = extUrl.trim().startsWith('http') ? extUrl.trim() : `https://${extUrl.trim()}`;
      onChange(url);
      setOpen(false);
    }
  };

  const filtered = step === 'pick'
    ? categories.filter(c => !search || (c.nombre || '').toLowerCase().includes(search.toLowerCase()))
    : products.filter(p => !search || (p.nombre || '').toLowerCase().includes(search.toLowerCase()) || (p.codigo || '').includes(search));

  const resolved = resolveLinkLabel(value);

  return (
    <div className="relative" ref={ref}>
      {/* ── Input row ── */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 relative">
          {resolved ? (
            <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 min-h-[36px]">
              <span className="text-[12px]">{resolved.emoji}</span>
              <span className="text-[11px] font-semibold text-light-text-primary dark:text-dark-text-primary truncate flex-1">{resolved.label}</span>
              <button onClick={() => onChange('')}
                className="p-0.5 rounded text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 transition-colors shrink-0">
                <FaTimes size={8} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-dashed border-light-border/30 dark:border-dark-border/30 min-h-[36px]">
              <FaLink size={9} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
              <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Sin link configurado</span>
            </div>
          )}
        </div>
        <button onClick={() => open ? setOpen(false) : handleOpen()}
          className={`px-2.5 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 shrink-0 ${open
            ? 'bg-matrix-green text-white shadow-sm'
            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green border border-light-border/20 dark:border-dark-border/20'}`}>
          <FaLink size={9} />
          {value ? 'Cambiar' : 'Elegir'}
        </button>
      </div>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/30 dark:border-dark-border/30 shadow-2xl overflow-hidden"
          >
            {/* ── Segmented Control — 3 modes ── */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 rounded-xl p-0.5">
                {[
                  { id: 'pages',    emoji: '📱', label: 'Páginas' },
                  { id: 'carta',    emoji: '🗂',  label: 'Carta' },
                  { id: 'external', emoji: '🌐', label: 'Externo' },
                ].map(t => (
                  <button key={t.id} onClick={() => { setTab(t.id); setStep('pick'); setSearch(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1 ${tab === t.id
                      ? 'bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                      : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ PAGES TAB ═══ */}
            {tab === 'pages' && (
              <div className="px-2 pb-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {INTERNAL_PAGES.map(page => {
                    const Icon = page.icon;
                    const isSelected = value === page.path;
                    return (
                      <button key={page.path} onClick={() => handlePickPage(page)}
                        className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition-all group ${isSelected
                          ? 'bg-matrix-green/10 border border-matrix-green/30'
                          : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-transparent hover:border-matrix-green/20 hover:bg-matrix-green/5'
                        }`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSelected
                          ? 'bg-matrix-green/20 text-matrix-green'
                          : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary group-hover:text-matrix-green'}`}>
                          <Icon size={11} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[10px] font-bold truncate ${isSelected ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                            {page.label}
                          </p>
                          <p className="text-[8px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono truncate">{page.path}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ CARTA TAB ═══ */}
            {tab === 'carta' && (
              <>
                {/* Category / Product toggle */}
                {step === 'pick' && (
                  <div className="px-3 pb-1.5">
                    <div className="flex bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 rounded-lg p-0.5">
                      <button onClick={() => setCartaMode('category')}
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all ${cartaMode === 'category'
                          ? 'bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                          : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
                        🗂 Categoría
                      </button>
                      <button onClick={() => setCartaMode('product')}
                        className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all ${cartaMode === 'product'
                          ? 'bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                          : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
                        🍕 Producto
                      </button>
                    </div>
                  </div>
                )}

                {/* Breadcrumb for product step */}
                {step === 'pickProduct' && (
                  <div className="px-3 pt-1 pb-1.5 flex items-center gap-1.5">
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

                {/* Search */}
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

                {/* List */}
                <div className="max-h-[200px] overflow-y-auto scrollbar-hide border-t border-light-border/10 dark:border-dark-border/10">
                  {loading ? (
                    <div className="py-6 flex flex-col items-center gap-2">
                      <div className="w-5 h-5 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
                      <span className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary">Cargando...</span>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">No encontrado</p>
                    </div>
                  ) : step === 'pick' ? (
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
                        {cartaMode === 'product' && (
                          <FaChevronRight size={9} className="text-light-text-tertiary dark:text-dark-text-tertiary group-hover:text-matrix-green transition-colors shrink-0" />
                        )}
                        {cartaMode === 'category' && (
                          <span className="text-[8px] text-matrix-green font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            Seleccionar
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
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
              </>
            )}

            {/* ═══ EXTERNAL TAB ═══ */}
            {tab === 'external' && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary">
                  Ingresa un link externo — se abrirá en una nueva pestaña
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 relative">
                    <FaGlobe size={9} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" />
                    <input
                      value={extUrl}
                      onChange={(e) => setExtUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSetExternal()}
                      placeholder="https://ejemplo.com/promo"
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 text-[11px] font-mono text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none focus:ring-2 focus:ring-matrix-green/40 transition-all"
                      autoFocus
                    />
                  </div>
                  <button onClick={handleSetExternal} disabled={!extUrl.trim()}
                    className="px-3 py-2 rounded-xl text-[10px] font-bold bg-matrix-green text-white hover:bg-matrix-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                    <FaExternalLinkAlt size={8} /> Aplicar
                  </button>
                </div>
                {extUrl && !extUrl.startsWith('http') && (
                  <p className="text-[8px] text-amber-500 flex items-center gap-1">
                    Se agregará https:// automáticamente
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LinkPicker;
