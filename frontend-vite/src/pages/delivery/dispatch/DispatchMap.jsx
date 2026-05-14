// src/pages/delivery/dispatch/DispatchMap.jsx
// Real-time dispatch command center map with location radius, order markers, courier tracking
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { loadGoogleMapsScript } from '../../locations/components/utils';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Santiago, Chile — default center
const DEFAULT_CENTER = { lat: -33.4489, lng: -70.6693 };
const DEFAULT_ZOOM = 13;

// No hardcoded status colors — derived from statuses prop (MongoDB)

// ─── SVG Marker Generators ──────────────────────────────────

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createLocationMarkerSvg() {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="#16a34a" stroke="white" stroke-width="3" opacity="0.95"/>
      <text x="24" y="30" text-anchor="middle" font-size="22">🏪</text>
    </svg>`);
}

function createOrderMarkerSvg(color = '#6b7280') {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="15" r="7" fill="white" opacity="0.95"/>
      <text x="16" y="19" text-anchor="middle" font-size="11" font-weight="bold" fill="${color}">🍕</text>
    </svg>`);
}

function createCourierMarkerSvg() {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#0f172a" stroke="#06b6d4" stroke-width="3"/>
      <text x="20" y="27" text-anchor="middle" font-size="18">🏍️</text>
    </svg>`);
}

// ─── Format helpers ──────────────────────────────────────

function elapsedMin(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return `$${Number(amount).toLocaleString('es-CL')}`;
}

function statusLabel(status, statusesMap, t) {
  const meta = statusesMap[status];
  return t?.(`delivery.dispatch_status_${status}`) || meta?.label || status;
}

// ─── InfoWindow HTML builders ──────────────────────────────

function buildLocationInfoHtml(loc) {
  return `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:260px;padding:6px">
      <div style="font-weight:800;font-size:15px;color:#16a34a;margin-bottom:6px">🏪 ${loc.nombre || loc.name || 'Sucursal'}</div>
      <div style="font-size:12px;color:#475569;margin-bottom:3px">📍 ${loc.direccion || loc.address || '—'}</div>
      ${loc.telefono ? `<div style="font-size:12px;color:#475569">📞 ${loc.telefono}</div>` : ''}
    </div>`;
}

function buildOrderInfoHtml(order, statusesMap, t, locations = []) {
  const elapsed = elapsedMin(order.created_at);
  const color = statusesMap[order.status]?.color || '#6b7280';
  const carrier = order.carrier_slug
    ? `<span style="color:#06b6d4;font-weight:600;text-transform:capitalize">${order.carrier_slug}</span>`
    : `<span style="color:#ef4444;font-style:italic">${t?.('delivery.dispatch_no_carrier') || 'Sin asignar'}</span>`;

  const locationName = locations.find(l => String(l._id) === String(order.location_id))?.nombre || order.location_name || 'Sucursal';
  const isPickup = order?.order_type === 'pickup';
  const deliveryAddress = isPickup ? 'Retiro en sucursal' : (order?.delivery_info?.address || order?.delivery_info?.street || 'Dirección de envío no especificada');
  const deliveryDepto = order.delivery_info?.depto || order.customer?.depto;

  // Items list
  const itemsHtml = (order.items || []).slice(0, 5).map(i =>
    `<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid #f1f5f9">
      <span style="color:#334155">${i.quantity}x ${i.nombre || i.codigo}</span>
      <span style="color:#64748b">${formatCurrency(i.unit_price * i.quantity)}</span>
    </div>`
  ).join('');
  const moreItems = (order.items || []).length > 5
    ? `<div style="font-size:10px;color:#94a3b8;text-align:center;padding:2px">+${order.items.length - 5} más</div>` : '';

  // Courier info
  let courierHtml = '';
  if (order.courier_info && order.courier_info.name) {
    const ci = order.courier_info;
    courierHtml = `
      <div style="margin-top:6px;padding:6px;background:#f0fdfa;border-radius:6px;border:1px solid #99f6e4">
        <div style="font-size:11px;font-weight:600;color:#0f766e">🏍️ ${ci.name}</div>
        ${ci.phone ? `<div style="font-size:10px;color:#64748b">📞 ${ci.phone}</div>` : ''}
        ${ci.vehicle ? `<div style="font-size:10px;color:#64748b">🛵 ${ci.vehicle}</div>` : ''}
      </div>`;
  }

  const timeColor = elapsed > 45 ? '#ef4444' : elapsed > 25 ? '#f59e0b' : '#64748b';

  return `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:300px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:800;font-size:14px;color:#0f172a">#${(order._id || '').slice(-8).toUpperCase()}</span>
        <span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${color}22;color:${color}">
          <span style="width:6px;height:6px;border-radius:50%;background:${color}"></span>
          ${statusLabel(order.status, statusesMap, t)}
        </span>
        <span style="font-size:9px;font-weight:800;color:#16a34a;padding:2px 6px;border-radius:4px;background:#16a34a1a;">
          ${locationName}
        </span>
      </div>

      <div style="font-size:12px;color:#334155;margin-bottom:3px">👤 ${order.customer?.name || 'Cliente'} ${order.customer?.phone ? `· ${order.customer.phone}` : ''}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:3px">📍 ${deliveryAddress}</div>
      ${deliveryDepto ? `<div style="font-size:11px;color:#64748b;margin-bottom:3px">🏢 Depto: ${deliveryDepto}</div>` : ''}

      <div style="display:flex;align-items:center;gap:12px;margin:6px 0;padding:4px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
        <div style="font-size:11px">🛵 ${carrier}</div>
        <div style="font-size:11px;color:${timeColor};font-weight:600">⏱️ ${elapsed} min</div>
        <div style="font-size:11px;color:#334155;font-weight:700">${formatCurrency(order.total_amount)}</div>
      </div>

      ${itemsHtml ? `<div style="margin-top:4px">${itemsHtml}${moreItems}</div>` : ''}
      ${courierHtml}

      ${order.notes ? `<div style="margin-top:6px;font-size:10px;color:#78716c;background:#fef3c7;padding:4px 6px;border-radius:4px">📝 ${order.notes}</div>` : ''}
      ${order.scheduled_for ? `<div style="margin-top:4px;font-size:10px;color:#7c3aed;font-weight:600">📅 Programado: ${new Date(order.scheduled_for).toLocaleString('es-CL')}</div>` : ''}
    </div>`;
}

function buildCourierInfoHtml(courier, order) {
  return `
    <div style="font-family:'Inter',system-ui,sans-serif;max-width:220px;padding:4px">
      <div style="font-weight:800;font-size:13px;color:#06b6d4;margin-bottom:4px">🏍️ ${courier.name || 'Courier'}</div>
      ${courier.phone ? `<div style="font-size:11px;color:#64748b">📞 ${courier.phone}</div>` : ''}
      ${courier.vehicle ? `<div style="font-size:11px;color:#64748b">🛵 ${courier.vehicle}</div>` : ''}
      ${order ? `<div style="font-size:11px;color:#334155;margin-top:4px">📦 Pedido #${(order._id || '').slice(-8).toUpperCase()}</div>` : ''}
    </div>`;
}

// ─── Component ──────────────────────────────────────────

const DispatchMap = ({ orders = [], locations = [], statuses = [], selectedOrderId, onSelectOrder, t }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const circlesRef = useRef([]);
  const linesRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Build lookup maps from MongoDB statuses
  const statusColors = useMemo(() => {
    const m = {};
    statuses.forEach(s => { m[s.key] = s.color; });
    return m;
  }, [statuses]);

  const statusesMap = useMemo(() => {
    const m = {};
    statuses.forEach(s => { m[s.key] = s; });
    return m;
  }, [statuses]);

  // Initialize map
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      setMapError('Google Maps API key not configured');
      return;
    }

    let cancelled = false;

    loadGoogleMapsScript(GOOGLE_MAPS_KEY)
      .then(() => {
        if (cancelled || !mapRef.current || mapInstanceRef.current) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#3a3a55' }] },
            { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a55' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a2b' }] },
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
          ],
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new window.google.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
        setMapError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Update markers ──────────────────────────────────
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;
    const gm = window.google.maps;

    // Clear previous
    markersRef.current.forEach((m) => m.setMap(null));
    circlesRef.current.forEach((c) => c.setMap(null));
    linesRef.current.forEach((l) => l.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];
    linesRef.current = [];

    const bounds = new gm.LatLngBounds();
    let hasPoints = false;

    // ═══ 1. LOCATIONS with radius circle ═══
    locations.forEach((loc) => {
      const lat = parseFloat(loc.lat);
      const lng = parseFloat(loc.lng);
      if (!lat || !lng) return;

      // Coverage radius circle (5km default)
      const circle = new gm.Circle({
        center: { lat, lng },
        radius: 5000,
        map,
        fillColor: '#16a34a',
        fillOpacity: 0.06,
        strokeColor: '#16a34a',
        strokeOpacity: 0.25,
        strokeWeight: 1.5,
        clickable: false,
      });
      circlesRef.current.push(circle);

      // Store marker
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        icon: { url: createLocationMarkerSvg(), scaledSize: new window.google.maps.Size(48, 48), anchor: new window.google.maps.Point(24, 24) },
        title: loc.nombre || loc.name || 'Sucursal',
        zIndex: 100,
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(buildLocationInfoHtml(loc));
        infoWindowRef.current.open(map, marker);
      });
      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
      hasPoints = true;
    });

    // ═══ 2. ORDER MARKERS (dropoff = customer location) ═══
    const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));

    activeOrders.forEach((order) => {
      const dropLat = parseFloat(order.delivery_info?.lat);
      const dropLng = parseFloat(order.delivery_info?.lng);
      if (!dropLat || !dropLng) return;

      const isSelected = order._id === selectedOrderId;

      const marker = new window.google.maps.Marker({
        position: { lat: dropLat, lng: dropLng },
        map,
        icon: {
          url: createOrderMarkerSvg(statusColors[order.status]),
          scaledSize: new window.google.maps.Size(isSelected ? 40 : 32, isSelected ? 50 : 40),
          anchor: new window.google.maps.Point(isSelected ? 20 : 16, isSelected ? 50 : 40),
        },
        title: `#${(order._id || '').slice(-8).toUpperCase()} — ${order.customer?.name || 'Cliente'}`,
        zIndex: isSelected ? 200 : 50,
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null,
      });

      marker.addListener('click', () => {
        onSelectOrder?.(order._id);
        infoWindowRef.current.setContent(buildOrderInfoHtml(order, statusesMap, t, locations));
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: dropLat, lng: dropLng });
      hasPoints = true;

      // ═══ 3. ROUTE LINE (pickup → dropoff) for dispatched ═══
      if (['dispatched', 'ready'].includes(order.status) && order.location_id) {
        const loc = locations.find((l) =>
          String(l._id) === String(order.location_id) || l.permalink_slug === order.location_id
        );
        if (loc && loc.lat && loc.lng) {
          const line = new gm.Polyline({
            path: [
              { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) },
              { lat: dropLat, lng: dropLng },
            ],
            geodesic: true,
            strokeColor: statusColors[order.status] || '#6b7280',
            strokeOpacity: 0.5,
            strokeWeight: 2,
            icons: [{
              icon: { path: gm.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: statusColors[order.status] || '#6b7280' },
              offset: '50%',
            }],
            map,
          });
          linesRef.current.push(line);
        }
      }

      // ═══ 4. COURIER MARKER ═══
      const ci = order.courier_info;
      if (ci && ci.lat && ci.lng) {
        const courierMarker = new window.google.maps.Marker({
          position: { lat: parseFloat(ci.lat), lng: parseFloat(ci.lng) },
          map,
          icon: { url: createCourierMarkerSvg(), scaledSize: new window.google.maps.Size(40, 40), anchor: new window.google.maps.Point(20, 20) },
          title: ci.name || 'Courier',
          zIndex: 150,
        });
        courierMarker.addListener('click', () => {
          infoWindowRef.current.setContent(buildCourierInfoHtml(ci, order));
          infoWindowRef.current.open(map, courierMarker);
        });
        markersRef.current.push(courierMarker);
        bounds.extend({ lat: parseFloat(ci.lat), lng: parseFloat(ci.lng) });
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      const listener = gm.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        gm.event.removeListener(listener);
      });
    }
  }, [orders, locations, selectedOrderId, onSelectOrder, t, statusColors, statusesMap]);

  useEffect(() => {
    if (mapReady) updateMarkers();
  }, [mapReady, updateMarkers]);

  // Center on selected order
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedOrderId) return;
    const order = orders.find((o) => o._id === selectedOrderId);
    if (order?.delivery_info?.lat && order?.delivery_info?.lng) {
      mapInstanceRef.current.panTo({
        lat: parseFloat(order.delivery_info?.lat),
        lng: parseFloat(order.delivery_info?.lng),
      });
      if (mapInstanceRef.current.getZoom() < 14) {
        mapInstanceRef.current.setZoom(14);
      }
    }
  }, [selectedOrderId, orders]);

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-dark-surface-secondary rounded-2xl">
        <p className="text-red-400 text-sm">❌ {mapError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/5">
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend overlay — driven from MongoDB statuses */}
      <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
        {[
          { color: '#16a34a', label: '🏪 Local' },
          ...statuses
            .filter(s => !['delivered', 'cancelled'].includes(s.key))
            .map(s => ({ color: s.color, label: `${s.icon} ${s.label}` })),
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-full bg-dark-surface/80 backdrop-blur-sm border border-white/10 text-[10px] text-dark-text-secondary">
            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-surface/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-dark-text-secondary">
            <div className="w-5 h-5 border-2 border-matrix-green border-t-transparent rounded-full animate-spin" />
            <span>{t?.('delivery.dispatch_loading_map') || 'Cargando mapa...'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchMap;
