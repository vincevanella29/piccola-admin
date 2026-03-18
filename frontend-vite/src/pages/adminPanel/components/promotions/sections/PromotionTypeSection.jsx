// src/components/promotions/sections/PromotionTypeSection.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TagIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import SearchProduct from './SearchProduct';

const inputClass =
  'w-full px-3 py-2.5 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 ' +
  'border border-light-border/60 dark:border-dark-border/60 rounded-xl text-sm ' +
  'text-light-text-primary dark:text-dark-text-primary ' +
  'focus:outline-none focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green/50 ' +
  'transition-all disabled:opacity-40';

const PromotionTypeSection = ({
  formData,
  handleChange,
  menus,
  isLoading,
  t,
  chileTime,
  mediaMap,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const promotionTypes = [
    { key: 'D', label: t('admin.promotions.discount'),        icon: TagIcon },
    { key: 'P', label: t('admin.promotions.product'),         icon: ShoppingBagIcon },
    { key: 'C', label: t('admin.promotions.coupon_external'), icon: CurrencyDollarIcon },
  ];

  const filteredMenus = menus.filter(m =>
    m.nombre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProduct = menu => {
    const current = Array.isArray(formData.menu_item_skus) ? formData.menu_item_skus : [];
    const next = current.includes(menu.codigo)
      ? current.filter(s => s !== menu.codigo)
      : [...current, menu.codigo];
    handleChange({ target: { name: 'menu_item_skus', value: next } });
  };

  const handleRemoveProduct = sku => {
    handleChange({ target: { name: 'menu_item_skus', value: formData.menu_item_skus.filter(s => s !== sku) } });
  };

  const handlePromotionTypeChange = key => {
    handleChange({ target: { name: 'promotion_type', value: key } });
    handleChange({ target: { name: 'reward_type', value: key === 'P' ? 'product' : 'discount' } });
    if (key !== 'P') handleChange({ target: { name: 'menu_item_skus', value: [] } });
  };

  const handleDiscountTypeChange = type =>
    handleChange({ target: { name: 'reward_details.type', value: type } });

  const isExternalCoupon  = formData.promotion_type === 'C';
  const isProductDiscount = formData.reward_type === 'product';
  const showProductSearch = formData.promotion_type === 'P' || formData.promotion_type === 'C';

  return (
    <div className="space-y-4">
      {/* Label */}
      <label className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
        {t('admin.promotions.promotion_type')} <span className="text-vanellix-purple">*</span>
      </label>

      {/* Type selector — segmented */}
      <div className="flex p-0.5 bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 rounded-xl border border-light-border/40 dark:border-dark-border/40">
        {promotionTypes.map(({ key, label, icon: Icon }) => {
          const active = formData.promotion_type === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handlePromotionTypeChange(key)}
              disabled={isLoading}
              className={`flex-1 py-2.5 px-2 rounded-[10px] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                active
                  ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-matrix-green' : ''}`} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Helper text for external coupon */}
      <AnimatePresence>
        {isExternalCoupon && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 p-3 bg-vanellix-cyan/5 border border-vanellix-cyan/20 rounded-xl text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <InformationCircleIcon className="h-4 w-4 text-vanellix-cyan shrink-0 mt-0.5" />
              <p>{t('admin.promotions.coupon_external_help')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discount value + type */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
          {t('admin.promotions.discount_amount')} <span className="text-vanellix-purple">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <span className="text-light-text-secondary dark:text-dark-text-secondary font-mono text-sm">
              {formData.reward_details.type === 'fixed' ? '$' : '%'}
            </span>
          </div>
          <input
            type="number"
            value={formData.reward_details.discount || ''}
            onChange={e =>
              handleChange({ target: { name: 'reward_details.discount', value: parseFloat(e.target.value) || '' } })
            }
            placeholder="0"
            className={`${inputClass} pl-8 pr-28`}
            disabled={isLoading}
            min="0"
          />
          {/* Embedded type pill */}
          <div className="absolute inset-y-1 right-1 flex gap-0.5 bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 rounded-lg p-0.5">
            {[
              { type: 'percentage', label: '%' },
              { type: 'fixed',      label: 'CLP' },
            ].map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleDiscountTypeChange(type)}
                disabled={isLoading}
                className={`px-3 rounded-md text-xs font-bold transition-all ${
                  formData.reward_details.type === type
                    ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product selector (conditional) */}
      <AnimatePresence>
        {showProductSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-2"
          >
            {/* Search trigger */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-light-border/50 dark:border-dark-border/50 text-light-text-secondary dark:text-dark-text-secondary hover:border-matrix-green/50 hover:text-matrix-green transition-all flex items-center justify-center gap-2 text-sm"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              {t('admin.promotions.select_menu')}
            </button>

            {/* Selected products */}
            {formData.menu_item_skus.length > 0 && (
              <div className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-xl border border-light-border/40 dark:border-dark-border/40 divide-y divide-light-border/30 dark:divide-dark-border/30 overflow-hidden">
                {formData.menu_item_skus.map(sku => {
                  const menu = menus.find(m => m.codigo === sku);
                  return (
                    <div key={sku} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border/40 dark:border-dark-border/40 flex items-center justify-center overflow-hidden shrink-0">
                          {menu?.imagen
                            ? <img src={menu.imagen} alt="" className="h-full w-full object-cover" />
                            : <ShoppingBagIcon className="h-4 w-4 text-light-text-secondary/40" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                            {menu?.nombre || sku}
                          </p>
                          <p className="text-[10px] text-light-text-secondary/60 font-mono">{sku}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(sku)}
                        className="text-light-text-secondary/30 hover:text-vanellix-purple transition-colors ml-2 shrink-0"
                      >
                        <XCircleIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search modal */}
      <SearchProduct
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSelectProduct={handleSelectProduct}
        filteredMenus={filteredMenus}
        formData={formData}
        isLoading={isLoading}
        t={t}
        chileTime={chileTime}
        mediaMap={mediaMap}
      />
    </div>
  );
};

export default PromotionTypeSection;