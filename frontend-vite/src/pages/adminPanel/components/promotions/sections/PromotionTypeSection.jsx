// src/components/promotions/sections/rules/PromotionTypeSection.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TagIcon, 
  CurrencyDollarIcon, 
  ShoppingBagIcon, 
  MagnifyingGlassIcon, 
  XCircleIcon, 
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import SearchProduct from './SearchProduct';

const PromotionTypeSection = ({ 
  formData, 
  handleChange, 
  menus, 
  isLoading, 
  t, 
  chileTime, 
  mediaMap 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Logic Helpers ---
  const promotionTypes = [
    { key: 'D', label: t('admin.promotions.discount'), icon: TagIcon },
    { key: 'P', label: t('admin.promotions.product'), icon: ShoppingBagIcon },
    { key: 'C', label: t('admin.promotions.coupon_external') || 'Cupón Externo', icon: CurrencyDollarIcon },
  ];

  const filteredMenus = menus.filter((menu) =>
    menu.nombre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProduct = (menu) => {
    const currentSkus = Array.isArray(formData.menu_item_skus) ? formData.menu_item_skus : [];
    const newSkus = currentSkus.includes(menu.codigo)
      ? currentSkus.filter((sku) => sku !== menu.codigo)
      : [...currentSkus, menu.codigo];
    handleChange({ target: { name: 'menu_item_skus', value: newSkus } });
  };

  const handleRemoveProduct = (sku) => {
    const newSkus = formData.menu_item_skus.filter((s) => s !== sku);
    handleChange({ target: { name: 'menu_item_skus', value: newSkus } });
  };

  const handleDiscountTypeChange = (type) => {
    handleChange({ target: { name: 'reward_details.type', value: type } });
  };

  const handlePromotionTypeChange = (key) => {
    handleChange({ target: { name: 'promotion_type', value: key } });
    if (key === 'P') {
      handleChange({ target: { name: 'reward_type', value: 'product' } });
    } else {
      handleChange({ target: { name: 'reward_type', value: 'discount' } });
      handleChange({ target: { name: 'menu_item_skus', value: [] } });
    }
  };

  const isProductDiscount = formData.reward_type === 'product';
  const isExternalCoupon = formData.promotion_type === 'C';
  const showProductSelector = formData.promotion_type === 'P' || formData.promotion_type === 'C';

  const handleApplyToProductChange = (applyToProduct) => {
    handleChange({ target: { name: 'reward_type', value: applyToProduct ? 'product' : 'discount' } });
    if (formData.promotion_type === 'D' || formData.promotion_type === 'P') {
      handleChange({ target: { name: 'promotion_type', value: applyToProduct ? 'P' : 'D' } });
    }
    handleChange({ target: { name: 'menu_item_skus', value: applyToProduct ? formData.menu_item_skus : [] } });
  };

  const formatValue = (value, type) => {
    if (!value) return '';
    // Solo mostramos el número raw en el input para edición, el símbolo lo manejamos visualmente
    return value; 
  };

  const parseValue = (value, type) => {
    const cleanedValue = value.replace(/[^0-9.]/g, ''); // Permitir decimales si es necesario
    return cleanedValue ? parseFloat(cleanedValue) : '';
  };

  // --- Styles ---
  const cardClass = "bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6";
  const labelClass = "block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2";

  return (
    <section className="max-w-4xl mx-auto space-y-6 mt-6">
      <h3 className="text-xl font-futurist text-neutral-900 dark:text-white px-1 flex items-center gap-2">
        <TagIcon className="h-6 w-6 text-matrix-green" />
        {t('admin.promotions.promotion_type_section')}
      </h3>

      {/* CARD 1: MAIN TYPE SELECTOR */}
      <div className={cardClass}>
        <label className={labelClass}>
          {t('admin.promotions.promotion_type')} <span className="text-red-500">*</span>
        </label>
        
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
          {promotionTypes.map(({ key, label, icon: Icon }) => {
            const isActive = formData.promotion_type === key;
            return (
              <button
                key={key}
                onClick={() => handlePromotionTypeChange(key)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isActive
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm ring-1 ring-black/5'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
                disabled={isLoading}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-matrix-green' : ''}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Helper Text for Coupon */}
        <AnimatePresence>
          {isExternalCoupon && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm border border-blue-100 dark:border-blue-800">
                <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
                <p>
                  {t('admin.promotions.coupon_external_help') || 'Este tipo de promoción genera un cupón externo. Define el descuento y validez; el código se canjeará en la tienda asociada.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CARD 2: VALUE CONFIGURATION */}
      <div className={cardClass}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Discount Value Input Group */}
          <div className="flex-1">
             <label className={labelClass}>
               {t('admin.promotions.discount_amount')} <span className="text-red-500">*</span>
             </label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-neutral-500 font-mono text-lg">
                    {formData.reward_details.type === 'fixed' ? '$' : '%'}
                  </span>
                </div>
                <input
                  type="text" // Usamos text para controlar mejor el formatting si quisieramos
                  value={formatValue(formData.reward_details.discount, formData.reward_details.type)}
                  onChange={(e) =>
                    handleChange({
                      target: {
                        name: 'reward_details.discount',
                        value: parseValue(e.target.value, formData.reward_details.type),
                      },
                    })
                  }
                  placeholder="0"
                  className="w-full pl-8 pr-32 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-lg font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green transition-all"
                  disabled={isLoading}
                />
                
                {/* Embedded Type Selector */}
                <div className="absolute inset-y-1 right-1 flex bg-neutral-200 dark:bg-neutral-700 rounded-lg p-1">
                   {[
                    { type: 'percentage', label: 'Percent' },
                    { type: 'fixed', label: 'Fixed' },
                   ].map(({ type, label }) => {
                     const isActive = formData.reward_details.type === type;
                     return (
                       <button
                        key={type}
                        onClick={() => handleDiscountTypeChange(type)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          isActive 
                           ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-white shadow-sm'
                           : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
                        }`}
                        title={label}
                       >
                         {type === 'percentage' ? '%' : 'CLP'}
                       </button>
                     );
                   })}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* CARD 3: SCOPE (Apply to Product) - Conditional */}
      {showProductSelector && (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
             <div>
               <label className="text-sm font-semibold text-neutral-900 dark:text-white block">
                 {t('admin.promotions.apply_to_product')}
               </label>
               <span className="text-xs text-neutral-500 block">
                 Limitar el descuento a productos específicos
               </span>
             </div>
             
             {/* Toggle Switch */}
             <Switch
                checked={isProductDiscount}
                onChange={handleApplyToProductChange}
                disabled={isLoading}
                className={`${
                  isProductDiscount ? 'bg-matrix-green' : 'bg-neutral-200 dark:bg-neutral-700'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-matrix-green/50`}
              >
                <span className={`${isProductDiscount ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </Switch>
          </div>

          <AnimatePresence>
            {isProductDiscount && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                 <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
                    {/* Search Trigger */}
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-matrix-green hover:text-matrix-green hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all flex items-center justify-center gap-2 group"
                      disabled={isLoading}
                    >
                      <MagnifyingGlassIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                      {t('admin.promotions.select_menu')}
                    </button>

                    {/* Selected Products List */}
                    {formData.menu_item_skus.length > 0 && (
                      <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-xl border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
                         {formData.menu_item_skus.map((sku) => {
                           const menu = menus.find((m) => m.codigo === sku);
                           // Mock image logic or use real one
                           const imageSrc = menu?.imagen || null; 

                           return (
                             <motion.div 
                               key={sku}
                               initial={{ opacity: 0 }}
                               animate={{ opacity: 1 }}
                               exit={{ opacity: 0 }}
                               className="flex items-center justify-between p-3"
                             >
                                <div className="flex items-center gap-3">
                                   <div className="h-10 w-10 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center overflow-hidden">
                                      {imageSrc ? (
                                        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        <ShoppingBagIcon className="h-5 w-5 text-neutral-400" />
                                      )}
                                   </div>
                                   <div>
                                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                                        {menu ? menu.nombre : sku}
                                      </p>
                                      <p className="text-xs text-neutral-500 font-mono">
                                        {sku}
                                      </p>
                                   </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveProduct(sku)}
                                  className="text-neutral-400 hover:text-red-500 transition-colors p-2"
                                >
                                  <XCircleIcon className="h-5 w-5" />
                                </button>
                             </motion.div>
                           );
                         })}
                      </div>
                    )}
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* MODAL INJECTION */}
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