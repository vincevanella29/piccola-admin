import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HexColorPicker, RgbaStringColorPicker } from 'react-colorful';
import { FaCheck, FaTimes } from 'react-icons/fa';

// Available color formats
const FORMATS = [
  { label: 'HEX', value: 'hex' },
  { label: 'RGB', value: 'rgb' },
  { label: 'RGBA', value: 'rgba' },
];

// Utility to parse and validate colors
const parseColor = (value, fallback = { hex: '#009246', alpha: 1, format: 'hex' }) => {
  // Parse rgba or rgb
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const hex = `#${(+r).toString(16).padStart(2, '0')}${(+g).toString(16).padStart(2, '0')}${(+b).toString(16).padStart(2, '0')}`;
    return {
      hex,
      alpha: a !== undefined ? parseFloat(a) : 1,
      format: a !== undefined ? 'rgba' : 'rgb',
    };
  }
  // Parse hex
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return {
      hex: value.startsWith('#') ? value : `#${value}`,
      alpha: 1,
      format: 'hex',
    };
  }
  return fallback;
};

// Convert hex to rgba string
const hexToRgba = (hex, alpha = 1) => {
  hex = hex.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex[0] + hex[1], 16);
    g = parseInt(hex[2] + hex[3], 16);
    b = parseInt(hex[4] + hex[5], 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
};

// Format the color for display based on the selected format
const formatColorForDisplay = (hex, alpha, format) => {
  if (format === 'rgba') return hexToRgba(hex, alpha);
  if (format === 'rgb') return hexToRgba(hex, 1).replace(/,1\)$/g, ')');
  return hex;
};

const ModernColorPicker = ({
  value = '#009246',
  onChange,
  onClose,
  format = 'hex',
  showAlpha = true,
  showFormats = true,
  previewClass = '',
}) => {
  // Initialize state from the provided value
  const initialColor = parseColor(value);
  const [hex, setHex] = useState(initialColor.hex);
  const [alpha, setAlpha] = useState(initialColor.alpha);
  const [currentFormat, setCurrentFormat] = useState(format);

  // Handle color selection from the picker
  const handleColorSelection = (newColor) => {
    let newHex = newColor;
    let newAlpha = alpha;

    if (currentFormat === 'rgba' || currentFormat === 'rgb') {
      const parsed = parseColor(newColor);
      newHex = parsed.hex;
      if (currentFormat === 'rgba') {
        newAlpha = parsed.alpha;
        setAlpha(newAlpha);
      }
    }

    setHex(newHex);
    const outputColor = formatColorForDisplay(newHex, newAlpha, currentFormat);
    if (onChange) onChange(outputColor);
  };

  // Handle opacity change
  const handleAlphaChange = (e) => {
    const newAlpha = Number(e.target.value);
    setAlpha(newAlpha);
    const outputColor = formatColorForDisplay(hex, newAlpha, currentFormat);
    if (onChange) onChange(outputColor);
  };

  // Handle format change
  const handleFormatChange = (newFormat) => {
    setCurrentFormat(newFormat);
    const outputColor = formatColorForDisplay(hex, alpha, newFormat);
    if (onChange) onChange(outputColor);
  };

  // Color for display in the picker and preview
  const displayColor = formatColorForDisplay(hex, alpha, currentFormat);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-light-surface dark:bg-dark-surface rounded-xl shadow-neon p-4 sm:p-6 w-full max-w-[90vw] sm:max-w-xs"
        style={{ minWidth: 220 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-base sm:text-lg text-light-text-primary dark:text-dark-text-primary">
            Color Picker
          </span>
          <button
            onClick={onClose}
            className="text-light-error dark:text-dark-error hover:scale-110 transition-transform"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-light-border dark:border-dark-border shadow-lg mb-2 ${previewClass}`}
            style={{ background: displayColor }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
          {showFormats && (
            <div className="flex gap-2 mb-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-semibold border transition-all duration-200 ${
                    currentFormat === f.value
                      ? 'bg-matrix-green text-white border-matrix-green'
                      : 'bg-transparent text-light-text-secondary dark:text-dark-text-secondary border-light-border dark:border-dark-border hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'
                  }`}
                  onClick={() => handleFormatChange(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {currentFormat === 'hex' && (
            <HexColorPicker color={hex} onChange={handleColorSelection} className="w-full" />
          )}
          {(currentFormat === 'rgb' || currentFormat === 'rgba') && (
            <RgbaStringColorPicker
              color={displayColor}
              onChange={handleColorSelection}
              className="w-full"
            />
          )}
          {showAlpha && currentFormat === 'rgba' && (
            <div className="w-full flex items-center gap-2 mt-2">
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                Opacidad
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={alpha}
                onChange={handleAlphaChange}
                className="flex-1 accent-matrix-green"
              />
              <span className="text-xs w-8 text-right text-light-text-secondary dark:text-dark-text-secondary">
                {Math.round(alpha * 100)}%
              </span>
            </div>
          )}
          <div className="w-full mt-4">
            <div className="bg-light-surface-secondary dark:bg-dark-surface-secondary rounded p-2 text-xs sm:text-sm text-center select-all text-light-text-primary dark:text-dark-text-primary">
              {displayColor}
            </div>
          </div>
        </div>
        <button
          className="mt-4 w-full py-2 rounded-lg bg-matrix-green text-white font-bold shadow-neon hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          onClick={onClose}
        >
          <FaCheck /> OK
        </button>
      </motion.div>
    </div>
  );
};

export default ModernColorPicker;