// ProductPickerModal.jsx — Modal para seleccionar productos y armar grids
// Receives searchProducts/getBestsellers from hook via props
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaStar, FaSpinner, FaTimes, FaCheck } from 'react-icons/fa';

const CLP = (v) => `$${Number(v || 0).toLocaleString('es-CL')}`;

const ProductPickerModal = ({ open, mode, searchProducts, getBestsellers, onInsertCard, onInsertGrid, onClose }) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!searchProducts) return;
    setLoading(true);
    try { const r = await searchProducts(q || undefined, 20); setProducts(r?.products || []); }
    catch { setProducts([]); }
    setLoading(false);
  }, [searchProducts]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch, open]);

  useEffect(() => { if (open) { setSelected([]); setQuery(''); } }, [open]);

  const loadBestsellers = async () => {
    if (!getBestsellers) return;
    setLoading(true);
    try { const r = await getBestsellers(12); setProducts(r?.products || []); }
    catch { setProducts([]); }
    setLoading(false);
  };

  const toggleSelect = (p) => setSelected(s => s.find(x => x.codigo === p.codigo) ? s.filter(x => x.codigo !== p.codigo) : [...s, p]);
  const isSel = (p) => !!selected.find(x => x.codigo === p.codigo);

  const handleConfirmGrid = () => { if (selected.length > 0) { onInsertGrid(selected); onClose(); } };
  const handleInsertCard = (p) => { onInsertCard(p); onClose(); };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/10 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-light-border/10 dark:border-dark-border/10">
            <div>
              <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                {mode === 'grid' ? '🔲 Seleccionar productos para Grid' : '📦 Insertar Producto'}
              </h3>
              <p className="text-xs text-light-text-tertiary mt-0.5">{mode === 'grid' ? 'Selecciona varios productos' : 'Click en un producto para insertarlo'}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary transition-colors">
              <FaTimes size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3 flex gap-2">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-3 text-light-text-tertiary" size={11} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto..."
                className="w-full pl-8 pr-3 py-2.5 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary" autoFocus />
            </div>
            <button onClick={loadBestsellers}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500/20 transition-colors border border-amber-500/20">
              <FaStar size={10} /> Top Vendidos
            </button>
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-12"><FaSpinner className="animate-spin text-matrix-green" size={20} /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-light-text-tertiary text-sm">Sin resultados</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {products.map(p => {
                  const sel = isSel(p);
                  return (
                    <button key={p._id || p.codigo} onClick={() => mode === 'grid' ? toggleSelect(p) : handleInsertCard(p)}
                      className={`relative bg-light-surface-secondary dark:bg-dark-surface-secondary border rounded-xl overflow-hidden text-left transition-all hover:shadow-md ${sel ? 'border-matrix-green ring-2 ring-matrix-green/20' : 'border-light-border/10 dark:border-dark-border/10 hover:border-matrix-green/30'}`}>
                      {sel && <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-matrix-green rounded-full flex items-center justify-center z-10"><FaCheck size={8} className="text-black" /></div>}
                      <div className="h-20 bg-light-surface dark:bg-dark-surface">
                        {p.media_r2 ? <img src={p.media_r2} alt={p.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">🍕</div>}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary truncate">{p.nombre}</p>
                        <p className="text-xs font-bold text-matrix-green mt-0.5">{CLP(p.precio)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer — grid mode: confirm button */}
          {mode === 'grid' && selected.length > 0 && (
            <div className="px-5 py-3 border-t border-light-border/10 dark:border-dark-border/10 flex items-center justify-between">
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{selected.length} productos seleccionados</span>
              <button onClick={handleConfirmGrid}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-matrix-green text-black rounded-xl hover:bg-matrix-green/80 transition-colors">
                <FaCheck size={10} /> Insertar Grid
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductPickerModal;
