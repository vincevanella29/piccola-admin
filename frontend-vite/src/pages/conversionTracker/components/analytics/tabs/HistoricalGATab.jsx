import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, BarChart3, ChevronDown, CheckCircle2, RefreshCw, Calendar, Users, Globe } from 'lucide-react';

const HistoricalGATab = ({ analyticsProviders, cacheManager }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [daysBack, setDaysBack] = useState(7);
  
  // Use Cache
  const cacheKey = 'historicalGA4';
  const cachedState = cacheManager.cache[cacheKey] || {};
  const { data, loading, error, providerId: cachedProviderId, days: cachedDays } = cachedState;

  useEffect(() => {
    if (!selectedId) {
      if (cachedProviderId) {
        setSelectedId(cachedProviderId);
        if (cachedDays) setDaysBack(cachedDays);
      }
      else if (analyticsProviders.length > 0) setSelectedId(analyticsProviders[0].id);
    }
  }, [analyticsProviders, selectedId, cachedProviderId, cachedDays]);

  const selected = useMemo(() => analyticsProviders.find(p => p.id === selectedId) || null, [analyticsProviders, selectedId]);

  useEffect(() => {
    if (selectedId) cacheManager.fetchHistorical(selectedId, daysBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, daysBack]);

  if (analyticsProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-light-surface/50 dark:bg-dark-surface/50 rounded-3xl border border-light-border/20 dark:border-dark-border/20">
        <LineChart size={40} className="text-gray-400 mb-4 opacity-30" />
        <h3 className="text-lg font-bold text-light-text-primary dark:text-white mb-2">No GA4 Providers</h3>
        <p className="text-sm text-gray-500 max-w-md">Add a Google Analytics provider with a service_account.json to enable historical analytics.</p>
      </div>
    );
  }

  const d = data || {};
  const usersByDate = d.users_by_date || [];
  const usersBySource = d.users_by_source || [];
  
  const totalHistoricalUsers = usersByDate.reduce((sum, item) => sum + item.active_users, 0);
  const maxDateUsers = Math.max(...usersByDate.map(x => x.active_users), 1);
  const maxSourceUsers = Math.max(...usersBySource.map(x => x.active_users), 1);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="relative z-50 flex flex-wrap items-center gap-3 bg-light-surface/60 dark:bg-dark-surface/60 p-3 rounded-2xl border border-light-border/30 dark:border-dark-border/30 backdrop-blur-md">
        
        {/* Provider selector */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-light-surface dark:bg-black/40 border border-light-border/40 dark:border-dark-border/40 text-sm font-semibold hover:border-matrix-green/50 transition-colors text-light-text-primary dark:text-dark-text-primary shadow-sm">
            <LineChart size={16} className="text-vanellix-cyan" />
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

        {/* Days Selector */}
        <div className="flex items-center gap-1 bg-light-surface dark:bg-black/40 p-1 rounded-xl border border-light-border/40 dark:border-dark-border/40 shadow-sm">
          {[7, 14, 30].map(days => (
            <button 
              key={days} 
              onClick={() => { setDaysBack(days); cacheManager.updateCache(cacheKey, { data: null }); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${daysBack === days ? 'bg-vanellix-cyan/20 text-vanellix-cyan shadow-sm' : 'text-light-text-secondary dark:text-gray-400 hover:text-light-text-primary dark:hover:text-white'}`}
            >
              {days}D
            </button>
          ))}
        </div>

        <button onClick={() => { cacheManager.updateCache(cacheKey, { lastFetched: 0 }); cacheManager.fetchHistorical(selectedId, daysBack); }} disabled={loading} className="p-2 rounded-xl bg-light-surface-secondary dark:bg-black/20 text-light-text-secondary dark:text-gray-400 border border-transparent hover:border-light-border/40 dark:hover:border-dark-border/40 disabled:opacity-50 transition-colors shadow-sm ml-auto">
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
          <RefreshCw size={32} className="animate-spin text-vanellix-cyan opacity-50" />
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          {/* Summary Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0d0f] to-[#1a1a2e] border border-white/10 p-6 shadow-2xl flex flex-col items-center justify-center text-center md:col-span-1">
            <Calendar size={16} className="text-vanellix-cyan mb-2 relative z-10" />
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 relative z-10">Total Users</p>
            <span className="text-5xl font-black text-white tabular-nums relative z-10 tracking-tight">{totalHistoricalUsers}</span>
            <p className="text-[11px] font-bold text-vanellix-cyan/80 mt-2 relative z-10 bg-vanellix-cyan/10 px-2 py-0.5 rounded-full border border-vanellix-cyan/20">Last {daysBack} Days</p>
          </div>

          {/* Activity Over Time (Bar Chart) */}
          <div className="md:col-span-3 rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-6 flex flex-col shadow-sm backdrop-blur-md">
            <h4 className="text-[10px] font-black text-light-text-secondary dark:text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2"><LineChart size={12} /> Users Over Time</h4>
            {usersByDate.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
              <div className="relative h-48 mt-auto flex flex-col">
                
                {/* Y-axis grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 pb-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center w-full">
                      <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500 w-8 text-right pr-2">
                        {Math.round(maxDateUsers * (4 - i) / 4)}
                      </span>
                      <div className="flex-1 border-t border-dashed border-light-border/20 dark:border-white/10" />
                    </div>
                  ))}
                </div>

                {/* Bars */}
                <div className="flex items-end justify-between gap-1 sm:gap-2 flex-1 pl-8 pb-6 relative z-10">
                  {usersByDate.map((item, idx) => {
                    const heightPct = Math.max(Math.round((item.active_users / maxDateUsers) * 100), 2); // At least 2% height so it's visible
                    const str = item.dimension;
                    const label = str.length === 8 ? `${str.substring(6,8)}/${str.substring(4,6)}` : str;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 bg-black text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-lg border border-white/10">
                          {item.active_users} Users
                        </div>
                        {/* Bar Track */}
                        <div className="w-full max-w-[28px] h-full flex items-end justify-center">
                          <motion.div 
                            initial={{ height: 0 }} 
                            animate={{ height: `${heightPct}%` }} 
                            transition={{ duration: 0.6, delay: idx * 0.05, type: 'spring', bounce: 0.4 }}
                            className="w-full bg-gradient-to-t from-vanellix-cyan to-[#00f2fe] rounded-t-md opacity-80 group-hover:opacity-100 group-hover:shadow-[0_0_12px_rgba(0,242,254,0.4)] transition-all"
                          />
                        </div>
                        {/* X-axis Label */}
                        <span className="absolute -bottom-6 text-[9px] font-mono font-medium text-light-text-secondary dark:text-gray-400 whitespace-nowrap">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Traffic Sources */}
          <div className="md:col-span-4 rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-6 shadow-sm backdrop-blur-md">
            <h4 className="text-[10px] font-black text-light-text-secondary dark:text-gray-500 uppercase tracking-wider mb-5 flex items-center gap-2"><Globe size={12} /> Acquisition Sources</h4>
            {usersBySource.length === 0 ? <div className="py-10 flex justify-center"><p className="text-gray-500 text-sm">No source data</p></div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {usersBySource.map((s, idx) => {
                  const pct = Math.round((s.active_users / maxSourceUsers) * 100);
                  return (
                    <div key={idx} className="bg-light-surface dark:bg-white/5 p-4 rounded-2xl border border-light-border/30 dark:border-white/5 hover:border-vanellix-cyan/40 transition-colors group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-light-text-primary dark:text-white truncate" title={s.dimension}>{s.dimension}</span>
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Source / Medium</span>
                        </div>
                        <div className="bg-vanellix-cyan/10 px-2 py-1 rounded-lg border border-vanellix-cyan/20 flex items-center gap-1.5 shrink-0">
                          <Users size={10} className="text-vanellix-cyan" />
                          <span className="font-black text-vanellix-cyan text-sm">{s.active_users}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-light-border/30 dark:bg-gray-800 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${pct}%` }} 
                          transition={{ duration: 0.8, delay: idx * 0.1 }} 
                          className="h-full rounded-full bg-vanellix-cyan" 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </motion.div>
      )}
    </div>
  );
};

export default HistoricalGATab;
