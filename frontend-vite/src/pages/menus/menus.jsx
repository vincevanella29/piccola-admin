// src/pages/menus/Menus.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaSyncAlt, FaThLarge, FaTh, FaListUl, FaSearch } from 'react-icons/fa';

// Components
import LocationSelector from './components/LocationSelector';
import StickyCategoryCarousel from './components/StickyCategoryCarousel';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import SearchModal from './components/SearchModal';

// Hooks
import useRestaurantData from '../../hooks/useRestaurantData';
import useMenuSearch from '../../hooks/useMenuSearch';
import { getCurrentPrice } from '../../hooks/useRestaurantUtils';

const Menus = ({ appState }) => {
  const { t } = useTranslation();
  
  // --- Data Hooks ---
  const { 
    data, 
    isLoading, 
    error, 
    refresh, 
    selectedLocation, 
    setSelectedLocation, 
    selectedCategory, 
    setSelectedCategory 
  } = useRestaurantData(appState);
  
  const { locations = [], categories = [], menus = [], allLocationMenus = [], mediaMap = {} } = data || {};

  // --- Filtering Logic ---
  const dineinMenus = useMemo(() => {
    return menus.filter(menu => {
      if (!menu.restriccion || menu.restriccion.length === 0) return true;
      return menu.restriccion.includes('dinein');
    });
  }, [menus]);

  // --- Search & Modal State ---
  const [selectedProduct, setSelectedProduct] = useState(null);
  const {
    searchQuery,
    setSearchQuery,
    isSearchModalOpen,
    setIsSearchModalOpen,
    displayedMenus,
    hasMore,
    loaderRef,
  } = useMenuSearch(allLocationMenus);

  // --- Layout Logic ---
  const [layout, setLayout] = useState('single');

  // Cookie Helpers (moved inside purely for encapsulation or keep as utils)
  const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  const setCookie = (name, value, days) => {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  };

  useEffect(() => {
    const savedLayout = getCookie('menuLayout');
    if (savedLayout && ['single', 'double', 'horizontal'].includes(savedLayout)) {
      setLayout(savedLayout);
    }
  }, []);

  const cycleLayout = () => {
    const nextLayouts = { single: 'double', double: 'horizontal', horizontal: 'single' };
    const next = nextLayouts[layout] || 'single';
    setLayout(next);
    setCookie('menuLayout', next, 30);
  };

  // --- Analytics ---
  useEffect(() => {
    if (window.gtag && dineinMenus.length > 0) {
      window.gtag('event', 'view_item_list', {
        items: dineinMenus.map(menu => ({
          item_id: menu._id,
          item_name: menu.nombre,
          price: getCurrentPrice(menu, 'dinein', appState.chileTime, t).price,
          quantity: 1
        }))
      });
    }
  }, [dineinMenus, t, appState.chileTime]);

  useEffect(() => {
    let userId = appState.profile?.email || appState.account || null;
    if (userId && window.gtag) {
      window.gtag('set', { 'user_id': userId });
    }
  }, [appState.profile, appState.account]);

  // --- Grid Classes Logic ---
  const getGridClasses = () => {
    switch (layout) {
      case 'horizontal':
        return 'flex flex-col gap-4';
      case 'double':
        return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 sm:gap-6';
      default: // single
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6';
    }
  };

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background transition-colors duration-300 pb-24">
      
      {/* 1. HEADER SECTION */}
      <div className="relative z-10 pt-12 pb-6 px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl font-bold font-futurist text-light-text-primary dark:text-dark-text-primary tracking-tight mb-2">
            {t('club.menus')}
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto">
            Explora nuestra selección gastronómica.
          </p>
        </motion.div>

        <div className="flex justify-center">
          <LocationSelector
            locations={locations}
            selectedLocation={selectedLocation}
            onSelect={setSelectedLocation}
            className="w-full max-w-md shadow-sm"
          />
        </div>
      </div>

      {/* 2. CATEGORY NAV (Sticky) */}
      {categories.length > 0 ? (
        <StickyCategoryCarousel
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={(category) => setSelectedCategory(category)}
          onSearchOpen={() => setIsSearchModalOpen(true)}
        />
      ) : (
        !isLoading && (
          <div className="text-center py-4">
            <p className="text-light-text-secondary dark:text-dark-text-secondary font-sans">
              {t('club.noCategories', 'No hay categorías disponibles para esta sucursal.')}
            </p>
          </div>
        )
      )}

      {/* 3. MAIN CONTENT GRID */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <motion.div
              className="w-12 h-12 border-4 border-matrix-green border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary animate-pulse">
              {t('spinner.loading')}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="p-4 bg-light-error/10 dark:bg-dark-error/10 rounded-full">
              <FaSyncAlt className="w-6 h-6 text-light-error dark:text-dark-error" />
            </div>
            <p className="text-light-text-primary dark:text-dark-text-primary">
              {t('club.error', { error })}
            </p>
            <button
              onClick={refresh}
              className="px-6 py-2 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-xl shadow-sm hover:shadow-md transition-all text-sm font-bold text-light-text-primary dark:text-dark-text-primary"
            >
              {t('club.retry')}
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!isLoading && !error && (
          <>
            <motion.div 
              layout 
              className={getGridClasses()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {dineinMenus.map((menu, index) => {
                const safeKey =
                  (menu && (menu._id || menu.id || menu.codigo))
                    ? String(menu._id || menu.id || menu.codigo)
                    : `menu-${index}`;
                return (
                  <ProductCard
                    key={safeKey}
                    dish={menu}
                    mediaMap={mediaMap}
                    chileTime={appState.chileTime}
                    onClick={() => setSelectedProduct(menu)}
                    profile={appState.profile}
                    account={appState.account}
                    isHorizontal={layout === 'horizontal'}
                  />
                );
              })}
            </motion.div>

            {/* Empty State */}
            {dineinMenus.length === 0 && categories.length > 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-center opacity-60">
                <FaSearch className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mb-4" />
                <p className="text-lg font-medium text-light-text-secondary dark:text-dark-text-secondary">
                  {t('club.noProducts')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. FLOATING LAYOUT TOGGLE (Glassmorphism) */}
      <div className="fixed bottom-8 right-6 z-40">
        <motion.button
          onClick={cycleLayout}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-4 rounded-full bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-md border border-light-border/20 dark:border-dark-border/20 shadow-neon text-light-text-primary dark:text-dark-text-primary hover:text-matrix-green transition-colors"
        >
          <AnimatePresence mode='wait'>
            <motion.div
              key={layout}
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              {layout === 'single' && <FaThLarge className="w-6 h-6" />}
              {layout === 'double' && <FaTh className="w-6 h-6" />}
              {layout === 'horizontal' && <FaListUl className="w-6 h-6" />}
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      {/* 5. MODALS */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal
            key="product-modal"
            product={selectedProduct}
            mediaMap={mediaMap}
            onClose={() => setSelectedProduct(null)}
            t={t}
            selectedLocation={selectedLocation}
          />
        )}
        <SearchModal
          key="search-modal"
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          displayedMenus={displayedMenus}
          hasMore={hasMore}
          loaderRef={loaderRef}
          onSelectProduct={setSelectedProduct}
          mediaMap={mediaMap}
          chileTime={appState.chileTime}
        />
      </AnimatePresence>

    </div>
  );
};

export const pageMetadata = {
  path: '/app/analytics/menus',
  label: 'menus.label',
  category: 'restaurant.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 1,
  orderWalletMenu: 1,
  orderFooter: 1,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'menus.description',
  icon: 'FaUtensils',
  isMainPage: false,
  isSearchable: true,
};

export default Menus;