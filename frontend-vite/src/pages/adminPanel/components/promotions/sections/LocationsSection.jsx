import React, { useState } from 'react';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPinIcon, XCircleIcon } from '@heroicons/react/24/outline';

// SegmentedControl reutilizable
const SegmentedControl = ({ options, value, onChange, disabled }) => (
  <div className="inline-flex p-0.5 bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 rounded-xl border border-light-border/40 dark:border-dark-border/40">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(opt.value)}
        className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
          value === opt.value
            ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const LocationsSection = ({ formData, handleSelectChange, locations, isLoading, t, customSelectStyles }) => {
  const [locationMode, setLocationMode] = useState(formData.locations.length === 0 ? 'all' : 'specific');

  const handleLocationModeChange = (mode) => {
    setLocationMode(mode);
    if (mode === 'all') handleSelectChange([], 'locations');
  };

  const locationOptions = locations.map(loc => ({
    value: loc.permalink_slug,
    label: loc.nombre,
  }));

  const portalStyles = {
    ...customSelectStyles,
    menuPortal: base => ({ ...base, zIndex: 9999 }),
  };

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-matrix-green" />
          <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.locations')}
          </span>
        </div>
        <SegmentedControl
          options={[
            { value: 'all', label: t('admin.promotions.all_locations') },
            { value: 'specific', label: t('admin.promotions.specific_locations') },
          ]}
          value={locationMode}
          onChange={handleLocationModeChange}
          disabled={isLoading}
        />
      </div>

      <AnimatePresence>
        {locationMode === 'specific' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-visible space-y-2"
          >
            <Select
              isMulti
              options={locationOptions}
              value={formData.locations.map(slug => ({
                value: slug,
                label: locations.find(loc => loc.permalink_slug === slug)?.nombre || slug,
              }))}
              onChange={selected => handleSelectChange(selected, 'locations')}
              styles={portalStyles}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              isDisabled={isLoading}
              placeholder={t('admin.promotions.select_locations') + '...'}
              className="text-sm"
            />

            {/* Selected chips */}
            <AnimatePresence>
              {formData.locations.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap gap-1.5"
                >
                  {formData.locations.map(slug => (
                    <motion.span
                      key={slug}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="inline-flex items-center gap-1 bg-matrix-green/10 text-matrix-green px-2.5 py-1 rounded-full text-xs font-semibold"
                    >
                      {locations.find(loc => loc.permalink_slug === slug)?.nombre || slug}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() =>
                          handleSelectChange(
                            formData.locations
                              .filter(s => s !== slug)
                              .map(s => ({
                                value: s,
                                label: locations.find(l => l.permalink_slug === s)?.nombre || s,
                              })),
                            'locations'
                          )
                        }
                        className="hover:text-vanellix-purple transition-colors"
                      >
                        <XCircleIcon className="h-3.5 w-3.5" />
                      </button>
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocationsSection;