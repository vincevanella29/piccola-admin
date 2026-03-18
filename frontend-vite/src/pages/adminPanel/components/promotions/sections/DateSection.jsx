import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import { Switch } from '@headlessui/react';
import {
  CalendarDaysIcon,
  ClockIcon,
  XCircleIcon,
  PlusCircleIcon,
  NoSymbolIcon,
  CakeIcon,
  ArrowRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 ' +
  'border border-light-border/60 dark:border-dark-border/60 rounded-xl text-sm ' +
  'text-light-text-primary dark:text-dark-text-primary ' +
  'focus:outline-none focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green/50 ' +
  'transition-all disabled:opacity-40 disabled:cursor-not-allowed';

const Field = ({ label, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
      {label}{required && <span className="text-vanellix-purple ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

// ─── Compact date range display ───────────────────────────────────────────────

const DateRangeRow = ({ startLabel, endLabel, startName, endName, startValue, endValue, onStartChange, onEndChange, isLoading }) => (
  <div className="flex items-end gap-2">
    <div className="flex-1">
      <Field label={startLabel} required>
        <input
          type="datetime-local"
          name={startName}
          value={startValue}
          onChange={onStartChange}
          className={inputClass}
          disabled={isLoading}
        />
      </Field>
    </div>
    <div className="flex items-center pb-2.5 shrink-0">
      <ArrowRightIcon className="h-4 w-4 text-light-text-secondary/40 dark:text-dark-text-secondary/40" />
    </div>
    <div className="flex-1">
      <Field label={endLabel} required>
        <input
          type="datetime-local"
          name={endName}
          value={endValue}
          onChange={onEndChange}
          className={inputClass}
          disabled={isLoading}
        />
      </Field>
    </div>
  </div>
);

// ─── SegmentedControl ─────────────────────────────────────────────────────────

const SegmentedControl = ({ options, value, onChange, disabled }) => (
  <div className="inline-flex p-0.5 bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 rounded-xl border border-light-border/40 dark:border-dark-border/40">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(opt.value)}
        className={`px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
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

// ─── Collapsible card section ─────────────────────────────────────────────────

const SectionCard = ({ icon: Icon, title, action, children, defaultOpen = false, accent }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface dark:bg-dark-surface overflow-hidden">
      {/* Header row: toggle area + optional action button (kept outside <button> to avoid nesting) */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex-1 flex items-center gap-2.5 px-4 py-3 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition-colors text-left"
        >
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${accent ?? 'bg-matrix-green/10'}`}>
            <Icon className={`h-3.5 w-3.5 ${accent ? 'text-vanellix-purple' : 'text-matrix-green'}`} />
          </div>
          <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
            {title}
          </span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-auto">
            <ChevronDownIcon className="h-4 w-4 text-light-text-secondary dark:text-dark-text-secondary" />
          </motion.div>
        </button>
        {/* Action (e.g. "+ Add date") lives outside the toggle button */}
        {action && (
          <div className="pr-3 shrink-0">
            {action}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-visible"
          >
            <div className="px-4 pb-4 pt-1 border-t border-light-border/40 dark:border-dark-border/40 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [dayMode, setDayMode] = useState(
    formData[section].days.length === 0 ? 'all' : 'specific'
  );
  const [timeMode, setTimeMode] = useState(
    formData[section].from_time === '' && formData[section].to_time === '' ? 'all' : 'specific'
  );

  const portalStyles = {
    ...customSelectStyles,
    menuPortal: base => ({ ...base, zIndex: 9999 }),
  };

  const handleDayModeChange = mode => {
    setDayMode(mode);
    if (mode === 'all') handleSelectChange([], section, 'days');
  };

  const handleTimeModeChange = mode => {
    setTimeMode(mode);
    if (mode === 'all') {
      setFormData(prev => ({
        ...prev,
        [section]: { ...prev[section], from_time: '', to_time: '' },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          from_time: prev[section].from_time || '09:00:00',
          to_time: prev[section].to_time || '23:00:00',
        },
      }));
    }
  };

  const data = formData[section];

  return (
    <div className="space-y-3">

      {/* ── MAIN TIMING ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface dark:bg-dark-surface p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-matrix-green" />
          <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
            {t(`admin.promotions.${section}_dates`)}
          </span>
        </div>

        {/* DISPLAY / CLAIM: compact start → end row */}
        {section !== 'redeem' && (
          <DateRangeRow
            startLabel={t(`admin.promotions.${section}_start`)}
            endLabel={t(`admin.promotions.${section}_end`)}
            startName={`${section}.start`}
            endName={`${section}.end`}
            startValue={data.start}
            endValue={data.end}
            onStartChange={e => handleChange(e, section, 'start')}
            onEndChange={e => handleChange(e, section, 'end')}
            isLoading={isLoading}
          />
        )}

        {/* REDEEM: validity type + optional date range */}
        {section === 'redeem' && (
          <div className="space-y-4">

            {/* Birthday toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-vanellix-purple/10 flex items-center justify-center">
                  <CakeIcon className="h-3.5 w-3.5 text-vanellix-purple" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-none">
                    {t('admin.promotions.is_birthday_coupon')}
                  </p>
                  <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                    {t('admin.promotions.birthday_validity_days_note')}
                  </p>
                </div>
              </div>
              <Switch
                checked={isBirthdayCoupon}
                onChange={handleBirthdayToggle}
                disabled={isLoading}
                className={`${isBirthdayCoupon ? 'bg-matrix-green' : 'bg-light-border dark:bg-dark-border'} relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none`}
              >
                <span className={`${isBirthdayCoupon ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 mt-1 transform rounded-full bg-white transition-transform shadow-sm`} />
              </Switch>
            </div>

            <AnimatePresence mode="wait">
              {isBirthdayCoupon ? (
                <motion.div key="bday" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Field label={t('admin.promotions.birthday_validity_days')}>
                    <div className="relative">
                      <input
                        type="number"
                        name={`${section}.birthday_validity_days`}
                        value={data.birthday_validity_days}
                        onChange={e => handleChange(e, section, 'birthday_validity_days')}
                        min="0"
                        className={`${inputClass} pr-12`}
                        disabled={isLoading}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                        {t('admin.loading') ? 'días' : 'días'}
                      </span>
                    </div>
                  </Field>
                </motion.div>
              ) : (
                <motion.div key="validity" className="space-y-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                  <Field label={t('admin.promotions.validity')}>
                    <select
                      name={`${section}.validity`}
                      value={data.validity}
                      onChange={e => handleValidityChange(e, section)}
                      className={inputClass}
                      disabled={isLoading}
                    >
                      {validityTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </Field>

                  <AnimatePresence>
                    {(data.validity === 'fixed' || data.validity === 'period') && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1">
                          <DateRangeRow
                            startLabel={t('admin.promotions.valid_from')}
                            endLabel={t('admin.promotions.valid_until')}
                            startName={`${section}.valid_from`}
                            endName={`${section}.valid_until`}
                            startValue={data.valid_from}
                            endValue={data.valid_until}
                            onStartChange={e => handleChange(e, section, 'valid_from')}
                            onEndChange={e => handleChange(e, section, 'valid_until')}
                            isLoading={isLoading}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── SCHEDULE RESTRICTIONS (collapsible) ──────────────────────────── */}
      <SectionCard
        icon={ClockIcon}
        title={t('promotion.all_hours') ? 'Horario y Días' : 'Schedule & Days'}
      >
        {/* Days */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              {t('admin.promotions.all_days')}
            </span>
            <SegmentedControl
              options={[
                { value: 'all', label: t('admin.promotions.all_days') },
                { value: 'specific', label: t('admin.promotions.specific_days') },
              ]}
              value={dayMode}
              onChange={handleDayModeChange}
              disabled={isLoading}
            />
          </div>
          <AnimatePresence>
            {dayMode === 'specific' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-visible"
              >
                <Select
                  isMulti
                  options={weekdays}
                  value={weekdays.filter(d => data.days.includes(d.value))}
                  onChange={selected => handleSelectChange(selected, section, 'days')}
                  styles={portalStyles}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  isDisabled={isLoading}
                  placeholder={t('admin.promotions.specific_days') + '...'}
                  className="text-sm"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hours */}
        <div className="space-y-2 pt-3 border-t border-light-border/40 dark:border-dark-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
              {t('admin.promotions.all_hours')}
            </span>
            <SegmentedControl
              options={[
                { value: 'all', label: t('admin.promotions.all_hours') },
                { value: 'specific', label: t('admin.promotions.specific_hours') },
              ]}
              value={timeMode}
              onChange={handleTimeModeChange}
              disabled={isLoading}
            />
          </div>
          <AnimatePresence>
            {timeMode === 'specific' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-end gap-2 pt-1">
                  <div className="flex-1">
                    <Field label={t('promotion.from_time')}>
                      <input type="time" name={`${section}.from_time`} value={data.from_time} onChange={e => handleChange(e, section, 'from_time')} className={inputClass} disabled={isLoading} />
                    </Field>
                  </div>
                  <div className="pb-2.5 shrink-0">
                    <ArrowRightIcon className="h-4 w-4 text-light-text-secondary/40 dark:text-dark-text-secondary/40" />
                  </div>
                  <div className="flex-1">
                    <Field label={t('promotion.to_time')}>
                      <input type="time" name={`${section}.to_time`} value={data.to_time} onChange={e => handleChange(e, section, 'to_time')} className={inputClass} disabled={isLoading} />
                    </Field>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      {/* ── EXCLUDED DATES (collapsible) ─────────────────────────────────── */}
      <SectionCard
        icon={NoSymbolIcon}
        title={t('admin.promotions.excluded_dates')}
        accent="bg-vanellix-purple/10"
        action={
          <button
            type="button"
            onClick={() => addExcludedDate(setFormData, section)}
            disabled={isLoading}
            className="flex items-center gap-1 text-[11px] font-semibold text-matrix-green hover:text-matrix-green/80 transition-colors disabled:opacity-40"
          >
            <PlusCircleIcon className="h-3.5 w-3.5" />
            {t('admin.promotions.add_excluded_date')}
          </button>
        }
      >
        {data.excluded_dates.length === 0 ? (
          <p className="text-xs text-center text-light-text-secondary dark:text-dark-text-secondary py-4">
            {t('admin.promotions.excluded_dates_tooltip')}
          </p>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence>
              {data.excluded_dates.map((date, idx) => (
                <motion.div
                  key={`${section}-excl-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-2 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-3 py-2 rounded-xl border border-light-border/40 dark:border-dark-border/40"
                >
                  <CalendarDaysIcon className="h-3.5 w-3.5 text-vanellix-purple shrink-0" />
                  <input
                    type="date"
                    value={date}
                    onChange={e => updateExcludedDate(setFormData, section, idx, e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm text-light-text-primary dark:text-dark-text-primary focus:ring-0 p-0 min-w-0"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => removeExcludedDate(idx)}
                    disabled={isLoading}
                    className="text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:text-vanellix-purple transition-colors"
                  >
                    <XCircleIcon className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </SectionCard>

    </div>
  );
};

export default DateSection;