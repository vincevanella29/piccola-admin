import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Spinner = () => (
  <span className="flex items-center justify-center h-full w-full">
    <span className="inline-block h-6 w-6 border-2 border-light-accent dark:border-dark-accent border-t-transparent rounded-full animate-spin" />
  </span>
);

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

export default ImageWithLoader;