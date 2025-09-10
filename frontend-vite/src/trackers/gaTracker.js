export default function createGATracker({ provider }) {
  const state = {
    id: provider.id,
    service: 'analytics',
    ready: false,
    measurementId: null,
    configured: false,
    debug: false,
  };

  function waitForGtm(maxMs = 5000) {
    const start = Date.now();
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      const ok = () => typeof window.google_tag_manager !== 'undefined';
      if (ok()) return resolve(true);
      const timer = setInterval(() => {
        if (ok()) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - start > maxMs) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });
  }

  function ensureGtag(mid, { debug } = {}) {
    if (typeof window === 'undefined') return false;
    // If gtag already present, just config
    if (window.gtag) {
      // Configure our measurement ID WITHOUT calling 'js' or injecting script
      if (!state.configured) {
        waitForGtm().then(() => {
          try {
            window.gtag('config', mid, { send_page_view: false });
            state.configured = true;
          } catch (e) {
            if (debug) console.warn('[gaTracker] config failed (gtag present, Firebase-managed?)', e);
          }
        });
      }
      return true;
    }
    // Do NOT inject GA when absent to avoid conflicts with Firebase Analytics.
    if (debug) console.warn('[gaTracker] window.gtag not present; GA not initialized');
    return false;
  }

  return {
    id: state.id,
    service: state.service,
    init: async (publicConfig, { debug } = {}) => {
      if (typeof window === 'undefined') return { ready: false };
      const mid = publicConfig?.measurementId;
      if (!mid) return { ready: false };
      state.debug = !!debug;
      const ok = ensureGtag(mid, { debug });
      // Ready only when gtag exists
      state.ready = !!ok && !!window.gtag;
      state.measurementId = mid;
      return { ready: state.ready };
    },
    track: async (eventName, payload = {}, _ctx = {}) => {
      if (typeof window === 'undefined') return;
      if (!window.gtag) {
        try { console.warn('[gaTracker:track] gtag not present; skipped', { eventName, payload }); } catch (_) {}
        return;
      }
      try {
        const toSend = { ...(payload || {}) };
        if (state.debug) toSend.debug_mode = true;
        window.gtag('event', eventName, toSend);
      } catch (_) { /* noop */ }
    },
    // Dedicated helper for SPA page views
    trackPageView: async (path, title, extras = {}) => {
      if (typeof window === 'undefined') return;
      if (!window.gtag || !state.measurementId) {
        try { console.warn('[gaTracker:page_view] gtag not ready; skipped', { path, title }); } catch (_) {}
        return;
      }
      try {
        const payload = {
          page_path: path || (typeof window !== 'undefined' ? window.location?.pathname : undefined),
          page_title: title || (typeof document !== 'undefined' ? document.title : undefined),
          page_location: typeof window !== 'undefined' ? window.location?.href : undefined,
          ...extras,
        };
        if (state.debug) payload.debug_mode = true;
        window.gtag('event', 'page_view', payload);
      } catch (_) { /* noop */ }
    },
    setUser: async (_user = {}) => {
      // GA4 user_id can be set via config or set call; kept minimal here
    },
    setConsent: async (_consent = {}) => {
      // Could wire to gtag consent API
    },
    dispose: () => {},
    isReady: () => state.ready,
  };
}
