// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/pages/company/tokens/components/VestingSchedule.jsx
import React from 'react';
import { motion } from 'framer-motion';
import VestingMintTabs from './VestingMintTabs.jsx';

const VestingSchedule = ({ vestingConfig, t, language, totalSupply, appState }) => {
  return (
    <motion.div
      className="bg-light-surface/90 dark:bg-dark-surface/90 rounded-3xl shadow-xl p-4 sm:p-6 flex flex-col gap-3 border border-light-border/30 dark:border-dark-border/30 w-full min-w-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex items-center gap-2 text-lg font-semibold text-light-accent dark:text-dark-accent mb-2 border-b border-light-border/20 dark:border-dark-border/20 pb-2"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {t('companyTokens.vesting_title', 'Vesting Schedule')}
      </motion.div>
      <VestingMintTabs vestingConfig={vestingConfig} t={t} language={language} totalSupply={totalSupply} appState={appState}/>
    </motion.div>
  );
};

export default VestingSchedule;