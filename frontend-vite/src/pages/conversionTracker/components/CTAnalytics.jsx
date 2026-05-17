import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Globe, Monitor, Users, AlertCircle, RefreshCw, Zap,
  CheckCircle2, XCircle, Truck, UtensilsCrossed, Shield,
  BarChart3, Smartphone, Tablet, Laptop, MapPin, ArrowUpRight, Radio,
  ChevronDown, Layers, ListChecks, ExternalLink
} from 'lucide-react';

const DEVICE_ICONS = { desktop: <Laptop size={14} />, mobile: <Smartphone size={14} />, tablet: <Tablet size={14} /> };
const DEVICE_COLORS = { desktop: 'from-blue-500 to-blue-600', mobile: 'from-matrix-green to-emerald-500', tablet: 'from-purple-500 to-violet-600' };
const PROVIDER_ICONS = { delivery: <Truck size={16} className="text-matrix-green" />, vanellix: <Truck size={16} className="text-matrix-green" />, carta: <UtensilsCrossed size={16} className="text-vanellix-cyan" />, admin: <Shield size={16} className="text-purple-400" /> };
const SERVICE_ICONS = { analytics: <BarChart3 size={14} className="text-yellow-500" />, meta: <Globe size={14} className="text-blue-500" />, firebase: <Zap size={14} className="text-orange-500" /> };

const SUB_TABS = [
  { key: 'ecosystem', label: 'Ecosystem', icon: Layers },
  { key: 'realtime', label: 'Real-time', icon: Radio },
  { key: 'events', label: 'Events Catalog', icon: ListChecks },
];

