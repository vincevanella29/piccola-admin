import React from 'react';
import { AiOutlineTwitter, AiOutlineDiscord, AiOutlineInstagram } from 'react-icons/ai';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const ActionButtons = ({ appState, isSidebarHovered, isSidebarOpen }) => {
  const { t } = useTranslation();
  const { account, disconnectWallet, isConnecting } = appState || {};
  const isExpanded = isSidebarHovered || isSidebarOpen;

  const handleConnect = () => {
    if (typeof appState?.connectWallet === 'function') {
      appState.connectWallet(appState);
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet(appState);
  };

  // Variantes para animación stagger
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.13,
        delayChildren: 0.15,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 24 } },
  };

  return (
    <motion.div
      className={`flex flex-col items-center gap-3 w-full`}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Botón de Conectar/Desconectar */}
      <motion.div variants={itemVariants} style={{ width: '100%' }}>
        {!appState?.isWalletDataReady ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg animate-pulse min-w-[120px] h-10">
            <span className="w-5 h-5 rounded-full bg-light-border dark:bg-dark-border" />
            <span className="w-20 h-4 rounded bg-light-border dark:bg-dark-border" />
          </div>
        ) : account ? (
          isExpanded ? (
            <motion.button
              whileHover={{}}
              whileTap={{}}
              onClick={handleDisconnect}
              className="w-full px-4 py-2 text-light-error dark:text-dark-error text-sm font-medium rounded-lg hover:bg-light-error/10 dark:hover:bg-dark-error/10 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 bg-transparent"
              disabled={isConnecting}
            >
              <Wallet size={20} />
              {t('header.disconnect')}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{}}
              whileTap={{}}
              onClick={handleDisconnect}
              className="p-2 text-light-error dark:text-dark-error hover:text-dark-error/80 dark:hover:text-light-error/80 transition-all duration-200 disabled:opacity-50 bg-transparent"
              disabled={isConnecting}
              title={t('header.disconnect')}
            >
              <Wallet size={28} />
            </motion.button>
          )
        ) : (
          isExpanded ? (
            <motion.button
              whileHover={{}}
              whileTap={{}}
              onClick={handleConnect}
              className="w-full px-4 py-2 text-light-accent dark:text-dark-accent text-sm font-medium rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 bg-transparent"
              disabled={isConnecting}
            >
              <Wallet size={20} />
              {isConnecting ? t('header.connecting') : t('header.connect_wallet')}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{}}
              whileTap={{}}
              onClick={handleConnect}
              className="p-2 text-light-accent dark:text-dark-accent hover:text-light-accent-hover dark:hover:text-dark-accent-hover transition-all duration-200 disabled:opacity-50 bg-transparent"
              disabled={isConnecting}
              title={t('header.connect_wallet')}
            >
              <Wallet size={28} />
            </motion.button>
          )
        )}
      </motion.div>

      {/* Íconos Sociales */}
      <motion.div
        className={`${isExpanded ? 'flex items-center gap-4' : 'flex flex-col items-center gap-3'} w-full justify-center`}
        variants={containerVariants}
      >
        <motion.a
          variants={itemVariants}
          whileHover={{ color: '#1DA1F2' }}
          whileTap={{}}
          href="https://x.com/LaPiccolaChile"
          target="_blank"
          rel="noopener noreferrer"
          className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-social-twitter dark:hover:text-dark-social-twitter transition-all duration-200"
          title="Twitter"
        >
          <AiOutlineTwitter size={isExpanded ? 24 : 28} />
        </motion.a>
        <motion.a
          variants={itemVariants}
          whileHover={{ color: '#5865F2' }}
          whileTap={{}}
          href="https://discord.gg/SyCcpcEUxM"
          target="_blank"
          rel="noopener noreferrer"
          className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-social-discord dark:hover:text-dark-social-discord transition-all duration-200"
          title="Discord"
        >
          <AiOutlineDiscord size={isExpanded ? 24 : 28} />
        </motion.a>
        <motion.a
          variants={itemVariants}
          whileHover={{ color: '#333' }}
          whileTap={{}}
          href="https://www.instagram.com/lapiccolaitaliaoficial/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-social-instagram dark:hover:text-dark-social-instagram transition-all duration-200"
          title="Instagram"
        >
          <AiOutlineInstagram size={isExpanded ? 24 : 28} />
        </motion.a>
      </motion.div>
    </motion.div>
  );
};

export default ActionButtons;