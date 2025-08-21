// src/components/promotions/PromotionForm.jsx
import React, { useState, useMemo } from 'react';
import { Switch } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
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
import { CheckCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

const Accordion = ({ title, children, isOpen, toggleOpen, isComplete, t }) => (
  <motion.div
    className="mb-6 rounded-xl border border-light-border/20 dark:border-dark-border/20 bg-light-surface/90 dark:bg-dark-surface/90 shadow-neon"
    initial={false}
  >
    <button
      onClick={toggleOpen}
      className="w-full p-4 flex justify-between items-center text-left text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface/10 dark:hover:bg-dark-surface/10 transition-all"
    >
      <div className="flex items-center gap-2">
        {isComplete ? (
          <CheckCircleIcon className="h-5 w-5 text-matrix-green" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-matrix-green" />
        )}
        <span className="text-lg font-semibold">{title}</span>
      </div>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <ChevronDownIcon className="h-5 w-5 text-matrix-green" />
      </motion.div>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-visible"
        >
          <div className="p-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

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
  chileTime,
  mediaMap,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(initialData);
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

  const ruleTypes = [
    { value: 'hold_tokens', label: t('promotion.rules.hold_tokens') },
    { value: 'burn_tokens', label: t('promotion.rules.burn_tokens') },
  ];

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

  const sectionCompletion = useMemo(() => {
    const completion = {
      basicInfo: formData.name.trim() !== '' && formData.description.trim() !== '',
      promotionType:
        formData.reward_type === 'discount'
          ? formData.reward_details.discount > 0 && formData.reward_details.type !== '' && formData.menu_item_skus.length === 0 && formData.promotion_type === 'D'
          : formData.reward_type === 'product'
          ? Array.isArray(formData.menu_item_skus) && formData.menu_item_skus.length > 0 && formData.promotion_type === 'P' && formData.reward_details.discount > 0 && formData.reward_details.type === 'percentage'
          : false,
      locations: true, // Empty locations means all locations
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
      tokenRules: formData.rules.length === 0 ||
        formData.rules.every((rule) =>
          rule.rule_type === 'hold_tokens' || rule.rule_type === 'burn_tokens'
            ? rule.token_address !== '' && rule.amount > 0
            : true
        ),
      rules: formData.rules.length === 0 ||
        formData.rules.every((rule) =>
          rule.rule_type === 'require_min_liked_products'
            ? rule.min_count > 0
            : !['hold_tokens', 'burn_tokens'].includes(rule.rule_type) || true
        ),
      limits: formData.max_coupon_per_table > 0 && formData.max_coupon_per_promo > 0 && formData.max_claims > 0,
    };
    return completion;
  }, [formData]);

  const progress = useMemo(() => {
    const completedSections = Object.values(sectionCompletion).filter(Boolean).length;
    const totalSections = Object.keys(sectionCompletion).length;
    return Math.round((completedSections / totalSections) * 100);
  }, [sectionCompletion]);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-8 rounded-3xl max-w-4xl mx-auto"
    >
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-2 text-light-text-primary dark:text-dark-text-primary">
        <CheckCircleIcon className="h-8 w-8 text-matrix-green" />
        {isUpdate ? t('promotion.update') : t('promotion.create')}
      </h2>
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
            {t('promotion.progress')}
          </span>
          <span className="text-sm font-semibold text-matrix-green">{progress}%</span>
        </div>
        <div className="w-full bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-full h-2.5 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-matrix-green to-vanellix-cyan h-full relative overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </motion.div>
        </div>
      </div>
      <div className="space-y-6">
        <Accordion
          title={t('promotion.basic_info')}
          isOpen={openSections.basicInfo}
          toggleOpen={() => toggleSection('basicInfo')}
          isComplete={sectionCompletion.basicInfo}
          t={t}
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
          t={t}
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
          t={t}
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
        <Accordion
          title={t('promotion.display_dates')}
          isOpen={openSections.displayDates}
          toggleOpen={() => toggleSection('displayDates')}
          isComplete={sectionCompletion.displayDates}
          t={t}
        >
          <DateSection
            section="display"
            formData={formData}
            handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
            handleSelectChange={(selected, sec, subfield) =>
              handleSelectChange(selected, setFormData, setFormError, sec, subfield)
            }
            handleValidityChange={(e, sec) => handleValidityChange(e, setFormData, sec)}
            addExcludedDate={() => addExcludedDate(setFormData, 'display')}
            removeExcludedDate={(index) => removeExcludedDate(setFormData, 'display', index)}
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
        <Accordion
          title={t('promotion.claim_dates')}
          isOpen={openSections.claimDates}
          toggleOpen={() => toggleSection('claimDates')}
          isComplete={sectionCompletion.claimDates}
          t={t}
        >
          <DateSection
            section="claim"
            formData={formData}
            handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
            handleSelectChange={(selected, sec, subfield) =>
              handleSelectChange(selected, setFormData, setFormError, sec, subfield)
            }
            handleValidityChange={(e, sec) => handleValidityChange(e, setFormData, sec)}
            addExcludedDate={() => addExcludedDate(setFormData, 'claim')}
            removeExcludedDate={(index) => removeExcludedDate(setFormData, 'claim', index)}
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
        <Accordion
          title={t('promotion.redeem_dates')}
          isOpen={openSections.redeemDates}
          toggleOpen={() => toggleSection('redeemDates')}
          isComplete={sectionCompletion.redeemDates}
          t={t}
        >
          <DateSection
            section="redeem"
            formData={formData}
            handleChange={(e, sec, key) => handleChange(e, setFormData, setFormError, sec, key)}
            handleSelectChange={(selected, sec, subfield) =>
              handleSelectChange(selected, setFormData, setFormError, sec, subfield)
            }
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
        <Accordion
          title={t('promotion.token_rule')}
          isOpen={openSections.tokenRules}
          toggleOpen={() => toggleSection('tokenRules')}
          isComplete={sectionCompletion.tokenRules}
          t={t}
        >
          <TokenRuleSection
            formData={formData}
            handleChange={(e) => handleChange(e, setFormData, setFormError)}
            handleSelectChange={(selected, section, subfield, rules) =>
              handleSelectChange(selected, setFormData, setFormError, section, subfield, rules)
            }
            isLoading={isLoading}
            t={t}
            platformTokens={platformTokens}
            tokenDecimals={tokenDecimals}
            customSelectStyles={customSelectStyles}
            setFormData={setFormData}
          />
        </Accordion>
        <Accordion
          title={t('promotion.rules_title')}
          isOpen={openSections.rules}
          toggleOpen={() => toggleSection('rules')}
          isComplete={sectionCompletion.rules}
          t={t}
        >
          <RulesSection
            formData={formData}
            handleChange={(e) => handleChange(e, setFormData, setFormError)}
            isLoading={isLoading}
            t={t}
            setFormData={setFormData}
          />
        </Accordion>
        <Accordion
          title={t('promotion.limits')}
          isOpen={openSections.limits}
          toggleOpen={() => toggleSection('limits')}
          isComplete={sectionCompletion.limits}
          t={t}
        >
          <LimitsSection
            formData={formData}
            handleChange={(e) => handleChange(e, setFormData, setFormError)}
            isLoading={isLoading}
            t={t}
          />
        </Accordion>
        {isUpdate && (
          <Accordion
            title={t('promotion.status')}
            isOpen={openSections.status}
            toggleOpen={() => toggleSection('status')}
            isComplete={true}
            t={t}
          >
            <div className="flex items-center gap-4">
              <Switch
                checked={formData.status}
                onChange={(checked) => setFormData((prev) => ({ ...prev, status: checked }))}
                className={`${formData.status ? 'bg-matrix-green' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
              >
                <span className={`${formData.status ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </Switch>
              <span className="text-light-text-primary dark:text-dark-text-primary">
                {formData.status ? t('promotion.active') : t('promotion.inactive')}
              </span>
            </div>
          </Accordion>
        )}
        <AnimatePresence>
          {formError && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-2 text-vanellix-purple text-sm"
            >
              {formError}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="flex justify-end mt-8">
          <button
            onClick={handleFormSubmit}
            disabled={isLoading || progress < 100}
            className="px-8 py-3 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary font-semibold rounded-xl hover:bg-green-300 dark:hover:bg-green-600 transition-all disabled:opacity-50 shadow-neon"
          >
            {isUpdate ? t('promotion.update_button') : t('promotion.create_button')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default PromotionForm;