import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPlus, FaSyncAlt } from 'react-icons/fa';
import useRestaurantData from '../../hooks/useRestaurantData';
import LocationCard from './components/LocationCard';
import LocationModal from './components/LocationModal';

const Locations = ({ appState }) => {
  const { t } = useTranslation();
  const { data, locations, isLoading, error, refresh } = useRestaurantData(appState);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filterText, setFilterText] = useState('');

  const filtered = useMemo(() => {
    if (!Array.isArray(locations)) return [];
    const text = filterText.trim().toLowerCase();
    if (!text) return locations;
    return locations.filter((l) =>
      [l.nombre, l.direccion, l.city, l.state]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(text))
    );
  }, [locations, filterText]);

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-12">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold font-futurist text-piccola-white dark:text-piccola-white mb-6 text-center tracking-tight"
        >
          {t('location.adminTitle', { base: t('club.locations') })}
        </motion.h1>

        <div className="mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <input
            type="text"
            placeholder={t('location.searchPlaceholder')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full sm:max-w-md rounded-xl px-4 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition"
          />
          <div className="flex gap-2">
            <button
              onClick={() => refresh()}
              className="inline-flex items-center px-4 py-2 bg-light-accent dark:bg-dark-accent text-piccola-white rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200"
            >
              <FaSyncAlt className="w-4 h-4 mr-2" />
              {t('club.retry')}
            </button>
            {/* Futuro: crear sucursal (si habilitas endpoint) */}
            <button
              disabled
              className="inline-flex items-center px-4 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-secondary dark:text-dark-text-secondary rounded-lg cursor-not-allowed"
              title={t('location.comingSoon')}
            >
              <FaPlus className="w-4 h-4 mr-2" />
              {t('location.newBranch')}
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center">
            <p className="text-light-text-secondary dark:text-dark-text-secondary font-sans mb-4">
              {t('spinner.loading')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center">
            <p className="text-light-error dark:text-dark-error font-sans mb-4">
              {t('location.errorPrefix')} {error}
            </p>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center px-4 py-2 bg-light-accent dark:bg-dark-accent text-piccola-light-text-primary dark:text-piccola-white rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200"
            >
              <FaSyncAlt className="w-4 h-4 mr-2" />
              {t('club.retry')}
            </button>
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-center text-light-text-secondary dark:text-dark-text-secondary font-sans">
            {t('location.emptyFiltered')}
          </p>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((location) => (
              <LocationCard
                key={location._id || location.id}
                location={location}
                onEdit={() => setSelectedLocation(location)}
              />
            ))}
          </div>
        )}

        <LocationModal
          location={selectedLocation}
          isOpen={!!selectedLocation}
          onClose={() => setSelectedLocation(null)}
          appState={appState}
        />
      </div>
    </div>
  );
};

export default Locations;

export const pageMetadata = {
  path: '/app/analytics/locations',
  label: 'club.locations',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 3,
  locations: ['sidebar', 'header'],
  description: 'location.description',
  icon: 'FaMapMarkerAlt',
  isMainPage: false,
  isSearchable: true,
};
