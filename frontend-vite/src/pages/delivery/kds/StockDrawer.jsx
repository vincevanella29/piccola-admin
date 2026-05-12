// src/pages/delivery/kds/StockDrawer.jsx
// Quick stock control panel — slides from right in KDS
// Fetches its own locations and lets the user pick which sucursal to manage
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTimes, FaSearch, FaBoxOpen, FaCheck,
  FaBan, FaFilter, FaStoreAlt,
} from 'react-icons/fa';
import useDeliveryStock from '../../../hooks/useDeliveryStock';
import api from '../../../utils/api';

const StockDrawer = ({ isOpen, onClose, appState, t }) => {
  const stock = useDeliveryStock(appState);
  const [search, setSearch] = useState('');
  const [onlyUnavailable, setOnlyUnavailable] = useState(false);
  const [togglingCodigo, setTogglingCodigo] = useState(null);

  // ── Location management ────────────────────────
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');

  const headers = useMemo(() => ({
    Authorization: `Bearer ${appState?.token}`,
    ...(appState?.account ? { 'X-Wallet-Address': appState.account } : {}),
  }), [appState?.token, appState?.account]);

  // Fetch locations on first open
  useEffect(() => {
    if (!isOpen || locations.length > 0) return;
    (async () => {
      try {
        const res = await api({
          method: 'GET',
          endpoint: '/delivery/locations',
          headers,
          withCredentials: true,
        });
        const locs = res?.locations || [];
        setLocations(locs);
        if (locs.length > 0 && !selectedLocation) {
          const slug = locs[0].permalink_slug || locs[0].slug || '';
          setSelectedLocation(slug);
        }
      } catch (err) {
        console.error('[StockDrawer] Failed to fetch locations:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch stock when location changes
  useEffect(() => {
    if (isOpen && selectedLocation) {
      stock.fetchStock(selectedLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedLocation]);

  // Filter products
  const filtered = useMemo(() => {
    let items = stock.products;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q)
      );
    }
    if (onlyUnavailable) {
      items = items.filter(p => {
        const override = p.overrides?.[selectedLocation];
        return override && override.available === false;
      });
    }
    return items;
  }, [stock.products, search, onlyUnavailable, selectedLocation]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const p of filtered) {
      const cat = p.category || 'Sin categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleToggle = useCallback(async (codigo, currentAvailable) => {
    if (!selectedLocation) return;
    setTogglingCodigo(codigo);
    try {
      await stock.toggleStock(codigo, selectedLocation, !currentAvailable);
    } catch (err) {
      console.error('[StockDrawer] Toggle failed:', err);
    } finally {
      setTogglingCodigo(null);
    }
  }, [stock, selectedLocation]);

  // Current location name
  const currentLocName = useMemo(() => {
    const loc = locations.find(l => (l.permalink_slug || l.slug) === selectedLocation);
    return loc?.nombre || loc?.name || selectedLocation;
  }, [locations, selectedLocation]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-light-background dark:bg-dark-background z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-light-border/10 dark:border-dark-border/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                    <FaBoxOpen size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-light-text-primary dark:text-dark-text-primary">
                      {t?.('delivery.stock_title') || 'Control de Stock'}
                    </h2>
                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                      {stock.unavailableCount > 0 ? (
                        <span className="text-red-400 font-bold">{stock.unavailableCount} agotados</span>
                      ) : (
                        <span className="text-emerald-400">Todo disponible</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
                >
                  <FaTimes size={16} />
                </button>
              </div>

              {/* Location selector */}
              {locations.length > 1 && (
                <div className="relative mb-3">
                  <FaStoreAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-matrix-green text-xs pointer-events-none" />
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-primary dark:text-dark-text-primary rounded-xl text-sm font-bold border border-light-border/10 dark:border-dark-border/10 appearance-none cursor-pointer hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors"
                  >
                    {locations.map((loc) => (
                      <option key={loc._id || loc.id} value={loc.permalink_slug || loc.slug}>
                        {loc.nombre || loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {locations.length === 1 && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <FaStoreAlt className="text-matrix-green" size={11} />
                  <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{currentLocName}</span>
                </div>
              )}

              {/* Search + filter */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" size={12} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t?.('delivery.stock_search') || 'Buscar producto...'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary border border-light-border/10 dark:border-dark-border/10 focus:outline-none focus:ring-1 focus:ring-matrix-green/30"
                  />
                </div>
                <button
                  onClick={() => setOnlyUnavailable(!onlyUnavailable)}
                  className={`p-2.5 rounded-xl transition-all ${
                    onlyUnavailable
                      ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                      : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                  title={onlyUnavailable ? 'Mostrar todos' : 'Solo agotados'}
                >
                  <FaFilter size={12} />
                </button>
              </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-none">
              {stock.isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!stock.isLoading && !selectedLocation && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FaStoreAlt size={32} className="text-light-text-tertiary/30 dark:text-dark-text-tertiary/30" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Selecciona una sucursal
                  </p>
                </div>
              )}

              {!stock.isLoading && selectedLocation && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FaBoxOpen size={32} className="text-light-text-tertiary/30 dark:text-dark-text-tertiary/30" />
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {search ? 'No se encontraron productos' : 'No hay productos'}
                  </p>
                </div>
              )}

              {grouped.map(([category, items]) => (
                <div key={category}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary mb-2 px-1">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {items.map(product => {
                      const override = product.overrides?.[selectedLocation] || {};
                      const isAvailable = override.available !== false;
                      const isToggling = togglingCodigo === product.codigo;

                      return (
                        <motion.button
                          key={product.codigo}
                          onClick={() => handleToggle(product.codigo, isAvailable)}
                          disabled={isToggling}
                          layout
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                            isAvailable
                              ? 'bg-light-surface/60 dark:bg-dark-surface/60 hover:bg-light-surface dark:hover:bg-dark-surface'
                              : 'bg-red-500/8 ring-1 ring-red-500/15'
                          }`}
                        >
                          {/* Image */}
                          {product.image ? (
                            <img src={product.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 shrink-0 flex items-center justify-center text-[10px]">
                              🍽️
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-bold truncate ${
                              isAvailable
                                ? 'text-light-text-primary dark:text-dark-text-primary'
                                : 'text-red-400 line-through'
                            }`}>
                              {product.nombre}
                            </p>
                            <p className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono">
                              {product.codigo}
                            </p>
                          </div>

                          {/* Toggle indicator */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isToggling
                              ? 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50'
                              : isAvailable
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                          }`}>
                            {isToggling ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : isAvailable ? (
                              <FaCheck size={12} />
                            ) : (
                              <FaBan size={12} />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-3 border-t border-light-border/10 dark:border-dark-border/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
                  {filtered.length} productos · {stock.unavailableCount} sin stock
                </span>
                <button
                  onClick={() => stock.fetchStock(selectedLocation)}
                  className="text-[10px] font-bold text-matrix-green hover:text-matrix-green/80 transition-colors"
                >
                  {t?.('delivery.refresh') || 'Actualizar'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StockDrawer;
