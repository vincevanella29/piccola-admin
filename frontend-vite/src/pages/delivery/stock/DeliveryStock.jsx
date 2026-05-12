// src/pages/delivery/stock/DeliveryStock.jsx
// Full stock management panel for Delivery tab — table view with analytics
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaBoxOpen, FaSearch, FaCheck, FaBan, FaSync,
  FaFilter, FaChartBar, FaStoreAlt, FaExclamationTriangle,
  FaHistory, FaCheckDouble,
} from 'react-icons/fa';
import useDeliveryStock from '../../../hooks/useDeliveryStock';

const DeliveryStock = ({ appState, locations = [], t }) => {
  const stock = useDeliveryStock(appState);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all | unavailable
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Set default location
  useEffect(() => {
    if (locations.length > 0 && !selectedLocation) {
      const slug = locations[0].permalink_slug || locations[0].slug;
      if (slug) setSelectedLocation(slug);
    }
  }, [locations, selectedLocation]);

  // Fetch on location change
  useEffect(() => {
    if (selectedLocation) {
      stock.fetchStock(selectedLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]);

  // Filtered products
  const filtered = useMemo(() => {
    let items = stock.products;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (filterMode === 'unavailable') {
      items = items.filter(p => {
        const ov = p.overrides?.[selectedLocation];
        return ov && ov.available === false;
      });
    }
    return items;
  }, [stock.products, search, filterMode, selectedLocation]);

  // Category breakdown
  const categories = useMemo(() => {
    const cats = {};
    for (const p of stock.products) {
      const cat = p.category || 'Sin categoría';
      if (!cats[cat]) cats[cat] = { total: 0, unavailable: 0 };
      cats[cat].total++;
      if (p.overrides?.[selectedLocation]?.available === false) {
        cats[cat].unavailable++;
      }
    }
    return Object.entries(cats).sort((a, b) => b[1].unavailable - a[1].unavailable);
  }, [stock.products, selectedLocation]);

  const handleToggle = useCallback(async (codigo, isAvailable) => {
    try {
      await stock.toggleStock(codigo, selectedLocation, !isAvailable);
    } catch (err) {
      console.error('[DeliveryStock] Toggle failed:', err);
    }
  }, [stock, selectedLocation]);

  const handleMarkAllAvailable = useCallback(async () => {
    const unavailableItems = stock.products
      .filter(p => p.overrides?.[selectedLocation]?.available === false)
      .map(p => ({ codigo: p.codigo, available: true }));

    if (unavailableItems.length === 0) return;
    if (!confirm(`¿Marcar ${unavailableItems.length} productos como disponibles?`)) return;

    try {
      await stock.bulkToggle(unavailableItems, selectedLocation);
    } catch (err) {
      console.error('[DeliveryStock] Bulk toggle failed:', err);
    }
  }, [stock, selectedLocation]);

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Location selector */}
          <div className="relative">
            <FaStoreAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-matrix-green text-xs pointer-events-none" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="pl-8 pr-8 py-2.5 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-xl text-sm font-medium border border-light-border/10 dark:border-dark-border/10 appearance-none cursor-pointer hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors min-w-[160px]"
            >
              {locations.map((loc) => (
                <option key={loc._id || loc.id} value={loc.permalink_slug || loc.slug}>
                  {loc.nombre || loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 relative min-w-[200px]">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" size={12} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t?.('delivery.stock_search') || 'Buscar producto...'}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary border border-light-border/10 dark:border-dark-border/10 focus:outline-none focus:ring-1 focus:ring-matrix-green/30"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <div className="flex items-center bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl p-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-light-surface dark:bg-dark-surface shadow-sm text-light-text-primary dark:text-dark-text-primary'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              Todos ({stock.products.length})
            </button>
            <button
              onClick={() => setFilterMode('unavailable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                filterMode === 'unavailable'
                  ? 'bg-red-500/15 text-red-400 shadow-sm'
                  : 'text-light-text-secondary dark:text-dark-text-secondary'
              }`}
            >
              <FaBan size={10} /> Sin stock ({stock.unavailableCount})
            </button>
          </div>

          {/* Mark all available */}
          {stock.unavailableCount > 0 && (
            <button
              onClick={handleMarkAllAvailable}
              className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all flex items-center gap-1.5 ring-1 ring-emerald-500/20"
            >
              <FaCheckDouble size={10} />
              Reponer todo
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => stock.fetchStock(selectedLocation)}
            className="p-2.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all"
          >
            <FaSync size={12} className={stock.isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-light-surface/60 dark:bg-dark-surface/60 rounded-xl p-3 ring-1 ring-light-border/5 dark:ring-dark-border/5">
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-1">Total productos</p>
          <p className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tabular-nums">{stock.products.length}</p>
        </div>
        <div className="bg-emerald-500/5 rounded-xl p-3 ring-1 ring-emerald-500/10">
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">Disponibles</p>
          <p className="text-2xl font-black text-emerald-400 tabular-nums">{stock.products.length - stock.unavailableCount}</p>
        </div>
        <div className={`rounded-xl p-3 ring-1 ${stock.unavailableCount > 0 ? 'bg-red-500/5 ring-red-500/10' : 'bg-light-surface/60 dark:bg-dark-surface/60 ring-light-border/5 dark:ring-dark-border/5'}`}>
          <p className={`text-[10px] uppercase tracking-wider mb-1 ${stock.unavailableCount > 0 ? 'text-red-400' : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`}>Sin stock</p>
          <p className={`text-2xl font-black tabular-nums ${stock.unavailableCount > 0 ? 'text-red-400' : 'text-light-text-primary dark:text-dark-text-primary'}`}>{stock.unavailableCount}</p>
        </div>
        <div className="bg-light-surface/60 dark:bg-dark-surface/60 rounded-xl p-3 ring-1 ring-light-border/5 dark:ring-dark-border/5">
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-1">Categorías</p>
          <p className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tabular-nums">{categories.length}</p>
        </div>
      </div>

      {/* Category breakdown — only if there are unavailable items */}
      {stock.unavailableCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.filter(([,c]) => c.unavailable > 0).map(([name, counts]) => (
            <div key={name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/8 ring-1 ring-red-500/15 text-xs">
              <FaExclamationTriangle size={10} className="text-red-400" />
              <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{name}</span>
              <span className="text-red-400 font-black">{counts.unavailable}</span>
              <span className="text-light-text-tertiary dark:text-dark-text-tertiary">/ {counts.total}</span>
            </div>
          ))}
        </div>
      )}

      {/* Product Table */}
      <div className="bg-light-surface/40 dark:bg-dark-surface/40 rounded-2xl ring-1 ring-light-border/5 dark:ring-dark-border/5 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] sm:grid-cols-[48px_1fr_120px_120px_100px_80px] gap-3 px-4 py-3 border-b border-light-border/10 dark:border-dark-border/10">
          <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary hidden sm:block"></span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary">Producto</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary hidden sm:block">Código</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary hidden sm:block">Categoría</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary text-center">Estado</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary text-center">Acción</span>
        </div>

        {/* Loading */}
        {stock.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!stock.isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FaBoxOpen size={32} className="text-light-text-tertiary/30 dark:text-dark-text-tertiary/30" />
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {search ? 'No se encontraron productos' : 'Selecciona una sucursal'}
            </p>
          </div>
        )}

        {/* Rows */}
        <div className="max-h-[500px] overflow-y-auto">
          {filtered.map((product) => {
            const override = product.overrides?.[selectedLocation] || {};
            const isAvailable = override.available !== false;

            return (
              <motion.div
                key={product.codigo}
                layout
                className={`grid grid-cols-[auto_1fr_auto_auto_auto] sm:grid-cols-[48px_1fr_120px_120px_100px_80px] gap-3 px-4 py-2.5 items-center border-b border-light-border/5 dark:border-dark-border/5 transition-colors ${
                  isAvailable
                    ? 'hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30'
                    : 'bg-red-500/5'
                }`}
              >
                {/* Image */}
                <div className="hidden sm:flex">
                  {product.image ? (
                    <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 flex items-center justify-center text-sm">
                      🍽️
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${
                    isAvailable
                      ? 'text-light-text-primary dark:text-dark-text-primary'
                      : 'text-red-400 line-through'
                  }`}>
                    {product.nombre}
                  </p>
                  <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary sm:hidden font-mono">
                    {product.codigo}
                  </p>
                </div>

                {/* Code */}
                <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary hidden sm:block">
                  {product.codigo}
                </span>

                {/* Category */}
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary hidden sm:block truncate">
                  {product.category}
                </span>

                {/* Status */}
                <div className="flex justify-center">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                    isAvailable
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {isAvailable ? '✓ Stock' : '✕ Agotado'}
                  </span>
                </div>

                {/* Action */}
                <div className="flex justify-center">
                  <button
                    onClick={() => handleToggle(product.codigo, isAvailable)}
                    className={`p-2 rounded-lg transition-all ${
                      isAvailable
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                    title={isAvailable ? 'Marcar sin stock' : 'Marcar disponible'}
                  >
                    {isAvailable ? <FaBan size={12} /> : <FaCheck size={12} />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeliveryStock;
