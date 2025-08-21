// src/components/VanellixIcon.jsx
import React from 'react';

import { useEffect, useState } from 'react';

const PiccolaIcon = ({ className = '' }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    // Listen for class changes (theme toggle)
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={isDark ? '/logo-piccola-blanco.png' : '/logo-piccola-negro.png'}
      alt="La Piccola Italia"
      className={className}
    />
  );
};

export default PiccolaIcon;