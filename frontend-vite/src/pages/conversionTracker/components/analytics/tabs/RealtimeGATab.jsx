import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, RefreshCw, BarChart3, ChevronDown, CheckCircle2, Monitor, MapPin, ArrowUpRight, Globe, Users } from 'lucide-react';

const DEVICE_ICONS = { desktop: <Monitor size={14} />, mobile: <Monitor size={14} />, tablet: <Monitor size={14} /> };
const DEVICE_COLORS = { desktop: 'from-blue-500 to-blue-600', mobile: 'from-matrix-green to-emerald-500', tablet: 'from-purple-500 to-violet-600' };

const RealtimeGATab = ({ analyticsProviders, cacheManager }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Use Cache
  const cacheKey = 'realtimeGA4';
  const cachedState = cacheManager.cache[cacheKey] || {};
  const { data, loading, error, providerId: cachedProviderId } = cachedState;

  // Initialize selectedId from cache or first provider
  useEffect(() => {
    if (!selectedId) {
      if (cachedProviderId) setSelectedId(cachedProviderId);
      else if (analyticsProviders.length > 0) setSelectedId(analyticsProviders[0].id);
    }
  }, [analyticsProviders, selectedId, cachedProviderId]);

  const selected = useMemo(() => analyticsProviders.find(p => p.id === selectedId) || null, [analyticsProviders, selectedId]);

  // Initial fetch on mount or provider change
  useEffect(() => {
    if (selectedId) cacheManager.fetchRealtime(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Polling
  useEffect(() => {
    if (!isPolling || !selectedId) return;
    const iv = setInterval(() => {
      // Force fetch by overriding cache validity mentally (we just call the API directly inside here or bypass check)
      cacheManager.updateCache(cacheKey, { lastFetched: 0 }); // Invalidate manually to force fetch
      cacheManager.fetchRealtime(selectedId);
    }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, selectedId]);

  if (analyticsProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-light-surface/50 dark:bg-dark-surface/50 rounded-3xl border border-light-border/20 dark:border-dark-border/20">
        <Radio size={40} className="text-gray-400 mb-4 opacity-30" />
        <h3 className="text-lg font-bold text-light-text-primary dark:text-white mb-2">No GA4 Providers</h3>
        <p className="text-sm text-gray-500 max-w-md">Add a Google Analytics provider with a service_account.json to enable real-time analytics.</p>
      </div>
    );
  }

  const d = data || {};
  const activeUsers = d.total_active_users || 0;
  const pages = d.pages || [];
  const countries = d.countries || [];
  const devices = d.devices || [];
  const sources = d.sources || [];
  const totalDev = devices.reduce((s, x) => s + x.active_users, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="relative z-50 flex flex-wrap items-center gap-3 bg-light-surface/60 dark:bg-dark-surface/60 p-3 rounded-2xl border border-light-border/30 dark:border-dark-border/30 backdrop-blur-md">
        {/* Provider selector */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-light-surface dark:bg-black/40 border border-light-border/40 dark:border-dark-border/40 text-sm font-semibold hover:border-matrix-green/50 transition-colors text-light-text-primary dark:text-dark-text-primary shadow-sm">
            <BarChart3 size={16} className="text-yellow-500" />
            <span>{selected ? selected.name : 'Select provider'}</span>
            <ChevronDown size={14} className={`transition-transform ml-2 opacity-60 ${showMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 mt-2 w-72 bg-light-surface dark:bg-dark-surface border border-light-border/40 dark:border-dark-border/40 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {analyticsProviders.map(ap => (
                  <button key={ap.id} onClick={() => { setSelectedId(ap.id); setShowMenu(false); cacheManager.updateCache(cacheKey, { data: null }); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${ap.id === selectedId ? 'bg-matrix-green/10 text-matrix-green font-bold border-l-2 border-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 border-l-2 border-transparent'}`}>
                    <BarChart3 size={16} className={ap.id === selectedId ? 'text-matrix-green' : 'text-gray-400'} />
                    <div className="flex flex-col flex-1"><span className="font-semibold">{ap.name}</span><span className="text-[10px] opacity-60 font-mono">PID: {ap.property_id}</span></div>
                    {ap.id === selectedId && <CheckCircle2 size={14} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-6 w-[1px] bg-light-border/40 dark:bg-dark-border/40 hidden sm:block" />

        <button onClick={() => setIsPolling(!isPolling)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border ${isPolling ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/30' : 'bg-light-surface-secondary dark:bg-black/20 text-light-text-secondary dark:text-gray-400 border-transparent hover:border-light-border/40 dark:hover:border-dark-border/40'}`}>
          <span className="relative flex h-2 w-2">{isPolling && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matrix-green opacity-75" />}<span className={`relative inline-flex rounded-full h-2 w-2 ${isPolling ? 'bg-matrix-green' : 'bg-gray-400'}`} /></span>
          {isPolling ? 'Live (30s)' : 'Auto-refresh'}
        </button>
        <button onClick={() => { cacheManager.updateCache(cacheKey, { lastFetched: 0 }); cacheManager.fetchRealtime(selectedId); }} disabled={loading} className="p-2 rounded-xl bg-light-surface-secondary dark:bg-black/20 text-light-text-secondary dark:text-gray-400 border border-transparent hover:border-light-border/40 dark:hover:border-dark-border/40 disabled:opacity-50 transition-colors shadow-sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold">
          Error: {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-matrix-green opacity-50" />
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Active Users */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0d0f] to-[#1a1a2e] border border-white/10 p-6 shadow-2xl flex flex-col items-center justify-center text-center group md:col-span-1">
            {activeUsers > 0 && <motion.div animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute inset-0 bg-matrix-green/10" />}
            <Radio size={16} className="text-matrix-green mb-2 relative z-10" />
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 relative z-10">Active Now</p>
            <span className="text-6xl font-black text-white tabular-nums relative z-10 tracking-tight">{activeUsers}</span>
            <p className="text-[11px] font-bold text-matrix-green/80 mt-2 relative z-10 bg-matrix-green/10 px-2 py-0.5 rounded-full border border-matrix-green/20">Last 30 min</p>
          </div>

          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Devices */}
            <div className="rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-5 flex flex-col shadow-sm backdrop-blur-md">
              <h4 className="text-[10px] font-black text-light-text-secondary dark:text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Monitor size={12} /> Devices</h4>
              {devices.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
                <div className="space-y-4 flex-1">{devices.map(d => {
                  const pct = Math.round((d.active_users / totalDev) * 100);
                  const cat = d.category.toLowerCase();
                  return (<div key={d.category} className="space-y-1.5">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-light-text-primary dark:text-white font-bold">{DEVICE_ICONS[cat] || <Monitor size={14} />}<span className="capitalize">{d.category}</span></div><span className="text-xs font-black tabular-nums text-light-text-primary dark:text-white">{d.active_users}</span></div>
                    <div className="h-2 rounded-full bg-light-border/30 dark:bg-gray-800 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full bg-gradient-to-r ${DEVICE_COLORS[cat] || 'from-gray-400 to-gray-500'}`} /></div>
                  </div>);
                })}</div>
              )}
            </div>

            {/* Countries */}
            <div className="rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-5 flex flex-col shadow-sm backdrop-blur-md">
              <h4 className="text-[10px] font-black text-light-text-secondary dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><MapPin size={12} /> Countries</h4>
              {countries.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[160px] scrollbar-none pr-1">{countries.slice(0, 10).map((c, i) => (
                  <div key={c.country} className="flex items-center justify-between py-1 border-b border-light-border/10 dark:border-white/5 last:border-0"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-gray-400 w-4">{i + 1}</span><span className="text-xs text-light-text-primary dark:text-white font-bold">{c.country}</span></div><span className="text-xs font-black tabular-nums text-matrix-green">{c.active_users}</span></div>
                ))}</div>
              )}
            </div>

            {/* Sources */}
            <div className="rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-5 flex flex-col shadow-sm backdrop-blur-md">
              <h4 className="text-[10px] font-black text-light-text-secondary dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><ArrowUpRight size={12} /> Sources</h4>
              {sources.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[160px] scrollbar-none pr-1">{sources.slice(0, 8).map((s, i) => (
                  <div key={`${s.source}-${i}`} className="flex items-center justify-between py-1 border-b border-light-border/10 dark:border-white/5 last:border-0"><div className="flex flex-col min-w-0"><span className="text-xs text-light-text-primary dark:text-white font-bold truncate">{s.source}</span><span className="text-[9px] text-gray-500 font-medium">{s.medium}</span></div><span className="text-xs font-black tabular-nums text-vanellix-cyan ml-2 shrink-0 bg-vanellix-cyan/10 px-1.5 py-0.5 rounded">{s.active_users}</span></div>
                ))}</div>
              )}
            </div>
          </div>

          {/* Pages Table */}
          <div className="md:col-span-4 rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-6 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-light-text-primary dark:text-white flex items-center gap-2 uppercase tracking-wide"><Globe size={16} className="text-vanellix-cyan" /> Active Pages</h3>
              <span className="text-[10px] font-bold text-vanellix-cyan bg-vanellix-cyan/10 border border-vanellix-cyan/20 px-2 py-1 rounded-lg uppercase">{pages.length} Pages</span>
            </div>
            <div className="overflow-y-auto max-h-[320px] scrollbar-none">
              {pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500"><Globe size={28} className="mb-2 opacity-20" /><p className="text-sm font-medium">No active traffic</p></div>
              ) : (
                <div className="space-y-2">{pages.map((p, i) => {
                  const bar = Math.round((p.active_users / (pages[0]?.active_users || 1)) * 100);
                  return (<div key={`${p.page}-${i}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-light-surface dark:hover:bg-white/5 relative overflow-hidden border border-transparent hover:border-light-border/30 dark:hover:border-white/5 transition-colors">
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-vanellix-cyan/5 to-matrix-green/5 dark:from-vanellix-cyan/10 dark:to-matrix-green/10" style={{ width: `${bar}%` }} />
                    <span className="w-6 text-center text-xs font-black text-gray-400 tabular-nums relative z-10">{i + 1}</span>
                    <span className="text-sm font-bold text-light-text-primary dark:text-white truncate flex-1 relative z-10">{p.page}</span>
                    <div className="flex items-center gap-1.5 shrink-0 relative z-10 bg-matrix-green/10 px-2 py-1 rounded-lg border border-matrix-green/20"><Users size={12} className="text-matrix-green" /><span className="font-black text-matrix-green tabular-nums text-sm">{p.active_users}</span></div>
                  </div>);
                })}</div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default RealtimeGATab;
