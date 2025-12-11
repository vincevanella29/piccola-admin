// src/components/promotions/sections/rules/DateSection.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  XCircleIcon, 
  PlusCircleIcon, 
  NoSymbolIcon,
  CakeIcon
} from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';

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

  // --- Styles for Portal Select (Z-Index Fix) ---
  const portalStyles = {
    ...customSelectStyles,
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  // --- Handlers ---
  const handleDayModeChange = (mode) => {
    setDayMode(mode);
    if (mode === 'all') {
      handleSelectChange([], section, 'days');
    }
  };

  const handleTimeModeChange = (mode) => {
    setTimeMode(mode);
    if (mode === 'all') {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], from_time: '', to_time: '' },
      }));
    } else {
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

  // Helper for Input Classes
  const inputClass = "w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClass = "block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5";

  return (
    <section className="max-w-4xl mx-auto mt-6 space-y-6">
      <h3 className="text-xl font-futurist text-neutral-900 dark:text-white px-1 flex items-center gap-2">
        <CalendarDaysIcon className="h-6 w-6 text-matrix-green" />
        {t(`admin.promotions.${section}_dates`)}
      </h3>

      {/* CARD 1: MAIN TIMING CONFIGURATION */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-visible p-6">
        
        {/* CASE A: DISPLAY or CLAIM (Simple Start/End) */}
        {section !== 'redeem' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>
                {t(`admin.promotions.${section}_start`)} <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name={`${section}.start`}
                value={formData[section].start}
                onChange={(e) => handleChange(e, section, 'start')}
                className={inputClass}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t(`admin.promotions.${section}_end`)} <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                name={`${section}.end`}
                value={formData[section].end}
                onChange={(e) => handleChange(e, section, 'end')}
                className={inputClass}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {/* CASE B: REDEEM (Complex Validity) */}
        {section === 'redeem' && (
          <div className="space-y-6">
            {/* Birthday Toggle Row */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-vanellix-purple/10 rounded-lg text-vanellix-purple">
                  <CakeIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white block">
                    {t('admin.promotions.is_birthday_coupon')}
                  </span>
                  <span className="text-xs text-neutral-500 block">
                    La validez dependerá del cumpleaños del usuario
                  </span>
                </div>
              </div>
              <Switch
                checked={isBirthdayCoupon}
                onChange={handleBirthdayToggle}
                disabled={isLoading}
                className={`${
                  isBirthdayCoupon ? 'bg-matrix-green' : 'bg-neutral-200 dark:bg-neutral-700'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-matrix-green/50`}
              >
                <span className={`${isBirthdayCoupon ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </Switch>
            </div>

            <AnimatePresence mode="wait">
              {isBirthdayCoupon ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <label className={labelClass}>
                    {t('admin.promotions.birthday_validity_days')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name={`${section}.birthday_validity_days`}
                      value={formData[section].birthday_validity_days}
                      onChange={(e) => handleChange(e, section, 'birthday_validity_days')}
                      min="0"
                      className={`${inputClass} pl-4 pr-12`}
                      disabled={isLoading}
                    />
                    <span className="absolute right-4 top-2.5 text-sm text-neutral-400">Días</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    {t('admin.promotions.birthday_validity_days_note')}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  className="space-y-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <div>
                    <label className={labelClass}>
                      {t('admin.promotions.validity')}
                    </label>
                    <select
                      name={`${section}.validity`}
                      value={formData[section].validity}
                      onChange={(e) => handleValidityChange(e, section)}
                      className={inputClass}
                      disabled={isLoading}
                    >
                      {validityTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(formData.redeem.validity === 'fixed' || formData.redeem.validity === 'period') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl border border-neutral-200 dark:border-neutral-700 border-dashed">
                      <div>
                        <label className={labelClass}>
                          {t('admin.promotions.valid_from')}
                        </label>
                        <input
                          type="datetime-local"
                          name={`${section}.valid_from`}
                          value={formData[section].valid_from}
                          onChange={(e) => handleChange(e, section, 'valid_from')}
                          className={inputClass}
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          {t('admin.promotions.valid_until')}
                        </label>
                        <input
                          type="datetime-local"
                          name={`${section}.valid_until`}
                          value={formData[section].valid_until}
                          onChange={(e) => handleChange(e, section, 'valid_until')}
                          className={inputClass}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* CARD 2: RESTRICTIONS (Days & Hours) */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-visible">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
           <h4 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
             <ClockIcon className="h-4 w-4 text-neutral-500" />
             Restricciones de Horario y Días
           </h4>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Days Selection */}
          <div>
            <label className={labelClass}>Días Permitidos</label>
            <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-4">
              {['all', 'specific'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleDayModeChange(mode)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    dayMode === mode
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {mode === 'all' ? t('admin.promotions.all_days') : t('admin.promotions.specific_days')}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {dayMode === 'specific' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-visible" // Important for Select
                >
                  <Select
                    isMulti
                    options={weekdays}
                    value={weekdays.filter((day) => formData[section].days.includes(day.value))}
                    onChange={(selected) => handleSelectChange(selected, section, 'days')}
                    styles={portalStyles}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    isDisabled={isLoading}
                    placeholder="Selecciona los días..."
                    className="text-sm"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hours Selection */}
          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <label className={labelClass}>Horario Permitido</label>
            <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-4">
              {['all', 'specific'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleTimeModeChange(mode)}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    timeMode === mode
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {mode === 'all' ? t('admin.promotions.all_hours') : t('admin.promotions.specific_hours')}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {timeMode === 'specific' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-neutral-500 mb-1 block">{t('admin.promotions.from_time')}</label>
                      <input
                        type="time"
                        name={`${section}.from_time`}
                        value={formData[section].from_time}
                        onChange={(e) => handleChange(e, section, 'from_time')}
                        className={inputClass}
                        disabled={isLoading}
                      />
                    </div>
                    <span className="text-neutral-300 mt-5">-</span>
                    <div className="flex-1">
                      <label className="text-xs text-neutral-500 mb-1 block">{t('admin.promotions.to_time')}</label>
                      <input
                        type="time"
                        name={`${section}.to_time`}
                        value={formData[section].to_time}
                        onChange={(e) => handleChange(e, section, 'to_time')}
                        className={inputClass}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* CARD 3: EXCLUDED DATES */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <NoSymbolIcon className="h-4 w-4 text-red-500" />
              {t('admin.promotions.excluded_dates')}
            </h4>
            <button
              type="button"
              onClick={() => addExcludedDate(setFormData, section)}
              className="text-xs font-medium text-matrix-green hover:text-green-400 flex items-center gap-1 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              <PlusCircleIcon className="h-4 w-4" />
              Añadir Fecha
            </button>
        </div>
        
        <div className="p-2 bg-neutral-50 dark:bg-neutral-800/20 min-h-[80px]">
           {formData[section].excluded_dates.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center py-6 text-neutral-400">
                <span className="text-xs">No hay fechas excluidas</span>
             </div>
           ) : (
             <div className="space-y-2">
               <AnimatePresence>
                  {formData[section].excluded_dates.map((date, index) => (
                    <motion.div
                      key={`${section}-excluded-date-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-2 bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm"
                    >
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => updateExcludedDate(setFormData, section, index, e.target.value)}
                        className="flex-1 bg-transparent border-none text-sm text-neutral-900 dark:text-white focus:ring-0 p-0"
                        disabled={isLoading}
                      />
                      <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700 mx-1"></div>
                      <button
                        type="button"
                        onClick={() => removeExcludedDate(index)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                        disabled={isLoading}
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    </motion.div>
                  ))}
               </AnimatePresence>
             </div>
           )}
        </div>
      </div>
    </section>
  );
};

export default DateSection;