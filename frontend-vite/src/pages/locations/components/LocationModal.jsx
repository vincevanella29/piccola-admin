import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaSave, FaUpload } from 'react-icons/fa';
import useRestaurantData from '../../../hooks/useRestaurantData';
import { useTranslation } from 'react-i18next';

const Field = ({ label, children }) => (
  <label className="block mb-3">
    <span className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">{label}</span>
    {children}
  </label>
);

const numberOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const LocationModal = ({ location, isOpen, onClose, appState }) => {
  const { t } = useTranslation();
  const { updateLocation, uploadLocationPhotos, actionLoading, actionError } = useRestaurantData(appState);
  const [form, setForm] = useState({
    capacidad_personas: '',
    cantidad_mesas: '',
    cantidad_sillas: '',
    descripcion: '',
  });
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const loading = actionLoading.updateLocation || actionLoading.uploadPhotos;

  useEffect(() => {
    if (isOpen && location) {
      setForm({
        capacidad_personas: location.capacidad_personas ?? '',
        cantidad_mesas: location.cantidad_mesas ?? '',
        cantidad_sillas: location.cantidad_sillas ?? '',
        descripcion: location.descripcion ?? '',
      });
      setFiles([]);
    }
  }, [isOpen, location]);

  const locationId = useMemo(
    () => (location ? String(location._id ?? location.id) : null),
    [location]
  );

  if (!isOpen || !location) return null;

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!locationId) return;

    const payload = {
      capacidad_personas: numberOrNull(form.capacidad_personas),
      cantidad_mesas: numberOrNull(form.cantidad_mesas),
      cantidad_sillas: numberOrNull(form.cantidad_sillas),
      descripcion: form.descripcion || null,
    };

    // Limpia nulls para no sobreescribir
    Object.keys(payload).forEach((k) => payload[k] === null && delete payload[k]);

    const updated = await updateLocation({ locationId, data: payload });

    if (updated && files.length > 0) {
      await uploadLocationPhotos({ locationId, files });
    }

    // Si no hubo error, cerrar
    if (!actionError.updateLocation && !actionError.uploadPhotos) {
      onClose?.();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative bg-gradient-to-br from-light-background/95 to-light-surface/95 dark:from-dark-surface/90 dark:to-dark-background/95 rounded-3xl p-6 sm:p-8 max-w-xs sm:max-w-md md:max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-light-border dark:border-dark-border"
        style={{ backdropFilter: 'blur(16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
          aria-label={t('location.modal.close')}
          disabled={loading}
        >
          <FaTimes className="w-5 sm:w-6 h-5 sm:h-6" />
        </button>

        <h3 className="text-xl sm:text-2xl font-futurist text-piccola-light-text-primary dark:text-piccola-white mb-4 text-center">
          {t('location.modal.editTitle', { name: location.nombre })}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={t('location.modal.capacity')}>
            <input
              type="number"
              min="0"
              value={form.capacidad_personas}
              onChange={handleChange('capacidad_personas')}
              className="w-full rounded-xl px-3 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition"
              placeholder={t('location.modal.capacityPlaceholder')}
            />
          </Field>
          <Field label={t('location.modal.tables')}>
            <input
              type="number"
              min="0"
              value={form.cantidad_mesas}
              onChange={handleChange('cantidad_mesas')}
              className="w-full rounded-xl px-3 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition"
              placeholder={t('location.modal.tablesPlaceholder')}
            />
          </Field>
          <Field label={t('location.modal.chairs')}>
            <input
              type="number"
              min="0"
              value={form.cantidad_sillas}
              onChange={handleChange('cantidad_sillas')}
              className="w-full rounded-xl px-3 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition"
              placeholder={t('location.modal.chairsPlaceholder')}
            />
          </Field>
        </div>

        <Field label={t('location.modal.description')}>
          <textarea
            rows={4}
            value={form.descripcion}
            onChange={handleChange('descripcion')}
            className="w-full rounded-xl px-3 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-light-accent dark:focus:border-dark-accent transition resize-y"
            placeholder={t('location.modal.notesPlaceholder')}
          />
        </Field>

        <div className="mb-4">
          <span className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {t('location.modal.currentPhotos')}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(location.media_urls || []).map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`media-${idx}`}
                className="w-full h-20 object-cover rounded-lg border border-light-border/50 dark:border-dark-border/50"
              />
            ))}
            {(location.media_urls || []).length === 0 && (
              <div className="col-span-3 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {t('location.modal.noPhotos')}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <span className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {t('location.modal.uploadPhotos')}
          </span>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="hidden"
              disabled={loading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary rounded-lg border border-light-border/50 dark:border-dark-border/50 hover:border-light-accent dark:hover:border-dark-accent transition"
            >
              <FaUpload className="w-4 h-4 mr-2" />
              {t('location.modal.selectFiles')}
            </button>
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              {files.length > 0
                ? t('location.modal.filesSelected', { count: files.length })
                : t('location.modal.noneSelected')}
            </span>
          </div>
        </div>

        {(actionError.updateLocation || actionError.uploadPhotos) && (
          <div className="mb-4 text-sm text-light-error dark:text-dark-error">
            {actionError.updateLocation || actionError.uploadPhotos}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-2 px-3 bg-light-accent/90 dark:bg-dark-accent/90 text-piccola-white rounded-lg hover:bg-light-accent dark:hover:bg-dark-accent transition-all duration-300 inline-flex items-center justify-center"
        >
          <FaSave className="mr-2 w-4 h-4" />
          {loading ? t('location.modal.saving') : t('location.modal.saveChanges')}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default LocationModal;
