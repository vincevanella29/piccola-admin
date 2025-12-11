// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/components/common/CompanyData/CompanySummary.jsx
import React from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import TokenCard from './Summary/TokenCard.jsx';
import VestingSchedule from './Summary/VestingSchedule.jsx';
import FundAllocation from './Summary/FundAllocation.jsx';

const CompanySummary = ({ tokens, t, language, appState, motionClassName }) => {
  // Accepts an array of tokens and handles selection UI
  const [selectedTab, setSelectedTab] = React.useState(0);
  const { address: walletAddress } = useAccount();
  let _t = t || appState?.t;
  const _lang = language || appState?.language;
  if (typeof _t !== 'function') {
    _t = (x) => x;
  }
  const showTabs = Array.isArray(tokens) && tokens.length > 1;
  const token = Array.isArray(tokens) ? tokens[selectedTab] : tokens;

  // Early return for no token data (never call hooks conditionally)
  if (!token || !token.platform_data) {
    return (
      <motion.div
        className="text-light-text-secondary dark:text-dark-text-secondary italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {typeof _t === 'function' ? _t('companyTokens.no_data', 'No token data available.') : 'No token data available.'}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={motionClassName}
    >
      <div className="w-full max-w-3xl mx-auto sm:px-4 px-1 sm:py-2 py-1 flex flex-col gap-2">
        {showTabs && (
          <div className="w-full flex items-center gap-4 mb-2">
            {tokens.map((tk, idx) => (
              <React.Fragment key={tk.platform_data.symbol || idx}>
                <div
                  className={`cursor-pointer px-2 pb-1 text-base font-semibold transition-colors border-b-2 ${
                    selectedTab === idx
                      ? 'border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent'
                      : 'border-transparent text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent dark:hover:text-dark-accent'
                  }`}
                  onClick={() => setSelectedTab(idx)}
                  style={{ minWidth: 100, textAlign: 'center' }}
                >
                  {tk.platform_data.symbol || _t('companyTokens.unknown_token', 'Token')}
                </div>
                {idx !== tokens.length - 1 && (
                  <div className="h-5 w-px bg-light-border/40 dark:bg-dark-border/40 mx-1" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={token.platform_data.symbol}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <TokenCard tokenData={token} t={_t} walletAddress={walletAddress} appState={appState}/>
          </motion.div>
        </AnimatePresence>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
          }}
        >
          <VestingSchedule
            vestingConfig={token.vesting_config || []}
            t={_t}
            language={_lang}
            totalSupply={token.platform_data?.totalSupply || 0}
            appState={appState}
          />
          <FundAllocation fundUsages={token.fund_usages || []} t={_t} />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default CompanySummary;