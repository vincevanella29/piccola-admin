// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/components/common/CompanyData/VestingMintTabs.jsx
import React, { useState, useEffect } from 'react';
import { JsonRpcProvider } from 'ethers';
import InfoTooltip from '../../Tools/InfoTooltip.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCopy } from 'react-icons/fa';

export default function VestingMintTabs({ vestingConfig = [], wallet, t, language, totalSupply = 0, appState }) {
  // Hooks must be called unconditionally at the top
  const [selected, setSelected] = useState(0); // Start at 0 for first unlock
  const [currentBlock, setCurrentBlock] = useState(null);

  useEffect(() => {
    const provider = new JsonRpcProvider(appState.rpcUrl);
    let isMounted = true;
    async function updateBlock() {
      try {
        const block = await provider.getBlockNumber();
        if (isMounted) setCurrentBlock(block);
      } catch (e) {}
    }
    updateBlock();
    const interval = setInterval(updateBlock, 2100); // cada 2.1s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Validate props after hooks
  if (!t) {
    return (
      <motion.div
        className="text-error-500 dark:text-error-400 font-mono text-sm italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {t('companyTokens.vesting_invalid_config', 'Invalid vesting config')}
      </motion.div>
    );
  }

  if (!Array.isArray(vestingConfig) || vestingConfig.length < 6) {
    return (
      <motion.div
        className="text-error-500 dark:text-error-400 font-mono text-sm italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {t('companyTokens.vesting_invalid_config', 'Invalid vesting config')}
      </motion.div>
    );
  }

  const owner = vestingConfig[0]?.toLowerCase(); // Owner wallet for first release
  const beneficiary = vestingConfig[1]?.toLowerCase(); // Beneficiary for subsequent releases
  const startBlock = Number(vestingConfig[3]);
  const startTimestamp = Number(vestingConfig[4]); // en segundos
  const unlocks = Array.isArray(vestingConfig[5]) ? vestingConfig[5] : [];
  const userWallet = (wallet || window?.ethereum?.selectedAddress || '').toLowerCase();

  // Map unlocks to block and percentage
  const unlockRows = unlocks.map(([block, percentage]) => ({
    block: Number(block),
    percentage: Number(percentage),
  }));

  if (!unlockRows.length) {
    return (
      <motion.div
        className="text-light-text-secondary dark:text-dark-text-secondary font-mono text-sm italic"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {t('companyTokens.vesting_no_unlocks', 'No unlocks')}
      </motion.div>
    );
  }

  // Calculate time remaining based on blocks
  function blocksToTime(blocks) {
    const seconds = blocks * 2.1;
    if (seconds <= 0) return t('companyTokens.vesting_time_zero', '00:00:00');
    const years = Math.floor(seconds / (365 * 24 * 3600));
    const days = Math.floor((seconds % (365 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    return `${years > 0 ? years + t('companyTokens.years', 'y') + ' ' : ''}${days > 0 ? days + t('companyTokens.days', 'd') + ' ' : ''}${hours
      .toString()
      .padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  function renderVestingDetail(selectedIdx) {
    const unlockBlock = unlockRows[selectedIdx]?.block;
    if (!unlockBlock) return null; // Prevent rendering invalid index
    const isUnlocked = currentBlock !== null && currentBlock >= unlockBlock;
    const blocksLeft = currentBlock !== null ? Math.max(unlockBlock - currentBlock, 0) : null;
    const percent = unlockRows[selectedIdx]?.percentage;
    const tokensToMint = Math.floor(totalSupply * percent / 100);
    const tokensFormatted = tokensToMint.toLocaleString();

    if (selectedIdx === 0) {
      // First release: already minted by owner
      return (
        <>
          {/* Release Header */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <span className="font-extrabold text-lg text-light-accent dark:text-dark-accent">
              {t('companyTokens.vesting_release_num', { num: selectedIdx + 1 }, { defaultValue: 'Release #{{num}}' })}
            </span>
            <span className="font-mono text-sm font-semibold px-3 py-1 rounded-xl bg-gray-500/10 dark:bg-gray-400/10 text-gray-500 dark:text-gray-400">
              {t('companyTokens.vesting_already_minted', 'Already Minted')}
            </span>
          </motion.div>

          {/* Token Info */}
          <motion.div
            className="flex flex-col items-center gap-1 bg-light-surface/80 dark:bg-dark-surface/80 rounded-xl px-4 py-3 border border-light-border/30 dark:border-dark-border/30 shadow-sm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div className="flex items-center gap-2 text-lg font-mono font-bold text-light-text-primary dark:text-dark-text-primary">
              {tokensFormatted}
              <span className="text-base font-normal text-light-text-secondary dark:text-dark-text-secondary">
                ({percent}%)
              </span>
              <InfoTooltip
                text={t(
                  'companyTokens.vesting_info_tokens_tooltip',
                  'This is the amount of tokens minted in this release by the owner.'
                )}
              />
            </div>
          </motion.div>

          {/* Owner Wallet */}
          <motion.div
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-light-accent dark:text-dark-accent">
                {t('companyTokens.vesting_owner_wallet', 'Minted by Owner')}
              </span>
              <span className="font-mono text-sm text-light-text-primary dark:text-dark-text-primary truncate max-w-[140px] sm:max-w-[200px]">
                {owner}
              </span>
              <motion.button
                onClick={() => navigator.clipboard.writeText(owner)}
                title={t('companyTokens.copy_wallet', 'Copy wallet address')}
                className="text-light-accent dark:text-dark-accent hover:text-light-accent-dark dark:hover:text-dark-accent-light transition-all"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <FaCopy className="text-sm" />
              </motion.button>
            </div>
          </motion.div>
        </>
      );
    }

    // Subsequent releases: standard minting UI
    return (
      <>
        {/* Release Header */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <span className="font-extrabold text-lg text-light-accent dark:text-dark-accent">
            {t('companyTokens.vesting_release_num', { num: selectedIdx + 1 }, { defaultValue: 'Release #{{num}}' })}
          </span>
          <span
            className={`font-mono text-sm font-semibold px-3 py-1 rounded-xl ${
              isUnlocked
                ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent'
                : 'bg-light-surface/80 dark:bg-dark-surface/80 text-light-text-secondary dark:text-dark-text-secondary'
            }`}
          >
            {isUnlocked
              ? t('companyTokens.vesting_tab_unlocked', 'Unlocked')
              : t('companyTokens.vesting_tab_locked', 'Locked')}
          </span>
        </motion.div>

        {/* Token Info */}
        <motion.div
          className="flex flex-col items-center gap-1 bg-light-surface/80 dark:bg-dark-surface/80 rounded-xl px-4 py-3 border border-light-border/30 dark:border-dark-border/30 shadow-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="flex items-center gap-2 text-lg font-mono font-bold text-light-text-primary dark:text-dark-text-primary">
            {tokensFormatted}
            <span className="text-base font-normal text-light-text-secondary dark:text-dark-text-secondary">
              ({percent}%)
            </span>
            <InfoTooltip
              text={t(
                'companyTokens.vesting_info_tokens_tooltip',
                'This is the amount of tokens you can mint in this release, based on the vesting schedule.'
              )}
            />
          </div>
        </motion.div>

        {/* Timing and Mint Button */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <motion.span
            className="font-mono text-base text-light-text-primary dark:text-dark-text-primary bg-light-surface/80 dark:bg-dark-surface/80 px-3 py-1 rounded-xl border border-light-border/30 dark:border-dark-border/30 shadow-sm"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {blocksLeft !== null && !isUnlocked
              ? blocksToTime(blocksLeft)
              : t('companyTokens.vesting_ready', '¡Listo para mintear!')}
          </motion.span>
          <motion.button
            className={`px-6 py-2 rounded-xl font-mono text-base font-semibold transition-all border border-light-border/30 dark:border-dark-border/30
              ${isUnlocked && userWallet && beneficiary && userWallet === beneficiary
                ? 'bg-light-accent/90 dark:bg-dark-accent/90 text-white hover:bg-light-accent-dark dark:hover:bg-dark-accent-light shadow-lg'
                : 'bg-light-surface/80 dark:bg-dark-surface/80 text-light-text-secondary dark:text-dark-text-secondary opacity-60 cursor-not-allowed'}
            `}
            onClick={() => {
              if (isUnlocked && userWallet && beneficiary && userWallet === beneficiary) {
                alert(`Mint ${tokensFormatted}!`);
              }
            }}
            disabled={!(isUnlocked && userWallet && beneficiary && userWallet === beneficiary)}
            whileHover={{ scale: isUnlocked && userWallet && beneficiary && userWallet === beneficiary ? 1.05 : 1 }}
            whileTap={{ scale: isUnlocked && userWallet && beneficiary && userWallet === beneficiary ? 0.95 : 1 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            {t('companyTokens.mint_btn', 'Mint')}
          </motion.button>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      className="bg-light-surface/90 dark:bg-dark-surface/90 rounded-3xl shadow-xl p-6 flex flex-col gap-4 border border-light-border/30 dark:border-dark-border/30 backdrop-blur-md"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Beneficiary Wallet Display */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center gap-2"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <span className="font-semibold text-base text-light-accent dark:text-dark-accent">
          {t('companyTokens.vesting_beneficiary', 'Beneficiary Wallet')}
        </span>
        <div className="flex items-center gap-2 max-w-full overflow-hidden">
          <span className="font-mono text-sm text-light-text-primary dark:text-dark-text-primary truncate max-w-[140px] sm:max-w-[200px]">
            {beneficiary}
          </span>
          <motion.button
            onClick={() => navigator.clipboard.writeText(beneficiary)}
            title={t('companyTokens.copy_wallet', 'Copy wallet address')}
            className="text-light-accent dark:text-dark-accent hover:text-light-accent-dark dark:hover:text-dark-accent-light transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <FaCopy className="text-sm" />
          </motion.button>
        </div>
      </motion.div>

      {/* Release Tabs */}
      <motion.div
        className="flex gap-2 flex-wrap mt-2"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }}
      >
        {unlockRows.map((u, i) => {
          const tabIdx = i; // 0-based index for state
          return (
            <motion.button
              key={tabIdx}
              className={`px-4 py-1 rounded-xl font-mono text-sm font-semibold transition-all border border-light-border/30 dark:border-dark-border/30
                ${selected === tabIdx
                  ? 'bg-light-accent/90 dark:bg-dark-accent/90 text-white shadow-lg'
                  : 'bg-light-surface/80 dark:bg-dark-surface/80 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 hover:text-light-accent dark:hover:text-dark-accent'}
              `}
              onClick={() => setSelected(tabIdx)}
              style={{ minWidth: 80 }}
              variants={{
                hidden: { opacity: 0, x: -16 },
                visible: { opacity: 1, x: 0 },
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t('companyTokens.vesting_release_num', { num: tabIdx + 1 }, { defaultValue: 'Release #{{num}}' })}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Vesting Details */}
      <motion.div
        className="mt-4 pt-4 border-t border-light-border/30 dark:border-dark-border/30 flex flex-col gap-4"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderVestingDetail(selected)}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}