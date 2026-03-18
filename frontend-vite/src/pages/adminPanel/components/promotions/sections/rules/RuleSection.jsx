// src/components/promotions/sections/rules/RulesSection.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@headlessui/react';
import {
  XCircleIcon,
  TrophyIcon,
  UserCircleIcon,
  NewspaperIcon,
  CakeIcon,
  MapPinIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import RuleRow from './components/RuleRow';
import MeritRuleModal from './components/MeritRuleModal';

// ─── Toggle row with icon ─────────────────────────────────────────────────────

const ProfileToggle = ({ icon: Icon, label, description, checked, onChange, disabled, accent }) => {
  const accentMap = {
    green:  { bg: 'bg-matrix-green/10',    icon: 'text-matrix-green',    ring: 'ring-matrix-green/20' },
    purple: { bg: 'bg-vanellix-purple/10', icon: 'text-vanellix-purple', ring: 'ring-vanellix-purple/20' },
    cyan:   { bg: 'bg-vanellix-cyan/10',   icon: 'text-vanellix-cyan',   ring: 'ring-vanellix-cyan/20' },
    pink:   { bg: 'bg-pink-500/10',        icon: 'text-pink-400',        ring: 'ring-pink-500/20' },
  };
  const a = accentMap[accent] ?? accentMap.green;

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl transition-colors hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/30">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-xl ${a.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${a.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-none">
            {label}
          </p>
          {description && (
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`shrink-0 ml-4 ${checked ? 'bg-matrix-green' : 'bg-light-border dark:bg-dark-border'} relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-matrix-green/30`}
      >
        <span className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 mt-1 transform rounded-full bg-white transition-transform shadow-sm`} />
      </Switch>
    </div>
  );
};

// ─── Number stepper ───────────────────────────────────────────────────────────

const NumberStepper = ({ value, onChange, min = 0, disabled, label }) => {
  const num = parseInt(value) || 0;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || num <= min}
        onClick={() => onChange(Math.max(min, num - 1))}
        className="w-8 h-8 rounded-xl border border-light-border/60 dark:border-dark-border/60 text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center justify-center hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary disabled:opacity-30 transition-all"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        value={num}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-14 text-center py-1.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border border-light-border/60 dark:border-dark-border/60 rounded-xl text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/30"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(num + 1)}
        className="w-8 h-8 rounded-xl border border-light-border/60 dark:border-dark-border/60 text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center justify-center hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary disabled:opacity-30 transition-all"
      >
        +
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RulesSection = ({
  formData,
  setFormData,
  isLoading,
  t,
  meritRules = [],
}) => {
  const requirePublicProfile    = !!formData.rules.find(r => r.rule_type === 'require_public_profile');
  const requireSubscribeNews    = !!formData.rules.find(r => r.rule_type === 'require_subscribe_news');
  const requireBirthdate        = !!formData.rules.find(r => r.rule_type === 'require_birthdate');
  const requireFavoriteLocation = !!formData.rules.find(r => r.rule_type === 'require_favorite_location');
  const likedRule               = formData.rules.find(r => r.rule_type === 'require_min_liked_products');
  const minLikedProducts        = likedRule ? likedRule.min_count || 0 : 0;
  const rankingRule             = formData.rules.find(r => r.rule_type === 'merit_rule_fulfilled') || null;

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSwitchChange = (ruleType, checked) => {
    let newRules = formData.rules.filter(r => r.rule_type !== ruleType);
    if (checked) newRules.push({ rule_type: ruleType });
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleMinLikedProductsChange = value => {
    let newRules = formData.rules.filter(r => r.rule_type !== 'require_min_liked_products');
    const val = parseInt(value);
    if (val > 0) newRules.push({ rule_type: 'require_min_liked_products', min_count: val });
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleRankingRuleChange = (field, value) => {
    let newRules = formData.rules.filter(r => r.rule_type !== 'merit_rule_fulfilled');
    const base = rankingRule || { rule_type: 'merit_rule_fulfilled', merit_rule_name: '', ranking_period: 'current' };
    const updated = { ...base, [field]: value, ranking_period: field === 'ranking_period' ? value : (base.ranking_period || 'current') };
    if (updated.merit_rule_name && updated.ranking_period) newRules.push(updated);
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const handleRemoveRankingRule = () => {
    const newRules = formData.rules.filter(r => r.rule_type !== 'merit_rule_fulfilled');
    setFormData(prev => ({ ...prev, rules: newRules }));
  };

  const selectedMeritRule = rankingRule
    ? (meritRules || []).find(r => r.rule_name === rankingRule.merit_rule_name)
    : null;

  const rankingPeriodOptions = [
    { value: 'current', label: t('promotion.rules.ranking_period.current_month') },
    { value: 'last',    label: t('promotion.rules.ranking_period.last_month') },
  ];

  return (
    <div className="space-y-3">

      {/* ── PROFILE RULES CARD ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface dark:bg-dark-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
          <UserCircleIcon className="h-4 w-4 text-matrix-green" />
          <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
            {t('promotion.rules.user_profile')}
          </span>
        </div>

        <div className="divide-y divide-light-border/30 dark:divide-dark-border/30 px-1 pb-1">
          <ProfileToggle
            icon={UserCircleIcon}
            label={t('promotion.rules.require_public_profile')}
            description={t('promotion.rules.require_public_profile')}
            checked={requirePublicProfile}
            onChange={c => handleSwitchChange('require_public_profile', c)}
            disabled={isLoading}
            accent="green"
          />
          <ProfileToggle
            icon={NewspaperIcon}
            label={t('promotion.rules.require_subscribe_news')}
            checked={requireSubscribeNews}
            onChange={c => handleSwitchChange('require_subscribe_news', c)}
            disabled={isLoading}
            accent="cyan"
          />
          <ProfileToggle
            icon={CakeIcon}
            label={t('promotion.rules.require_birthdate')}
            checked={requireBirthdate}
            onChange={c => handleSwitchChange('require_birthdate', c)}
            disabled={isLoading}
            accent="pink"
          />
          <ProfileToggle
            icon={MapPinIcon}
            label={t('promotion.rules.require_favorite_location')}
            checked={requireFavoriteLocation}
            onChange={c => handleSwitchChange('require_favorite_location', c)}
            disabled={isLoading}
            accent="purple"
          />

          {/* Liked products row — number stepper */}
          <div className="flex items-center justify-between py-3 px-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0">
                <HeartIcon className="h-4 w-4 text-pink-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-none">
                  {t('promotion.rules.require_min_liked_products')}
                </p>
                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                  {minLikedProducts > 0 ? `≥ ${minLikedProducts}` : t('promotion.optional')}
                </p>
              </div>
            </div>
            <NumberStepper
              value={minLikedProducts}
              onChange={handleMinLikedProductsChange}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* ── MERIT RANKING CARD ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface dark:bg-dark-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
          <TrophyIcon className="h-4 w-4 text-vanellix-purple" />
          <span className="text-xs font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
            {t('promotion.rules.merit_rule_fulfilled')}
          </span>
        </div>

        <div className="px-4 pb-4">
          {!rankingRule ? (
            <button
              type="button"
              onClick={() => setIsRuleModalOpen(true)}
              className="w-full py-6 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-light-border/50 dark:border-dark-border/50 text-light-text-secondary dark:text-dark-text-secondary hover:border-vanellix-purple/40 hover:text-vanellix-purple transition-all"
            >
              <TrophyIcon className="h-6 w-6 opacity-40" />
              <span className="text-xs font-medium">
                {t('promotion.rules.merit_rule_name_placeholder')}
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              {/* Selected rule chip */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-vanellix-purple/5 border border-vanellix-purple/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-vanellix-purple/10 flex items-center justify-center shrink-0">
                    <TrophyIcon className="h-4 w-4 text-vanellix-purple" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                      {rankingRule.merit_rule_name}
                    </p>
                    {selectedMeritRule?.template_key && (
                      <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                        {selectedMeritRule.template_key}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsRuleModalOpen(true)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-border dark:hover:bg-dark-border transition-colors font-semibold"
                  >
                    {t('admin.actions') || 'Change'}
                  </button>
                  <button type="button" onClick={handleRemoveRankingRule} className="text-vanellix-purple/60 hover:text-vanellix-purple transition-colors">
                    <XCircleIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Period selector + summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/40 dark:border-dark-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                    {t('promotion.rules.ranking_period_label')}
                  </p>
                  <select
                    value={rankingRule?.ranking_period || 'current'}
                    onChange={e => handleRankingRuleChange('ranking_period', e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-light-text-primary dark:text-dark-text-primary focus:outline-none cursor-pointer"
                    disabled={isLoading}
                  >
                    {rankingPeriodOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {selectedMeritRule && (
                  <div className="p-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/40 dark:border-dark-border/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                      {t('promotion.rules.selected_rule_summary') || 'Summary'}
                    </p>
                    <div className="text-xs text-light-text-primary dark:text-dark-text-primary space-y-0.5">
                      <div>
                        {selectedMeritRule.params?.position_type === 'top_n'
                          ? `Top ${selectedMeritRule.params?.position_to}`
                          : `Pos ${selectedMeritRule.params?.ranking_position}`}
                      </div>
                      <div className="text-light-text-secondary dark:text-dark-text-secondary text-[11px]">
                        {selectedMeritRule.params?.metric_key || selectedMeritRule.params?.metric || '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <MeritRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        meritRules={meritRules}
        t={t}
        initialRuleName={rankingRule?.merit_rule_name || ''}
        onSelect={rule => {
          handleRankingRuleChange('merit_rule_name', rule.rule_name);
          setIsRuleModalOpen(false);
        }}
      />
    </div>
  );
};

export default RulesSection;