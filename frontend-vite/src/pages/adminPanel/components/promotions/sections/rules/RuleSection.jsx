// src/components/promotions/sections/rules/RulesSection.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon, ChevronRightIcon, TrophyIcon } from '@heroicons/react/24/outline';
import RuleRow from './components/RuleRow';
import MeritRuleModal from './components/MeritRuleModal';

const RulesSection = ({
  formData,
  setFormData,
  isLoading,
  t,
  meritRules = [],
}) => {
  // --- Logic Extraction ---
  const requirePublicProfile = !!formData.rules.find((r) => r.rule_type === 'require_public_profile');
  const requireSubscribeNews = !!formData.rules.find((r) => r.rule_type === 'require_subscribe_news');
  const requireBirthdate = !!formData.rules.find((r) => r.rule_type === 'require_birthdate');
  const requireFavoriteLocation = !!formData.rules.find((r) => r.rule_type === 'require_favorite_location');
  const likedRule = formData.rules.find((r) => r.rule_type === 'require_min_liked_products');
  const minLikedProducts = likedRule ? likedRule.min_count || 0 : 0;
  
  const rankingRule = formData.rules.find((r) => r.rule_type === 'merit_rule_fulfilled') || null;

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // --- Handlers ---
  const handleSwitchChange = (ruleType, checked) => {
    let newRules = formData.rules.filter((r) => r.rule_type !== ruleType);
    if (checked) newRules.push({ rule_type: ruleType });
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };

  const handleMinLikedProductsChange = (value) => {
    let newRules = formData.rules.filter((r) => r.rule_type !== 'require_min_liked_products');
    const val = parseInt(value);
    if (val > 0) newRules.push({ rule_type: 'require_min_liked_products', min_count: val });
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };

  const handleRankingRuleChange = (field, value) => {
    let newRules = formData.rules.filter((r) => r.rule_type !== 'merit_rule_fulfilled');
    const base = rankingRule || { rule_type: 'merit_rule_fulfilled', merit_rule_name: '', ranking_period: 'current' };

    // Nuevo modelo: solo 'current' o 'last'. Por defecto, 'current'.
    let nextRankingPeriod = base.ranking_period || 'current';

    const updated = {
      ...base,
      [field]: value,
      ranking_period: field === 'ranking_period' ? value : nextRankingPeriod,
    };
    if (updated.merit_rule_name && updated.ranking_period) {
      newRules.push(updated);
    }
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };

  const handleRemoveRankingRule = () => {
    const newRules = formData.rules.filter((r) => r.rule_type !== 'merit_rule_fulfilled');
    setFormData((prev) => ({ ...prev, rules: newRules }));
  };

  const selectedMeritRule = rankingRule
    ? (meritRules || []).find((r) => r.rule_name === rankingRule.merit_rule_name)
    : null;

  const rankingPeriodOptions = [
    // Nuevo modelo: solo 'current' o 'last', pero reutilizamos labels existentes
    { value: 'current', label: t('promotion.rules.ranking_period.current_month') },
    { value: 'last', label: t('promotion.rules.ranking_period.last_month') },
  ];

  return (
    <section className="max-w-4xl mx-auto">
      <h3 className="text-xl font-futurist text-neutral-900 dark:text-white mb-4 px-1">
        {t('promotion.rules.user_profile')}
      </h3>
      
      {/* CAMBIO AQUI: Quite 'overflow-hidden' y puse 'overflow-visible' */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-visible">
        
        {/* Basic Boolean Rules */}
        <div className="px-6">
          <RuleRow
            label={t('promotion.rules.require_public_profile')}
            checked={requirePublicProfile}
            onChange={(c) => handleSwitchChange('require_public_profile', c)}
            disabled={isLoading}
          />
          <RuleRow
            label={t('promotion.rules.require_subscribe_news')}
            checked={requireSubscribeNews}
            onChange={(c) => handleSwitchChange('require_subscribe_news', c)}
            disabled={isLoading}
          />
          <RuleRow
            label={t('promotion.rules.require_birthdate')}
            checked={requireBirthdate}
            onChange={(c) => handleSwitchChange('require_birthdate', c)}
            disabled={isLoading}
          />
          <RuleRow
            label={t('promotion.rules.require_favorite_location')}
            checked={requireFavoriteLocation}
            onChange={(c) => handleSwitchChange('require_favorite_location', c)}
            disabled={isLoading}
            border={false}
          />
        </div>

        {/* Numeric Input Rule */}
        <div className="bg-neutral-50/50 dark:bg-neutral-800/30 border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
           <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {t('promotion.rules.require_min_liked_products')}
          </label>
          <div className="flex items-center">
            <input
              type="number"
              min="0"
              value={minLikedProducts}
              onChange={(e) => handleMinLikedProductsChange(e.target.value)}
              className="w-16 py-1.5 px-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-center text-sm font-mono focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green transition-all"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Advanced Ranking Section */}
      <h3 className="text-xl font-futurist text-neutral-900 dark:text-white mt-8 mb-4 px-1 flex items-center gap-2">
        <TrophyIcon className="w-5 h-5 text-vanellix-purple" />
        {t('promotion.rules.merit_rule_fulfilled')}
      </h3>

      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden p-1">
        {!rankingRule ? (
          <button
            onClick={() => setIsRuleModalOpen(true)}
            className="w-full py-8 flex flex-col items-center justify-center text-neutral-400 hover:text-matrix-green hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-matrix-green/30"
          >
             <span className="text-sm font-medium">{t('promotion.rules.merit_rule_name_placeholder')}</span>
          </button>
        ) : (
          <div className="p-4">
             {/* Selected Rule Header */}
             <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-vanellix-purple/10 flex items-center justify-center text-vanellix-purple">
                    <TrophyIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {rankingRule.merit_rule_name}
                    </h4>
                    <p className="text-xs text-neutral-500">
                      {selectedMeritRule?.template_key}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button
                    onClick={() => setIsRuleModalOpen(true)}
                    className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                   >
                     Cambiar
                   </button>
                   <button
                    onClick={handleRemoveRankingRule}
                    className="text-red-500 hover:text-red-600 p-1"
                   >
                     <XCircleIcon className="h-6 w-6" />
                   </button>
                </div>
             </div>

             {/* Details Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-100 dark:border-neutral-800">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                    {t('promotion.rules.ranking_period_label')}
                  </label>
                  <select
                    value={rankingRule?.ranking_period || 'current'}
                    onChange={(e) => handleRankingRuleChange('ranking_period', e.target.value)}
                    className="bg-transparent text-sm font-medium text-neutral-900 dark:text-white focus:outline-none cursor-pointer py-1 border-b border-transparent focus:border-matrix-green transition-all"
                    disabled={isLoading}
                  >
                    {rankingPeriodOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="text-neutral-900 bg-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedMeritRule && (
                  <div className="flex flex-col gap-1 border-l border-neutral-200 dark:border-neutral-700 pl-4">
                     <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                        Resumen
                      </label>
                      <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-0.5">
                         <div>Target: {selectedMeritRule.params?.position_type === 'top_n' ? `Top ${selectedMeritRule.params?.position_to}` : `Pos ${selectedMeritRule.params?.ranking_position}`}</div>
                         <div>Metric: {selectedMeritRule.params?.metric_key || selectedMeritRule.params?.metric || '-'}</div>
                      </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Modal Injection */}
      <MeritRuleModal 
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        meritRules={meritRules}
        t={t}
        initialRuleName={rankingRule?.merit_rule_name || ''}
        onSelect={(rule) => {
          handleRankingRuleChange('merit_rule_name', rule.rule_name);
          setIsRuleModalOpen(false);
        }}
      />
    </section>
  );
};

export default RulesSection;