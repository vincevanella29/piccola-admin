import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Box, Link, Activity, Zap, Server, ShieldCheck, Fingerprint, Plus, X, Check, BarChart3, Target, Flame } from 'lucide-react';

const SERVICE_ICONS = {
  analytics: <BarChart3 size={14} className="text-yellow-500" />,
  meta: <Target size={14} className="text-blue-500" />,
  firebase: <Flame size={14} className="text-orange-500" />,
  google_ads: <Zap size={14} className="text-green-500" />,
};

const EcosystemCard = ({ provider, onResync, isSyncing, assignedTrackers, allTrackers, onToggleTracker }) => {
  const { t } = useTranslation();
  const [showAssign, setShowAssign] = useState(false);

  // Trackers NOT yet assigned to this provider
  const unassigned = allTrackers.filter(ct => 
    ct.is_active && !assignedTrackers.some(at => at.id === ct.id) &&
    // exclude globals (they're implicitly assigned)
    ct.assigned_providers && ct.assigned_providers.length > 0
  );
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border/20 dark:border-dark-border/20 overflow-hidden shadow-sm hover:shadow-neon transition-all duration-300"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-vanellix-cyan/5 rounded-bl-full pointer-events-none blur-2xl"></div>
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-light-surface/80 dark:bg-dark-surface/80 rounded-xl shadow-sm border border-light-border/10 dark:border-dark-border/10">
              <Server className="text-vanellix-cyan" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{provider.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-matrix-green/20 text-matrix-green border border-matrix-green/30 uppercase tracking-wider">
                  {provider.ecosystem_type}
                </span>
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono">{provider.slug}</span>
              </div>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${provider.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
            <Activity size={14} />
            {provider.status}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Link className="text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5" size={16} />
              <div>
                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Domain</p>
                <p className="text-sm text-light-text-primary dark:text-dark-text-primary font-mono mt-0.5">{provider.domain || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5" size={16} />
              <div>
                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Security</p>
                <p className="text-sm text-light-text-primary dark:text-dark-text-primary mt-0.5">{provider.dilithium_secured ? 'Dilithium Secured' : 'Legacy API Key'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Fingerprint className="text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5" size={16} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Active Trackers</p>
                  <button
                    onClick={() => setShowAssign(!showAssign)}
                    className="p-1 rounded-lg hover:bg-matrix-green/10 text-matrix-green transition-colors"
                    title="Manage tracker assignments"
                  >
                    {showAssign ? <X size={14} /> : <Plus size={14} />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {assignedTrackers.length > 0 ? (
                    assignedTrackers.map(tr => (
                      <span key={tr.id} className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded text-xs font-medium group">
                        {SERVICE_ICONS[tr.service]}
                        {tr.name || tr.service}
                        {/* Show remove button if it's specifically assigned (not global) */}
                        {tr.assigned_providers && tr.assigned_providers.includes(provider.slug) && (
                          <button 
                            onClick={() => onToggleTracker(tr, provider.slug, 'remove')}
                            className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                            title="Remove from this provider"
                          >
                            <X size={10} />
                          </button>
                        )}
                        {(!tr.assigned_providers || tr.assigned_providers.length === 0) && (
                          <span className="text-[8px] opacity-50 ml-0.5">(global)</span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">No trackers assigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Assign tracker panel */}
        <AnimatePresence>
          {showAssign && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 p-4 rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50 border border-light-border/30 dark:border-dark-border/30">
                <p className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
                  Assign Trackers to {provider.name}
                </p>
                {allTrackers.filter(ct => ct.is_active).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No active trackers available. Create one in the Providers tab.</p>
                ) : (
                  <div className="space-y-2">
                    {allTrackers.filter(ct => ct.is_active).map(ct => {
                      const isAssigned = ct.assigned_providers && ct.assigned_providers.includes(provider.slug);
                      const isGlobal = !ct.assigned_providers || ct.assigned_providers.length === 0;
                      return (
                        <div key={ct.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/20 dark:border-dark-border/20">
                          <div className="flex items-center gap-2">
                            {SERVICE_ICONS[ct.service] || <Activity size={14} />}
                            <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">{ct.name || ct.service}</span>
                            {isGlobal && <span className="text-[10px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">Global</span>}
                          </div>
                          {isGlobal ? (
                            <span className="text-[10px] text-gray-400 italic">Applied everywhere</span>
                          ) : (
                            <button
                              onClick={() => onToggleTracker(ct, provider.slug, isAssigned ? 'remove' : 'add')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                isAssigned 
                                  ? 'bg-matrix-green/10 text-matrix-green hover:bg-red-500/10 hover:text-red-400' 
                                  : 'bg-light-surface dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary hover:bg-matrix-green/10 hover:text-matrix-green border border-light-border/30 dark:border-dark-border/30'
                              }`}
                            >
                              {isAssigned ? <><Check size={12} /> Assigned</> : <><Plus size={12} /> Assign</>}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-4 border-t border-light-border/10 dark:border-dark-border/10 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onResync(provider._id || provider.id)}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-black font-semibold rounded-xl shadow-neon disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? 'Syncing...' : 'Force Resync'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const CTConfig = ({ loading, error, config, providersById, onRefresh, ecosystemProviders = [], resyncEcosystemProvider, conversionProviders = [], onUpdateProvider }) => {
  const { t } = useTranslation();
  const [syncingId, setSyncingId] = useState(null);

  const handleResync = async (id) => {
    try {
      setSyncingId(id);
      await resyncEcosystemProvider(id);
      alert('Sync trigger sent successfully.');
    } catch (err) {
      alert('Sync failed. ' + (err.message || String(err)));
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleTracker = async (tracker, providerSlug, action) => {
    if (!onUpdateProvider) return;
    const current = tracker.assigned_providers || [];
    let updated;
    if (action === 'add') {
      updated = [...new Set([...current, providerSlug])];
    } else {
      updated = current.filter(s => s !== providerSlug);
    }
    try {
      await onUpdateProvider(tracker.id, { assigned_providers: updated });
      // Refresh to reflect changes
      if (onRefresh) onRefresh();
    } catch (e) {
      alert('Failed to update tracker: ' + (e.message || e));
    }
  };

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {!!error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="max-w-3xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error">
            <AlertTriangle size={18} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm whitespace-pre-line">{String(error?.message || error)}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-light-surface-secondary to-transparent dark:from-dark-surface-secondary dark:to-transparent p-6 rounded-2xl border border-light-border/30 dark:border-dark-border/30 mb-6">
        <div>
          <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <Box className="text-matrix-green" size={28} />
            Ecosystem Integration
          </h3>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Manage connected storefronts, assign trackers, and sync configurations.
          </p>
        </div>
        <motion.button
          className="px-5 py-2.5 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/50 dark:border-dark-border/50 text-light-text-primary dark:text-dark-text-primary font-semibold shadow-sm hover:border-matrix-green/50 disabled:opacity-60 flex items-center gap-2 transition-colors"
          onClick={onRefresh}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw size={18} className={loading ? "animate-spin text-vanellix-cyan" : "text-vanellix-cyan"} />
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </motion.button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {ecosystemProviders.length > 0 ? (
          ecosystemProviders.map(ep => {
            const assignedTrackers = conversionProviders.filter(cp => 
              cp.is_active && (
                !cp.assigned_providers || 
                cp.assigned_providers.length === 0 || 
                cp.assigned_providers.includes(ep.slug)
              )
            );
            return (
              <EcosystemCard 
                key={ep._id || ep.id || ep.slug} 
                provider={ep} 
                onResync={handleResync} 
                isSyncing={syncingId === (ep._id || ep.id)}
                assignedTrackers={assignedTrackers}
                allTrackers={conversionProviders}
                onToggleTracker={handleToggleTracker}
              />
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center border border-dashed border-light-border/40 dark:border-dark-border/40 rounded-3xl bg-light-surface/20 dark:bg-dark-surface/20">
            <Server className="mx-auto text-light-text-tertiary dark:text-dark-text-tertiary mb-4" size={48} />
            <h3 className="text-lg font-bold text-light-text-secondary dark:text-dark-text-secondary mb-2">No Ecosystem Providers Found</h3>
            <p className="text-light-text-tertiary dark:text-dark-text-tertiary">Connect a Delivery or Carta provider first.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CTConfig;
