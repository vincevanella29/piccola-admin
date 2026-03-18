import React from 'react';
import {
  UsersIcon,
  HashtagIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// ─── Primitives ───────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 ' +
  'border border-light-border/60 dark:border-dark-border/60 rounded-xl text-sm text-center ' +
  'text-light-text-primary dark:text-dark-text-primary font-mono ' +
  'focus:outline-none focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green/50 ' +
  'transition-all disabled:opacity-40 disabled:cursor-not-allowed';

const LimitCard = ({ icon: Icon, label, hint, name, value, onChange, placeholder, isLoading, accent = 'matrix-green' }) => {
  const accentMap = {
    'matrix-green': {
      icon: 'text-matrix-green',
      bg: 'bg-matrix-green/8',
      ring: 'ring-matrix-green/20',
    },
    'vanellix-purple': {
      icon: 'text-vanellix-purple',
      bg: 'bg-vanellix-purple/8',
      ring: 'ring-vanellix-purple/20',
    },
    'vanellix-cyan': {
      icon: 'text-vanellix-cyan',
      bg: 'bg-vanellix-cyan/8',
      ring: 'ring-vanellix-cyan/20',
    },
  };
  const a = accentMap[accent] ?? accentMap['matrix-green'];

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border/50 dark:border-dark-border/50">
      {/* Icon + label */}
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl ${a.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${a.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary leading-none truncate">
            {label}
          </p>
          {hint && (
            <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              {hint}
            </p>
          )}
        </div>
      </div>

      {/* Input */}
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        min="0"
        placeholder={placeholder}
        className={inputClass}
        disabled={isLoading}
      />
    </div>
  );
};

// ─── LimitsSection ────────────────────────────────────────────────────────────

const LimitsSection = ({ formData, handleChange, isLoading, t }) => (
  <div className="space-y-3">

    {/* Row 1: table + promo */}
    <div className="grid grid-cols-2 gap-3">
      <LimitCard
        icon={UsersIcon}
        label={t('admin.promotions.max_coupon_per_table')}
        hint={t('admin.promotions.max_coupon_per_table_tooltip')}
        name="max_coupon_per_table"
        value={formData.max_coupon_per_table}
        onChange={handleChange}
        isLoading={isLoading}
        accent="matrix-green"
      />
      <LimitCard
        icon={HashtagIcon}
        label={t('admin.promotions.max_coupon_per_promo')}
        hint={t('admin.promotions.max_coupon_per_promo_tooltip')}
        name="max_coupon_per_promo"
        value={formData.max_coupon_per_promo}
        onChange={handleChange}
        isLoading={isLoading}
        accent="vanellix-cyan"
      />
    </div>

    {/* Row 2: total claims + daily */}
    <div className="grid grid-cols-2 gap-3">
      <LimitCard
        icon={ShieldCheckIcon}
        label={t('admin.promotions.max_claims')}
        hint={t('admin.promotions.max_claims_total_label')}
        name="max_claims"
        value={formData.max_claims}
        onChange={handleChange}
        isLoading={isLoading}
        accent="vanellix-purple"
      />
      <LimitCard
        icon={ShieldCheckIcon}
        label={t('admin.promotions.max_claims_per_day')}
        hint={t('admin.promotions.max_claims_per_day_label')}
        name="max_claims_per_day"
        value={formData.max_claims_per_day || ''}
        onChange={handleChange}
        placeholder={t('admin.promotions.max_claims_per_day_placeholder')}
        isLoading={isLoading}
        accent="matrix-green"
      />
    </div>
  </div>
);

export default LimitsSection;