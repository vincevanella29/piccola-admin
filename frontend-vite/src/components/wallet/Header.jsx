import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { polygonAmoy } from 'wagmi/chains';

const CHAINS = [{ id: polygonAmoy.id, name: 'Amoy', color: '#f3b13d' }];

const Header = ({ chainId, handleSwitchChain, switchingChain, onClose }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -16, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="sticky top-0 z-20 bg-light-surface-primary/90 dark:bg-dark-surface-primary/90 shadow-sm border-b border-light-border/5 dark:border-dark-border/5 rounded-t-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-2 min-h-[40px]">
        <motion.div
          className="flex items-center gap-1.5 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-lg px-2.5 py-1 shadow-sm border border-light-border/10 dark:border-dark-border/10"
          whileHover={{ scale: 1.02 }}
        >
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            className="text-light-accent dark:text-dark-accent"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          <select
            value={chainId?.toString()}
            onChange={handleSwitchChain}
            disabled={switchingChain}
            className="text-[11px] bg-transparent border-none focus:ring-2 focus:ring-light-accent/50 dark:focus:ring-dark-accent/50 rounded-lg py-1 px-1.5 transition-all outline-none font-semibold"
            style={{ minWidth: 70 }}
          >
            {CHAINS.map((chain) => (
              <option
                key={chain.id}
                value={chain.id.toString()}
                style={{ color: chain.color, background: 'inherit' }}
              >
                {chain.name}
              </option>
            ))}
          </select>
        </motion.div>
        <motion.button
          onClick={onClose}
          className="p-1.5 rounded-full bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-all duration-200 shadow-sm"
          aria-label={t('wallet.close')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={18} />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Header;