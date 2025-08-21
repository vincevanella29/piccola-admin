import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SwapHeader from './SwapHeader';
import SwapFooter from './SwapFooter';
import SwapInfoPanel from './SwapInfoPanel';
import useSwapData from '../../../hooks/useSwapData';
import InfoTooltip from '../../../components/common/Tools/InfoTooltip';
import { FaSyncAlt } from 'react-icons/fa';

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};

const inputVariants = {
  focus: {
    scale: 1.02,
    borderColor: '#00f4ff',
    transition: { duration: 0.3 },
  },
  blur: { scale: 1, borderColor: '#4B5EAA', boxShadow: 'none', transition: { duration: 0.3 } },
};

const SwapCard = ({ appState, tokens, routes = {}, useSwap }) => {
  const {
    showInputDropdown,
    setShowInputDropdown,
    showOutputDropdown,
    setShowOutputDropdown,
    inputDropdownRef,
    outputDropdownRef,
    inputButtonRef,
    outputButtonRef,
    inputDropdownStyle,
    outputDropdownStyle,
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    inputAmount,
    setInputAmount,
    outputAmount,
    setOutputAmount,
    liquidity,
    setLiquidity,
    percentOfPool,
    setPercentOfPool,
    warningHighPercent,
    setWarningHighPercent,
    loadingPrice,
    loadingInfo,
    setLoadingPrice,
    error,
    setError,
    needsApproval,
    setNeedsApproval,
    isInputActive,
    setIsInputActive,
    approveLoading,
    approveError,
    swapLoading,
    swapError,
    allTokens,
    inputBalance,
    inputMetadata,
    outputMetadata,
    handleAmountChange,
    handleApprove,
    handleSwap,
    isValidInput,
    minReceived,
    t,
    getDirectPair,
    unwrapLoading,
    handleUnwrapWMATIC,
  } = useSwapData(appState, useSwap);

  useEffect(() => {
    appState.tokens = tokens;
  }, [tokens, appState]);

  const handleSwitchTokens = () => {
    if (inputToken && outputToken) {
      setInputToken(outputToken);
      setOutputToken(inputToken);
      const tempInputAmount = inputAmount;
      setInputAmount(outputAmount || '');
      setOutputAmount(tempInputAmount || '');
      setLiquidity('');
      setPercentOfPool('');
      setWarningHighPercent(false);
    }
  };

  return (
    <motion.div
      className="w-full max-w-md mx-auto bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md rounded-3xl p-6 border border-light-accent/20 dark:border-dark-accent/20 shadow-neon"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <SwapHeader t={t} warningHighPercent={warningHighPercent} percentOfPool={percentOfPool} />
      <AnimatePresence>
        {(error || approveError || swapError) && (
          <motion.div
            className="mb-4 p-3 bg-light-error/30 dark:bg-dark-error/30 text-light-error dark:text-dark-error rounded-lg text-sm flex items-center gap-2 shadow-neon-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error || approveError || swapError}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-4">
        <div className="relative">
          <label className="flex items-center gap-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {t('swap.from')}
            <InfoTooltip text={t('swap.from_tooltip')} />
          </label>
          <motion.div
            className="relative"
            variants={inputVariants}
            animate={isInputActive ? 'focus' : 'blur'}
          >
            <div className="flex items-center bg-light-surface-tertiary dark:bg-dark-surface-tertiary border border-light-accent/40 dark:border-dark-accent/40 rounded-xl overflow-hidden">
              <div className="relative w-full">
                <button
                  ref={inputButtonRef}
                  type="button"
                  className="flex items-center w-full p-3 bg-transparent text-light-text-primary dark:text-dark-text-primary border-none focus:outline-none rounded-xl transition-all hover:bg-light-accent/10 dark:hover:bg-dark-accent/10"
                  onClick={() => {
                    setShowInputDropdown((open) => !open);
                    setShowOutputDropdown(false);
                  }}
                  tabIndex={0}
                  aria-haspopup="listbox"
                  aria-expanded={showInputDropdown}
                >
                  {inputToken ? (
                    <>
                      <img
                        src={inputToken.logo}
                        alt={inputToken.symbol}
                        className="w-8 h-8 rounded-full mr-2 border border-light-accent/60 dark:border-dark-accent/60 bg-light-surface dark:bg-dark-surface"
                        style={{ objectFit: 'contain' }}
                      />
                      <span className="font-semibold text-light-accent dark:text-dark-accent mr-2">{inputToken.symbol}</span>
                    </>
                  ) : (
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('swap.select_token')}</span>
                  )}
                  <svg
                    className="ml-auto w-4 h-4 text-light-accent dark:text-dark-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showInputDropdown &&
                  typeof window !== 'undefined' &&
                  ReactDOM.createPortal(
                    <motion.div
                      ref={inputDropdownRef}
                      className="z-[200] bg-light-surface dark:bg-dark-surface border border-light-accent/50 dark:border-dark-accent/50 rounded-xl shadow-neon max-h-60 overflow-auto scrollbar-none"
                      style={inputDropdownStyle}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      tabIndex={-1}
                    >
                      {allTokens.map((token) => (
                        <button
                          key={token.address}
                          className={`flex items-center w-full px-4 py-2 hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 focus:bg-light-accent/30 dark:focus:bg-dark-accent/30 transition-all text-left ${
                            inputToken?.address === token.address ? 'bg-light-accent/20 dark:bg-dark-accent/20' : ''
                          }`}
                          onClick={() => {
                            setInputToken(token);
                            setShowInputDropdown(false);
                            setInputAmount('');
                            setOutputAmount('');
                            setLiquidity('');
                            setPercentOfPool('');
                            setWarningHighPercent(false);
                          }}
                        >
                          <img
                            src={token.logo}
                            alt={token.symbol}
                            className="w-6 h-6 rounded-full mr-2 border border-light-accent/60 dark:border-dark-accent/60 bg-light-surface dark:bg-dark-surface"
                          />
                          <span className="font-semibold text-light-accent dark:text-dark-accent mr-2">{token.symbol}</span>
                        </button>
                      ))}
                    </motion.div>,
                    document.body
                  )}
              </div>
              <div className="relative w-full">
                <motion.input
                  type="number"
                  inputMode="decimal"
                  pattern="^[0-9]*[.,]?[0-9]*$"
                  className="w-full p-3 pl-4 bg-transparent text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-2 focus:border-light-accent dark:focus:border-dark-accent text-lg font-mono"
                  placeholder="0.00"
                  value={inputAmount}
                  onChange={(e) => handleAmountChange(e.target.value, true)}
                  min={0}
                  step={0.000001}
                  autoComplete="off"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
          <div className="w-full flex justify-end mt-1">
            <motion.span
              className="text-xs text-light-accent dark:text-dark-accent font-mono"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {inputBalance.isLoading
                ? t('spinner.loading')
                : inputBalance.data
                ? `${parseFloat(inputBalance.data.formatted).toFixed(4)} ${inputToken?.symbol}`
                : ''}
            </motion.span>
          </div>
        </div>
  
        <div className="flex justify-center my-3">
          <motion.div
            className="p-2 bg-gradient-to-r from-light-accent to-dark-accent rounded-full shadow-neon cursor-pointer"
            whileHover={{ rotate: 360, scale: 1.15, boxShadow: '0 0 16px rgba(0, 146, 70, 0.5)' }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.4 }}
            onClick={handleSwitchTokens}
          >
            <FaSyncAlt className="text-white text-lg" />
          </motion.div>
        </div>
  
        <div className="relative">
          <label className="flex items-center gap-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
            {t('swap.to')}
            <InfoTooltip text={t('swap.to_tooltip')} />
          </label>
          <motion.div
            className="relative"
            variants={inputVariants}
            animate={!isInputActive ? 'focus' : 'blur'}
          >
            <div className="flex items-center bg-light-surface-tertiary dark:bg-dark-surface-tertiary border border-light-accent/40 dark:border-dark-accent/40 rounded-xl overflow-hidden">
              <div className="relative w-full">
                <button
                  ref={outputButtonRef}
                  type="button"
                  className="flex items-center w-full p-3 bg-transparent text-light-text-primary dark:text-dark-text-primary border-none focus:outline-none rounded-xl transition-all hover:bg-light-accent/10 dark:hover:bg-dark-accent/10"
                  onClick={() => {
                    setShowOutputDropdown((open) => !open);
                    setShowInputDropdown(false);
                  }}
                  tabIndex={0}
                  aria-haspopup="listbox"
                  aria-expanded={showOutputDropdown}
                >
                  {outputToken ? (
                    <>
                      <img
                        src={outputToken.logo}
                        alt={outputToken.symbol}
                        className="w-8 h-8 rounded-full mr-2 border border-light-accent/60 dark:border-dark-accent/60 bg-light-surface dark:bg-dark-surface"
                        style={{ objectFit: 'contain' }}
                      />
                      <span className="font-semibold text-light-accent dark:text-dark-accent mr-2">{outputToken.symbol}</span>
                    </>
                  ) : (
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('swap.select_token')}</span>
                  )}
                  <svg
                    className="ml-auto w-4 h-4 text-light-accent dark:text-dark-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showOutputDropdown &&
                  typeof window !== 'undefined' &&
                  ReactDOM.createPortal(
                    <motion.div
                      ref={outputDropdownRef}
                      className="z-[200] bg-light-surface dark:bg-dark-surface border border-light-accent/50 dark:border-dark-accent/50 rounded-xl shadow-neon max-h-60 overflow-auto scrollbar-none"
                      style={outputDropdownStyle}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      tabIndex={-1}
                    >
                      {allTokens.map((token) => (
                        <button
                          key={token.address}
                          className={`flex items-center w-full px-4 py-2 hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 focus:bg-light-accent/30 dark:focus:bg-dark-accent/30 transition-all text-left ${
                            outputToken?.address === token.address ? 'bg-light-accent/20 dark:bg-dark-accent/20' : ''
                          }`}
                          onClick={() => {
                            setOutputToken(token);
                            setShowOutputDropdown(false);
                            setInputAmount('');
                            setOutputAmount('');
                            setLiquidity('');
                            setPercentOfPool('');
                            setWarningHighPercent(false);
                          }}
                        >
                          <img
                            src={token.logo}
                            alt={token.symbol}
                            className="w-6 h-6 rounded-full mr-2 border border-light-accent/60 dark:border-dark-accent/60 bg-light-surface dark:bg-dark-surface"
                          />
                          <span className="font-semibold text-light-accent dark:text-dark-accent mr-2">{token.symbol}</span>
                        </button>
                      ))}
                    </motion.div>,
                    document.body
                  )}
              </div>
              <div className="relative w-full">
                <motion.input
                  type="number"
                  value={loadingPrice ? '' : outputAmount}
                  onChange={(e) => handleAmountChange(e.target.value, false)}
                  className="w-full p-3 pl-4 bg-transparent text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-2 focus:border-light-accent dark:focus:border-dark-accent text-lg font-mono"
                  placeholder={loadingPrice ? '' : '0.00'}
                  readOnly={loadingPrice}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: loadingPrice ? 0 : 1 }}
                  transition={{ duration: 0.4 }}
                />
                {loadingPrice && (
                  <motion.div
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 border-light-accent dark:border-dark-accent border-t-light-text-primary dark:border-t-dark-text-primary animate-spin-slow"
                      animate={{ boxShadow: ['0 0 8px rgba(0, 146, 70, 0.3)', '0 0 16px rgba(0, 146, 70, 0.5)', '0 0 8px rgba(0, 146, 70, 0.3)'] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        <SwapInfoPanel
          t={t}
          inputAmount={inputAmount}
          outputAmount={outputAmount}
          inputToken={inputToken}
          outputToken={outputToken}
          liquidity={liquidity}
          percentOfPool={percentOfPool}
          minReceived={minReceived}
          loadingInfo={loadingInfo}
        />
        {/* Botón Unwrap WMATIC */}
        <div className="mt-4">
          {outputToken?.symbol === 'WMATIC' && outputAmount && (
            <motion.button
              className="w-full py-3 rounded-xl bg-gradient-to-r from-light-accent to-dark-accent text-white font-semibold disabled:opacity-50 shadow-neon transition-all"
              whileHover={{ scale: 1.05, boxShadow: '0 0 16px rgba(0, 146, 70, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleUnwrapWMATIC(outputAmount)}
              disabled={unwrapLoading || !outputAmount}
            >
              {unwrapLoading ? t('swap.unwrapping') : t('swap.unwrap_wmatic')}
            </motion.button>
          )}
        </div>
      </div>
      <SwapFooter
        t={t}
        needsApproval={needsApproval}
        approveLoading={approveLoading}
        handleApprove={handleApprove}
        isValidInput={isValidInput}
        swapLoading={swapLoading}
        loadingPrice={loadingPrice}
        handleSwap={handleSwap}
      />
    </motion.div>
  );
};

export default SwapCard;