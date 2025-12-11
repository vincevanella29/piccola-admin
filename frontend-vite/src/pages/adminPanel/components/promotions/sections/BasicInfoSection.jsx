// src/components/promotions/sections/rules/BasicInfoSection.jsx
import React, { useRef, useEffect } from 'react';
import { 
  InformationCircleIcon, 
  PencilSquareIcon, 
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const BasicInfoSection = ({ formData, handleChange, isLoading, t }) => {
  // Ref solo para la descripción, ya que el nombre suele ser una línea
  const descriptionInputRef = useRef(null);

  // Auto-resize effect for description
  useEffect(() => {
    const textarea = descriptionInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [formData.description]);

  // Estilos compartidos
  const labelClass = "block text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-2";
  const inputBaseClass = "w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <section className="max-w-4xl mx-auto mt-6">
      <h3 className="text-xl font-futurist text-neutral-900 dark:text-white px-1 mb-4 flex items-center gap-2">
        <InformationCircleIcon className="h-6 w-6 text-matrix-green" />
        {t('admin.promotions.basic_info')}
      </h3>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 space-y-8">
        
        {/* Name Field */}
        <div>
          <label className={labelClass}>
            <PencilSquareIcon className="h-4 w-4" />
            {t('admin.promotions.name')}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('admin.promotions.name_placeholder')}
              className={`${inputBaseClass} p-4 text-lg font-medium`}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Este nombre será visible para los usuarios en la aplicación.
          </p>
        </div>

        {/* Description Field */}
        <div>
          <label className={labelClass}>
            <DocumentTextIcon className="h-4 w-4" />
            {t('admin.promotions.description')}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative">
            <textarea
              ref={descriptionInputRef}
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={t('admin.promotions.description_placeholder')}
              className={`${inputBaseClass} p-4 min-h-[120px] resize-none leading-relaxed`}
              disabled={isLoading}
              rows={3}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 flex justify-between">
            <span>Describe los detalles, condiciones y beneficios.</span>
            <span>{formData.description.length} caracteres</span>
          </p>
        </div>

      </div>
    </section>
  );
};

export default BasicInfoSection;