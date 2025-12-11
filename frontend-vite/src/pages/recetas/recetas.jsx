import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaSyncAlt, FaThLarge, FaTh, FaListUl } from 'react-icons/fa';
import LocationSelector from './components/LocationSelector';
import StickyCategoryCarousel from './components/StickyCategoryCarousel';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import SearchModal from './components/SearchModal';
import useRecipes from '../../hooks/useRecipes';
import useMenuSearch from '../../hooks/useMenuSearch';
import { getCurrentPrice } from '../../hooks/useRestaurantUtils';

const Recetas = ({ appState }) => {
  const { t } = useTranslation();
  const { 
    data, 
    isLoading, 
    error, 
    refresh, 
    selectedLocation, 
    setSelectedLocation, 
    selectedCategory, 
    setSelectedCategory 
  } = useRecipes(appState);
  console.log('data', data);
  
  const { locations = [], categories = [], menus = [], allLocationMenus = [], mediaMap = {} } = data || {};

  // Filtrar solo productos para dinein
  const dineinMenus = menus.filter(menu => {
    if (!menu.restriccion || menu.restriccion.length === 0) return true;
    return menu.restriccion.includes('dinein');
  });

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
  console.log('menus', selectedProduct);

  const [layout, setLayout] = useState('single');

  const cycleLayout = () => {
    let next;
    if (layout === 'single') {
      next = 'double';
    } else if (layout === 'double') {
      next = 'horizontal';
    } else {
      next = 'single';
    }
    setLayout(next);
  };

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

  let containerClass;
  if (layout === 'horizontal') {
    containerClass = 'flex flex-col gap-4 mt-8 mb-20 sm:mb-0';
  } else if (layout === 'double') {
    containerClass = 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 mt-8 mb-20 sm:mb-0';
  } else {
    containerClass = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-8 mb-20 sm:mb-0';
  }

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-12">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold font-futurist text-vanellix-cyan dark:text-vanellix-cyan mb-2 text-center tracking-tight"
        >
          {t('club.menus')}
        </motion.h1>

        <LocationSelector
          locations={locations}
          selectedLocation={selectedLocation}
          onSelect={setSelectedLocation}
          className="mb-8"
        />

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
        
        {isLoading && (
          <div className="text-center">
            <motion.div
              className="inline-block h-12 w-12 border-4 border-light-accent dark:border-dark-accent border-t-transparent rounded-full animate-spin mb-4"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-light-text-secondary dark:text-dark-text-secondary font-sans">
              {t('spinner.loading')}
            </p>
          </div>
        )}
        {error && (
          <div className="text-center">
            <p className="text-light-error dark:text-dark-error font-sans mb-4">
              {t('club.error', { error })}
            </p>
            <button
              onClick={refresh}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-light-accent to-dark-accent text-white rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200 shadow-neon"
            >
              <FaSyncAlt className="w-4 h-4 mr-2 animate-spin" />
              {t('club.retry')}
            </button>
          </div>
        )}
        {!isLoading && !error && (
          <>
            <div className={containerClass}>
              {dineinMenus.map((menu) => (
                <ProductCard
                  key={menu._id}
                  dish={menu}
                  mediaMap={mediaMap}
                  chileTime={appState.chileTime}
                  onClick={() => setSelectedProduct(menu)}
                  profile={appState.profile}
                  account={appState.account}
                  isHorizontal={layout === 'horizontal'}
                />
              ))}
            </div>
            {dineinMenus.length === 0 && categories.length > 0 && (
              <div className="text-center py-10">
                <p className="text-light-text-secondary dark:text-dark-text-secondary font-sans">
                  {t('club.noProducts')}
                </p>
              </div>
            )}
            {selectedProduct && (
              <ProductModal
                product={selectedProduct}
                mediaMap={mediaMap}
                onClose={() => setSelectedProduct(null)}
                t={t}
                selectedLocation={selectedLocation}
              />
            )}
            <SearchModal
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
          </>
        )}
      </div>
      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={cycleLayout}
          className="bg-gradient-to-r from-light-accent/50 to-dark-accent/50 text-white/80 p-4 rounded-full shadow-neon hover:shadow-lg transition-all duration-200"
        >
          {layout === 'single' ? <FaThLarge className="w-6 h-6" /> : layout === 'double' ? <FaTh className="w-6 h-6" /> : <FaListUl className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default Recetas;

export const pageMetadata = {
  path: '/app/analytics/recetas',
  label: 'menus.label',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 7,
  order: 1,
  orderWalletMenu: 2,
  orderFooter: 1,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'menus.description',
  icon: 'FaUtensils',
  isMainPage: false,
  isSearchable: true,
};