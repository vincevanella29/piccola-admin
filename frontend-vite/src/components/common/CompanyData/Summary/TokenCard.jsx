// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/pages/company/tokens/components/TokenCard.jsx
import { useBalance } from 'wagmi';
import { FaFileAlt, FaLink, FaCopy } from 'react-icons/fa';
import { motion } from 'framer-motion';
import InfoTooltip from "../../Tools/InfoTooltip.jsx";
import { useTokenMetadata } from "../../../../hooks/useTokenMetadata.jsx";
import React, { useMemo } from 'react';

const TokenCard = ({ tokenData, t, walletAddress, appState }) => {
  const { platform_data, documents } = tokenData;
  // Compute tokenAddress reactively
  const tokenAddress = useMemo(
    () => platform_data?.proxy || platform_data?.[7] || platform_data?.address || platform_data?.[1],
    [platform_data]
  );
  // Use hooks with key to force update on token change
  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useBalance(
    walletAddress && tokenAddress
      ? { address: walletAddress, token: tokenAddress, watch: true }
      : { enabled: false }
  );
  const { totalSupply, decimals, loading: supplyLoading } = useTokenMetadata(tokenAddress);


  return (
    <motion.div
      className="bg-light-surface/90 dark:bg-dark-surface/90 rounded-3xl shadow-xl p-6 flex flex-col gap-4 border border-light-border/30 dark:border-dark-border/30 backdrop-blur-md"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex flex-col md:flex-row gap-6 w-full"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* Token Info */}
        <motion.div
          className="flex flex-col items-center gap-2 w-full md:w-1/2"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {platform_data?.imagePath ? (
            <motion.img
              src={platform_data.imagePath}
              alt="Logo"
              className="w-16 h-16 rounded-full border-4 border-light-accent/40 dark:border-dark-accent/40 object-cover shadow-lg bg-light-surface/80 dark:bg-dark-surface/80"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;utf8,<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#D1D5DB"/><text x="50%" y="54%" text-anchor="middle" font-size="28" fill="#9CA3AF" dy=".3em">?</text></svg>';
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
            />
          ) : (
            <motion.div
              className="w-16 h-16 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center text-3xl text-light-accent dark:text-dark-accent font-bold shadow-lg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
            >
              {platform_data?.symbol?.[0] || '?'}
            </motion.div>
          )}
          <motion.div
            className="flex items-center gap-1 justify-center mt-2"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="text-2xl font-extrabold text-light-accent dark:text-dark-accent leading-tight text-center">
              {platform_data?.name || platform_data?.[2] || 'Not available'}
            </div>
            <InfoTooltip text={t('companyTokens.name_tooltip', 'Nombre oficial del token.')} />
          </motion.div>
          <motion.div
            className="text-base font-mono text-light-text-secondary dark:text-dark-text-secondary tracking-wide text-center"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            {platform_data?.symbol || platform_data?.[3] || 'Not available'}
          </motion.div>
          <motion.div
            className="flex flex-col items-center gap-1 mt-2 w-full"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className="flex items-center gap-1 text-lg font-semibold">
              <span className="font-bold text-light-accent dark:text-dark-accent">{t('companyTokens.supply_label', 'Supply')}:</span>
              <span className="font-mono text-xl text-light-text-primary dark:text-dark-text-primary">
                {supplyLoading
                  ? '...'
                  : totalSupply
                  ? (Number(totalSupply) / Math.pow(10, decimals)).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                  : '0.0000'}
              </span>
              <InfoTooltip text={t('companyTokens.supply_tooltip')} />
            </div>
            <motion.div
              className="flex items-center gap-1 text-lg font-semibold bg-light-surface/80 dark:bg-dark-surface/80 rounded-xl px-3 py-1 border border-light-border/30 dark:border-dark-border/30 mt-2 shadow-sm"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.35 }}
            >
              <span className="font-bold text-light-accent dark:text-dark-accent">{t('companyTokens.balance_label', 'Your Balance')}:</span>
              {balanceLoading ? (
                <span className="font-mono text-base text-light-text-secondary dark:text-dark-text-secondary animate-pulse">...</span>
              ) : balanceError ? (
                <span className="text-error-500 dark:text-error-400 text-xs">{t('companyTokens.balance_error', 'Error')}</span>
              ) : (
                <span className="font-mono text-xl text-light-text-primary dark:text-dark-text-primary">
                  {balanceData
                    ? Number(balanceData.formatted.replace(/,/g, '')).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                    : '0.0000'}
                </span>
              )}
              <span className="text-sm font-mono text-light-text-secondary dark:text-dark-text-secondary ml-1">
                {balanceData?.symbol || platform_data?.symbol || ''}
              </span>
            </motion.div>
          </motion.div>
          <motion.div
            className="flex flex-col items-center gap-1 mt-2 w-full"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            {platform_data?.proxy || platform_data?.[7] ? (
              <div className="flex items-center gap-2 mt-1 max-w-full overflow-hidden">
                <a
                  href={`${appState.blockExplorer}/address/${platform_data.proxy || platform_data[7]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-light-accent dark:text-dark-accent hover:text-light-accent-dark dark:hover:text-dark-accent-light transition-all truncate"
                >
                  <FaLink className="text-sm" />
                  <span className="underline truncate">{platform_data.proxy || platform_data[7]}</span>
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(platform_data.proxy || platform_data[7])}
                  title={t('companyTokens.copy_address', 'Copy address')}
                  className="text-light-accent dark:text-dark-accent hover:text-light-accent-dark dark:hover:text-dark-accent-light transition-all"
                >
                  <FaCopy className="text-sm" />
                </button>
              </div>
            ) : (
              <span className="text-light-text-secondary dark:text-dark-text-secondary">-</span>
            )}
          </motion.div>
        </motion.div>
        {/* Description */}
        <motion.div
          className="flex flex-col gap-2 w-full md:w-1/2 md:border-l md:border-light-border dark:md:border-dark-border md:pl-6"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.45 }}
        >
          <div className="flex items-center gap-2 text-base font-semibold text-light-accent dark:text-dark-accent">
            {t('companyTokens.desc_label', 'Description:')}
            <InfoTooltip text={t('companyTokens.description_tooltip', 'A brief overview of the token and its purpose.')} />
          </div>
          <p className="text-sm text-light-text-primary dark:text-dark-text-primary leading-relaxed">
            {platform_data?.description || t('companyTokens.no_description', 'No description available.')}
          </p>
        </motion.div>
      </motion.div>
      {/* Documents Card */}
      <motion.div
        className="mt-5 pt-4 border-t border-light-border dark:border-dark-border"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="flex items-center gap-2 text-base font-semibold text-light-accent dark:text-dark-accent mb-2">
          {t('companyTokens.summary_docs', 'Documents:')}
        </div>
        {documents && documents.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 w-full"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
            }}
          >
            {documents.map((d, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-start gap-2 bg-light-surface-tertiary dark:bg-dark-surface-tertiary rounded-xl p-4 border border-light-border dark:border-dark-border shadow-md hover:shadow-lg transition-shadow"
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FaFileAlt className="text-light-accent dark:text-dark-accent text-xl" />
                  <span
                    className="font-semibold text-light-text-primary dark:text-dark-text-primary text-base truncate max-w-[120px]"
                    title={d.name}
                  >
                    {d.name}
                  </span>
                </div>
                {d.url && (
                  <motion.a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-light-accent/90 dark:bg-dark-accent/90 text-white font-medium text-xs hover:bg-light-accent-dark dark:hover:bg-dark-accent-light transition-colors shadow"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t('companyTokens.docs_view', 'View')}
                  </motion.a>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary italic py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {t('companyTokens.docs_label', 'No documents uploaded.')}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default TokenCard;