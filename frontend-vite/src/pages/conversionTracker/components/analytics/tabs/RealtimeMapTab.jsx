import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { Globe, Activity, RefreshCw, BarChart3, ChevronDown, CheckCircle2, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Simple geo-mapping for top cities/countries to avoid needing an external geocoding API
const GEO_MAP = {
  // Chile
  'Santiago': [-33.4489, -70.6693],
  'Valparaiso': [-33.0456, -71.6197],
  'Concepcion': [-36.8201, -73.0444],
  'Vina del Mar': [-33.0245, -71.5518],
  'Antofagasta': [-23.6500, -70.4000],
  'La Serena': [-29.9027, -71.2520],
  'Temuco': [-38.7359, -72.5904],
  'Rancagua': [-34.1708, -70.7444],
  'Talca': [-35.4264, -71.6554],
  'Arica': [-18.4783, -70.3126],
  'Iquique': [-20.2208, -70.1431],
  'Puerto Montt': [-41.4693, -72.9424],
  'Copiapo': [-27.3667, -70.3333],
  'Quilpue': [-33.0481, -71.4425],
  'Osorno': [-40.5739, -73.1336],
  'Valdivia': [-39.8142, -73.2459],
  'Punta Arenas': [-53.1500, -70.9167],
  
  // Latin America
  'Buenos Aires': [-34.6037, -58.3816],
  'Lima': [-12.0464, -77.0428],
  'Bogota': [4.7110, -74.0721],
  'Sao Paulo': [-23.5505, -46.6333],
  'Mexico City': [19.4326, -99.1332],
  
  // US & Europe
  'New York': [40.7128, -74.0060],
  'Miami': [25.7617, -80.1918],
  'Madrid': [40.4168, -3.7038],
  'London': [51.5074, -0.1278],

  // Countries (Fallback if city is not found)
  'Chile': [-35.6751, -71.5430],
  'Argentina': [-38.4161, -63.6167],
  'Peru': [-9.1900, -75.0152],
  'Colombia': [4.5709, -74.2973],
  'Brazil': [-14.2350, -51.9253],
  'Mexico': [23.6345, -102.5528],
  'United States': [37.0902, -95.7129],
  'Spain': [40.4637, -3.7492],
};

const getCoordinates = (city, country) => {
  if (city && GEO_MAP[city]) return GEO_MAP[city];
  if (country && GEO_MAP[country]) return GEO_MAP[country];
  // Default to a central point if unknown
  return null;
};

// Map component using React Leaflet
const LeafletMap = ({ locations }) => {
  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-light-border/20 dark:border-white/5 relative z-0">
      <MapContainer 
        center={[-30, -60]} 
        zoom={3} 
        style={{ height: '100%', width: '100%', background: '#0a0a0c' }}
        zoomControl={false}
      >
        {/* CartoDB Dark Matter TileLayer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {locations.map((loc, i) => {
          const coords = getCoordinates(loc.city, loc.country);
          if (!coords) return null;
          
          // Size based on active users (min 5, max 30)
          const radius = Math.max(5, Math.min(30, loc.active_users * 2));
          
          return (
            <CircleMarker
              key={`${loc.city}-${loc.country}-${i}`}
              center={coords}
              radius={radius}
              pathOptions={{ 
                fillColor: '#00ff9d', 
                fillOpacity: 0.5, 
                color: '#00ff9d', 
                weight: 1 
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1} className="custom-leaflet-tooltip">
                <div className="text-center font-sans">
                  <p className="font-bold text-xs text-gray-800">{loc.city !== '(not set)' ? loc.city : loc.country}</p>
                  <p className="text-[10px] text-gray-600 font-black">{loc.active_users} Active Users</p>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};


const RealtimeMapTab = ({ analyticsProviders, cacheManager }) => {
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
      cacheManager.updateCache(cacheKey, { lastFetched: 0 }); // Invalidate manually to force fetch
      cacheManager.fetchRealtime(selectedId);
    }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling, selectedId]);

  if (analyticsProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-light-surface/50 dark:bg-dark-surface/50 rounded-3xl border border-light-border/20 dark:border-dark-border/20">
        <Globe size={40} className="text-gray-400 mb-4 opacity-30" />
        <h3 className="text-lg font-bold text-light-text-primary dark:text-white mb-2">No GA4 Providers</h3>
        <p className="text-sm text-gray-500 max-w-md">Add a Google Analytics provider to enable the real-time map.</p>
      </div>
    );
  }

  const d = data || {};
  const activeUsers = d.total_active_users || 0;
  const locations = d.locations || [];
  const events = d.events || [];

  return (
    <div className="space-y-6 h-full flex flex-col">
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
        <div className="flex items-center justify-center py-20 flex-1">
          <RefreshCw size={32} className="animate-spin text-matrix-green opacity-50" />
        </div>
      )}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
          
          {/* Map Section */}
          <div className="lg:col-span-3 flex flex-col rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 shadow-sm backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                <Globe size={14} className="text-vanellix-cyan" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Active Users: <span className="text-matrix-green">{activeUsers}</span></span>
              </div>
            </div>
            
            <LeafletMap locations={locations} />
            
            {/* Legend / Overlay */}
            <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
               <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex flex-col gap-1">
                 <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Live Activity</span>
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-matrix-green shadow-[0_0_8px_#00ff9d]" />
                   <span className="text-xs text-white font-medium">User Connection</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Events Feed Section */}
          <div className="lg:col-span-1 rounded-3xl bg-light-surface/60 dark:bg-black/30 border border-light-border/20 dark:border-white/5 p-5 shadow-sm backdrop-blur-md flex flex-col h-full overflow-hidden">
            <h3 className="text-[11px] font-black text-light-text-secondary dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={14} className="text-vanellix-cyan" /> Event Stream (Live)
            </h3>
            
            <div className="flex-1 overflow-y-auto scrollbar-none space-y-3 pr-1">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                  <Navigation size={24} className="mb-2" />
                  <p className="text-xs font-medium">Listening for events...</p>
                </div>
              ) : (
                <AnimatePresence>
                  {events.map((ev, i) => (
                    <motion.div 
                      key={`${ev.event_name}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-3 rounded-2xl bg-light-surface dark:bg-white/5 border border-light-border/20 dark:border-white/5 hover:border-matrix-green/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-light-text-primary dark:text-white break-all">
                            {ev.event_name}
                          </span>
                          <span className="text-[9px] text-gray-500 mt-0.5">Last 30 mins</span>
                        </div>
                        <div className="bg-matrix-green/10 text-matrix-green font-black text-[10px] px-1.5 py-0.5 rounded border border-matrix-green/20">
                          {ev.active_users}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

        </motion.div>
      )}

      {/* Global styles for Leaflet Tooltip */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-leaflet-tooltip {
          background-color: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 8px;
          padding: 4px 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .leaflet-container {
          background-color: transparent !important;
        }
      `}} />
    </div>
  );
};

export default RealtimeMapTab;
