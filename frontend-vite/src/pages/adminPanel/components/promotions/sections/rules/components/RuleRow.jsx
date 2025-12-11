// src/components/promotions/sections/rules/components/RuleRow.jsx
import React from 'react';
import { Switch } from '@headlessui/react';

const RuleRow = ({ label, checked, onChange, disabled, border = true }) => {
  return (
    <div className={`flex items-center justify-between py-4 ${border ? 'border-b border-neutral-200/60 dark:border-neutral-800/60' : ''}`}>
      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </span>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`${
          checked ? 'bg-matrix-green' : 'bg-neutral-200 dark:bg-neutral-700'
        } relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-matrix-green/50`}
      >
        <span
          className={`${
            checked ? 'translate-x-6' : 'translate-x-1'
          } inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out`}
        />
      </Switch>
    </div>
  );
};

export default RuleRow;