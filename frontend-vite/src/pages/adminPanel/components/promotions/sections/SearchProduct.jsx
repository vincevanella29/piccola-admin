import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import ImageWithLoader from './ImageWithLoader';
import { getCurrentPrice } from '../../../../../hooks/useRestaurantUtils';

// Spinner component for ImageWithLoader
const Spinner = () => (
  <span className="flex items-center justify-center h-full w-full">
    <span className="inline-block h-6 w-6 border-2 border-light-text-primary dark:border-dark-text-primary border-t-transparent rounded-full animate-spin" />
  </span>
);

// Reused ImageWithLoader from SearchModal
const ImageWithLoaderComponent = ({ src, alt, className }) => {
  const [loaded, setLoaded] = React.useState(false);
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

const SearchProduct = ({
  isModalOpen,
  setIsModalOpen,
  searchQuery,
  setSearchQuery,
  handleSelectProduct,
  filteredMenus,
  formData,
  isLoading,
  t,
  chileTime,
  mediaMap,
}) => {
  if (!isModalOpen) return null;

  // Portal to render the modal at the root of the DOM
  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4"
        variants={{
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.8 },
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={() => setIsModalOpen(false)}
      >
        <motion.div
          className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-xl p-0 max-w-lg w-full max-h-[70vh] flex flex-col shadow-2xl"
          style={{ backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-light-surface/95 dark:bg-dark-surface/95 rounded-t-xl px-6 pt-6 pb-2 flex flex-col">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
              aria-label={t('admin.promotions.close')}
            >
              <FaTimes className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-4 text-center">
              {t('admin.promotions.select_menu')}
            </h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('header.search_placeholder')}
              className="w-full p-3 mb-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            />
          </div>
          {/* Scrollable Products */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 grid grid-cols-1 gap-4 scrollbar-thin">
            {filteredMenus.length > 0 ? (
              filteredMenus.map((menu) => {
                const { price, isSpecial, schedule } = getCurrentPrice(menu, 'dinein', chileTime, t);
                return (
                  <motion.div
                    key={menu._id || menu.codigo}
                    className="flex items-center gap-4 p-3 bg-light-surface/50 dark:bg-dark-surface/50 rounded-lg hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-all duration-300 cursor-pointer"
                    onClick={() => handleSelectProduct(menu)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.menu_item_skus?.includes(menu.codigo)}
                      onChange={() => handleSelectProduct(menu)}
                      className="w-5 h-5 mr-3 text-light-accent focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 rounded-md border-light-border dark:border-dark-border"
                      disabled={isLoading}
                    />
                    {menu.media_url || (menu.media_id && mediaMap[String(menu.media_id)]) ? (
                      <ImageWithLoaderComponent
                        src={menu.media_url || mediaMap[String(menu.media_id)]}
                        alt={menu.nombre}
                        className="w-16 h-16 rounded-lg object-cover border border-light-accent/40 dark:border-dark-accent/40"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
                        {t('common.no_image')}
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-light-text-primary dark:text-dark-text-primary">
                        {menu.nombre || t('common.no_name')}
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
                          <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            {menu.currency || '$'}{Number(price).toLocaleString('es-CL')} ({t('club.offer')})
                          </p>
                          {schedule && (
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                              {t('common.schedule')}: {schedule}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body // Render the modal directly to the body
  );
};

export default SearchProduct;