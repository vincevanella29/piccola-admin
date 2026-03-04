import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalWallet } from '../hooks/useModalWallet.jsx';
import { usePriceTokens } from '../hooks/usePriceTokens.jsx';
import { useWalletBalances } from '../hooks/useWalletBalances.jsx';
import { useTokenMetadata } from '../hooks/useTokenMetadata.jsx';
import Header from './wallet/Header';
import Balance from './wallet/Balance';
import AccountActions from './wallet/AccountActions';
import Tabs from './wallet/Tabs';
import TokensTab from './wallet/TokensTab';
import TransferTab from './wallet/TransferTab';
import Disclaimer from './wallet/Disclaimer';

const WalletModal = React.memo(({ isOpen, onClose, isPrivyWalletActive, appState }) => {
  const { t } = useTranslation();
  const stableAppState = React.useMemo(() => appState, [appState]);
  const stableT = React.useMemo(() => t, [t]);
  const modalWallet = useModalWallet(stableAppState?.account, stableT, stableAppState);
  const { tokens, loading: balancesLoading } = useWalletBalances(stableAppState?.account, isOpen, stableAppState?.chainId);
  const { fetchPrices, prices, loading: pricesLoading, error: pricesError } = usePriceTokens('polygon-pos');

  // Define token addresses for price fetching
  const tokenAddresses = React.useMemo(() => {
    return Array.isArray(tokens) ? tokens.map((t) => t.address?.toLowerCase() || '').filter(Boolean) : [];
  }, [tokens]);

  const [activeTab, setActiveTab] = React.useState('tokens');
  const [hasFetchedPrices, setHasFetchedPrices] = React.useState(false);
  const pricesFetchedRef = React.useRef(false);

  // Fetch prices only once per modal open
  React.useEffect(() => {
    if (!isOpen) {
      pricesFetchedRef.current = false;
      setHasFetchedPrices(false);
      return;
    }
    if (
      isOpen &&
      !balancesLoading &&
      tokenAddresses.length &&
      !pricesFetchedRef.current &&
      !hasFetchedPrices
    ) {
      pricesFetchedRef.current = true;
      fetchPrices(tokenAddresses)
        .then(() => setHasFetchedPrices(true))
        .catch(() => setHasFetchedPrices(true));
    }
    // eslint-disable-next-line
  }, [isOpen, fetchPrices, balancesLoading, tokenAddresses, hasFetchedPrices]);

  // Early return after all hooks
  if (!isOpen || !stableAppState?.isWalletDataReady) {
    return null;
  }

  // Authenticated but no wallet — show Create Wallet CTA
  if (!stableAppState?.account) {
    const isAuthenticated = Boolean(stableAppState?.isAuthenticated || stableAppState?.token);
    if (!isAuthenticated) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: -20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-[95vw] mx-2 sm:mx-auto lg:w-[400px] flex flex-col items-center rounded-2xl shadow-modal border border-light-border dark:border-dark-border bg-light-background dark:bg-dark-background text-light-text-primary dark:text-dark-text-primary p-8"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 hover:bg-light-error/20 text-light-text-secondary hover:text-light-error transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Animated Wallet Icon */}
            <div className="p-6 rounded-full bg-vanellix-cyan/10 text-vanellix-cyan mb-6">
              <motion.svg
                className="w-16 h-16"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5zm-5 1a1 1 0 100-2 1 1 0 000 2z" />
              </motion.svg>
            </div>

            {/* Text */}
            <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2 text-center">
              {t('wallet.create_title', '¡Crea tu Wallet!')}
            </h2>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary text-center leading-relaxed mb-8 max-w-[280px]">
              {t('wallet.create_desc', 'Tu wallet te permite canjear promociones, recibir recompensas y acceder a todos los beneficios del sistema.')}
            </p>

            {/* CTA Button */}
            <button
              onClick={async () => {
                try {
                  await stableAppState?.createWalletOnDemand?.();
                } catch (e) {
                  console.error('Error creating wallet:', e);
                }
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-vanellix-cyan to-matrix-green text-white font-bold text-lg shadow-lg shadow-vanellix-cyan/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('wallet.create_btn', 'Crear Mi Wallet')}
            </button>

            {/* Secondary info */}
            <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-4 text-center">
              {t('wallet.create_info', 'Es gratis e instantáneo. Tu wallet se crea de forma segura.')}
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Combine tokens with metadata, balances, and prices
  const tokensWithBalances = tokens.map((token) => {
    const addr = token.address.toLowerCase();
    const needsMetadata = !token.symbol || !token.name;
    const metadata = needsMetadata ? useTokenMetadata(token.address) : {};
    const price = prices[addr]?.usd || 0;
    return {
      ...token,
      name: token.name || metadata.name || 'Unknown Token',
      symbol: token.symbol || metadata.symbol || 'UNKNOWN',
      decimals: metadata.decimals || token.decimals || 18,
      logo: token.imagePath || '/token-logos/fallback.png',
      explorer: token.explorer || '',
      price,
      usd: (typeof token.balance === 'number' && !isNaN(token.balance) ? token.balance : 0) * price,
    };
  }).filter((token) => typeof token.balance === 'number' && !isNaN(token.balance));

  // Calculate total USD, excluding tokens with price errors (usd: 0)
  const totalUsd = tokensWithBalances.reduce((sum, t) => t.price > 0 ? sum + t.usd : sum, 0);
  const totalTokens = tokensWithBalances.length;

  const loading = balancesLoading || pricesLoading;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-light-background/95 dark:bg-dark-background/95 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: -20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: -20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-[95vw] mx-2 sm:mx-auto mt-[env(safe-area-inset-top,16px)] h-[620px] max-h-[620px] lg:w-[400px] lg:mt-16 flex flex-col rounded-2xl shadow-modal border border-light-border dark:border-dark-border bg-light-background dark:bg-dark-background text-light-text-primary dark:text-dark-text-primary lg:drop-shadow-2xl"
        >
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-light-background/80 dark:bg-dark-background/80">
              <svg className="animate-spin h-10 w-10 text-vanellix-cyan" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          )}
          <Header
            chainId={modalWallet.chainId}
            handleSwitchChain={modalWallet.handleSwitchChain}
            switchingChain={modalWallet.switchingChain}
            onClose={onClose}
          />
          <Balance
            nativeBalance={tokensWithBalances.find((t) => t.isNative)?.balance || 0}
            nativeSymbol={tokensWithBalances.find((t) => t.isNative)?.symbol || 'MATIC'}
            nativeUsd={totalUsd}
            totalTokens={totalTokens}
          />
          <AccountActions
            account={stableAppState.account}
            handleCopy={modalWallet.handleCopy}
            copied={modalWallet.copied}
            isPrivyWalletActive={isPrivyWalletActive}
            handleExportWallet={modalWallet.handleExportWallet}
            exportLoading={modalWallet.exportLoading}
            fundAmount={modalWallet.fundAmount}
            setFundAmount={modalWallet.setFundAmount}
            handleAddFunds={modalWallet.handleAddFunds}
            fundLoading={modalWallet.fundLoading}
            fundError={modalWallet.fundError}
          />
          {/* Tabs always visible, fixed at top of content area */}
          <div className="flex flex-col flex-1 min-h-0 px-6 pb-5 pt-4">
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="relative flex-1 min-h-0 mt-2 px-1">
              {/* Scrollable area for tab content with padding */}
              <div className="absolute inset-0 overflow-y-auto scrollbar-none py-2">
                {activeTab === 'tokens' && (
                  <TokensTab
                    tokensWithBalances={tokensWithBalances}
                    totalUsd={totalUsd}
                    loading={balancesLoading || pricesLoading}
                  />
                )}
                {activeTab === 'transfer' && (
                  <TransferTab
                    tokensWithBalances={tokensWithBalances}
                    selectedToken={modalWallet.selectedToken}
                    setSelectedToken={modalWallet.setSelectedToken}
                    sendTo={modalWallet.sendTo}
                    setSendTo={modalWallet.setSendTo}
                    sendAmount={modalWallet.sendAmount}
                    setSendAmount={modalWallet.setSendAmount}
                    handleSend={modalWallet.handleSend}
                    error={modalWallet.error}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="w-full px-6 pb-3 pt-2 border-t border-light-border/10 dark:border-dark-border/10 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 rounded-b-2xl flex flex-col items-center shrink-0">
            <Disclaimer
              isOpen={modalWallet.showDisclaimer}
              toggle={modalWallet.toggleDisclaimer}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default WalletModal;