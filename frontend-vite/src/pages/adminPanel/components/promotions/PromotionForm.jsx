// src/components/promotions/PromotionForm.jsx
import React, { useState, useMemo } from 'react';
import { Switch } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/solid';

// Importamos las secciones
import {
  BasicInfoSection,
  PromotionTypeSection,
  LocationsSection,
  DateSection,
  TokenRuleSection,
  RulesSection,
  LimitsSection,
} from './sections';

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

// --- COMPONENTE ACORDEÓN "VANELLIX STYLE" ---
const Accordion = ({ title, children, isOpen, toggleOpen, isComplete, isLocked = false }) => {
  return (
    <div 
      className={`
        group rounded-2xl border transition-all duration-300
        ${isOpen 
          ? 'bg-light-surface dark:bg-dark-surface border-matrix-green/50 shadow-lg shadow-matrix-green/10' 
          : 'bg-light-surface dark:bg-dark-surface border-light-border/20 dark:border-dark-border/20 hover:border-light-border/40 dark:hover:border-dark-border/40'
        }
        ${isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}
      `}
    >
      <button
        onClick={toggleOpen}
        disabled={isLocked}
        className="w-full p-5 flex justify-between items-center text-left focus:outline-none"
      >
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <div className="relative flex items-center justify-center">
            {isComplete ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckCircleIcon className="h-6 w-6 text-matrix-green" />
              </motion.div>
            ) : (
              <div className={`h-5 w-5 rounded-full border-2 ${isOpen ? 'border-matrix-green' : 'border-light-border/40 dark:border-dark-border/40'}`} />
            )}
          </div>
          
          {/* Title */}
          <span className={`text-lg font-futurist tracking-tight ${isOpen ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
            {title}
          </span>
        </div>

        {/* Chevron Animation */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "circOut" }}
          className={isOpen ? 'text-matrix-green' : 'text-light-text-secondary/50 dark:text-dark-text-secondary/50'}
        >
          <ChevronDownIcon className="h-6 w-6" />
        </motion.div>
      </button>

      {/* Content Animation with Overflow Handling for Selects */}
      <motion.div
        initial={false}
        animate={isOpen ? "open" : "closed"}
        variants={{
          open: { 
            height: "auto", 
            opacity: 1,
            transition: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] },
            transitionEnd: { overflow: "visible" } 
          },
          closed: { 
            height: 0, 
            opacity: 0,
            overflow: "hidden",
            transition: { duration: 0.3, ease: "easeInOut" }
          }
        }}
        className="overflow-hidden" 
      >
        <div className="p-5 pt-0 border-t border-transparent">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
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
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(initialData);
  
  // Control de secciones
  const [openSections, setOpenSections] = useState({
    basicInfo: true,
    promotionType: false,
    locations: false,
    displayDates: false,
    claimDates: false,
    redeemDates: false,
    tokenRules: false,
    rules: false,
    limits: false,
    status: false,
  });

  // Data estática
  const weekdays = [
    { value: 'monday', label: t('promotion.days.monday') },
    { value: 'tuesday', label: t('promotion.days.tuesday') },
    { value: 'wednesday', label: t('promotion.days.wednesday') },
    { value: 'thursday', label: t('promotion.days.thursday') },
    { value: 'friday', label: t('promotion.days.friday') },
    { value: 'saturday', label: t('promotion.days.saturday') },
    { value: 'sunday', label: t('promotion.days.sunday') },
  ];

  const validityTypes = [
    { value: 'fixed', label: t('promotion.fixed') },
    { value: 'period', label: t('promotion.period') },
    { value: 'recurring', label: t('promotion.recurring') },
    { value: 'forever', label: t('promotion.forever') },
    { value: 'birthday', label: t('promotion.birthday') },
  ];

  // Cálculo de completitud
  const sectionCompletion = useMemo(() => {
    return {
      basicInfo: formData.name.trim() !== '' && formData.description.trim() !== '',
      promotionType:
        formData.reward_type === 'discount'
          ? formData.reward_details.discount > 0 && formData.reward_details.type !== '' && formData.menu_item_skus.length === 0 && formData.promotion_type === 'D'
          : formData.reward_type === 'product'
          ? Array.isArray(formData.menu_item_skus) && formData.menu_item_skus.length > 0 && formData.promotion_type === 'P' && formData.reward_details.discount > 0
          : formData.promotion_type === 'C'
          ? formData.reward_details.discount > 0
          : false,
      locations: true,
      displayDates: formData.display.start !== '' && formData.display.end !== '',
      claimDates: formData.claim.start !== '' && formData.claim.end !== '',
      redeemDates:
        formData.is_birthday_coupon
          ? formData.redeem.birthday_validity_days > 0
          : formData.redeem.validity !== '' &&
            (formData.redeem.validity === 'forever' ||
              (formData.redeem.validity === 'fixed' || formData.redeem.validity === 'period'
                ? formData.redeem.valid_from !== '' && formData.redeem.valid_until !== ''
                : true)),
      tokenRules: true, 
      rules: true, 
      limits: formData.max_coupon_per_table > 0 && formData.max_coupon_per_promo > 0 && formData.max_claims > 0,
    };
  }, [formData]);

  const progress = useMemo(() => {
    const criticalSections = ['basicInfo', 'promotionType', 'displayDates', 'claimDates', 'redeemDates', 'limits'];
    const completed = criticalSections.filter(k => sectionCompletion[k]).length;
    return Math.round((completed / criticalSections.length) * 100);
  }, [sectionCompletion]);

  const toggleSection = (section) => {
    setOpenSections((prev) => {
      return { ...prev, [section]: !prev[section] };
    });
  };

  const handleFormSubmit = async () => {
    const error = validateForm(formData, t);
    if (error) {
      setFormError(error);
      return;
    }
    try {
      const promotionData = preparePromotionData(formData, isUpdate, tokenDecimals);
      await onSubmit({ promotionData });
      if (!isUpdate) {
        setFormData({ ...initialFormData, menu_item_skus: [] });
      }
    } catch (err) {
      setFormError(t('promotion.error_creating', { message: err.message }));
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      
      {/* HEADER & PROGRESS (STICKY) */}
      <div className="sticky top-0 z-40    pt-6 pb-4 mb-6">
        <div className="flex justify-between items-end mb-3 px-1">
          <div>
             <h2 className="text-2xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
              {isUpdate ? t('promotion.update') : t('promotion.create')}
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {progress === 100 ? "Todo listo para lanzar 🚀" : "Completa los campos requeridos"}
            </p>
          </div>
          <span className="text-2xl font-mono font-bold text-matrix-green">
            {progress}%
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="bg-matrix-green h-full shadow-[0_0_10px_rgba(var(--matrix-green-rgb),0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {formError && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="bg-light-error/10 dark:bg-dark-error/10 border border-light-error/20 dark:border-dark-error/20 rounded-lg p-3 flex items-start gap-3 overflow-hidden"
            >
              <ExclamationCircleIcon className="h-5 w-5 text-light-error dark:text-dark-error mt-0.5 flex-shrink-0" />
              <p className="text-sm text-light-error dark:text-dark-error font-medium">
                {formError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FORM SECTIONS STACK */}
      <div className="space-y-4">
        
        <Accordion
          title={t('promotion.basic_info')}
          isOpen={openSections.basicInfo}
          toggleOpen={() => toggleSection('basicInfo')}
          isComplete={sectionCompletion.basicInfo}
        >
          <BasicInfoSection
            formData={formData}
            handleChange={(e) => handleChange(e, setFormData, setFormError)}
            isLoading={isLoading}
            t={t}
          />
        </Accordion>

        <Accordion
          title={t('promotion.promotion_type')}
          isOpen={openSections.promotionType}
          toggleOpen={() => toggleSection('promotionType')}
          isComplete={sectionCompletion.promotionType}
        >
          <PromotionTypeSection
            formData={formData}
            handleChange={(e) => handleChange(e, setFormData, setFormError)}
            menus={menus}
            isLoading={isLoading}
            t={t}
            chileTime={chileTime}
            mediaMap={mediaMap}
          />
        </Accordion>

        <Accordion
          title={t('promotion.locations')}
          isOpen={openSections.locations}
          toggleOpen={() => toggleSection('locations')}
          isComplete={sectionCompletion.locations}
        >
          <LocationsSection
            formData={formData}
            handleSelectChange={(selected, section) => handleSelectChange(selected, setFormData, setFormError, section)}
            locations={locations}
            isLoading={isLoading}
            t={t}
            customSelectStyles={customSelectStyles}
          />
        </Accordion>

        {/* Date Group */}
        <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase text-light-text-secondary/60 dark:text-dark-text-secondary/60 tracking-widest px-2">
              Calendario
            </h3>
            <Accordion
              title={t('promotion.display_dates')}
              isOpen={openSections.displayDates}
              toggleOpen={() => toggleSection('displayDates')}
              isComplete={sectionCompletion.displayDates}
            >
              <DateSection
                section="display"
                formData={formData}
                handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
                handleSelectChange={(selected, sec, subfield) => handleSelectChange(selected, setFormData, setFormError, sec, subfield)}
                addExcludedDate={() => addExcludedDate(setFormData, 'display')}
                removeExcludedDate={(index) => removeExcludedDate(setFormData, 'display', index)}
                updateExcludedDate={updateExcludedDate}
                setFormData={setFormData}
                isLoading={isLoading}
                t={t}
                customSelectStyles={customSelectStyles}
                weekdays={weekdays}
              />
            </Accordion>

            <Accordion
              title={t('promotion.claim_dates')}
              isOpen={openSections.claimDates}
              toggleOpen={() => toggleSection('claimDates')}
              isComplete={sectionCompletion.claimDates}
            >
              <DateSection
                section="claim"
                formData={formData}
                handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
                handleSelectChange={(selected, sec, subfield) => handleSelectChange(selected, setFormData, setFormError, sec, subfield)}
                addExcludedDate={() => addExcludedDate(setFormData, 'claim')}
                removeExcludedDate={(index) => removeExcludedDate(setFormData, 'claim', index)}
                updateExcludedDate={updateExcludedDate}
                setFormData={setFormData}
                isLoading={isLoading}
                t={t}
                customSelectStyles={customSelectStyles}
                weekdays={weekdays}
              />
            </Accordion>

            <Accordion
              title={t('promotion.redeem_dates')}
              isOpen={openSections.redeemDates}
              toggleOpen={() => toggleSection('redeemDates')}
              isComplete={sectionCompletion.redeemDates}
            >
              <DateSection
                section="redeem"
                formData={formData}
                handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
                handleSelectChange={(selected, sec, subfield) => handleSelectChange(selected, setFormData, setFormError, sec, subfield)}
                handleValidityChange={(e, sec) => handleValidityChange(e, setFormData, sec)}
                addExcludedDate={() => addExcludedDate(setFormData, 'redeem')}
                removeExcludedDate={(index) => removeExcludedDate(setFormData, 'redeem', index)}
                updateExcludedDate={updateExcludedDate}
                setFormData={setFormData}
                isLoading={isLoading}
                t={t}
                customSelectStyles={customSelectStyles}
                weekdays={weekdays}
                validityTypes={validityTypes}
                isBirthdayCoupon={formData.is_birthday_coupon}
                handleBirthdayToggle={(e) => handleBirthdayToggle(e, setFormData)}
              />
            </Accordion>
        </div>

        {/* Rules Group */}
        <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase text-light-text-secondary/60 dark:text-dark-text-secondary/60 tracking-widest px-2">
              Reglas Avanzadas
            </h3>
            
            <Accordion
              title={t('promotion.token_rule')}
              isOpen={openSections.tokenRules}
              toggleOpen={() => toggleSection('tokenRules')}
              isComplete={sectionCompletion.tokenRules}
            >
              <TokenRuleSection
                formData={formData}
                handleChange={(e) => handleChange(e, setFormData, setFormError)}
                handleSelectChange={(selected, section, subfield, rules) => handleSelectChange(selected, setFormData, setFormError, section, subfield, rules)}
                isLoading={isLoading}
                t={t}
                platformTokens={platformTokens}
                tokenDecimals={tokenDecimals}
                customSelectStyles={customSelectStyles}
                setFormData={setFormData}
                meritSegments={meritSegments}
              />
            </Accordion>

            <Accordion
              title={t('promotion.rules_title')}
              isOpen={openSections.rules}
              toggleOpen={() => toggleSection('rules')}
              isComplete={sectionCompletion.rules}
            >
              <RulesSection
                formData={formData}
                handleChange={(e) => handleChange(e, setFormData, setFormError)}
                isLoading={isLoading}
                t={t}
                setFormData={setFormData}
                meritRules={meritRules}
              />
            </Accordion>

            <Accordion
              title={t('promotion.limits')}
              isOpen={openSections.limits}
              toggleOpen={() => toggleSection('limits')}
              isComplete={sectionCompletion.limits}
            >
              <LimitsSection
                formData={formData}
                handleChange={(e) => handleChange(e, setFormData, setFormError)}
                isLoading={isLoading}
                t={t}
              />
            </Accordion>
        </div>

        {/* UPDATE STATUS */}
        {isUpdate && (
          <div className="mt-8 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-6 flex justify-between items-center">
            <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {t('promotion.status')}
            </span>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${formData.status ? 'text-matrix-green' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                {formData.status ? t('promotion.active') : t('promotion.inactive')}
              </span>
              <Switch
                checked={formData.status}
                onChange={(checked) => setFormData((prev) => ({ ...prev, status: checked }))}
                className={`${formData.status ? 'bg-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'} relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-matrix-green/50`}
              >
                <span className={`${formData.status ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-light-surface dark:bg-dark-text-primary transition-transform shadow-sm`} />
              </Switch>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER ACTION */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-lg border-t border-light-border/20 dark:border-dark-border/20 z-50 flex justify-center">
        <button
          onClick={handleFormSubmit}
          disabled={isLoading}
          className="w-full max-w-3xl py-4 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-light-text-primary font-bold text-lg rounded-2xl hover:shadow-[0_0_20px_rgba(var(--matrix-green-rgb),0.4)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {isUpdate ? t('promotion.update_button') : t('promotion.create_button')}
        </button>
      </div>
      
    </div>
  );
};

export default PromotionForm;