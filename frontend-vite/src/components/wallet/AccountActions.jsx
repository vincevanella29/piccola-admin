import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Wallet, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';

const AccountActions = ({
  account,
  handleCopy,
  copied,
  isPrivyWalletActive,
  handleExportWallet,
  exportLoading,
  fundAmount,
  setFundAmount,
  handleAddFunds,
  fundLoading,
  fundError,
}) => {
  const { t } = useTranslation();
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-3 px-6 pb-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="flex items-center gap-2" variants={itemVariants}>
        <span className="text-xs font-mono bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 px-2.5 py-1.5 rounded-lg max-w-[140px] truncate border border-light-border/5 dark:border-dark-border/5 shadow-sm backdrop-blur-sm">
          {account}
        </span>
        <motion.button
          onClick={handleCopy}
          className="p-1.5 rounded-full hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-all duration-200"
          title={t('wallet.copy_address')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Copy size={14} className={copied ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-secondary dark:text-dark-text-secondary'} />
        </motion.button>
        <motion.button
          onClick={() => setIsQRModalOpen(true)}
          className="p-1.5 rounded-full hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-all duration-200"
          title={t('wallet.share_qr')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Share2 size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
        </motion.button>
      </motion.div>
      {isPrivyWalletActive && (
        <motion.div className="flex items-center gap-2" variants={itemVariants}>
          <motion.button
            onClick={handleExportWallet}
            disabled={exportLoading || !isPrivyWalletActive}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-light-error/90 to-light-error-hover/90 dark:from-dark-error/90 dark:to-dark-error-hover/90 text-light-text-primary dark:text-dark-text-primary rounded-lg text-xs font-semibold shadow-theme hover:shadow-lg transition-all duration-200 ${!isPrivyWalletActive ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={t('wallet.export_wallet') + (!isPrivyWalletActive ? t('wallet.export_wallet_only_embedded') : '')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Wallet size={14} />
            {exportLoading ? t('wallet.exporting_wallet') : t('wallet.export_wallet')}
          </motion.button>
        </motion.div>
      )}
      <motion.form
        className="flex items-center gap-2 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          handleAddFunds();
        }}
        variants={itemVariants}
      >
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-accent dark:text-dark-accent text-sm font-bold pointer-events-none">
            $
          </span>
          <motion.input
            type="number"
            min="1"
            step="any"
            placeholder={t('wallet.amount_usd') || t('wallet.amount_usd_fallback')}
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-2xl bg-light-surface/80 dark:bg-dark-surface/80 text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-light-accent/40 dark:focus:ring-dark-accent/40 text-sm shadow-inner transition-all duration-200 backdrop-blur-lg placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary"
            disabled={fundLoading}
            inputMode="decimal"
            whileFocus={{ scale: 1.02 }}
          />
        </div>
        <motion.button
          type="submit"
          onClick={handleAddFunds}
          disabled={fundLoading || !fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-light-accent/90 to-light-accent-hover/90 dark:from-dark-accent/90 dark:to-dark-accent-hover/90 text-light-text-primary dark:text-dark-text-primary rounded-2xl font-bold text-sm shadow-theme hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('wallet.add_funds')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Wallet size={16} />
          {fundLoading ? t('wallet.adding_funds') || t('wallet.adding_funds_fallback') : t('wallet.add_funds')}
        </motion.button>
      </motion.form>
      {fundError && (
        <motion.div
          className="text-xs text-light-error dark:text-dark-error w-full text-center font-semibold"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {fundError}
        </motion.div>
      )}
      {isQRModalOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="absolute inset-0 bg-light-surface/20 dark:bg-dark-surface/20 backdrop-blur-sm"
            onClick={() => setIsQRModalOpen(false)}
          />
          <motion.div
            className="relative bg-light-surface dark:bg-dark-surface p-6 rounded-2xl shadow-theme max-w-sm w-full mx-4"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-4 text-center">
              {t('wallet.share_wallet') || 'Share Wallet Address'}
            </h3>
            <div className="flex flex-col items-center gap-4">
              <QRCode value={account} size={200} className="bg-white p-2 rounded-lg" />
              <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary break-all text-center">
                {account}
              </span>
              <motion.button
                onClick={handleCopy}
                className="p-2 rounded-full hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-all duration-200"
                title={t('wallet.copy_address')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Copy size={16} className={copied ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-secondary dark:text-dark-text-secondary'} />
              </motion.button>
            </div>
            <motion.button
              onClick={() => setIsQRModalOpen(false)}
              className="mt-6 w-full px-4 py-2.5 bg-gradient-to-r from-light-accent/90 to-light-accent-hover/90 dark:from-dark-accent/90 dark:to-dark-accent-hover/90 text-light-text-primary dark:text-dark-text-primary rounded-2xl font-bold text-sm shadow-theme hover:shadow-lg transition-all duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {t('wallet.close') || 'Close'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AccountActions;