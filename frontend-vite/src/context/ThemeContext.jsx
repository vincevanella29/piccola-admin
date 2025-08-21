import React, { createContext, useState, useContext, useEffect } from 'react';

const hexOrRgbaToRgb = (color) => {
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return `${match[1]}, ${match[2]}, ${match[3]}`;
    }
  } else if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '0, 0, 0';
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children, colors = {}, userLevel }) => {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    setTheme(storedTheme || 'dark');
  }, []);

  useEffect(() => {
    if (theme) {
      localStorage.setItem('theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    const root = document.documentElement;
    Object.entries(colors).forEach(([name, value]) => {
      root.style.setProperty(`--${name}`, value);
      const rgbValue = hexOrRgbaToRgb(value);
      root.style.setProperty(`--${name}-rgb`, rgbValue);
    });
    root.style.setProperty('--user-level', userLevel || 0);
  }, [theme, colors, userLevel]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors, userLevel }}>
      {theme && children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);