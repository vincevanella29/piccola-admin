import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Radio, LineChart, ListChecks, BarChart3, Globe } from 'lucide-react';
import { useMarketingAnalytics } from '../../../../hooks/marketing/useMarketingAnalytics.jsx';

// Import Tabs
import EcosystemMapTab from './tabs/EcosystemMapTab.jsx';
import RealtimeGATab from './tabs/RealtimeGATab.jsx';
import HistoricalGATab from './tabs/HistoricalGATab.jsx';
import ProviderEventsTab from './tabs/ProviderEventsTab.jsx';
import RealtimeMapTab from './tabs/RealtimeMapTab.jsx';

const SUB_TABS = [
  { key: 'ecosystem', label: 'Ecosystem', icon: Layers },
  { key: 'realtime', label: 'Real-time GA4', icon: Radio },
  { key: 'map', label: 'Real-time Map', icon: Globe },
  { key: 'historical', label: 'Historical GA4', icon: LineChart },
  { key: 'events', label: 'Provider Events', icon: ListChecks },
];

const CTAnalyticsDashboard = ({ 
  realtimeData, 
  fetchRealtimeAnalytics, 
  providers, 
  ecosystemProviders = [], 
  analyticsProviders = [],
  token,
  account
}) => {
  const [subTab, setSubTab] = useState('ecosystem');
  const cacheManager = useMarketingAnalytics({ token, account });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-matrix-green/20 to-vanellix-cyan/20 shadow-lg border border-matrix-green/30">
          <BarChart3 size={24} className="text-matrix-green" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-matrix-green to-vanellix-cyan">Analytics Dashboard</h2>
          <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-0.5 font-medium">Track your ecosystem performance across all providers in real-time and historically</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 p-1.5 rounded-2xl bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/20 dark:border-dark-border/20 w-fit backdrop-blur-sm shadow-inner">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const active = subTab === tab.key;
          return (
            <button 
              key={tab.key} 
              onClick={() => setSubTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                active 
                  ? 'bg-light-surface dark:bg-dark-surface text-matrix-green shadow-sm border border-light-border/30 dark:border-dark-border/30' 
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface/50 dark:hover:bg-dark-surface/50'
              }`}
            >
              <Icon size={16} className={active ? 'text-matrix-green' : 'opacity-70'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div 
            key={subTab} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {subTab === 'ecosystem' && (
              <EcosystemMapTab 
                providers={providers} 
                ecosystemProviders={ecosystemProviders} 
                cacheManager={cacheManager}
              />
            )}
            
            {subTab === 'realtime' && (
              <RealtimeGATab 
                analyticsProviders={analyticsProviders} 
                cacheManager={cacheManager}
              />
            )}
            
            {subTab === 'map' && (
              <RealtimeMapTab 
                analyticsProviders={analyticsProviders}
                cacheManager={cacheManager}
              />
            )}
            
            {subTab === 'historical' && (
              <HistoricalGATab 
                analyticsProviders={analyticsProviders}
                cacheManager={cacheManager}
              />
            )}
            
            {subTab === 'events' && (
              <ProviderEventsTab 
                providers={providers}
                cacheManager={cacheManager}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CTAnalyticsDashboard;
