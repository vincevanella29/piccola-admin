import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getCurrentPrice } from '../../../hooks/useRestaurantUtils';

// Spinner CSS
const Spinner = () => (
  <span className="flex items-center justify-center h-full w-full">
    <span className="inline-block h-6 w-6 border-2 border-light-accent dark:border-dark-accent border-t-transparent rounded-full animate-spin" />
  </span>
);

// Imagen con loader y fade-in
const ImageWithLoader = ({ src, alt, className }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative ${className}`} style={{ minHeight: '4rem', minWidth: '4rem' }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Spinner />
        </div>
      )}
      <motion.img
        src={src}
        alt={alt}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.97 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover rounded-lg transition-all duration-500 border border-light-accent/40 dark:border-dark-accent/40 ${loaded ? '' : 'opacity-0'}`}
        draggable={false}
      />
    </div>
  );
};

const SearchModal = ({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  displayedMenus,
  hasMore,
  loaderRef,
  onSelectProduct,
  mediaMap,
  chileTime,
  profile,
  account,
}) => {
  const { t } = useTranslation(); // ya presente

  useEffect(() => {
    let userId = profile?.email || account || null;
    if (userId && window.gtag) {
      window.gtag('set', { 'user_id': userId });
    }
  }, [profile, account]);

  useEffect(() => {
    if (window.gtag && displayedMenus.length > 0) {
      window.gtag('event', 'view_item_list', {
        item_list_id: 'search_results',
        item_list_name: 'Search Results',
        items: displayedMenus.map(menu => ({
          item_id: menu._id,
          item_name: menu.nombre,
          price: getCurrentPrice(menu, 'dinein', chileTime, t).price,
          quantity: 1
        }))
      });
    }
  }, [displayedMenus, chileTime, t]);

  useEffect(() => {
    if (window.gtag && searchQuery.length > 2) {
      window.gtag('event', 'search', {
        search_term: searchQuery
      });
    }
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleProductClick = (menu) => {
    if (window.gtag) {
      window.gtag('event', 'view_item', {
        items: [{
          item_id: menu._id,
          item_name: menu.nombre,
          price: getCurrentPrice(menu, 'dinein', chileTime, t).price,
          quantity: 1
        }]
      });
    }
    onSelectProduct(menu);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
        variants={{
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.8 },
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-xl p-0 max-w-lg w-full max-h-[70vh] flex flex-col shadow-2xl"
          style={{ backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header fijo */}
          <div className="sticky top-0 z-20 bg-light-surface/95 dark:bg-dark-surface/95 rounded-t-xl px-6 pt-6 pb-2 flex flex-col">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
              aria-label={t('common.close', 'Cerrar')}
            >
              <FaTimes className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-futurist text-vanellix-cyan dark:text-vanellix-cyan mb-4 text-center">
              {t('header.search_placeholder')}
            </h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('header.search_placeholder')}
              className="w-full p-3 mb-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            />
          </div>
          {/* Productos scrollables */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 grid grid-cols-1 gap-4 scrollbar-thin">
            {displayedMenus.length > 0 ? (
              displayedMenus.map((menu) => {
                const { price, isSpecial, schedule } = getCurrentPrice(menu, 'dinein', chileTime, t);
                return (
                  <motion.div
                    key={menu._id}
                    className="flex items-center gap-4 p-3 bg-light-surface/50 dark:bg-dark-surface/50 rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-all duration-300 cursor-pointer"
                    onClick={() => handleProductClick(menu)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {menu.media_url || (menu.media_id && mediaMap[String(menu.media_id)]) ? (
                      <ImageWithLoader
                        src={menu.media_url || mediaMap[String(menu.media_id)]}
                        alt={menu.nombre}
                        className="w-16 h-16 rounded-lg object-cover border border-light-accent/40 dark:border-dark-accent/40"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
                        {t('common.no_image', 'Sin imagen')}
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-vanellix-cyan dark:text-vanellix-cyan">
                        {menu.nombre || t('common.no_name', 'Sin nombre')}
                      </h4>
                      {menu.estado === false ? (
                        <p className="text-sm font-semibold text-light-error dark:text-dark-error bg-light-error/10 dark:bg-dark-error/10 px-2 py-1 rounded-full animate-pulse">
                          {t('club.outOfStock')}
                        </p>
                      ) : isSpecial ? (
                        <>
                          <p className="text-sm text-light-error dark:text-dark-error line-through">
                            {menu.currency || '$'}{Number(menu.precio).toLocaleString('es-CL')}
                          </p>
                          <p className="text-sm font-medium text-light-accent dark:text-dark-accent">
                            {menu.currency || '$'}{Number(price).toLocaleString('es-CL')} ({t('club.offer')})
                          </p>
                          {schedule && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                              {t('common.schedule', 'Horario')}: {schedule}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-medium text-light-accent dark:text-dark-accent">
                          {menu.currency || '$'}{Number(price).toLocaleString('es-CL')}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
                {t('club.noProducts')}
              </p>
            )}
            {hasMore && (
              <div ref={loaderRef} className="flex justify-center py-4">
                <motion.div
                  className="inline-block h-8 w-8 border-4 border-light-accent dark:border-dark-accent border-t-transparent rounded-full animate-spin"
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchModal;