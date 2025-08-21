import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, Send } from 'lucide-react';

const TransferTab = ({
  tokensWithBalances,
  selectedToken,
  setSelectedToken,
  sendTo,
  setSendTo,
  sendAmount,
  setSendAmount,
  handleSend,
  error,
}) => {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -5 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <h4 className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2.5">
        {t('wallet.transfer_title')}
      </h4>
      <motion.div variants={itemVariants}>
        <label className="block text-[12px] font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
          {t('wallet.tokens_tab')}
        </label>
        <select
          value={selectedToken?.symbol || ''}
          onChange={(e) =>
            setSelectedToken(tokensWithBalances.find((t) => t.symbol === e.target.value))
          }
          className="w-full px-3 py-2 rounded-3xl border border-light-border/10 dark:border-dark-border/10 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-primary dark:text-dark-text-primary mb-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-matrix-green/50 dark:focus:ring-matrix-green/40 focus:shadow-neon transition-all z-10"
        >
          {tokensWithBalances.map((token) => (
            <option key={token.symbol} value={token.symbol}>
              {token.symbol} - {token.name}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
            {t('wallet.balance')}: {selectedToken ? 
            `${new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
            }).format(Number(selectedToken.balance))} ${selectedToken.symbol}` : '--'}
          </span>
        </div>
        <label className="block text-[12px] font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
          {t('wallet.send_to')}
        </label>
        <motion.input
          type="text"
          value={sendTo}
          onChange={(e) => setSendTo(e.target.value)}
          placeholder="0x..."
          className="w-full px-3 py-2 rounded-3xl border border-light-border/10 dark:border-dark-border/10 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-primary dark:text-dark-text-primary text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-matrix-green/50 dark:focus:ring-matrix-green/40 focus:shadow-neon transition-all z-10"
          whileFocus={{ scale: 1.02 }}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
        <label className="block text-[12px] font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
          {t('wallet.amount')}
        </label>
        <motion.input
          type="number"
          min="0"
          step="any"
          placeholder={t('wallet.amount_to_send') || 'Monto a enviar'}
          value={sendAmount}
          onChange={(e) => setSendAmount(e.target.value)}
          className="w-full px-3 py-2 rounded-3xl border border-light-border/10 dark:border-dark-border/10 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-primary dark:text-dark-text-primary text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-matrix-green/50 dark:focus:ring-matrix-green/40 focus:shadow-neon transition-all mb-1 z-10"
          whileFocus={{ scale: 1.02 }}
        />
        <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mb-1">
          {t('wallet.available_balance')}:{' '}
          <span className="font-mono font-bold">
            {selectedToken ? 
            `${new Intl.NumberFormat('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
            }).format(Number(selectedToken.balance))} ${selectedToken.symbol}` : '0.0000'}{' '}
          </span>
        </div>
        {sendAmount && selectedToken && Number(sendAmount) > selectedToken.balance && (
          <motion.div
            className="text-[11px] text-light-error dark:text-dark-error mb-1 w-full text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {t('wallet.error_insufficient_balance') || 'Saldo insuficiente para transferir.'}
          </motion.div>
        )}
        {error && (
          <motion.div
            className="text-[11px] text-light-error dark:text-dark-error mb-1 w-full text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}
        <motion.button
          type="button"
          onClick={handleSend}
          disabled={
            !selectedToken ||
            !sendTo ||
            !sendAmount ||
            isNaN(Number(sendAmount)) ||
            Number(sendAmount) <= 0 ||
            Number(sendAmount) > selectedToken.balance
          }
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-matrix-green hover:bg-matrix-green/90 dark:bg-matrix-green dark:hover:bg-matrix-green/80 text-white dark:text-dark-text-primary rounded-3xl font-bold text-[12px] shadow-neon hover:shadow-lg hover:animate-hover-lift transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-none"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Send size={16} />
          {t('wallet.send')}
        </motion.button>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 p-2 bg-light-error/10 dark:bg-dark-error/10 rounded-lg mt-2"
          >
            <AlertTriangle size={14} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-[11px]">{error}</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default TransferTab;