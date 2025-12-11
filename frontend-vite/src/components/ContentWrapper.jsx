import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import App from '../App.jsx';
import Header from './Header';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';
import LoadingSpinner from './common/LoadingSpinner';
import GlobalStatusMessage from './common/GlobalStatusMessage';
import { useGlobalStatusMessage } from './common/globalStatusMessageContext.jsx';
import WalletModal from './WalletModal';
import { useTheme } from '../context/ThemeContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import FullScreenRipple from './common/FullScreenRipple';
import CustomTransactionModal from './CustomTransactionModal.jsx';
import CustomSignatureModal from './CustomSignatureModal.jsx';
import CustomLoginModal from './CustomLoginModal.jsx';
import { useCustomWallet } from '../hooks/useCustomWallet.jsx';

const ContentWrapperInner = ({
  onLogout,
  isAuthenticated,
  account,
  connectWallet,
  disconnectWallet,
  isConnecting,
  isSidebarOpen,
  toggleSidebar,
  appState,
}) => {
  const rippleRef = React.useRef(null);

  // Estado del ancho del Sidebar (por defecto 80px en PC cerrado para el nuevo diseño)
  const [sidebarWidth, setSidebarWidth] = useState(80);

  const { theme, setTheme } = useTheme();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const location = useLocation();
  const [pageLoading, setPageLoading] = useState(true);
  const [pathnamebak, setPathnamebak] = useState(location.pathname);

  // Hook personalizado para manejar UIs whitelabel de Privy (transacciones y firmas)
  const customWallet = useCustomWallet(appState);

  // Validación defensiva para evitar estados no serializables en los modales
  const safeCustomWallet = customWallet && typeof customWallet === 'object'
    ? {
        isTransactionModalOpen: Boolean(customWallet.isTransactionModalOpen),
        isSignatureModalOpen: Boolean(customWallet.isSignatureModalOpen),
        isLoading: Boolean(customWallet.isLoading),
        error: customWallet.error ? String(customWallet.error) : null,
        success: Boolean(customWallet.success),
        closeTransactionModal: customWallet.closeTransactionModal,
        closeSignatureModal: customWallet.closeSignatureModal,
        handleTransactionConfirm: customWallet.handleTransactionConfirm,
        handleTransactionCancel: customWallet.handleTransactionCancel,
        handleSignatureConfirm: customWallet.handleSignatureConfirm,
        handleSignatureCancel: customWallet.handleSignatureCancel,
        customSendTransaction: customWallet.customSendTransaction,
        customSignMessage: customWallet.customSignMessage,
        currentTransaction: customWallet.currentTransaction || null,
        currentMessage: customWallet.currentMessage || '',
        currentUiOptions: customWallet.currentUiOptions || {},
      }
    : null;

  // AppState mejorado que usa los handlers personalizados para firmar/enviar
  const openLoginModal = () => {
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const enhancedAppState = React.useMemo(
    () => ({
      ...appState,
      // Siempre usar el nuevo modal de login para connectWallet
      connectWallet: openLoginModal,
      ...(safeCustomWallet && {
        signTxData: safeCustomWallet.customSignMessage,
        sendTx: safeCustomWallet.customSendTransaction,
      }),
    }),
    [appState, safeCustomWallet, openLoginModal]
  );

  useEffect(() => {
    if (enhancedAppState?.isAuthenticated && isLoginModalOpen) {
      setIsLoginModalOpen(false);
    }
  }, [enhancedAppState?.isAuthenticated, isLoginModalOpen]);

  useEffect(() => {
    if (pathnamebak !== location.pathname) {
      if (location.pathname.startsWith('/app/menus/')) {
        setPageLoading(false);
        return;
      } else {
        setPageLoading(true);
      }
    }
    setPathnamebak(location.pathname);
    if (enhancedAppState.pageLoading || !enhancedAppState.isWalletDataReady) {
      setPageLoading(true);
    }
    if (enhancedAppState?.isWalletDataReady && !enhancedAppState?.pageLoading) {
      setTimeout(() => {
        setPageLoading(false);
      }, 1500);
    }
  }, [enhancedAppState?.isWalletDataReady, enhancedAppState?.pageLoading, location.pathname]);

  const openWalletModal = () => setIsWalletModalOpen(true);
  const closeWalletModal = () => setIsWalletModalOpen(false);
  const globalStatus = useGlobalStatusMessage();

  // Calculamos el padding dinámico para el contenido normal
  const contentPaddingLeft = window.innerWidth >= 1024 ? sidebarWidth + 32 : 0;

  return (
    <div className="min-h-screen text-light-text-primary dark:text-dark-text-primary font-sans flex flex-col relative overflow-x-hidden">

      <GlobalStatusMessage
        notifications={globalStatus.notifications}
        onClose={globalStatus.removeNotification}
      />

      <div className="fixed inset-0 w-[100vw] h-[100vh] z-[-10] bg-light-background dark:bg-dark-background transition-colors duration-300" />
      <FullScreenRipple theme={theme} ref={rippleRef} />

      <Header
        toggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        isAuthenticated={isAuthenticated}
        account={account}
        connectWallet={enhancedAppState.connectWallet}
        disconnectWallet={disconnectWallet}
        isConnecting={isConnecting}
        appState={enhancedAppState}
        openWalletModal={openWalletModal}
        onLogout={onLogout}
      />

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={closeWalletModal}
        account={enhancedAppState.account}
        isPrivyWalletActive={enhancedAppState.isPrivyWalletActive}
        appState={enhancedAppState}
      />

      <CustomLoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
      />

      {/* Modales personalizados para transacciones y firmas (whitelabel Privy) */}
      {safeCustomWallet && (
        <>
          <CustomTransactionModal
            isOpen={safeCustomWallet.isTransactionModalOpen}
            onClose={safeCustomWallet.closeTransactionModal}
            transaction={safeCustomWallet.currentTransaction}
            uiOptions={safeCustomWallet.currentUiOptions}
            appState={enhancedAppState}
            onConfirm={safeCustomWallet.handleTransactionConfirm}
            onCancel={safeCustomWallet.handleTransactionCancel}
            isLoading={safeCustomWallet.isLoading}
            error={safeCustomWallet.error}
            success={safeCustomWallet.success}
          />

          <CustomSignatureModal
            isOpen={safeCustomWallet.isSignatureModalOpen}
            onClose={safeCustomWallet.closeSignatureModal}
            message={safeCustomWallet.currentMessage}
            uiOptions={safeCustomWallet.currentUiOptions}
            onConfirm={safeCustomWallet.handleSignatureConfirm}
            onCancel={safeCustomWallet.handleSignatureCancel}
            isLoading={safeCustomWallet.isLoading}
            error={safeCustomWallet.error}
            success={safeCustomWallet.success}
          />
        </>
      )}

      {isSidebarOpen && (
        <div
          className="fixed top-24 left-0 right-0 bottom-0 z-50 lg:hidden bg-black/60 transition-opacity duration-300"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      {/* Contenedor principal con padding inferior ajustado */}
      <div className="flex flex-1 pt-24 pb-32 md:pb-28">

        <AnimatePresence>
          <motion.div
            key="sidebar"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="h-full"
            style={{ display: 'contents' }}
          >
            <Sidebar
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
              isAuthenticated={isAuthenticated}
              appState={enhancedAppState}
              // El Sidebar reportará su ancho aquí para ajustar el layout
              onSidebarWidthChange={setSidebarWidth}
            />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          <motion.main
            key="main"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300 min-h-[calc(100vh-128px)] w-full"
            style={{
              transition: 'padding-left 0.35s cubic-bezier(0.4,0,0.2,1)',
              paddingLeft: contentPaddingLeft,
            }}
          >
            <div className="relative max-w-[1440px] mx-auto min-h-[calc(100%-60px)] flex w-full">

              <AnimatePresence>
                {pageLoading && (
                  <motion.div
                    key="page-loader"
                    initial={{ opacity: 0, scale: 0.92, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 18 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-auto w-full h-full"
                  >
                    <LoadingSpinner
                      size="md"
                      showText={true}
                      isFullScreen={false}
                      rippleDrop={(x, y, r, p, id, mode) => rippleRef.current?.dropRipple(x, y, r, p, id, mode)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {!pageLoading && (
                  <motion.div
                    key={location.pathname + '-content'}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-1 w-full h-full"
                  >
                    <Routes>
                      {/* Pasamos el sidebarWidth a App para que los componentes hijos lo usen si es necesario */}
                      <Route
                        path="/*"
                        element={
                          <App
                            appState={enhancedAppState}
                            onLogout={onLogout}
                            sidebarWidth={sidebarWidth}
                          />
                        }
                      />
                    </Routes>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.main>
        </AnimatePresence>
      </div>

      <Footer
        isAuthenticated={isAuthenticated}
        changeLanguage={enhancedAppState.changeLanguage}
        roleLevel={enhancedAppState.roleLevel}
        theme={theme}
        setTheme={setTheme}
        language={enhancedAppState.language}
        t={enhancedAppState.t}
      />

    </div>
  );
};

const ContentWrapper = ContentWrapperInner;

export default ContentWrapper;