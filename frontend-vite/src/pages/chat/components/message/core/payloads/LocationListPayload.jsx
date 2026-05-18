// src/pages/chat/components/common/LocationList.jsx
import React from 'react';
import { MapPin } from 'lucide-react';
import LocationPayload from './LocationPayload';

const LocationListPayload = ({ locations, title }) => {
  if (!Array.isArray(locations) || locations.length === 0) return null;

  return (
    <div className="w-full max-w-md bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border-b border-light-border dark:border-dark-border flex items-center gap-2">
           <MapPin size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
           <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide">
             {title}
           </span>
        </div>
      )}
      <div className="p-2 space-y-2">
        {locations.map((loc, idx) => (
          <LocationPayload key={loc.id || loc.permalink || idx} location={loc} />
        ))}
      </div>
    </div>
  );
};

export default LocationListPayload;
