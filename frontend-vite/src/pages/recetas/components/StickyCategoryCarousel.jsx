import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CategoryCarousel from './CategoryCarousel';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const StickyCategoryCarousel = ({ categories, selectedCategory, onSelect, onSearchOpen }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const [stickyThreshold, setStickyThreshold] = useState(null);

  const wrapperRef = useRef(null);
  const barRef = useRef(null);

  // Medimos altura de la barra y el umbral de scroll una sola vez (y en resize)
  useEffect(() => {
    const measure = () => {
      if (barRef.current) {
        setBarHeight(barRef.current.offsetHeight || 0);
      }
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        // Queremos que la barra se fije cuando su top llegue a ~80px del viewport
        setStickyThreshold(absoluteTop - 80);
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Listener de scroll muy ligero: solo compara contra el threshold
  useEffect(() => {
    if (stickyThreshold == null) return;

    const handleScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      setIsSticky(y >= stickyThreshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [stickyThreshold]);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  return (
    <>
      {/* Wrapper que actúa como spacer para que el layout no salte */}
      <div ref={wrapperRef} style={{ height: barHeight || 'auto' }}>
        <div
          ref={barRef}
          style={
            isSticky
              ? {
                  position: 'fixed',
                  top: 80,
                  left: 0,
                  right: 0,
                  zIndex: 40,
                }
              : {
                  position: 'relative',
                  zIndex: 10,
                }
          }
        >
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="backdrop-blur-md bg-light-surface/10 dark:bg-dark-surface/20 py-2 px-4 rounded-full overflow-x-auto scrollbar-hide flex gap-2 shadow-neon border border-matrix-green/20">
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