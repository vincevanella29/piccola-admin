// src/pages/delivery/kds/KitchenDisplay.jsx
// Kitchen Display System — full-screen order grid for kitchen staff
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaUtensils, FaSync, FaExpand, FaCompress,
  FaBoxOpen, FaVolumeUp, FaVolumeMute, FaWifi,
} from 'react-icons/fa';
import useKDS from '../../../hooks/useKDS';
import useDeliveryStock from '../../../hooks/useDeliveryStock';
import KDSOrderCard from './KDSOrderCard';
import StockDrawer from './StockDrawer';

// Live clock hook
const useLiveClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// KDS statuses: everything derived from MongoDB pipeline — zero hardcoding

// Bottom status bar with live clock
const BottomBar = ({ bottomStatuses, counts, wsConnected }) => {
  const clock = useLiveClock();
  return (
    <div className="shrink-0 bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-xl border-t border-light-border/10 dark:border-dark-border/10 px-4 py-2 z-10">
      <div className="max-w-[1800px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-5">
          {bottomStatuses.map(s => {
            const count = counts[s.key] || 0;
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="text-lg font-black tabular-nums" style={{ color: s.color }}>{count}</span>
                <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary hidden sm:inline">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-light-text-secondary dark:text-dark-text-secondary tabular-nums">
            {clock}
          </span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono">
              {wsConnected ? 'WS' : 'POLL'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const KitchenDisplay = ({ appState }) => {
  const { t } = useTranslation();
  const kds = useKDS(appState);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stockDrawerOpen, setStockDrawerOpen] = useState(false);
  const containerRef = useRef(null);

  // Stock hook for badge count
  const stockHook = useDeliveryStock(appState);

  // ── Fullscreen ────────────────────────────────
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  // Sync state with actual fullscreen changes (Esc key, etc)
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Derive KDS-visible statuses from MongoDB pipeline (only kds_controllable ones)
  const kdsStatuses = useMemo(
    () => kds.statuses.filter(s => s.kds_controllable !== false),
    [kds.statuses]
  );

  const kdsPickupStatuses = useMemo(
    () => (kds.pickupStatuses || []).filter(s => s.kds_controllable !== false),
    [kds.pickupStatuses]
  );

  const statusFilters = useMemo(() => [
    { key: 'all', emoji: '📋', label: t('delivery.kds_filter_all') },
    ...kdsStatuses.map(s => ({ key: s.key, emoji: s.icon, label: s.label })),
  ], [kdsStatuses, t]);

  const bottomStatuses = useMemo(
    () => kdsStatuses.map(s => ({
      key: s.key,
      label: s.label,
      color: s.color || '#888',
    })),
    [kdsStatuses]
  );

  // Build set of allowed KDS status keys (from both pipelines)
  const kdsAllowedKeys = useMemo(() => {
    const keys = new Set();
    kdsStatuses.forEach(s => keys.add(s.key));
    kdsPickupStatuses.forEach(s => keys.add(s.key));
    return keys;
  }, [kdsStatuses, kdsPickupStatuses]);

  // Filter orders — only show orders with KDS-visible statuses
  const kdsOrders = useMemo(
    () => kds.orders.filter(o => kdsAllowedKeys.has(o.status)),
    [kds.orders, kdsAllowedKeys]
  );

  const filteredOrders = statusFilter === 'all'
    ? kdsOrders
    : kdsOrders.filter(o => o.status === statusFilter);

  // Counts per status (only KDS-visible)
  const counts = kdsOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    acc.all = (acc.all || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-light-background dark:bg-dark-background text-light-text-primary dark:text-dark-text-primary ${
        isFullscreen ? 'h-screen' : ''
      }`}
      style={isFullscreen ? undefined : { height: 'calc(100vh - 64px - 64px)' }}
    >
      {/* ── Top Bar ── */}
      <div className="shrink-0 bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-xl border-b border-light-border/10 dark:border-dark-border/10 px-4 py-3 z-10">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-vanellix-purple flex items-center justify-center shadow-lg">
              <FaUtensils size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight font-futurist text-light-text-primary dark:text-dark-text-primary">
                {t('delivery.kds_title')}
              </h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${kds.wsConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-amber-500 animate-pulse'}`} />
                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono">
                  {kds.wsConnected ? 'LIVE' : 'POLLING'}
                </p>
              </div>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="hidden md:flex items-center gap-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl p-1">
            {statusFilters.map(f => {
              const count = counts[f.key] || 0;
              const isActive = statusFilter === f.key;
              return (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  }`}>
                  <span>{f.emoji}</span>
                  <span className="hidden lg:inline">{f.label}</span>
                  {count > 0 && (
                    <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-black ${
                      isActive ? 'bg-matrix-green/20 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Active count badge */}
            <div className="px-3 py-1.5 rounded-xl bg-matrix-green/10 ring-1 ring-matrix-green/30">
              <span className="text-sm font-black text-matrix-green">{kdsOrders.length}</span>
              <span className="text-[10px] text-matrix-green/60 ml-1.5 hidden sm:inline">{t('delivery.kds_active')}</span>
            </div>

            <button onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl transition-all ${
                soundEnabled
                  ? 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  : 'bg-vanellix-purple/15 text-vanellix-purple'
              }`}>
              {soundEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
            </button>

            <button onClick={kds.fetchOrders}
              className="p-2.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all">
              <FaSync size={14} className={kds.isLoading ? 'animate-spin' : ''} />
            </button>

            {/* Stock control */}
            <button onClick={() => setStockDrawerOpen(true)}
              className="p-2.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all relative">
              <FaBoxOpen size={14} />
              {stockHook.unavailableCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[8px] font-black bg-red-500 text-white px-1 shadow-sm">
                  {stockHook.unavailableCount}
                </span>
              )}
            </button>

            <button onClick={handleFullscreen}
              className="p-2.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all hidden sm:flex">
              {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
            </button>
          </div>
        </div>

        {/* Mobile status filter */}
        <div className="flex md:hidden items-center gap-1 mt-2 overflow-x-auto scrollbar-none pb-1">
          {statusFilters.map(f => {
            const count = counts[f.key] || 0;
            const isActive = statusFilter === f.key;
            return (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary'
                }`}>
                <span>{f.emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content — scrollable area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="max-w-[1800px] mx-auto">
          {/* Loading */}
          {kds.isLoading && kdsOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-12 h-12 border-3 border-matrix-green border-t-transparent rounded-full animate-spin" />
              <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">
                {t('delivery.kds_loading_orders')}
              </p>
            </div>
          )}

          {/* Empty state */}
          {!kds.isLoading && filteredOrders.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-4"
            >
              <div className="w-20 h-20 rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 flex items-center justify-center">
                <FaBoxOpen size={32} className="text-light-text-secondary/30 dark:text-dark-text-secondary/30" />
              </div>
              <p className="text-light-text-primary dark:text-dark-text-primary text-lg font-bold">
                {t('delivery.kds_no_orders')}
              </p>
              <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm max-w-md text-center">
                {t('delivery.kds_no_orders_hint')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-matrix-green animate-pulse" />
                <span className="text-[11px] text-matrix-green/60 font-mono">{t('delivery.kds_listening')}</span>
              </div>
            </motion.div>
          )}

          {/* Order Grid — auto-adapts columns to order count */}
          {filteredOrders.length > 0 && (
            <motion.div
              layout
              className={`grid gap-4 ${
                filteredOrders.length === 1
                  ? 'grid-cols-1 max-w-lg mx-auto'
                  : filteredOrders.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto'
                    : filteredOrders.length <= 4
                      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 max-w-5xl mx-auto'
                      : filteredOrders.length <= 6
                        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                        : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
              }`}
            >
              <AnimatePresence mode="popLayout">
                {filteredOrders.map(order => (
                  <KDSOrderCard
                    key={order._id}
                    order={order}
                    statuses={order.order_type === 'pickup' ? kdsPickupStatuses : kdsStatuses}
                    onToggleItem={kds.toggleItemDone}
                    onStatusChange={kds.updateStatus}
                    t={t}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Bottom status bar ── */}
      <BottomBar bottomStatuses={bottomStatuses} counts={counts} wsConnected={kds.wsConnected} />

      {/* ── Stock Drawer ── */}
      <StockDrawer
        isOpen={stockDrawerOpen}
        onClose={() => setStockDrawerOpen(false)}
        appState={appState}
        t={t}
      />
    </div>
  );
};

export default KitchenDisplay;

export const pageMetadata = {
  path: '/app/delivery/kds',
  label: 'delivery.kds_label',
  category: 'delivery.category',
  minRoleLevel: 3,
  maxRoleLevel: 7,
  order: 2,
  locations: ['sidebar'],
  description: 'delivery.kds_description',
  icon: 'FaUtensils',
  isSearchable: true,
};
