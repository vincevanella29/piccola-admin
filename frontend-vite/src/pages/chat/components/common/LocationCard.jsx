// src/pages/chat/components/common/LocationCard.jsx
import React from 'react';

const LocationCard = ({ location }) => {
  if (!location) return null;
  const {
    id,
    name,
    address,
    city,
    state,
    phone,
    status,
    menu_count,
    image_url,
    map_url,
    permalink,
  } = location;

  const meta = [
    city,
    state,
    phone,
    menu_count ? `${menu_count} menús` : null,
    status,
  ].filter(Boolean);

  // Build Google Maps directions link (prefer full address; fallback to map_url)
  const fullAddress = [address, city, state].filter(Boolean).join(', ');
  const directionsUrl = fullAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`
    : (map_url ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(map_url)}` : null);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur shadow-lg">
      {image_url && (
        <div className="w-full aspect-[16/9] bg-black/20 overflow-hidden">
          <img src={image_url} alt={name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-semibold text-light-text">{name}</h4>
          {status && (
            <div className="px-2 py-0.5 rounded bg-light-surface-tertiary/60 border border-light-border/40 text-xs capitalize">
              {status}
            </div>
          )}
        </div>
        <div className="text-sm text-light-text/80 space-y-1">
          {address && <div>{address}</div>}
          {(city || state) && (
            <div className="opacity-90">{[city, state].filter(Boolean).join(', ')}</div>
          )}
          {phone && (
            <div className="opacity-90">Teléfono: {phone}</div>
          )}
        </div>
        {meta.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-light-text/70">
            {meta.map((m, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">{m}</span>
            ))}
          </div>
        )}
        {(directionsUrl || map_url || permalink) && (
          <div className="flex items-center gap-3 pt-1">
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-matrix-green hover:underline"
              >
                Cómo llegar
              </a>
            )}
            {map_url && (
              <a href={map_url} target="_blank" rel="noreferrer" className="text-sm text-matrix-green hover:underline">Ver en mapa</a>
            )}
            {permalink && (
              <a href={permalink} target="_blank" rel="noreferrer" className="text-sm text-matrix-green hover:underline">Ver detalle</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationCard;
