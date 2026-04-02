import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Settings2 } from 'lucide-react';

import RoleScopesTab from './components/roles/RoleScopesTab.jsx';
import PoliciesTab from './components/roles/PoliciesTab.jsx';

const EmpresaRolesTab = ({ appState, t, prefetchedEmpresas = [], prefetchedSucursales = [] }) => {
  const [subtab, setSubtab] = useState('wallet');

  const tabs = [
    { key: 'wallet', icon: ShieldCheck, label: t?.('empresa.tab_wallet_scopes') || 'Wallet Scopes' },
    { key: 'policies', icon: Settings2, label: t?.('empresa.tab_policies') || 'Políticas Cargo/Sección' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs Apple pill style */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-100/80 dark:bg-gray-800/60 rounded-2xl w-fit backdrop-blur-sm">
        {tabs.map(({ key, icon: Icon, label }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSubtab(key)}
            className={`relative inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              subtab === key
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="whitespace-nowrap">{label}</span>
          </motion.button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={subtab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {subtab === 'wallet' && (
          <RoleScopesTab
            appState={appState}
            t={t}
            prefetchedEmpresas={prefetchedEmpresas}
            prefetchedSucursales={prefetchedSucursales}
          />
        )}
        {subtab === 'policies' && (
          <PoliciesTab
            appState={appState}
            t={t}
            prefetchedEmpresas={prefetchedEmpresas}
            prefetchedSucursales={prefetchedSucursales}
          />
        )}
      </motion.div>
    </div>
  );
};

export default EmpresaRolesTab;