// ══════════════════════════════════════════════════════════════════
// ECOSYSTEM TAB
// ══════════════════════════════════════════════════════════════════
const EcosystemTab = ({ providers, ecosystemProviders }) => {
  const providerMap = useMemo(() => {
    const globalTrackers = providers.filter(p => p.is_active && (!p.assigned_providers || p.assigned_providers.length === 0));
    const map = {};
    for (const ep of ecosystemProviders) {
      const slug = ep.slug || ep.name?.toLowerCase();
      if (!slug) continue;
      const assigned = providers.filter(p => p.is_active && (p.assigned_providers || []).includes(slug));
      const all = [...globalTrackers, ...assigned].filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
      map[slug] = { name: ep.name || slug, domain: ep.domain || '', slug, trackers: all };
    }
    return map;
  }, [providers, ecosystemProviders]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Object.entries(providerMap).map(([slug, info]) => (
        <motion.div key={slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/30 dark:border-dark-border/30 p-5 hover:border-matrix-green/40 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-matrix-green/5 rounded-bl-full -mr-4 -mt-4 pointer-events-none group-hover:bg-matrix-green/10 transition-colors" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-light-surface dark:bg-dark-surface rounded-xl shadow-sm">
              {PROVIDER_ICONS[slug] || <Globe size={18} className="text-gray-400" />}
            </div>
            <div>
              <h4 className="font-bold text-light-text-primary dark:text-dark-text-primary">{info.name}</h4>
              {info.domain && <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[180px]">{info.domain}</p>}
            </div>
          </div>
          <div className="space-y-2">
            {info.trackers.length === 0 ? (
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic py-2">No trackers assigned</p>
            ) : info.trackers.map(t => (
              <div key={t.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/20 dark:border-dark-border/20">
                <div className="flex items-center gap-2">
                  {SERVICE_ICONS[t.service] || <Activity size={14} className="text-gray-400" />}
                  <span className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary">{t.name || t.service}</span>
                </div>
                {t.is_active ? <CheckCircle2 size={14} className="text-matrix-green" /> : <XCircle size={14} className="text-red-400" />}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-light-border/20 dark:border-dark-border/20 flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${info.trackers.length > 0 ? 'bg-matrix-green/20 text-matrix-green' : 'bg-gray-500/20 text-gray-400'}`}>
              {info.trackers.length} tracker{info.trackers.length !== 1 ? 's' : ''}
            </span>
            {info.domain && <a href={info.domain} target="_blank" rel="noopener noreferrer" className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green transition-colors flex items-center gap-1">Visit <ExternalLink size={10} /></a>}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// REALTIME TAB
// ══════════════════════════════════════════════════════════════════
const RealtimeTab = ({ realtimeData, fetchRealtimeAnalytics, analyticsProviders, loading }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => { if (!selectedId && analyticsProviders.length > 0) setSelectedId(analyticsProviders[0].id); }, [analyticsProviders, selectedId]);
  const selected = useMemo(() => analyticsProviders.find(p => p.id === selectedId) || null, [analyticsProviders, selectedId]);

  const doFetch = useCallback(async () => {
    if (!selectedId) return;
    setFetchError(null);
    try {
      await fetchRealtimeAnalytics(selectedId);
    } catch (e) {
      setFetchError(e?.message || 'Failed to fetch');
    }
    setFetched(true);
  }, [selectedId, fetchRealtimeAnalytics]);

  useEffect(() => {
    if (!isPolling || !selectedId) return;
    const iv = setInterval(() => fetchRealtimeAnalytics(selectedId).catch(() => {}), 30000);
    return () => clearInterval(iv);
  }, [isPolling, selectedId, fetchRealtimeAnalytics]);

  if (analyticsProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity size={40} className="text-gray-400 mb-4 opacity-30" />
        <h3 className="text-lg font-bold text-light-text-primary dark:text-white mb-2">No GA4 Providers</h3>
        <p className="text-sm text-gray-500 max-w-md">Add a Google Analytics provider with a service_account.json to enable real-time analytics.</p>
      </div>
    );
  }

  const d = realtimeData || {};
  const activeUsers = d.total_active_users || 0;
  const pages = d.pages || [];
  const countries = d.countries || [];
  const devices = d.devices || [];
  const sources = d.sources || [];
  const totalDev = devices.reduce((s, x) => s + x.active_users, 0) || 1;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Provider selector */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/40 dark:border-dark-border/40 text-sm font-semibold hover:border-matrix-green/50 transition-colors text-light-text-primary dark:text-dark-text-primary">
            {selected && <>{PROVIDER_ICONS[selected.assigned_providers?.[0]] || <BarChart3 size={14} />}<span>{selected.name}</span></>}
            {!selected && <span>Select provider</span>}
            <ChevronDown size={14} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 mt-2 w-64 bg-light-surface dark:bg-dark-surface border border-light-border/40 dark:border-dark-border/40 rounded-2xl shadow-2xl z-50 overflow-hidden">
                {analyticsProviders.map(ap => (
                  <button key={ap.id} onClick={() => { setSelectedId(ap.id); setShowMenu(false); setFetched(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${ap.id === selectedId ? 'bg-matrix-green/10 text-matrix-green font-bold' : 'text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50'}`}>
                    {PROVIDER_ICONS[ap.assigned_providers?.[0]] || <BarChart3 size={14} />}
                    <div className="flex flex-col"><span className="font-semibold">{ap.name}</span><span className="text-[10px] opacity-60">Property: {ap.property_id}</span></div>
                    {ap.id === selectedId && <CheckCircle2 size={14} className="ml-auto" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button onClick={() => setIsPolling(!isPolling)} className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-colors ${isPolling ? 'bg-matrix-green/10 text-matrix-green' : 'bg-black/5 dark:bg-white/5 text-gray-400'}`}>
          <span className="relative flex h-2 w-2">{isPolling && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matrix-green opacity-75" />}<span className={`relative inline-flex rounded-full h-2 w-2 ${isPolling ? 'bg-matrix-green' : 'bg-gray-400'}`} /></span>
          {isPolling ? 'Live (30s)' : 'Auto-refresh'}
        </button>
        <button onClick={doFetch} disabled={loading} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Not yet fetched */}
      {!fetched && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-3xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-dashed border-light-border/30 dark:border-dark-border/30">
          <Radio size={32} className="text-matrix-green mb-3 opacity-40" />
          <p className="text-sm text-gray-500 mb-4">Click the refresh button or enable auto-refresh to start fetching real-time data.</p>
          <button onClick={doFetch} className="px-5 py-2 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-black font-bold text-sm hover:scale-105 transition-transform">
            Fetch Now
          </button>
        </div>
      )}

      {/* Data loaded */}
      {fetched && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Active Users */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d0d0f] to-[#1a1a2e] border border-white/10 p-6 shadow-2xl flex flex-col items-center justify-center text-center group">
              {activeUsers > 0 && <motion.div animate={{ opacity: [0.05, 0.15, 0.05] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute inset-0 bg-matrix-green/10" />}
              <Radio size={14} className="text-matrix-green mb-1 relative z-10" />
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1 relative z-10">Active Now</p>
              <span className="text-5xl font-black text-white tabular-nums relative z-10">{loading && !realtimeData ? '—' : activeUsers}</span>
              <p className="text-[10px] text-matrix-green/80 mt-1 relative z-10">Last 30 min</p>
            </motion.div>

            {/* Devices */}
            <div className="rounded-3xl bg-light-surface/50 dark:bg-[#1a1a1e] border border-light-border/10 dark:border-white/5 p-5 flex flex-col">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Monitor size={14} /> Devices</h4>
              {devices.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
                <div className="space-y-3 flex-1">{devices.map(d => {
                  const pct = Math.round((d.active_users / totalDev) * 100);
                  const cat = d.category.toLowerCase();
                  return (<div key={d.category} className="space-y-1">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-light-text-primary dark:text-white font-medium">{DEVICE_ICONS[cat] || <Monitor size={14} />}<span className="capitalize">{d.category}</span></div><span className="text-sm font-bold tabular-nums text-light-text-primary dark:text-white">{d.active_users}</span></div>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full bg-gradient-to-r ${DEVICE_COLORS[cat] || 'from-gray-400 to-gray-500'}`} /></div>
                  </div>);
                })}</div>
              )}
            </div>

            {/* Countries */}
            <div className="rounded-3xl bg-light-surface/50 dark:bg-[#1a1a1e] border border-light-border/10 dark:border-white/5 p-5 flex flex-col">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><MapPin size={14} /> Countries</h4>
              {countries.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">{countries.slice(0, 10).map((c, i) => (
                  <div key={c.country} className="flex items-center justify-between py-1"><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span><span className="text-sm text-light-text-primary dark:text-white font-medium">{c.country}</span></div><span className="text-sm font-bold tabular-nums text-matrix-green">{c.active_users}</span></div>
                ))}</div>
              )}
            </div>

            {/* Sources */}
            <div className="rounded-3xl bg-light-surface/50 dark:bg-[#1a1a1e] border border-light-border/10 dark:border-white/5 p-5 flex flex-col">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><ArrowUpRight size={14} /> Sources</h4>
              {sources.length === 0 ? <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic">No data</div> : (
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">{sources.slice(0, 8).map((s, i) => (
                  <div key={`${s.source}-${i}`} className="flex items-center justify-between py-1"><div className="flex flex-col min-w-0"><span className="text-sm text-light-text-primary dark:text-white font-medium truncate">{s.source}</span><span className="text-[10px] text-gray-500">{s.medium}</span></div><span className="text-sm font-bold tabular-nums text-vanellix-cyan ml-2 shrink-0">{s.active_users}</span></div>
                ))}</div>
              )}
            </div>
          </div>

          {/* Pages Table */}
          <div className="rounded-3xl bg-light-surface/50 dark:bg-[#1a1a1e] border border-light-border/10 dark:border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-light-text-primary dark:text-white flex items-center gap-2"><Globe size={18} className="text-vanellix-cyan" /> Active Pages</h3>
              <span className="text-xs text-gray-500 font-mono">{pages.length} pages</span>
            </div>
            <div className="overflow-y-auto max-h-[320px] pr-2 custom-scrollbar">
              {pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500"><Globe size={28} className="mb-2 opacity-20" /><p className="text-sm">No active traffic</p></div>
              ) : (
                <div className="space-y-1.5">{pages.map((p, i) => {
                  const bar = Math.round((p.active_users / (pages[0]?.active_users || 1)) * 100);
                  return (<div key={`${p.page}-${i}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-vanellix-cyan/5 dark:bg-vanellix-cyan/10 rounded-xl" style={{ width: `${bar}%` }} />
                    <span className="w-6 text-center text-xs font-bold text-gray-400 tabular-nums relative z-10">{i + 1}</span>
                    <span className="text-sm font-medium text-light-text-primary dark:text-white truncate flex-1 relative z-10">{p.page}</span>
                    <div className="flex items-center gap-1.5 shrink-0 relative z-10"><Users size={11} className="text-gray-400" /><span className="font-bold text-matrix-green tabular-nums text-sm">{p.active_users}</span></div>
                  </div>);
                })}</div>
              )}
            </div>
          </div>


          {fetchError && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error fetching GA4 data</p>
                <p className="mt-1 opacity-80 text-xs">{fetchError}</p>
                <p className="mt-1 opacity-60 text-xs">Upload a valid service_account.json in the Providers tab and ensure the Property ID is correct.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// EVENTS CATALOG TAB
// ══════════════════════════════════════════════════════════════════
const EventsCatalogTab = () => {
  const [events, setEvents] = useState([]);
  const [loadingCat, setLoadingCat] = useState(true);

  useEffect(() => {
    fetch('/api/conversion_tracker/events/catalog')
      .then(r => r.json())
      .then(data => { setEvents(data?.events || []); setLoadingCat(false); })
      .catch(() => setLoadingCat(false));
  }, []);

  if (loadingCat) return <div className="flex items-center justify-center py-16"><RefreshCw size={24} className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Standardized conversion events that satellites (Delivery, Carta) must implement. Each event maps to GA4 and Meta Pixel automatically.</p>
      <div className="rounded-2xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-left">
              <th className="px-4 py-3 font-bold text-light-text-primary dark:text-dark-text-primary">Event</th>
              <th className="px-4 py-3 font-bold text-yellow-500">GA4</th>
              <th className="px-4 py-3 font-bold text-blue-500">Meta Pixel</th>
              <th className="px-4 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary">Applies To</th>
              <th className="px-4 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary hidden md:table-cell">Required Params</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-border/20 dark:divide-dark-border/20">
            {events.map(ev => (
              <tr key={ev.key} className="hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-matrix-green text-xs bg-matrix-green/10 px-2 py-0.5 rounded-md">{ev.key}</span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-light-text-primary dark:text-dark-text-primary">{ev.ga4_event || '—'}</td>
                <td className="px-4 py-3 text-xs font-mono text-light-text-primary dark:text-dark-text-primary">{ev.meta_event || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(ev.applies_to || []).map(a => (
                      <span key={a} className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-vanellix-cyan/10 text-vanellix-cyan">{a}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden md:table-cell">{(ev.required_params || []).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
const CTAnalytics = ({ realtimeData, fetchRealtimeAnalytics, providers, loading, setActiveTab, ecosystemProviders = [], analyticsProviders = [] }) => {
  const [subTab, setSubTab] = useState('ecosystem');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-matrix-green/20 to-vanellix-cyan/20 shadow-lg">
          <BarChart3 size={24} className="text-matrix-green" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-light-text-primary dark:text-white">Analytics Dashboard</h2>
          <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-0.5">Track your ecosystem performance across all providers</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/20 dark:border-dark-border/20 w-fit">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const active = subTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setSubTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-light-surface dark:bg-dark-surface text-matrix-green shadow-sm' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}>
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={subTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {subTab === 'ecosystem' && <EcosystemTab providers={providers} ecosystemProviders={ecosystemProviders} />}
          {subTab === 'realtime' && <RealtimeTab realtimeData={realtimeData} fetchRealtimeAnalytics={fetchRealtimeAnalytics} analyticsProviders={analyticsProviders} loading={loading} />}
          {subTab === 'events' && <EventsCatalogTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CTAnalytics;
