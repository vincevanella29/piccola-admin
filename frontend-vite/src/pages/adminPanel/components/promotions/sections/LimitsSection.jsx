import React from 'react';

const LimitsSection = ({ formData, handleChange, isLoading, t }) => (
  <section>
    <h3 className="text-xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
      {t('admin.promotions.limits')}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
          {t('admin.promotions.max_coupon_per_table')}
        </label>
        <input
          type="number"
          name="max_coupon_per_table"
          value={formData.max_coupon_per_table}
          onChange={handleChange}
          className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
          disabled={isLoading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
          {t('admin.promotions.max_coupon_per_promo')}
        </label>
        <input
          type="number"
          name="max_coupon_per_promo"
          value={formData.max_coupon_per_promo}
          onChange={handleChange}
          className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
          disabled={isLoading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
          {t('admin.promotions.max_claims')}
        </label>
        <input
          type="number"
          name="max_claims"
          value={formData.max_claims}
          onChange={handleChange}
          className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all disabled:opacity-50"
          disabled={isLoading}
        />
      </div>
    </div>
  </section>
);

export default LimitsSection;