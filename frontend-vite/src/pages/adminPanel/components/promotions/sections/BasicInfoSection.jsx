import React, { useRef, useEffect } from 'react';

const BasicInfoSection = ({ formData, handleChange, isLoading, t }) => {
  // Auto-resize refs for name and description
  const nameInputRef = useRef(null);
  const descriptionInputRef = useRef(null);

  // Auto-resize effect for name
  useEffect(() => {
    const textarea = nameInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [formData.name]);

  // Auto-resize effect for description
  useEffect(() => {
    const textarea = descriptionInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [formData.description]);

  return (
    <section className="p-6 bg-gradient-to-br from-light-surface/80 dark:from-dark-surface/80 to-light-surface/50 dark:to-dark-surface/50 rounded-2xl shadow-lg border border-light-border/20 dark:border-dark-border/20">
      <h3 className="text-2xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-6 flex items-center gap-3">
        {t('admin.promotions.basic_info')}
      </h3>
      <div className="space-y-6">
        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
            {t('admin.promotions.name')}
            <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
          </label>
          <input
            ref={nameInputRef}
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('admin.promotions.name_placeholder')}
            className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50 resize-none"
            disabled={isLoading}
            rows={1}
          />
        </div>

        {/* Description Field */}
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
            {t('admin.promotions.description')}
            <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
          </label>
          <textarea
            ref={descriptionInputRef}
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t('admin.promotions.description_placeholder')}
            className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50 resize-none min-h-[100px]"
            disabled={isLoading}
            rows={3}
          />
        </div>
      </div>
    </section>
  );
};

export default BasicInfoSection;