import React from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaEdit } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const Stat = ({ label, value }) => (
  <div className="flex flex-col p-2 rounded-lg bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
    <span className="text-sm font-semibold text-piccola-light-text-primary dark:text-piccola-white">{value ?? '—'}</span>
  </div>
);

const LocationCard = ({ location, onEdit }) => {
  const { t } = useTranslation();
  const telefono = location.telephone || location.phone;
  const capacidad = location.capacidad_personas;
  const mesas = location.cantidad_mesas;
  const sillas = location.cantidad_sillas;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl bg-gradient-to-br from-light-surface/90 to-white/90 dark:from-dark-surface/90 dark:to-dark-surface/90 backdrop-blur-md p-4 sm:p-6 shadow-neon border border-light-accent/10 dark:border-dark-accent/10 hover:shadow-lg hover:border-light-accent dark:hover:border-dark-accent transition-all duration-300"
    >
      <div className="flex items-center mb-3 gap-2">
        <FaMapMarkerAlt className="w-6 h-6 sm:w-7 sm:h-7 text-light-accent dark:text-dark-accent" />
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-futurist font-bold text-piccola-light-text-primary dark:text-piccola-white truncate">
            {location.nombre}
          </h3>
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
            {location.direccion}{location.city ? `, ${location.city}` : ''}{location.state ? `, ${location.state}` : ''}
          </p>
          {telefono && (
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('location.card.telPrefix')} {telefono}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label={t('location.card.capacityShort')} value={capacidad} />
        <Stat label={t('location.card.tables')} value={mesas} />
        <Stat label={t('location.card.chairs')} value={sillas} />
      </div>

      <button
        onClick={onEdit}
        className="w-full py-2 px-3 bg-light-accent/90 dark:bg-dark-accent/90 text-piccola-white rounded-lg hover:bg-light-accent dark:hover:bg-dark-accent transition-all duration-300 inline-flex items-center justify-center"
      >
        <FaEdit className="mr-2 w-4 h-4" />
        {t('location.card.edit')}
      </button>
    </motion.div>
  );
};

export default LocationCard;
