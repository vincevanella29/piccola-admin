import React from 'react';

const CategoryCarousel = ({ categories = [], selectedCategory, onSelect }) => {
  const activeCategories = categories
    .filter((cat) => cat.estado === true)
    .sort((a, b) => {
      const pa = a.prioridad ?? 9999;
      const pb = b.prioridad ?? 9999;
      return pa - pb;
    });

  return (
    <div
      className="sticky top-0 z-30 w-full backdrop-blur-md bg-light-surface/10 dark:bg-dark-surface/20 py-2 px-2 rounded-full overflow-x-auto scrollbar-hide flex gap-2 shadow-neon"
      style={{ minHeight: 56 }}
    >
      {activeCategories.map((category) => (
        <button
          key={String(category.id ?? category.nombre)}
          className={`whitespace-nowrap px-5 py-2 rounded-full font-medium text-sm transition-all duration-300 ${
            String(selectedCategory?.id) === String(category.id)
              ? 'bg-gradient-to-r from-light-accent to-dark-accent text-white shadow-neon border-2 border-light-accent/50 dark:border-dark-accent/50'
              : 'bg-light-surface/10 dark:bg-dark-surface/10 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/20 dark:hover:bg-dark-accent/20'
          } focus:outline-none focus:border-2 focus:border-light-accent dark:focus:border-dark-accent`}
          onClick={() => onSelect?.(category)}
        >
          {category.nombre}
        </button>
      ))}
    </div>
  );
};

export default CategoryCarousel;