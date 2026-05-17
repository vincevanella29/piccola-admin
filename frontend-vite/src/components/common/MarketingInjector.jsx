import React, { useEffect, useRef } from 'react';

const MarketingInjector = ({ trackers = [] }) => {
  const injectedRef = useRef(new Set());

  useEffect(() => {
    if (!Array.isArray(trackers) || trackers.length === 0) return;

    trackers.forEach(tracker => {
      const service = tracker.service;
      const config = tracker.public_config || tracker.credentials || {};
      const trackerId = tracker.id || tracker.service;

      if (injectedRef.current.has(trackerId) || !tracker.is_active) return;

      if (service === 'analytics' && config.measurementId) {
        // Inject Google Analytics 4 (gtag.js)
        const measurementId = config.measurementId;
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        script.async = true;
        document.head.appendChild(script);

        const inlineScript = document.createElement('script');
        inlineScript.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `;
        document.head.appendChild(inlineScript);
        
        injectedRef.current.add(trackerId);
        console.log(`[Marketing] Admin Injected GA4: ${measurementId}`);
      }

      if (service === 'meta' && config.pixel_id) {
        // Inject Meta Pixel (fbq)
        const pixelId = config.pixel_id;
        const script = document.createElement('script');
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
        
        injectedRef.current.add(trackerId);
        console.log(`[Marketing] Admin Injected Meta Pixel: ${pixelId}`);
      }
    });

  }, [trackers]);

  return null;
};

export default MarketingInjector;
