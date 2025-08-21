import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagnifyingGlassIcon, XCircleIcon } from '@heroicons/react/24/solid';
import SearchProduct from './SearchProduct';

const PromotionTypeSection = ({ formData, handleChange, menus, isLoading, t, chileTime, mediaMap }) => {
  // Opciones de tipo de promoción
  const promotionTypes = [
    { key: 'D', label: t('admin.promotions.discount') },
    { key: 'P', label: t('admin.promotions.product') },
    { key: 'C', label: t('admin.promotions.coupon_external') || 'Cupón externo' },
  ];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMenus = menus.filter((menu) =>
    menu.nombre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProduct = (menu) => {
    const currentSkus = Array.isArray(formData.menu_item_skus) ? formData.menu_item_skus : [];
    const newSkus = currentSkus.includes(menu.codigo)
      ? currentSkus.filter((sku) => sku !== menu.codigo)
      : [...currentSkus, menu.codigo];
    handleChange({
      target: {
        name: 'menu_item_skus',
        value: newSkus,
      },
    });
  };

  const handleRemoveProduct = (sku) => {
    const newSkus = formData.menu_item_skus.filter((s) => s !== sku);
    handleChange({ target: { name: 'menu_item_skus', value: newSkus } });
  };

  const handleDiscountTypeChange = (type) => {
    handleChange({
      target: {
        name: 'reward_details.type',
        value: type,
      },
    });
  };

  // Nuevo: handler para cambiar tipo de promoción
  const handlePromotionTypeChange = (key) => {
    handleChange({
      target: {
        name: 'promotion_type',
        value: key,
      },
    });
    if (key === 'P') {
      handleChange({ target: { name: 'reward_type', value: 'product' } });
    } else {
      handleChange({ target: { name: 'reward_type', value: 'discount' } });
      handleChange({ target: { name: 'menu_item_skus', value: [] } });
    }
  };

  const isProductDiscount = formData.reward_type === 'product';
  const isExternalCoupon = formData.promotion_type === 'C';
  // Mostrar selector de productos si es tipo producto o cupón externo
  const showProductSelector = formData.promotion_type === 'P' || formData.promotion_type === 'C';

  const handleApplyToProductChange = (applyToProduct) => {
    handleChange({
      target: {
        name: 'reward_type',
        value: applyToProduct ? 'product' : 'discount',
      },
    });
  
    // Solo modificar promotion_type si NO es cupón externo
    if (formData.promotion_type === 'D' || formData.promotion_type === 'P') {
      handleChange({
        target: {
          name: 'promotion_type',
          value: applyToProduct ? 'P' : 'D',
        },
      });
    }
  
    handleChange({
      target: {
        name: 'menu_item_skus',
        value: applyToProduct ? formData.menu_item_skus : [],
      },
    });
  };

  const formatValue = (value, type) => {
    if (!value) return '';
    if (type === 'percentage') {
      return `${Number(value)}%`;
    }
    return Number(value).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
  };

  const parseValue = (value, type) => {
    const cleanedValue = value.replace(/[^0-9]/g, '');
    return cleanedValue ? parseFloat(cleanedValue) : '';
  };

  return (
    <section className="p-6 bg-gradient-to-br from-light-surface/80 dark:from-dark-surface/80 to-light-surface/50 dark:to-dark-surface/50 rounded-2xl shadow-lg border border-light-border/20 dark:border-dark-border/20">
      <h3 className="text-2xl font-futurist text-vanellix-cyan dark:text-vanellix-cyan mb-6 flex items-center gap-3">
        <MagnifyingGlassIcon className="w-7 h-7 text-matrix-green animate-pulse" />
        {t('admin.promotions.promotion_type_section')}
      </h3>
      <div className="space-y-6">
        {/* Selector de tipo de promoción */}
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.promotion_type')}
            <span className="text-matrix-green text-xs"> ({t('admin.promotions.required')})</span>
          </label>
          <div className="flex gap-2 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-lg p-1">
            {promotionTypes.map(({ key, label }) => (
              <motion.button
                key={key}
                onClick={() => handlePromotionTypeChange(key)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  formData.promotion_type === key
                    ? 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isLoading}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Discount Type Selector */}
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.discount_type')}
            <span className="text-matrix-green text-xs"> ({t('admin.promotions.required')})</span>
          </label>
          <div className="flex gap-2 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-lg p-1">
            {[
              { type: 'percentage', label: '%', icon: '%' },
              { type: 'fixed', label: t('admin.promotions.fixed'), icon: '$' },
            ].map(({ type, label, icon }) => (
              <motion.button
                key={type}
                onClick={() => handleDiscountTypeChange(type)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  formData.reward_details.type === type
                    ? 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isLoading}
              >
                <span className="text-xs">{icon}</span>
                {label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Discount Amount Input */}
        <div>
          <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
            {t('admin.promotions.discount_amount')}
            <span className="text-matrix-green text-xs"> ({t('admin.promotions.required')})</span>
          </label>
          <motion.input
            type="text"
            name="reward_details.discount"
            value={formatValue(formData.reward_details.discount, formData.reward_details.type)}
            onChange={(e) =>
              handleChange({
                target: {
                  name: 'reward_details.discount',
                  value: parseValue(e.target.value, formData.reward_details.type),
                },
              })
            }
            className="w-full p-4 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/30 dark:border-dark-border/30 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green/50 dark:focus:ring-matrix-green/50 transition-all disabled:opacity-50 shadow-md hover:shadow-neon"
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            min={0}
            max={100}
            placeholder={formData.reward_details.type === 'percentage' ? '0%' : '$0'}
          />
        </div>

        {/* Apply to Product Toggle */}
        {showProductSelector && (
          <div>
            <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
              {t('admin.promotions.apply_to_product')}
            </label>
            <div className="flex gap-4">
              {['no', 'yes'].map((option) => (
                <motion.label
                  key={option}
                  className="flex items-center gap-2 cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <input
                    type="radio"
                    name="apply_to_product"
                    value={option}
                    checked={(option === 'yes') === isProductDiscount}
                    onChange={() => handleApplyToProductChange(option === 'yes')}
                    className="w-5 h-5 text-matrix-green focus:ring-matrix-green/50 border-light-border/20 dark:border-dark-border/20"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                    {t(`admin.promotions.${option}`)}
                  </span>
                </motion.label>
              ))}
            </div>
          </div>
        )}

        {/* Selected Products and Modal Button */}
        {showProductSelector && isProductDiscount && (
          <div className="space-y-4">
            <motion.button
              onClick={() => setIsModalOpen(true)}
              className="w-full p-4 bg-gradient-to-r from-matrix-green/30 to-vanellix-cyan/30 dark:from-matrix-green/20 dark:to-vanellix-cyan/20 border border-matrix-green/20 dark:border-matrix-green/10 rounded-xl text-light-text-primary dark:text-dark-text-primary text-center flex items-center justify-center gap-2 hover:bg-matrix-green/40 dark:hover:bg-matrix-green/30 transition-all disabled:opacity-50 shadow-neon"
              disabled={isLoading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <MagnifyingGlassIcon className="w-5 h-5 text-matrix-green" />
              {t('admin.promotions.select_menu')}
            </motion.button>
            {formData.menu_item_skus.length > 0 && (
              <>
                <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('admin.promotions.selected_products')}
                </label>
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex flex-wrap gap-3"
                  >
                    {formData.menu_item_skus.map((sku) => {
                      const menu = menus.find((m) => m.codigo === sku);
                      return (
                        <motion.div
                          key={sku}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-2 bg-gradient-to-r from-matrix-green/20 to-vanellix-cyan/20 dark:from-matrix-green/10 dark:to-vanellix-cyan/10 text-vanellix-cyan dark:text-vanellix-cyan px-4 py-2 rounded-full text-sm font-medium shadow-neon hover:shadow-lg transition-all"
                        >
                          {menu ? menu.nombre : sku}
                          <XCircleIcon
                            className="h-5 w-5 cursor-pointer text-vanellix-purple hover:text-vanellix-purple/70 transition-colors"
                            onClick={() => handleRemoveProduct(sku)}
                          />
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </div>
        )}

        {/* Ayuda contextual para cupón externo */}
        {isExternalCoupon && (
          <div className="p-4 bg-vanellix-cyan/10 border-l-4 border-vanellix-cyan rounded-xl text-vanellix-cyan text-sm mt-4">
            {t('admin.promotions.coupon_external_help') || 'Este tipo de promoción genera un cupón externo para ser usado en la tienda asociada. Solo debes definir el tipo y monto de descuento, días y horarios de validez.'}
          </div>
        )}
      </div>

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
    </section>
  );
};

export default PromotionTypeSection;