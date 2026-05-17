import React, { useEffect, useRef } from 'react';

// ── Standardized Event Catalog ─────────────────────────────────────────────────
// Maps internal event keys to GA4 and Meta Pixel event names.
const EVENT_CATALOG = {
  page_view:        { ga4: 'page_view',        meta: 'PageView' },
  view_item:        { ga4: 'view_item',        meta: 'ViewContent' },
  add_to_cart:      { ga4: 'add_to_cart',      meta: 'AddToCart' },
  remove_from_cart: { ga4: 'remove_from_cart', meta: null },
  begin_checkout:   { ga4: 'begin_checkout',   meta: 'InitiateCheckout' },
  purchase:         { ga4: 'purchase',         meta: 'Purchase' },
  search:           { ga4: 'search',           meta: 'Search' },
  generate_lead:    { ga4: 'generate_lead',    meta: 'Lead' },
};

/**
 * trackEvent — Global conversion event dispatcher.
 * Fires the event to ALL active tracking providers (GA4, Meta Pixel).
 *
 * @param {string} eventKey - One of the EVENT_CATALOG keys (e.g. 'add_to_cart')
 * @param {object} data     - Event-specific parameters (items, value, currency, etc.)
 */
export const trackEvent = (eventKey, data = {}) => {
  const mapping = EVENT_CATALOG[eventKey];
  if (!mapping) {
    console.warn(`[ConversionTracker] Unknown event key: "${eventKey}"`);
    return;
  }

  // ── Universal Logging (Always visible, even if adblockers block GA4/Meta) ──
  console.log(`[ConversionTracker] 🚀 Emitting: ${eventKey}`, data);

  // GA4 via gtag
  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', mapping.ga4, data);
      console.log(`[ConversionTracker] GA4 → ${mapping.ga4}`, data);
    } catch (e) {
      console.warn(`[ConversionTracker] GA4 event failed:`, e);
    }
  }

  // Meta Pixel via fbq
  if (typeof window.fbq === 'function' && mapping.meta) {
    try {
      window.fbq('track', mapping.meta, data);
      console.log(`[ConversionTracker] Meta → ${mapping.meta}`, data);
    } catch (e) {
      console.warn(`[ConversionTracker] Meta event failed:`, e);
    }
  }
};

// ── Helper: resolve pixel_id from tracker credentials ──────────────────────────
const resolvePixelId = (tracker) =>
  tracker.credentials?.pixel_id ||
  tracker.public_config?.pixel_id ||
  tracker.pixel_settings?.pixel_id ||
  null;

// ── Helper: resolve GA4 measurement ID from tracker ────────────────────────────
const resolveGaId = (tracker) =>
  tracker.public_config?.measurementId ||
  tracker.credentials?.measurementId ||
  tracker.analytics_settings?.ga4_property_id ||
  null;

// ── MarketingInjector Component ────────────────────────────────────────────────
const MarketingInjector = ({ trackers }) => {
  const injectedRef = useRef(new Set());

  useEffect(() => {
    if (!trackers || !Array.isArray(trackers)) return;

    trackers.forEach(tracker => {
      if (!tracker.is_active && tracker.is_active !== undefined) return;

      // ── GA4 (Google Analytics 4) ──────────────────────────────────────
      if (tracker.service === 'analytics') {
        let gaId = resolveGaId(tracker);
        if (!gaId) return;
        
        // Auto-fix if user entered just numbers instead of G-XXXXXXX
        if (/^\d+$/.test(gaId)) {
          console.log(`[ConversionTracker] Auto-fixing GA4 ID format from '${gaId}' to 'G-${gaId}'`);
          gaId = `G-${gaId}`;
        }

        if (!injectedRef.current.has(`ga-${gaId}`) && !document.getElementById(`ga-${gaId}`)) {
          injectedRef.current.add(`ga-${gaId}`);

          const script1 = document.createElement('script');
          script1.async = true;
          script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
          script1.id = `ga-${gaId}`;
          document.head.appendChild(script1);

          const script2 = document.createElement('script');
          script2.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `;
          document.head.appendChild(script2);
          console.log(`[MarketingInjector] GA4 inyectado: ${gaId}`);
        }
      }

      // ── Meta Pixel ────────────────────────────────────────────────────
      // Admin sends service: 'meta' — also support legacy 'pixel'
      else if (tracker.service === 'meta' || tracker.service === 'pixel') {
        const pixelId = resolvePixelId(tracker);
        if (!pixelId) return;
        if (!injectedRef.current.has(`meta-${pixelId}`) && !document.getElementById(`meta-pixel-${pixelId}`)) {
          injectedRef.current.add(`meta-${pixelId}`);

          const script = document.createElement('script');
          script.id = `meta-pixel-${pixelId}`;
          script.innerHTML = `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `;
          document.head.appendChild(script);
          console.log(`[MarketingInjector] Meta Pixel inyectado: ${pixelId}`);
        }
      }
    });
  }, [trackers]);

  return null; // Componente invisible
};

export default MarketingInjector;
