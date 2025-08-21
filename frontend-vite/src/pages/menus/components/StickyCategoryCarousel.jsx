import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CategoryCarousel from './CategoryCarousel';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const StickyCategoryCarousel = ({ categories, selectedCategory, onSelect, onSearchOpen }) => {
  const { t } = useTranslation();
  const wrapperRef = useRef(null);
  const carouselRef = useRef(null);
  const [isSticky, setIsSticky] = useState(false);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const [width, setWidth] = useState('auto');
  const [carouselHeight, setCarouselHeight] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Update dimensions
  useEffect(() => {
    const updateDims = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setLeft(rect.left + window.scrollX);
        setWidth(rect.width);
      }
      if (carouselRef.current) {
        setCarouselHeight(carouselRef.current.offsetHeight);
      }
    };

    updateDims();
    window.addEventListener('resize', updateDims);

    const ro = new ResizeObserver(updateDims);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    if (carouselRef.current) ro.observe(carouselRef.current);

    return () => {
      window.removeEventListener('resize', updateDims);
      ro.disconnect();
    };
  }, []);

  // Sticky scroll logic
  useEffect(() => {
    if (!wrapperRef.current) return;

    const handleScroll = () => {
      const header = document.querySelector('header') || document.querySelector('.Header');
      const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
      const wrapperRect = wrapperRef.current.getBoundingClientRect();

      const stickyThreshold = headerRect.bottom;
      const isStickyNow = wrapperRect.top <= stickyThreshold;

      setIsSticky(isStickyNow);
      setTop(isStickyNow ? stickyThreshold : 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          height: `${carouselHeight}px`,
        }}
      >
        <div
          ref={carouselRef}
          style={
            isSticky
              ? { position: 'fixed', top: `${top}px`, left, width }
              : { position: 'absolute', top: 0, left: 0, width: '100%' }
          }
          className={`w-full backdrop-blur-md bg-light-surface/10 dark:bg-dark-surface/20 py-2 px-4 rounded-full overflow-x-auto scrollbar-hide flex gap-2 shadow-neon transition-all duration-300 ${
            isSticky ? 'border-2 border-matrix-green/20 z-50' : 'z-10'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              className="flex items-center justify-center w-10 h-8 bg-light-surface/10 dark:bg-dark-surface/10 rounded-full text-matrix-green dark:text-matrix-green hover:bg-matrix-green/20 dark:hover:bg-matrix-green/20 transition-all duration-300 focus:outline-none focus:border-2 focus:border-matrix-green shadow-neon"
            >
              <FaBars className="w-5 h-5" />
            </button>
            <button
              onClick={onSearchOpen}
              className="flex items-center justify-center w-10 h-8 bg-light-surface/10 dark:bg-dark-surface/10 rounded-full text-matrix-green dark:text-matrix-green hover:bg-matrix-green/20 dark:hover:bg-matrix-green/20 transition-all duration-300 focus:outline-none focus:border-2 focus:border-matrix-green shadow-neon"
            >
              <FaSearch className="w-5 h-5" />
            </button>
          </div>
          <CategoryCarousel
            categories={categories}
            selectedCategory={selectedCategory}
            onSelect={onSelect}
          />
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 dark:bg-dark-background/50 z-[100] flex items-center justify-center p-4"
            variants={{
              hidden: { opacity: 0, scale: 0.8 },
              visible: { opacity: 1, scale: 1 },
              exit: { opacity: 0, scale: 0.8 },
            }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleCloseModal}
          >
            <motion.div
              className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-xl p-6 max-w-md w-full max-h-[70vh] overflow-y-auto scrollbar-thin shadow-neon backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
                aria-label="Cerrar"
              >
                <FaTimes className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-futurist text-matrix-green dark:text-matrix-green mb-4 text-center">
                {t('club.allCategories', 'Todas las categorías')}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {categories
                  .filter((cat) => cat.estado === true)
                  .sort((a, b) => (a.prioridad ?? 9999) - (b.prioridad ?? 9999))
                  .map((category) => (
                    <button
                      key={String(category.id ?? category.nombre)}
                      className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 text-left ${
                        String(selectedCategory?.id) === String(category.id)
                          ? 'bg-gradient-to-r from-matrix-green to-dark-accent text-white shadow-neon border-2 border-matrix-green/50'
                          : 'bg-light-surface/10 dark:bg-dark-surface/10 text-light-text-secondary dark:text-dark-text-secondary hover:bg-matrix-green/20 dark:hover:bg-matrix-green/20'
                      } focus:outline-none focus:border-2 focus:border-matrix-green`}
                      onClick={() => {
                        onSelect(category);
                        handleCloseModal();
                      }}
                    >
                      {category.nombre}
                    </button>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StickyCategoryCarousel;