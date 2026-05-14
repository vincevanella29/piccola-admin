import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

const HeatmapMap = ({ points, center = [-33.4489, -70.6693], zoom = 12 }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const tileLayerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');
    const tileUrl = isDark 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    // Create map only once
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center,
        zoom,
        zoomControl: false,
      });

      tileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a>'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const darkNow = document.documentElement.classList.contains('dark');
          const newUrl = darkNow 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
          
          if (tileLayerRef.current) {
            tileLayerRef.current.setUrl(newUrl);
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    // Clear previous heat layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!points || points.length === 0) return;

    const validPoints = points.filter(p => p[0] && p[1]);

    if (validPoints.length > 0) {
      const heatLayer = L.heatLayer(validPoints, {
        radius: 20,
        blur: 15,
        maxZoom: 14,
        max: 1.0,
        gradient: {
          0.4: 'blue',
          0.6: 'cyan',
          0.7: 'lime',
          0.8: 'yellow',
          1.0: 'red'
        }
      });
      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;

      // Fit bounds
      const bounds = L.latLngBounds(validPoints.map(p => [p[0], p[1]]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    return () => {
      observer.disconnect();
    };
  }, [points, center, zoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full" />;
};

export default HeatmapMap;
