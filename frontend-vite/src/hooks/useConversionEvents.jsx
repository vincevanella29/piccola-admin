import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import conversionTrackerApi from '../utils/conversionTracker/api.jsx';
import { buildAdapter } from '../trackers';
import createEventQueue from '../trackers/utils/queue';
import { EVENT_NAMES } from '../trackers/utils/eventMap';
import { normalizeFirebaseConfig, normalizeGAConfig } from '../trackers/utils/normalizeConfig';

// Hook: initialize active providers and expose a unified tracking API
// It also exposes Firebase handles when available so other hooks (like useNotifications) can reuse them.

const useConversionEvents = ({ token, account, debug = false } = {}) => {
  const [activeProviders, setActiveProviders] = useState([]); // public providers from backend
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const adaptersRef = useRef([]); // [{ id, service, adapter, map }]
  const ctxRef = useRef({ user: null, consent: {}, shared: {} });
  const queue = useMemo(() => createEventQueue(), []);

  // Derived handles (e.g., Firebase app/analytics) for reuse in app
  const derivedHandles = useMemo(() => {
    const out = {};
    const fb = adaptersRef.current.find(a => a.service === 'firebase' && a.adapter?.handles);
    if (fb) {
      const h = fb.adapter.handles?.();
      if (h?.app) out.firebase = { app: h.app, analytics: h.analytics };
    }
    return out;
  }, [ready]);

  const loadConfig = useCallback(async () => {
    const data = await conversionTrackerApi.fetchConfig({ token, account });
    const list = Array.isArray(data?.providers) ? data.providers : [];
    setActiveProviders(list.filter(p => p?.is_active));
    return list;
  }, [token, account]);

  const initProviders = useCallback(async (providers) => {
    adaptersRef.current = [];
    setInitializing(true);
    try {
      for (const p of providers) {
        const built = buildAdapter(p);
        if (!built) continue;
        const { adapter, normalize, map } = built;
        let publicConfig = p.public_config || {};
        // Some providers may need normalization (firebase)
        if (typeof normalize === 'function') {
          publicConfig = normalize(publicConfig);
        }
        const res = await adapter.init(publicConfig, { debug });
        adaptersRef.current.push({ id: p.id, service: p.service, adapter, map, ready: !!res?.ready });
      }
      const anyReady = adaptersRef.current.some(a => a.ready);
      setReady(anyReady);
      // Flush queued events if any
      await queue.flush(async ({ eventName, payload }) => {
        for (const a of adaptersRef.current) {
          if (!a.ready) continue;
          const mapper = a.map?.[eventName];
          const mapped = typeof mapper === 'function' ? mapper(payload, ctxRef.current) : { name: eventName, params: payload };
          await a.adapter.track(mapped.name, mapped.params, ctxRef.current).catch?.(() => {});
        }
      });
    } finally {
      setInitializing(false);
    }
  }, [debug, queue]);

  const reload = useCallback(async () => {
    const list = await loadConfig();
    await initProviders(list);
  }, [loadConfig, initProviders]);

  // Public setters
  const setUser = useCallback((user) => {
    ctxRef.current.user = user || null;
    adaptersRef.current.forEach(a => {
      a.adapter?.setUser?.(ctxRef.current.user);
    });
  }, []);

  const setConsent = useCallback((consent) => {
    ctxRef.current.consent = { ...(ctxRef.current.consent || {}), ...(consent || {}) };
    adaptersRef.current.forEach(a => {
      a.adapter?.setConsent?.(ctxRef.current.consent);
    });
  }, []);

  // Core track function
  const track = useCallback(async (eventName, payload = {}) => {
    const dispatch = async () => {
      for (const a of adaptersRef.current) {
        if (!a.ready) continue;
        const mapper = a.map?.[eventName];
        const mapped = typeof mapper === 'function' ? mapper(payload, ctxRef.current) : { name: eventName, params: payload };
        await a.adapter.track(mapped.name, mapped.params, ctxRef.current).catch?.(() => {});
      }
    };
    if (!ready || initializing) {
      queue.push({ eventName, payload });
      return;
    }
    return dispatch();
  }, [ready, initializing, queue, debug]);

  // Helper shortcuts
  const trackPageView = useCallback((page_path) => track(EVENT_NAMES.PAGE_VIEW, { page_path }), [track]);
  const trackViewItem = useCallback((item) => track(EVENT_NAMES.VIEW_ITEM, item), [track]);
  const trackStake = useCallback((data) => track(EVENT_NAMES.STAKE, data), [track]);
  const trackUnstake = useCallback((data) => track(EVENT_NAMES.UNSTAKE, data), [track]);
  const trackClaimStake = useCallback((data) => track(EVENT_NAMES.CLAIM_STAKE, data), [track]);
  const trackWalletCreated = useCallback((data) => track(EVENT_NAMES.WALLET_CREATED, data), [track]);
  const trackTransfer = useCallback((data) => track(EVENT_NAMES.TRANSFER, data), [track]);
  const trackFundingStart = useCallback((data) => track(EVENT_NAMES.FUNDING_START, data), [track]);
  const trackFundingCompleted = useCallback((data) => track(EVENT_NAMES.FUNDING_COMPLETED, data), [track]);
  const trackFundingFailed = useCallback((data) => track(EVENT_NAMES.FUNDING_FAILED, data), [track]);
  const trackSwap = useCallback((data) => track(EVENT_NAMES.SWAP, data), [track]);

  // Initial load
  useEffect(() => {
    if (token || account) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, account]);

  // Expose firebase handles also in a flat top-level for convenience
  const firebase = useMemo(() => {
    const fbAdapter = adaptersRef.current.find(a => a.service === 'firebase' && a.adapter?.handles);
    return fbAdapter?.adapter?.handles?.() || null;
  }, [ready]);

  // Provide a small appState-like export for useNotifications to consume
  const appState = useMemo(() => {
    const fb = firebase;
    return {
      providers: {
        firebase: fb ? { app: fb.app, analytics: fb.analytics, vapidKey: (activeProviders.find(p => p.service === 'firebase')?.public_config?.vapidKey) } : undefined,
        google: activeProviders.find(p => p.service === 'analytics')?.public_config || undefined,
      },
      firebase: fb ? { app: fb.app, analytics: fb.analytics } : undefined,
      vapidKey: activeProviders.find(p => p.service === 'firebase')?.public_config?.vapidKey,
    };
  }, [firebase, activeProviders]);

  return {
    // state
    ready,
    initializing,
    activeProviders,
    appState,
    firebase,
    // identity/consent
    setUser,
    setConsent,
    // core
    track,
    // helpers
    trackPageView,
    trackViewItem,
    trackStake,
    trackUnstake,
    trackClaimStake,
    trackWalletCreated,
    trackTransfer,
    trackFundingStart,
    trackFundingCompleted,
    trackFundingFailed,
    trackSwap,
    // utils
    reload,
  };
};

export default useConversionEvents;
