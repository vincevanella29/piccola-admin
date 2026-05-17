import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe, Truck, UtensilsCrossed, Shield, CheckCircle2, XCircle, Activity, BarChart3, Zap, Link } from 'lucide-react';

const PROVIDER_ICONS = { 
  delivery: <Truck size={20} className="text-matrix-green" />, 
  vanellix: <Truck size={20} className="text-matrix-green" />, 
  carta: <UtensilsCrossed size={20} className="text-vanellix-cyan" />, 
  admin: <Shield size={20} className="text-purple-400" /> 
};

const SERVICE_ICONS = { 
  analytics: <BarChart3 size={16} className="text-yellow-500" />, 
  meta: <Globe size={16} className="text-blue-500" />, 
  firebase: <Zap size={16} className="text-orange-500" /> 
};

const EcosystemMapTab = ({ providers, ecosystemProviders, cacheManager }) => {
  const providerMap = useMemo(() => {
    // If cached, return it (Optional if we don't fetch anything new, but good for heavy compute)
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
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <Link size={20} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
        <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Platform Connections</h3>
        <span className="px-2 py-1 bg-matrix-green/10 text-matrix-green text-[10px] font-bold rounded uppercase tracking-wider">Active Nodes: {Object.keys(providerMap).length}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.entries(providerMap).map(([slug, info], index) => (
          <motion.div 
            key={slug} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: index * 0.1 }}
            className="rounded-3xl bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/30 dark:border-dark-border/30 p-6 shadow-sm hover:shadow-lg hover:border-matrix-green/40 transition-all relative overflow-hidden group backdrop-blur-xl"
          >
            {/* Background flourish */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-matrix-green/10 rounded-full blur-2xl group-hover:bg-matrix-green/20 transition-all pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-vanellix-cyan/10 rounded-full blur-2xl group-hover:bg-vanellix-cyan/20 transition-all pointer-events-none" />

            {/* Header Node */}
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-light-surface-secondary dark:bg-black/40 rounded-2xl shadow-inner border border-light-border/20 dark:border-dark-border/20">
                  {PROVIDER_ICONS[slug] || <Globe size={20} className="text-gray-400" />}
                </div>
                <div>
                  <h4 className="text-lg font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">{info.name}</h4>
                  {info.domain && (
                    <a href={`https://${info.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green transition-colors truncate max-w-[180px] inline-block">
                      {info.domain}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Lines & Trackers */}
            <div className="relative z-10 pl-5 border-l-2 border-dashed border-light-border/40 dark:border-dark-border/40 ml-5 space-y-3">
              {info.trackers.length === 0 ? (
                <div className="py-2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary italic flex items-center gap-2">
                  <div className="w-2 h-[2px] bg-light-border/40 dark:bg-dark-border/40 absolute -left-[2px]" />
                  No trackers routing here
                </div>
              ) : info.trackers.map((t, idx) => (
                <motion.div 
                  key={t.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (index * 0.1) + (idx * 0.05) }}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-light-surface-secondary/80 dark:bg-black/30 border border-light-border/20 dark:border-dark-border/20 relative group/item hover:border-light-border/40 dark:hover:border-dark-border/40"
                >
                  <div className="w-4 h-[2px] bg-light-border/40 dark:bg-dark-border/40 absolute -left-[18px] group-hover/item:bg-matrix-green/50 transition-colors" />
                  <div className="flex items-center gap-2">
                    {SERVICE_ICONS[t.service] || <Activity size={16} className="text-gray-400" />}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{t.name || t.service}</span>
                      <span className="text-[9px] font-mono text-light-text-tertiary dark:text-dark-text-tertiary uppercase">{t.id.slice(0,8)}</span>
                    </div>
                  </div>
                  {t.is_active ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-matrix-green/10 border border-matrix-green/20">
                      <CheckCircle2 size={10} className="text-matrix-green" />
                      <span className="text-[9px] font-bold text-matrix-green uppercase tracking-wider">Sync</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                      <XCircle size={10} className="text-red-400" />
                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Off</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default EcosystemMapTab;
