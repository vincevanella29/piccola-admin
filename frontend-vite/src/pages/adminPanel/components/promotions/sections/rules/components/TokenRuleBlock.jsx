// src/components/promotions/sections/rules/components/TokenRuleBlock.jsx
import React from 'react';
import Select from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon } from '@heroicons/react/24/outline';

const TokenRuleBlock = ({
  title,
  subtitle,
  icon: Icon,
  options,
  value,
  onChange,
  activeItems = [],
  onAmountBlur,
  onRemove,
  isMulti = false,
  isLoading,
  customSelectStyles, // Tu estilo base
  t,
  placeholder,
}) => {
  
  // Fusionamos tus estilos custom con el estilo necesario para el Portal
  const portalStyles = {
    ...customSelectStyles,
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999 // Z-INDEX NUCLEAR: Siempre arriba
    })
  };

  return (
    <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 last:border-0 relative">
      <div className="flex items-start gap-3 mb-4">
        {Icon && (
          <div className="mt-0.5 p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="pl-0 md:pl-11">
        <Select
          isMulti={isMulti}
          options={options}
          value={value}
          onChange={onChange}
          // --- AQUÍ ESTÁ LA MAGIA ---
          styles={portalStyles} 
          menuPortalTarget={document.body} // Renderiza el menú fuera del componente, directo en el body
          menuPosition="fixed" // Asegura que se pegue bien al scroll
          // --------------------------
          classNamePrefix="custom-select"
          isDisabled={isLoading}
          placeholder={placeholder || "Seleccionar..."}
          isClearable={!isMulti}
          className="text-sm"
        />

        <AnimatePresence>
          {activeItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 flex flex-col gap-2"
            >
              {activeItems.map((item, idx) => (
                <motion.div
                  key={item.id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.imagePath ? (
                      <img src={item.imagePath} alt="" className="w-6 h-6 rounded-full bg-white shadow-sm object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-500">
                        {item.symbol?.[0] || '?'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {item.symbol || item.name}
                      </span>
                      {item.name && item.symbol && (
                         <span className="text-[10px] text-neutral-500 truncate">{item.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <input
                        type="number"
                        defaultValue={item.amount || ''}
                        onBlur={(e) => onAmountBlur(item.id, e.target.value)}
                        className="w-24 px-2 py-1 text-right bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green outline-none transition-all"
                        placeholder="0.00"
                        step="0.000000000000000001"
                        min="0"
                        disabled={isLoading}
                      />
                      <span className="text-[10px] text-neutral-400 mt-0.5">
                        {t('admin.promotions.rules.amount')}
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="text-neutral-400 hover:text-red-500 transition-colors p-1"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TokenRuleBlock;