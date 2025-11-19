import React, { useState, useEffect, useRef } from 'react';
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
  
  // Estado del ancho del Sidebar (por defecto 80px en PC cerrado)
  const [sidebarWidth, setSidebarWidth] = useState(80);
  
  const { theme, setTheme } = useTheme();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const location = useLocation();
  const [pageLoading, setPageLoading] = useState(true);
  const [pathnamebak , setPathnamebak ] = useState(location.pathname);

  useEffect(() => {
    if(pathnamebak !== location.pathname) {
      if(location.pathname.startsWith('/app/menus/')) {
        setPageLoading(false);
        return;
      } else {
        setPageLoading(true);
      }
    }
    setPathnamebak(location.pathname);
    if (appState.pageLoading || !appState.isWalletDataReady) {
      setPageLoading(true);
    }
    if (appState?.isWalletDataReady && !appState?.pageLoading) {
      setTimeout(() => {
        setPageLoading(false);
      }, 1500);
    }
  }, [appState?.isWalletDataReady, appState?.pageLoading, location.pathname]);

  const openWalletModal = () => setIsWalletModalOpen(true);
  const closeWalletModal = () => setIsWalletModalOpen(false);
  const globalStatus = useGlobalStatusMessage();

  // Calculamos el padding dinámico para el contenido normal (no portal)
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
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
        isConnecting={isConnecting}
        appState={appState}
        openWalletModal={openWalletModal}
        onLogout={onLogout}
      />

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={closeWalletModal}
        account={appState.account}
        isPrivyWalletActive={appState.isPrivyWalletActive}
        appState={appState}
      />

      {isSidebarOpen && (
        <div
          className="fixed top-16 left-0 right-0 bottom-0 z-50 lg:hidden bg-black/60 transition-opacity duration-300"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}

      <div className="flex flex-1 pt-16 pb-32 md:pb-28">
        
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
              appState={appState}
              // El Sidebar reporta su ancho aquí
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
              paddingLeft: contentPaddingLeft
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
                      {/* PASAMOS sidebarWidth A APP */}
                      <Route path="/*" element={<App appState={appState} onLogout={onLogout} sidebarWidth={sidebarWidth} />} />
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
        changeLanguage={appState.changeLanguage}
        roleLevel={appState.roleLevel}
        theme={theme}
        setTheme={setTheme}
        language={appState.language}
        t={appState.t}
      />

    </div>
  );
};

const ContentWrapper = ContentWrapperInner;

export default ContentWrapper;