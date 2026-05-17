import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Fingerprint, ArrowRight, ShieldCheck } from 'lucide-react';

const WalletGate = ({ appState }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-light-surface dark:bg-dark-surface p-10 rounded-3xl border border-light-border/30 dark:border-dark-border/30 shadow-xl text-center relative overflow-hidden"
      >
        {/* Glow background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-matrix-green/5 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-matrix-green/10 border border-matrix-green/20 flex items-center justify-center mb-6">
            <Fingerprint size={40} className="text-matrix-green" />
          </div>

          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
            {t('b2b.wallet_required_title')}
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-8 max-w-md mx-auto">
            {t('b2b.wallet_required_desc')}
          </p>

          <button
            onClick={() => {
              if (typeof appState?.connectWallet === 'function') {
                appState.connectWallet();
              }
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-matrix-green text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-matrix-green/25 transition-all duration-300 active:scale-[0.98]"
          >
            <span>{t('b2b.connect_wallet_btn')}</span>
            <ArrowRight size={16} />
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
            <ShieldCheck size={12} />
            <span>{t('b2b.security_notice')}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WalletGate;
