// src/components/promotions/PromotionForm.jsx
import React, { useState, useMemo } from 'react';
import { Switch } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/solid';
import {
  InformationCircleIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  TagIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

import {
  BasicInfoSection,
  PromotionTypeSection,
  LocationsSection,
  DateSection,
  TokenRuleSection,
  LimitsSection,
} from './sections';
import { RulesSection, JobPositionRuleSection } from './sections/rules';

import {
  initialFormData,
  handleChange,
  handleSelectChange,
  addExcludedDate,
  removeExcludedDate,
  handleBirthdayToggle,
  handleValidityChange,
  validateForm,
  preparePromotionData,
  updateExcludedDate,
  customSelectStyles,
} from './PromotionFormUtils';

// ─── Primitive: pill badge ────────────────────────────────────────────────────
const StatusPill = ({ isComplete }) =>
  isComplete ? (
    <CheckCircleIcon className="h-5 w-5 text-matrix-green shrink-0" />
  ) : (
    <div className="h-4 w-4 rounded-full border-2 border-light-border/40 dark:border-dark-border/40 shrink-0" />
  );

// ─── Accordion ────────────────────────────────────────────────────────────────
const Accordion = ({ title, subtitle, children, isOpen, toggleOpen, isComplete, isLocked = false, icon: Icon }) => (
  <div
    className={`
      rounded-2xl border transition-all duration-300
      ${isOpen
        ? 'bg-light-surface dark:bg-dark-surface border-matrix-green/40 shadow-md shadow-matrix-green/5'
        : 'bg-light-surface dark:bg-dark-surface border-light-border/30 dark:border-dark-border/30 hover:border-light-border/60 dark:hover:border-dark-border/60'
      }
      ${isLocked ? 'opacity-50 pointer-events-none' : ''}
    `}
  >
    <button
      onClick={toggleOpen}
      disabled={isLocked}
      className="w-full px-5 py-4 flex justify-between items-center text-left focus:outline-none"
    >
      <div className="flex items-center gap-3 min-w-0">
        <StatusPill isComplete={isComplete} />
        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-matrix-green/10' : 'bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60'}`}>
            <Icon className={`h-4 w-4 ${isOpen ? 'text-matrix-green' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
          </div>
        )}
        <div className="min-w-0">
          <span className={`text-sm font-bold tracking-tight truncate block ${isOpen ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-light-text-secondary/60 dark:text-dark-text-secondary/60 truncate block">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.25, ease: 'circOut' }}
        className={`shrink-0 ml-3 ${isOpen ? 'text-matrix-green' : 'text-light-text-secondary/40 dark:text-dark-text-secondary/40'}`}
      >
        <ChevronDownIcon className="h-5 w-5" />
      </motion.div>
    </button>

    <motion.div
      initial={false}
      animate={isOpen ? 'open' : 'closed'}
      variants={{
        open:   { height: 'auto', opacity: 1, transition: { duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }, transitionEnd: { overflow: 'visible' } },
        closed: { height: 0,      opacity: 0, overflow: 'hidden', transition: { duration: 0.25, ease: 'easeInOut' } },
      }}
      className="overflow-hidden"
    >
      <div className="px-5 pb-5 pt-1 border-t border-light-border/30 dark:border-dark-border/30">
        {children}
      </div>
    </motion.div>
  </div>
);

// ─── Date tabs (Display / Claim) ──────────────────────────────────────────────
const DateTabs = ({ tabs, activeTab, onChange }) => (
  <div className="flex p-0.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 rounded-xl border border-light-border/40 dark:border-dark-border/40 mb-4">
    {tabs.map(tab => (
      <button
        key={tab.key}
        type="button"
        onClick={() => onChange(tab.key)}
        className={`flex-1 py-2 rounded-[10px] text-xs font-bold transition-all ${
          activeTab === tab.key
            ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
            : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

// ─── Section divider label ─────────────────────────────────────────────────────
const GroupLabel = ({ children }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-light-text-secondary/50 dark:text-dark-text-secondary/50 px-1 pt-2">
    {children}
  </p>
);

// ─── Main Form ────────────────────────────────────────────────────────────────
const PromotionForm = ({
  initialData = { ...initialFormData, menu_item_skus: [], status: true },
  onSubmit,
  locations,
  menus,
  isLoading,
  formError,
  setFormError,
  isUpdate = false,
  platformTokens,
  tokenDecimals,
  meritSegments,
  meritRules,
  chileTime,
  mediaMap,
  appState,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(initialData);

  // Accordion open state — 5 sections instead of 10
  const [openSections, setOpenSections] = useState({
    setup:   true,   // BasicInfo + PromotionType + Locations
    display: false,  // Display dates + Claim dates (tabbed)
    redeem:  false,  // Redeem dates
    rules:   false,  // Token + Profile + Job rules
    limits:  false,  // Limits
  });

  // Active date tab inside "display" accordion
  const [activeDateTab, setActiveDateTab] = useState('display');

  const weekdays = [
    { value: 'monday',    label: t('promotion.days.monday') },
    { value: 'tuesday',   label: t('promotion.days.tuesday') },
    { value: 'wednesday', label: t('promotion.days.wednesday') },
    { value: 'thursday',  label: t('promotion.days.thursday') },
    { value: 'friday',    label: t('promotion.days.friday') },
    { value: 'saturday',  label: t('promotion.days.saturday') },
    { value: 'sunday',    label: t('promotion.days.sunday') },
  ];

  const validityTypes = [
    { value: 'fixed',     label: t('promotion.fixed') },
    { value: 'period',    label: t('promotion.period') },
    { value: 'recurring', label: t('promotion.recurring') },
    { value: 'forever',   label: t('promotion.forever') },
    { value: 'birthday',  label: t('promotion.birthday') },
  ];

  // ── Completion checks ──────────────────────────────────────────────────────
  const sectionCompletion = useMemo(() => ({
    setup:
      formData.name.trim() !== '' &&
      formData.description.trim() !== '' &&
      (
        formData.reward_type === 'discount'
          ? formData.reward_details.discount > 0 && formData.reward_details.type !== '' && formData.menu_item_skus.length === 0 && formData.promotion_type === 'D'
          : formData.reward_type === 'product'
            ? Array.isArray(formData.menu_item_skus) && formData.menu_item_skus.length > 0 && formData.promotion_type === 'P' && formData.reward_details.discount > 0
            : formData.promotion_type === 'C' ? formData.reward_details.discount > 0 : false
      ),
    display: formData.display.start !== '' && formData.display.end !== '' && formData.claim.start !== '' && formData.claim.end !== '',
    redeem:
      formData.is_birthday_coupon
        ? formData.redeem.birthday_validity_days > 0
        : formData.redeem.validity !== '' &&
          (formData.redeem.validity === 'forever' ||
            (formData.redeem.validity === 'fixed' || formData.redeem.validity === 'period'
              ? formData.redeem.valid_from !== '' && formData.redeem.valid_until !== ''
              : true)),
    rules:  true,
    limits: formData.max_coupon_per_table > 0 && formData.max_coupon_per_promo > 0 && formData.max_claims > 0,
  }), [formData]);

  const progress = useMemo(() => {
    const critical = ['setup', 'display', 'redeem', 'limits'];
    return Math.round(critical.filter(k => sectionCompletion[k]).length / critical.length * 100);
  }, [sectionCompletion]);

  const toggle = section =>
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

  const handleFormSubmit = async () => {
    const error = validateForm(formData, t);
    if (error) { setFormError(error); return; }
    try {
      const promotionData = preparePromotionData(formData, isUpdate, tokenDecimals);
      await onSubmit({ promotionData });
      if (!isUpdate) setFormData({ ...initialFormData, menu_item_skus: [] });
    } catch (err) {
      setFormError(t('promotion.error_creating', { message: err.message }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-28">

      {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 pt-5 pb-3 mb-5">
        <div className="flex justify-between items-end mb-2 px-1">
          <div>
            <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
              {isUpdate ? t('promotion.update') : t('promotion.create')}
            </h2>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              {progress === 100 ? '🚀 ' + t('admin.promotions.completed') : t('admin.promotions.fill_required')}
            </p>
          </div>
          <span className="text-xl font-mono font-bold text-matrix-green tabular-nums">
            {progress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full h-1 overflow-hidden">
          <motion.div
            className="bg-matrix-green h-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {formError && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-light-error/10 dark:bg-dark-error/10 border border-light-error/20 dark:border-dark-error/20 rounded-xl p-3 flex items-start gap-2.5"
            >
              <ExclamationCircleIcon className="h-4 w-4 text-light-error dark:text-dark-error mt-0.5 shrink-0" />
              <p className="text-xs text-light-error dark:text-dark-error font-medium">{formError}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── ACCORDION STACK ────────────────────────────────────────────── */}
      <div className="space-y-3">

        {/* ① SETUP: Info + Tipo + Ubicaciones ─────────────────────────── */}
        <Accordion
          title={t('promotion.basic_info') + ' & ' + t('admin.promotions.promotion_type')}
          subtitle={formData.name || t('admin.promotions.name_placeholder')}
          icon={TagIcon}
          isOpen={openSections.setup}
          toggleOpen={() => toggle('setup')}
          isComplete={sectionCompletion.setup}
        >
          <div className="space-y-5 pt-3">
            <BasicInfoSection
              formData={formData}
              handleChange={e => handleChange(e, setFormData, setFormError)}
              isLoading={isLoading}
              t={t}
            />

            <div className="border-t border-light-border/30 dark:border-dark-border/30 pt-4">
              <PromotionTypeSection
                formData={formData}
                handleChange={e => handleChange(e, setFormData, setFormError)}
                menus={menus}
                isLoading={isLoading}
                t={t}
                chileTime={chileTime}
                mediaMap={mediaMap}
              />
            </div>

            <div className="border-t border-light-border/30 dark:border-dark-border/30 pt-4">
              <LocationsSection
                formData={formData}
                handleSelectChange={(selected, section) => handleSelectChange(selected, setFormData, setFormError, section)}
                locations={locations}
                isLoading={isLoading}
                t={t}
                customSelectStyles={customSelectStyles}
              />
            </div>
          </div>
        </Accordion>

        {/* ── GROUP LABEL: Calendario ──────────────────────────────────── */}
        <GroupLabel>{t('admin.heading_calendar') || 'Calendario'}</GroupLabel>

        {/* ② DISPLAY + CLAIM (tabbed) ──────────────────────────────────── */}
        <Accordion
          title={t('promotion.display_dates') + ' & ' + t('promotion.claim_dates')}
          subtitle={
            sectionCompletion.display
              ? (formData.display.start?.slice(0, 10) + ' → ' + formData.claim.end?.slice(0, 10))
              : t('admin.promotions.required')
          }
          icon={CalendarDaysIcon}
          isOpen={openSections.display}
          toggleOpen={() => toggle('display')}
          isComplete={sectionCompletion.display}
        >
          <div className="pt-3">
            <DateTabs
              tabs={[
                { key: 'display', label: t('promotion.display_dates') },
                { key: 'claim',   label: t('promotion.claim_dates') },
              ]}
              activeTab={activeDateTab}
              onChange={setActiveDateTab}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDateTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <DateSection
                  section={activeDateTab}
                  formData={formData}
                  handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
                  handleSelectChange={(selected, sec, subfield) => handleSelectChange(selected, setFormData, setFormError, sec, subfield)}
                  addExcludedDate={addExcludedDate}
                  removeExcludedDate={(index) => removeExcludedDate(setFormData, activeDateTab, index)}
                  updateExcludedDate={updateExcludedDate}
                  setFormData={setFormData}
                  isLoading={isLoading}
                  t={t}
                  customSelectStyles={customSelectStyles}
                  weekdays={weekdays}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </Accordion>

        {/* ③ REDEEM ─────────────────────────────────────────────────────── */}
        <Accordion
          title={t('promotion.redeem_dates')}
          subtitle={formData.is_birthday_coupon ? '🎂 ' + t('admin.promotions.is_birthday_coupon') : (formData.redeem.validity || t('admin.promotions.required'))}
          icon={CalendarDaysIcon}
          isOpen={openSections.redeem}
          toggleOpen={() => toggle('redeem')}
          isComplete={sectionCompletion.redeem}
        >
          <div className="pt-3">
            <DateSection
              section="redeem"
              formData={formData}
              handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
              handleSelectChange={(selected, sec, subfield) => handleSelectChange(selected, setFormData, setFormError, sec, subfield)}
              handleValidityChange={(e, sec) => handleValidityChange(e, setFormData, sec)}
              addExcludedDate={addExcludedDate}
              removeExcludedDate={(index) => removeExcludedDate(setFormData, 'redeem', index)}
              updateExcludedDate={updateExcludedDate}
              setFormData={setFormData}
              isLoading={isLoading}
              t={t}
              customSelectStyles={customSelectStyles}
              weekdays={weekdays}
              validityTypes={validityTypes}
              isBirthdayCoupon={formData.is_birthday_coupon}
              handleBirthdayToggle={e => handleBirthdayToggle(e, setFormData)}
            />
          </div>
        </Accordion>

        {/* ── GROUP LABEL: Reglas Avanzadas ─────────────────────────────── */}
        <GroupLabel>{t('admin.heading_rules') || 'Reglas Avanzadas'}</GroupLabel>

        {/* ④ RULES: Token + Profile + Job ─────────────────────────────── */}
        <Accordion
          title={t('promotion.rules_title')}
          subtitle={t('admin.promotions.optional')}
          icon={ShieldCheckIcon}
          isOpen={openSections.rules}
          toggleOpen={() => toggle('rules')}
          isComplete={sectionCompletion.rules}
        >
          <div className="space-y-5 pt-3">
            {/* Token rules */}
            <TokenRuleSection
              formData={formData}
              handleChange={e => handleChange(e, setFormData, setFormError)}
              handleSelectChange={(selected, section, subfield, rules) => handleSelectChange(selected, setFormData, setFormError, section, subfield, rules)}
              isLoading={isLoading}
              t={t}
              platformTokens={platformTokens}
              tokenDecimals={tokenDecimals}
              customSelectStyles={customSelectStyles}
              setFormData={setFormData}
              meritSegments={meritSegments}
            />

            <div className="border-t border-light-border/30 dark:border-dark-border/30 pt-4">
              {/* Profile + merit rules */}
              <div className="flex items-center gap-1.5 mb-3">
                <InformationCircleIcon className="h-3.5 w-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
                <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                  {t('promotion.rules.user_profile')}
                </span>
              </div>
              <RulesSection
                formData={formData}
                setFormData={setFormData}
                isLoading={isLoading}
                t={t}
                meritRules={meritRules}
              />
            </div>

            <div className="border-t border-light-border/30 dark:border-dark-border/30 pt-4">
              {/* Job position rule */}
              <JobPositionRuleSection
                formData={formData}
                setFormData={setFormData}
                isLoading={isLoading}
                appState={appState}
              />
            </div>
          </div>
        </Accordion>

        {/* ⑤ LIMITS ─────────────────────────────────────────────────────── */}
        <Accordion
          title={t('promotion.limits')}
          subtitle={
            sectionCompletion.limits
              ? `${formData.max_coupon_per_promo} cupones · ${formData.max_claims}/usuario`
              : t('admin.promotions.required')
          }
          icon={Squares2X2Icon}
          isOpen={openSections.limits}
          toggleOpen={() => toggle('limits')}
          isComplete={sectionCompletion.limits}
        >
          <div className="pt-3">
            <LimitsSection
              formData={formData}
              handleChange={e => handleChange(e, setFormData, setFormError)}
              isLoading={isLoading}
              t={t}
            />
          </div>
        </Accordion>

        {/* ── STATUS (update only) ───────────────────────────────────────── */}
        {isUpdate && (
          <div className="rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/30 dark:border-dark-border/30 px-5 py-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
              {t('promotion.status')}
            </span>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${formData.status ? 'text-matrix-green' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {formData.status ? t('promotion.active') : t('promotion.inactive')}
              </span>
              <Switch
                checked={formData.status}
                onChange={checked => setFormData(prev => ({ ...prev, status: checked }))}
                className={`${formData.status ? 'bg-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'} relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none`}
              >
                <span className={`${formData.status ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 mt-1 transform rounded-full bg-white transition-transform shadow-sm`} />
              </Switch>
            </div>
          </div>
        )}

      </div>

      {/* ── FOOTER CTA ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-xl border-t border-light-border/20 dark:border-dark-border/20 z-50 flex justify-center">
        <button
          onClick={handleFormSubmit}
          disabled={isLoading}
          className="w-full max-w-2xl py-3.5 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-white font-bold text-sm rounded-2xl hover:shadow-[0_0_20px_rgba(var(--matrix-green-rgb),0.35)] disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {isLoading ? '...' : (isUpdate ? t('promotion.update_button') : t('promotion.create_button'))}
        </button>
      </div>
    </div>
  );
};

export default PromotionForm;