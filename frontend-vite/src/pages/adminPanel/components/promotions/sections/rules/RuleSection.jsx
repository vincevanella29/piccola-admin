// src/components/promotions/sections/rules/RulesSection.jsx
import React, { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon } from '@heroicons/react/24/outline';

const RulesSection = ({
  formData,
  handleChange,
  isLoading,
  t,
  setFormData,
}) => {

  const nonTokenRuleTypes = [
    'require_public_profile',
    'require_subscribe_news',
    'require_birthdate',
    'require_favorite_location',
    'require_min_liked_products',
  ];

  // Compute values directly from formData.rules
  const requirePublicProfile = !!formData.rules.find((r) => r.rule_type === 'require_public_profile');
  const requireSubscribeNews = !!formData.rules.find((r) => r.rule_type === 'require_subscribe_news');
  const requireBirthdate = !!formData.rules.find((r) => r.rule_type === 'require_birthdate');
  const requireFavoriteLocation = !!formData.rules.find((r) => r.rule_type === 'require_favorite_location');
  const likedRule = formData.rules.find((r) => r.rule_type === 'require_min_liked_products');
  const minLikedProducts = likedRule ? likedRule.min_count || 0 : 0;


  // Handlers to update rules directly
  const handleSwitchChange = (ruleType, checked) => {
    let newRules = formData.rules.filter((r) => r.rule_type !== ruleType);
    if (checked) newRules.push({ rule_type: ruleType });
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };
  const handleMinLikedProductsChange = (value) => {
    let newRules = formData.rules.filter((r) => r.rule_type !== 'require_min_liked_products');
    if (parseInt(value) > 0) newRules.push({ rule_type: 'require_min_liked_products', min_count: parseInt(value) });
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };


  const handleRemoveNonToken = (ruleType) => {
    // Elimina la regla correspondiente del array de reglas
    let newRules = formData.rules.filter((r) => r.rule_type !== ruleType);
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };


  const getRuleLabel = (rule) => {
    if (rule.rule_type === 'require_min_liked_products') {
      return t('promotion.rules.require_min_liked_products', { count: rule.min_count });
    }
    return t(`promotion.rules.${rule.rule_type}`);
  };

  const nonTokenRules = formData.rules.filter((rule) => nonTokenRuleTypes.includes(rule.rule_type));

  return (
    <section className="p-6 bg-gradient-to-br from-light-surface/80 dark:from-dark-surface/80 to-light-surface/50 dark:to-dark-surface/50 rounded-2xl shadow-lg border border-light-border/20 dark:border-dark-border/20">
      <h3 className="text-2xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-6 flex items-center gap-3">
        {t('promotion.rules.user_profile')}
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-light-text-primary dark:text-dark-text-primary">
            {t('promotion.rules.require_public_profile')}
          </label>
          <Switch
            checked={requirePublicProfile}
            onChange={checked => handleSwitchChange('require_public_profile', checked)}
            className={`${requirePublicProfile ? 'bg-matrix-green' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            disabled={isLoading}
          >
            <span className={`${requirePublicProfile ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
          </Switch>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-light-text-primary dark:text-dark-text-primary">
            {t('promotion.rules.require_subscribe_news')}
          </label>
          <Switch
            checked={requireSubscribeNews}
            onChange={checked => handleSwitchChange('require_subscribe_news', checked)}
            className={`${requireSubscribeNews ? 'bg-matrix-green' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            disabled={isLoading}
          >
            <span className={`${requireSubscribeNews ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
          </Switch>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-light-text-primary dark:text-dark-text-primary">
            {t('promotion.rules.require_birthdate')}
          </label>
          <Switch
            checked={requireBirthdate}
            onChange={checked => handleSwitchChange('require_birthdate', checked)}
            className={`${requireBirthdate ? 'bg-matrix-green' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            disabled={isLoading}
          >
            <span className={`${requireBirthdate ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
          </Switch>
        </div>
        <div className="flex items-center justify-between">
          <label className="text-light-text-primary dark:text-dark-text-primary">
            {t('promotion.rules.require_favorite_location')}
          </label>
          <Switch
            checked={requireFavoriteLocation}
            onChange={checked => handleSwitchChange('require_favorite_location', checked)}
            className={`${requireFavoriteLocation ? 'bg-matrix-green' : 'bg-gray-200 dark:bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            disabled={isLoading}
          >
            <span className={`${requireFavoriteLocation ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
          </Switch>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-light-text-primary dark:text-dark-text-primary">
            {t('promotion.rules.require_min_liked_products')}
          </label>
          <input
            type="number"
            min="0"
            value={minLikedProducts}
            onChange={(e) => handleMinLikedProductsChange(e.target.value)}
            className="w-24 p-1 bg-transparent border border-matrix-green/50 rounded text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green transition-all"
            disabled={isLoading}
          />
        </div>
      </div>
      <AnimatePresence>
        {nonTokenRules.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap gap-2 mt-3"
          >
            {nonTokenRules.map((rule) => (
              <motion.div
                key={rule.rule_type}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1 bg-gradient-to-r from-matrix-green/20 to-light-text-primary dark:from-matrix-green/10 dark:to-light-text-primary/10 text-light-text-primary dark:text-dark-text-primary px-3 py-1 rounded-full text-sm shadow-neon hover:shadow-lg transition-all"
              >
                {getRuleLabel(rule)}
                <XCircleIcon
                  className="h-4 w-4 cursor-pointer text-vanellix-purple hover:text-vanellix-purple/80"
                  onClick={() => handleRemoveNonToken(rule.rule_type)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default RulesSection;