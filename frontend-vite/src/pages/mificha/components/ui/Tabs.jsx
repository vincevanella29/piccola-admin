// src/pages/employees_register/components/ui/Tabs.jsx

import React from 'react';
import { motion } from 'framer-motion';

export const Tabs = ({ children }) => <div className="w-full">{children}</div>;

export const TabsList = ({ children }) => <div className="flex items-center gap-2 border-b border-light-border/20 dark:border-dark-border/20">{children}</div>;

export const TabsTrigger = ({ children, isActive, onClick, icon: Icon, className = '' }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${className}
      ${isActive
        ? 'border-matrix-green text-matrix-green'
        : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
      }`}
  >
    <Icon size={16} />
    {children}
  </button>
);

export const TabsContent = ({ children, isActive }) => (
  isActive ? (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-6"
    >
      {children}
    </motion.div>
  ) : null
);