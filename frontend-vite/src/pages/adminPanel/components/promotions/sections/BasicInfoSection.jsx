import React, { useRef, useEffect } from 'react';
import { PencilSquareIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const inputBaseClass =
  'w-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 ' +
  'border border-light-border/60 dark:border-dark-border/60 rounded-xl ' +
  'text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary/40 dark:placeholder-dark-text-secondary/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green/50 ' +
  'transition-all disabled:opacity-40 disabled:cursor-not-allowed';

const BasicInfoSection = ({ formData, handleChange, isLoading, t }) => {
  const descriptionRef = useRef(null);

  useEffect(() => {
    const ta = descriptionRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
  }, [formData.description]);

  const charCount = formData.description?.length ?? 0;

  return (
    <div className="space-y-4">

      {/* Name */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
          <PencilSquareIcon className="h-3.5 w-3.5" />
          {t('admin.promotions.name')}
          <span className="text-vanellix-purple">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder={t('admin.promotions.name_placeholder')}
          className={`${inputBaseClass} px-4 py-3 text-base font-medium`}
          disabled={isLoading}
          autoComplete="off"
        />
        <p className="text-[11px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 pl-1">
          {t('admin.promotions.name_tooltip')}
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
          <DocumentTextIcon className="h-3.5 w-3.5" />
          {t('admin.promotions.descriptions')}
          <span className="text-vanellix-purple">*</span>
        </label>
        <textarea
          ref={descriptionRef}
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder={t('admin.promotions.description_placeholder')}
          className={`${inputBaseClass} px-4 py-3 min-h-[100px] resize-none leading-relaxed`}
          disabled={isLoading}
          rows={3}
        />
        <div className="flex justify-between items-center pl-1">
          <p className="text-[11px] text-light-text-secondary/60 dark:text-dark-text-secondary/60">
            {t('admin.promotions.description_tooltip')}
          </p>
          <span className={`text-[11px] font-mono tabular-nums ${charCount > 200 ? 'text-vanellix-purple' : 'text-light-text-secondary/50 dark:text-dark-text-secondary/50'}`}>
            {charCount}
          </span>
        </div>
      </div>

    </div>
  );
};

export default BasicInfoSection;