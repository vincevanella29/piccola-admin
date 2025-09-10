// src/pages/chat/components/common/LocationList.jsx
import React from 'react';
import LocationCard from './LocationCard';

const LocationList = ({ query, total, shown, items = [] }) => {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm text-light-text/80">
        <div>
          {query ? (
            <>
              Locales para <span className="font-medium text-light-text">“{query}”</span>
            </>
          ) : (
            <span className="font-medium">Locales</span>
          )}
        </div>
        <div className="opacity-70">Mostrando {shown ?? items.length} de {total ?? items.length}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((loc) => (
          <LocationCard key={loc.id || loc.permalink} location={loc} />
        ))}
      </div>
    </div>
  );
};

export default LocationList;
