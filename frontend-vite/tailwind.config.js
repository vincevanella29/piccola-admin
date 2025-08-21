/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dark-background': 'var(--dark-background, #0A0A0A)',
        'dark-surface': 'var(--dark-surface, #1A1A1A)',
        'dark-surface-secondary': 'var(--dark-surface-secondary, #2A2A2A)',
        'dark-surface-tertiary': 'var(--dark-surface-tertiary, #232323)',
        'dark-text-primary': 'var(--dark-text-primary, #FFFFFF)',
        'dark-text-secondary': 'var(--dark-text-secondary, #B0B0B0)',
        'dark-accent': 'var(--dark-accent, #009246)',
        'dark-accent-hover': 'var(--dark-accent-hover, #007A3D)',
        'dark-error': 'var(--dark-error, #CE2B37)',
        'dark-error-hover': 'var(--dark-error-hover, #A8232D)',
        'dark-success': 'var(--dark-success, #1DE9B6)',
        'dark-border': 'var(--dark-border, #333333)',
        'dark-social-twitter': 'var(--dark-social-twitter, #009246)',
        'dark-social-discord': 'var(--dark-social-discord, #7289DA)',
        'dark-social-github': 'var(--dark-social-github, #FFFFFF)',
        'dark-glow': 'var(--dark-glow, rgba(0, 146, 70, 0.3))',
        'light-background': 'var(--light-background, #F5F5F5)',
        'light-surface': 'var(--light-surface, #FFFFFF)',
        'light-surface-secondary': 'var(--light-surface-secondary, #E5E7EB)',
        'light-surface-tertiary': 'var(--light-surface-tertiary, #D1D5DB)',
        'light-text-primary': 'var(--light-text-primary, #111827)',
        'light-text-secondary': 'var(--light-text-secondary, #6B7280)',
        'light-accent': 'var(--light-accent, #009246)',
        'light-accent-hover': 'var(--light-accent-hover, #007A3D)',
        'light-error': 'var(--light-error, #CE2B37)',
        'light-error-hover': 'var(--light-error-hover, #A8232D)',
        'light-success': 'var(--light-success, #1DE9B6)',
        'light-border': 'var(--light-border, #D1D5DB)',
        'light-social-twitter': 'var(--light-social-twitter, #009246)',
        'light-social-discord': 'var(--light-social-discord, #7289DA)',
        'light-social-github': 'var(--light-social-github, #111827)',
        'light-glow': 'var(--light-glow, rgba(0, 146, 70, 0.3))',
        'matrix-green': 'var(--matrix-green, #009246)',
        'vanellix-purple': 'var(--vanellix-purple, #CE2B37)',
        'vanellix-cyan': 'var(--vanellix-cyan, #FFFFFF)',
        'matrix-green-rgb': 'var(--matrix-green-rgb, 0, 146, 70)',
        'vanellix-purple-rgb': 'var(--vanellix-purple-rgb, 206, 43, 55)',
      },
      backgroundImage: {
        'island-gradient': 'linear-gradient(135deg, var(--tw-gradient-stops))',
        'neon-glow': 'radial-gradient(circle, rgba(var(--matrix-green-rgb), 0.2) 0%, rgba(var(--matrix-green-rgb), 0) 70%)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        futurist: ['Orbitron', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        'neon': '0 0 8px rgba(var(--matrix-green-rgb), 0.3), 0 0 16px rgba(var(--matrix-green-rgb), 0.2)',
        'neon-error': '0 0 8px rgba(var(--vanellix-purple-rgb), 0.3), 0 0 16px rgba(var(--vanellix-purple-rgb), 0.2)',
        'modal': '0 10px 30px rgba(var(--matrix-green-rgb), 0.2)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      spacing: {
        15: '3.75rem',
        18: '4.5rem',
      },
      animation: {
        pulse: 'pulse 2.2s ease-in-out infinite',
        vortex: 'vortex 3s linear infinite',
        orbit: 'orbit 4s linear infinite',
        planet: 'planet 4s linear infinite',
        spark: 'spark 1.6s ease-in-out infinite',
        'spark-delay': 'spark 1.6s ease-in-out infinite 0.7s',
        fadeIn: 'fadeIn 0.5s ease-in-out',
        flow: 'flow 2.2s ease-in-out infinite',
        'flow-delay': 'flow 2.2s ease-in-out infinite 1.1s',
        'v-appear': 'v-appear 1.8s cubic-bezier(.77,0,.18,1) forwards',
        'spin-slow': 'spin-slow 3s linear infinite',
        glow: 'glow 1.5s ease-in-out infinite',
        'hover-lift': 'hoverLift 0.3s ease-in-out',
        'fade-slide': 'fadeSlide 0.4s ease-in-out',
        shimmer: 'shimmer 1.8s infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
        vortex: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        orbit: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        planet: {
          '0%': { transform: 'translate(0, 0) rotate(0deg) translate(10px, 0)' },
          '100%': { transform: 'translate(0, 0) rotate(360deg) translate(10px, 0)' },
        },
        spark: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flow: {
          '0%, 100%': { 'stroke-opacity': '0.7' },
          '50%': { 'stroke-opacity': '1' },
        },
        'v-appear': {
          '0%': { 'stroke-dashoffset': '40' },
          '100%': { 'stroke-dashoffset': '0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(var(--matrix-green-rgb), 0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(var(--matrix-green-rgb), 0.5)' },
        },
        'hover-lift': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2px)' },
        },
        'fade-slide': {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [
    // Scrollbar plugin
    function ({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      };
      addUtilities(newUtilities);
    },
    // Plugin for opacity-modified classes
    plugin(function ({ addUtilities, theme }) {
      const colors = theme('colors');
      const utilities = {};
      // Generate utilities for opacities 10-100 (inclusive)
      const opacities = Array.from({ length: 99 }, (_, i) => i + 1); // 1 to 100

      Object.keys(colors).forEach((colorName) => {
        const colorValue = colors[colorName];
        if (typeof colorValue === 'string' && colorValue.startsWith('var(')) {
          const varName = colorValue.match(/var\((--[^,]+),[^)]+\)/)?.[1];
          if (varName) {
            opacities.forEach((opacity) => {
              const opacityValue = (opacity / 100).toFixed(2);
              // Dash variant: bg-light-surface-90
              utilities[`.bg-${colorName}-${opacity}`] = {
                backgroundColor: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.border-${colorName}-${opacity}`] = {
                borderColor: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.text-${colorName}-${opacity}`] = {
                color: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.fill-${colorName}-${opacity}`] = {
                fill: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.stroke-${colorName}-${opacity}`] = {
                stroke: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.scrollbar-thumb-${colorName}-${opacity}`] = {
                backgroundColor: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };

              // Slash variant: bg-light-surface/90
              utilities[`.bg-${colorName}\\/${opacity}`] = {
                backgroundColor: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.border-${colorName}\\/${opacity}`] = {
                borderColor: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.text-${colorName}\\/${opacity}`] = {
                color: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.fill-${colorName}\\/${opacity}`] = {
                fill: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.stroke-${colorName}\\/${opacity}`] = {
                stroke: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
              utilities[`.scrollbar-thumb-${colorName}\\/${opacity}`] = {
                backgroundColor: `rgba(var(${varName}-rgb), ${opacityValue})`,
              };
            });
          }
        }
      });
      addUtilities(utilities);
    }),
  ],
};