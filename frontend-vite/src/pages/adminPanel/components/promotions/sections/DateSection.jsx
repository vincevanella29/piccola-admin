import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { XCircleIcon, PlusCircleIcon } from '@heroicons/react/24/solid';

const DateSection = ({
  section,
  formData,
  handleChange,
  handleSelectChange,
  handleValidityChange,
  addExcludedDate,
  removeExcludedDate,
  updateExcludedDate,
  isLoading,
  t,
  customSelectStyles,
  weekdays,
  validityTypes,
  isBirthdayCoupon,
  handleBirthdayToggle,
  setFormData,
}) => {
  // State for day and time selection modes
  const [dayMode, setDayMode] = useState(formData[section].days.length === 0 ? 'all' : 'specific');
  const [timeMode, setTimeMode] = useState(
    formData[section].from_time === '' && formData[section].to_time === '' ? 'all' : 'specific'
  );

  // Handle day mode change
  const handleDayModeChange = (mode) => {
    setDayMode(mode);
    if (mode === 'all') {
      handleSelectChange([], section, 'days');
    }
  };

  // Handle time mode change
  const handleTimeModeChange = (mode) => {
    setTimeMode(mode);
    if (mode === 'all') {
      // Clear time fields
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          from_time: '',
          to_time: '',
        },
      }));
    } else {
      // Restore default times if previously cleared
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          from_time: prev[section].from_time || '09:00:00',
          to_time: prev[section].to_time || '23:00:00',
        },
      }));
    }
  };

  return (
    <section className="p-6 bg-gradient-to-br from-light-surface/80 dark:from-dark-surface/80 to-light-surface/50 dark:to-dark-surface/50 rounded-2xl shadow-lg border border-light-border/20 dark:border-dark-border/20">
      <h3 className="text-2xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-6 flex items-center gap-3">
        {t(`admin.promotions.${section}_dates`)}
      </h3>
      <div className="space-y-8">
        {/* Date Inputs for display and claim */}
        {section !== 'redeem' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                {t(`admin.promotions.${section}_start`)}
                <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
              </label>
              <input
                type="datetime-local"
                name={`${section}.start`}
                value={formData[section].start}
                onChange={(e) => handleChange(e, section, 'start')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                {t(`admin.promotions.${section}_end`)}
                <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
              </label>
              <input
                type="datetime-local"
                name={`${section}.end`}
                value={formData[section].end}
                onChange={(e) => handleChange(e, section, 'end')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* Redeem: Validity Type and Birthday Toggle */}
        {section === 'redeem' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                checked={isBirthdayCoupon}
                onChange={handleBirthdayToggle}
                className="w-4 h-4 text-matrix-green bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border-light-border/40 dark:border-dark-border/40 rounded focus:ring-light-accent dark:focus:ring-dark-accent disabled:opacity-50"
                disabled={isLoading}
              />
              <label className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                {t('admin.promotions.is_birthday_coupon')}
              </label>
              <span className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                (Próximamente: Basado en perfil de usuario)
              </span>
            </div>
            {!isBirthdayCoupon && (
              <div>
                <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('admin.promotions.validity')}
                  <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
                </label>
                <select
                  name={`${section}.validity`}
                  value={formData[section].validity}
                  onChange={(e) => handleValidityChange(e, section)}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                  disabled={isLoading}
                >
                  {validityTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {(formData.redeem.validity === 'fixed' || formData.redeem.validity === 'period') && !isBirthdayCoupon && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                    {t('admin.promotions.valid_from')}
                    <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
                  </label>
                  <input
                    type="datetime-local"
                    name={`${section}.valid_from`}
                    value={formData[section].valid_from}
                    onChange={(e) => handleChange(e, section, 'valid_from')}
                    className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                    {t('admin.promotions.valid_until')}
                    <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
                  </label>
                  <input
                    type="datetime-local"
                    name={`${section}.valid_until`}
                    value={formData[section].valid_until}
                    onChange={(e) => handleChange(e, section, 'valid_until')}
                    className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}
            {isBirthdayCoupon && (
              <div>
                <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
                  {t('admin.promotions.birthday_validity_days')}
                  <span className="text-matrix-green text-xs">({t('admin.promotions.required')})</span>
                </label>
                <input
                  type="number"
                  name={`${section}.birthday_validity_days`}
                  value={formData[section].birthday_validity_days}
                  onChange={(e) => handleChange(e, section, 'birthday_validity_days')}
                  min="0"
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                  disabled={isLoading}
                />
                <p className="text-xs text-light-text-secondary/60 dark:text-dark-text-secondary/60 mt-1">
                  {t('admin.promotions.birthday_validity_days_note')}
                </p>
              </div>
            )}
          </>
        )}

        {/* Day and Time Restrictions */}
        <div className="space-y-4">
          {/* Days Radio Buttons */}
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${section}.dayMode`}
                value="all"
                checked={dayMode === 'all'}
                onChange={() => handleDayModeChange('all')}
                disabled={isLoading}
                className="h-5 w-5 text-matrix-green focus:ring-matrix-green border-light-border dark:border-dark-border"
              />
              <span className="text-light-text-primary dark:text-dark-text-primary">
                {t('admin.promotions.all_days')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${section}.dayMode`}
                value="specific"
                checked={dayMode === 'specific'}
                onChange={() => handleDayModeChange('specific')}
                disabled={isLoading}
                className="h-5 w-5 text-matrix-green focus:ring-matrix-green border-light-border dark:border-dark-border"
              />
              <span className="text-light-text-primary dark:text-dark-text-primary">
                {t('admin.promotions.specific_days')}
              </span>
            </label>
          </div>

          {/* Specific Days Dropdown */}
          <AnimatePresence>
            {dayMode === 'specific' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('admin.promotions.valid_days')}
                </label>
                <Select
                  isMulti
                  options={weekdays}
                  value={weekdays.filter((day) => formData[section].days.includes(day.value))}
                  onChange={(selected) => handleSelectChange(selected, section, 'days')}
                  styles={customSelectStyles}
                  isDisabled={isLoading}
                  placeholder={t('admin.promotions.select_menu')}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hours Radio Buttons */}
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${section}.timeMode`}
                value="all"
                checked={timeMode === 'all'}
                onChange={() => handleTimeModeChange('all')}
                disabled={isLoading}
                className="h-5 w-5 text-matrix-green focus:ring-matrix-green border-light-border dark:border-dark-border"
              />
              <span className="text-light-text-primary dark:text-dark-text-primary">
                {t('admin.promotions.all_hours')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`${section}.timeMode`}
                value="specific"
                checked={timeMode === 'specific'}
                onChange={() => handleTimeModeChange('specific')}
                disabled={isLoading}
                className="h-5 w-5 text-matrix-green focus:ring-matrix-green border-light-border dark:border-dark-border"
              />
              <span className="text-light-text-primary dark:text-dark-text-primary">
                {t('admin.promotions.specific_hours')}
              </span>
            </label>
          </div>

          {/* Specific Hours Inputs */}
          <AnimatePresence>
            {timeMode === 'specific' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
                      {t('admin.promotions.from_time')}
                    </label>
                    <input
                      type="time"
                      name={`${section}.from_time`}
                      value={formData[section].from_time}
                      onChange={(e) => handleChange(e, section, 'from_time')}
                      className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
                      {t('admin.promotions.to_time')}
                    </label>
                    <input
                      type="time"
                      name={`${section}.to_time`}
                      value={formData[section].to_time}
                      onChange={(e) => handleChange(e, section, 'to_time')}
                      className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Excluded Dates */}
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.excluded_dates')}
          </label>
          <AnimatePresence>
            {formData[section].excluded_dates.map((date, index) => (
              <motion.div
                key={`${section}-excluded-date-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 mb-2"
              >
                <input
                  type="date"
                  value={date}
                  onChange={(e) => updateExcludedDate(setFormData, section, index, e.target.value)}
                  className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => removeExcludedDate(index)}
                  className="p-2 bg-light-error/20 dark:bg-dark-error/20 hover:bg-red-600/30 rounded-full transition-all disabled:opacity-50"
                  disabled={isLoading}
                >
                  <XCircleIcon className="h-5 w-5 text-light-error dark:text-dark-error" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => addExcludedDate(setFormData, section)}
            className="mt-2 flex items-center gap-2 text-matrix-green hover:text-green-300 transition-all disabled:opacity-50"
            disabled={isLoading}
          >
            <PlusCircleIcon className="h-5 w-5" />
            {t('admin.promotions.add_excluded_date')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default DateSection;