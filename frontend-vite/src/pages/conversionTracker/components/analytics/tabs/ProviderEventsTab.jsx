import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ListChecks, Globe, Zap, BarChart3, CheckCircle2, XCircle, Search, Filter } from 'lucide-react';

const SERVICE_ICONS = { 
  analytics: <BarChart3 size={16} className="text-yellow-500" />, 
  meta: <Globe size={16} className="text-blue-500" />, 
  firebase: <Zap size={16} className="text-orange-500" /> 
};

const SERVICE_COLORS = {
  analytics: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  meta: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  firebase: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
};

const ProviderEventsTab = ({ providers, cacheManager }) => {
  const [events, setEvents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeServicesFilter, setActiveServicesFilter] = useState(['analytics', 'meta', 'firebase']);

  // We can fetch the events catalog from backend (this is static, so cache it locally inside the component or manager)
  const cacheKey = 'providerEvents';
  const cachedState = cacheManager.cache[cacheKey] || {};
  const { data, loading } = cachedState;

  useEffect(() => {
    cacheManager.fetchEventsCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (data) {
      setEvents(data);
    }
  }, [data]);

  // Which services are active overall in our providers?
  const activeServicesInEcosystem = useMemo(() => {
    const active = new Set();
    providers.forEach(p => { if (p.is_active) active.add(p.service); });
    return active;
  }, [providers]);

  const toggleFilter = (service) => {
    if (activeServicesFilter.includes(service)) {
      setActiveServicesFilter(activeServicesFilter.filter(s => s !== service));
    } else {
      setActiveServicesFilter([...activeServicesFilter, service]);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (searchTerm && !ev.key.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [events, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-light-surface/60 dark:bg-dark-surface/60 p-4 rounded-2xl border border-light-border/30 dark:border-dark-border/30 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search events..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-light-surface-secondary dark:bg-black/40 border border-light-border/40 dark:border-dark-border/40 text-sm rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green/50 outline-none transition-all text-light-text-primary dark:text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-light-surface-secondary dark:bg-black/20 rounded-xl border border-light-border/20 dark:border-white/5 mr-1">
            <Filter size={14} className="text-gray-400" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Compare</span>
          </div>
          {['analytics', 'meta', 'firebase'].map(svc => {
            const isFilterActive = activeServicesFilter.includes(svc);
            const isConfigured = activeServicesInEcosystem.has(svc);
            return (
              <button 
                key={svc}
                onClick={() => toggleFilter(svc)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all shrink-0 ${isFilterActive ? SERVICE_COLORS[svc] : 'bg-transparent border-light-border/30 dark:border-dark-border/30 text-gray-400 hover:bg-light-surface dark:hover:bg-white/5'}`}
              >
                {SERVICE_ICONS[svc]}
                <span className="text-xs font-bold capitalize">{svc === 'analytics' ? 'GA4' : svc}</span>
                {isConfigured ? (
                  <span className="flex h-2 w-2 rounded-full bg-matrix-green ml-1" title="Provider is configured and active" />
                ) : (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 ml-1" title="Provider not configured" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="rounded-3xl border border-light-border/30 dark:border-dark-border/30 bg-light-surface/50 dark:bg-black/20 backdrop-blur-md overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-light-surface/80 dark:bg-black/40 text-left border-b border-light-border/30 dark:border-dark-border/30">
                  <th className="px-6 py-4 font-black text-xs text-light-text-secondary dark:text-gray-400 uppercase tracking-wider">Internal Event (Dispatch)</th>
                  {activeServicesFilter.includes('analytics') && <th className="px-6 py-4 font-black text-xs text-yellow-500 uppercase tracking-wider whitespace-nowrap"><div className="flex items-center gap-2"><BarChart3 size={14} /> GA4 Mapping</div></th>}
                  {activeServicesFilter.includes('meta') && <th className="px-6 py-4 font-black text-xs text-blue-500 uppercase tracking-wider whitespace-nowrap"><div className="flex items-center gap-2"><Globe size={14} /> Meta Mapping</div></th>}
                  {activeServicesFilter.includes('firebase') && <th className="px-6 py-4 font-black text-xs text-orange-500 uppercase tracking-wider whitespace-nowrap"><div className="flex items-center gap-2"><Zap size={14} /> Firebase (Push)</div></th>}
                  <th className="px-6 py-4 font-black text-xs text-light-text-secondary dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border/20 dark:divide-white/5">
                {filteredEvents.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-medium">No events match your filter</td></tr>
                ) : filteredEvents.map(ev => (
                  <motion.tr 
                    key={ev.key} 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="hover:bg-light-surface dark:hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-matrix-green opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="font-mono font-bold text-light-text-primary dark:text-white bg-light-surface-secondary dark:bg-white/10 px-2 py-1 rounded-lg border border-light-border/20 dark:border-white/5">{ev.key}</span>
                      </div>
                    </td>
                    
                    {activeServicesFilter.includes('analytics') && (
                      <td className="px-6 py-4">
                        {ev.ga4_event ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-semibold text-yellow-600 dark:text-yellow-400">{ev.ga4_event}</span>
                            {ev.required_params?.length > 0 && <span className="text-[9px] text-gray-500 font-mono">params: {ev.required_params.join(', ')}</span>}
                          </div>
                        ) : <span className="text-xs text-gray-500 italic">— Ignored —</span>}
                      </td>
                    )}

                    {activeServicesFilter.includes('meta') && (
                      <td className="px-6 py-4">
                        {ev.meta_event ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{ev.meta_event}</span>
                          </div>
                        ) : <span className="text-xs text-gray-500 italic">— Ignored —</span>}
                      </td>
                    )}

                    {activeServicesFilter.includes('firebase') && (
                      <td className="px-6 py-4">
                        {/* Assuming firebase triggers are just logged natively by our useConversionEvents, we can show a badge */}
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-matrix-green/50" />
                          <span className="text-xs text-gray-500">Native push</span>
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {(ev.applies_to || []).map(a => (
                          <span key={a} className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-vanellix-cyan/10 text-vanellix-cyan border border-vanellix-cyan/20">{a}</span>
                        ))}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderEventsTab;
