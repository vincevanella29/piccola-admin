import { initializeApp, getApps } from 'firebase/app';

export default function createFirebaseTracker({ provider }) {
  const state = {
    id: provider.id,
    service: 'firebase',
    ready: false,
    app: null,
    analytics: null,
  };

  return {
    id: state.id,
    service: state.service,
    init: async (publicConfig, { debug } = {}) => {
      if (typeof window === 'undefined') return { ready: false };
      const { appConfig } = publicConfig;
      if (!appConfig || !appConfig.apiKey || !appConfig.projectId || !appConfig.appId) {
        if (debug) console.warn('[firebaseTracker] missing required app config');
        return { ready: false };
      }
      try {
        const existing = getApps().find(a => a.options?.projectId === appConfig.projectId);
        state.app = existing || initializeApp(appConfig, `trk-${appConfig.projectId}`);
        // Try analytics if supported
        try {
          const mod = await import('firebase/analytics');
          // analytics only works in browsers with cookies etc.
          state.analytics = mod.getAnalytics(state.app);
        } catch (_) {
          state.analytics = null;
        }
        state.ready = true;
        return { ready: true, handles: { app: state.app, analytics: state.analytics } };
      } catch (e) {
        if (debug) console.error('[firebaseTracker] init error', e);
        return { ready: false };
      }
    },
    track: async (eventName, payload = {}, ctx = {}) => {
      if (!state.ready) return;
      if (state.analytics) {
        try {
          const { logEvent } = await import('firebase/analytics');
          logEvent(state.analytics, eventName, payload);
        } catch (_) {
          // ignore
        }
      }
    },
    setUser: async (user = {}) => {
      // Optionally set user id for analytics
      if (state.analytics) {
        try {
          const { setUserId, setUserProperties } = await import('firebase/analytics');
          if (user?.walletAddress) setUserId(state.analytics, String(user.walletAddress));
          const props = { wallet: user?.walletAddress || user?.wallet || undefined };
          setUserProperties(state.analytics, props);
        } catch (_) {}
      }
    },
    setConsent: async (_consent = {}) => {
      // Could wire to analytics consent (gtag set consent). Skipping for brevity.
    },
    dispose: () => {
      // No-op; app shared in page
    },
    handles: () => ({ app: state.app, analytics: state.analytics }),
    isReady: () => state.ready,
  };
}
