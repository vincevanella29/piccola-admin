import React, { useState } from 'react';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon } from '@heroicons/react/24/outline';

const LocationsSection = ({ formData, handleSelectChange, locations, isLoading, t, customSelectStyles }) => {
  // State to track radio button selection: 'all' or 'specific'
  const [locationMode, setLocationMode] = useState(formData.locations.length === 0 ? 'all' : 'specific');

  // Handle radio button change
  const handleLocationModeChange = (mode) => {
    setLocationMode(mode);
    if (mode === 'all') {
      // Clear locations to indicate all locations
      handleSelectChange([], 'locations');
    }
    // If switching to 'specific', keep existing selections or start empty
  };

  // Handle specific location selection
  const handleSpecificLocationChange = (selected) => {
    handleSelectChange(selected, 'locations');
  };

  // Location options for the dropdown
  const locationOptions = locations.map((loc) => ({
    value: loc.permalink_slug,
    label: loc.nombre,
  }));

  return (
    <section className="p-6 bg-gradient-to-br from-light-surface/80 dark:from-dark-surface/80 to-light-surface/50 dark:to-dark-surface/50 rounded-2xl shadow-lg border border-light-border/20 dark:border-dark-border/20">
      <h3 className="text-2xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-6 flex items-center gap-3">
        {t('admin.promotions.locations')}
      </h3>
      <div className="space-y-4">
        <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
          {t('admin.promotions.select_locations')}
          <span className="text-matrix-green text-xs"> ({t('admin.promotions.required')})</span>
        </label>

        {/* Radio Buttons */}
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="locationMode"
              value="all"
              checked={locationMode === 'all'}
              onChange={() => handleLocationModeChange('all')}
              disabled={isLoading}
              className="h-5 w-5 text-matrix-green focus:ring-matrix-green border-light-border dark:border-dark-border"
            />
            <span className="text-light-text-primary dark:text-dark-text-primary">
              {t('admin.promotions.all_locations')}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="locationMode"
              value="specific"
              checked={locationMode === 'specific'}
              onChange={() => handleLocationModeChange('specific')}
              disabled={isLoading}
              className="h-5 w-5 text-matrix-green focus:ring-matrix-green border-light-border dark:border-dark-border"
            />
            <span className="text-light-text-primary dark:text-dark-text-primary">
              {t('admin.promotions.specific_locations')}
            </span>
          </label>
        </div>

        {/* Specific Locations Dropdown */}
        <AnimatePresence>
          {locationMode === 'specific' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Select
                isMulti
                options={locationOptions}
                value={formData.locations.map((slug) => ({
                  value: slug,
                  label: locations.find((loc) => loc.permalink_slug === slug)?.nombre || slug,
                }))}
                onChange={handleSpecificLocationChange}
                styles={customSelectStyles}
                classNamePrefix="custom-select"
                isDisabled={isLoading}
                placeholder={t('admin.promotions.select_locations')}
              />
              <AnimatePresence>
                {formData.locations.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-wrap gap-2 mt-3"
                  >
                    {formData.locations.map((slug) => (
                      <motion.div
                        key={slug}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-1 bg-gradient-to-r from-matrix-green/20 to-light-text-primary dark:from-matrix-green/10 dark:to-light-text-primary/10 text-light-text-primary dark:text-dark-text-primary px-3 py-1 rounded-full text-sm shadow-neon hover:shadow-lg transition-all"
                      >
                        {locations.find((loc) => loc.permalink_slug === slug)?.nombre || slug}
                        <XCircleIcon
                          className="h-4 w-4 cursor-pointer text-vanellix-purple hover:text-vanellix-purple/80"
                          onClick={() =>
                            handleSelectChange(
                              formData.locations
                                .filter((s) => s !== slug)
                                .map((s) => ({
                                  value: s,
                                  label: locations.find((loc) => loc.permalink_slug === s)?.nombre || s,
                                })),
                              'locations'
                            )
                          }
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default LocationsSection;