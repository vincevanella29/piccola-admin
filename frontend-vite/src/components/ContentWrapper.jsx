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
  
  const [sidebarWidth, setSidebarWidth] = useState(64);
  const { theme, setTheme } = useTheme();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const location = useLocation();
  const [pageLoading, setPageLoading] = useState(true); // Inicia como true hasta que los datos estén listos
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

  const openWalletModal = () => {
    setIsWalletModalOpen(true);
  };

  const closeWalletModal = () => {
    setIsWalletModalOpen(false);
  };

  const globalStatus = useGlobalStatusMessage();

  return (
    <div className="min-h-screen text-light-text-primary dark:text-dark-text-primary font-sans flex flex-col relative">
      <GlobalStatusMessage
        notifications={globalStatus.notifications}
        onClose={globalStatus.removeNotification}
      />
      <div className="fixed inset-0 w-[100vw] h-[100vh] z-[-10] bg-light-background dark:bg-dark-background transition-colors duration-300" />
      <FullScreenRipple theme={theme} ref={rippleRef} />
      
          <AnimatePresence>
            <motion.header
              key="header"
              initial={{ y: -64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -64, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              className="fixed top-0 left-0 right-0 h-16 bg-dark-surface dark:bg-light-surface shadow-lg z-[999]"
            >
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
            </motion.header>
          </AnimatePresence>

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

          <div className="flex flex-1 pt-16 pb-16">
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
                  ...(window.innerWidth >= 1024 ? { paddingLeft: sidebarWidth + 32 } : {})
                }}
              >
                <div className="relative max-w-[1440px] mx-auto min-h-[calc(100%-128px)] flex w-full">
                  <AnimatePresence>
                    {pageLoading && (
                      <motion.div
                        key="page-loader"
                        initial={{ opacity: 0, scale: 0.92, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 18 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} // Reducido para transición rápida
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
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} // Sincronizado con el loader
                        className="flex-1 w-full h-full"
                      >
                        <Routes>
                          <Route path="/*" element={<App appState={appState} onLogout={onLogout} />} />
                        </Routes>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.main>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            <motion.footer
              key="footer"
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              className="fixed bottom-0 left-0 right-0 h-16 bg-light-surface dark:bg-light-surface border-t border-light-border dark:border-dark-border z-[999]"
            >
              <Footer
                isAuthenticated={isAuthenticated}
                changeLanguage={appState.changeLanguage}
                roleLevel={appState.roleLevel}
                theme={theme}
                setTheme={setTheme}
                language={appState.language}
                t={appState.t}
              />
            </motion.footer>
          </AnimatePresence>

    </div>
  );
};

const ContentWrapper = ContentWrapperInner;

export default ContentWrapper;