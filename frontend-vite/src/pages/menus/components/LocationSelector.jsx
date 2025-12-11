import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaMapMarkerAlt, FaTimes } from 'react-icons/fa';

const LocationSelector = ({ locations, selectedLocation, onSelect }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 100, damping: 20, duration: 0.5 },
    },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      className="w-full flex justify-end mb-8"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-light-accent/10 to-white/10 dark:from-dark-accent/10 dark:to-dark-surface/20 rounded-xl text-sm font-medium text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-all duration-300 border border-light-accent/40 dark:border-dark-accent/40 shadow-md"
      >
        <FaMapMarkerAlt className="w-4 h-4" />
        {selectedLocation?.nombre || t('club.selectLocation', { defaultValue: 'Selecciona una sucursal' })}
      </button>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleCloseModal}
          >
            <motion.div
              className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-xl p-6 max-w-md w-full max-h-[70vh] overflow-y-auto scrollbar-thin shadow-xl"
              style={{ backdropFilter: 'blur(8px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
                aria-label="Cerrar"
              >
                <FaTimes className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-futurist text-piccola-light-text-primary dark:text-piccola-white mb-4 text-center">
                {t('club.selectLocation', { defaultValue: 'Selecciona una sucursal' })}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {locations.map((location, index) => {
                  const safeKey =
                    (location && (location._id || location.nombre))
                      ? String(location._id || location.nombre)
                      : `location-${index}`;
                  return (
                  <button
                    key={safeKey}
                    className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 text-left ${
                      selectedLocation?._id === location._id
                        ? 'bg-matrix-green text-white shadow-md'
                        : 'bg-light-surface/50 dark:bg-dark-surface/50 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/20 dark:hover:bg-dark-accent/20'
                    } focus:outline-none focus:border-2 focus:border-matrix-green`}
                    onClick={() => {
                      onSelect(location);
                      handleCloseModal();
                    }}
                  >
                    {location.nombre || `Sucursal ${location._id}`}
                  </button>
                )})}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LocationSelector;