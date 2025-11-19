import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { pagesMetadata, pageModules, getDynamicMetadata } from './pages/pagesConfig.js';

// ACEPTAMOS sidebarWidth
const App = ({ onLogout, appState, sidebarWidth }) => {
  const { t } = useTranslation();
  const { roleLevel } = appState;
  const location = useLocation();

  const mainPageMetadata = pagesMetadata.find((page) => page.isMainPage === true);
  const mainPageModulePath = mainPageMetadata
    ? Object.keys(pageModules).find((fileName) => {
        const module = pageModules[fileName];
        return module.pageMetadata && module.pageMetadata.path === mainPageMetadata.path;
      })
    : null;
  const MainPageComponent = mainPageModulePath ? pageModules[mainPageModulePath].default : null;

  const canAccessPage = (metadata) => {
    if (metadata.minRoleLevel === -1) return true;
    if (roleLevel === -1) return false;
    const meetsMinLevel = roleLevel >= metadata.minRoleLevel;
    const meetsMaxLevel = metadata.maxRoleLevel === undefined || roleLevel <= metadata.maxRoleLevel;
    return meetsMinLevel && meetsMaxLevel;
  };

  const pages = pagesMetadata.map((metadata) => {
    const modulePath = Object.keys(pageModules).find((fileName) => {
      const module = pageModules[fileName];
      return module.pageMetadata && module.pageMetadata.path === metadata.path;
    });
    if (!modulePath) return null;
    const Component = pageModules[modulePath].default;
    return { component: Component, metadata, path: metadata.path };
  }).filter((page) => page !== null);

  const metadata = getDynamicMetadata(location.pathname, appState, t);

  const FallbackComponent = () => <div className="text-dark-error dark:text-light-error p-4">{t('app.no_main_page')}</div>;
  const DefaultPage = MainPageComponent || FallbackComponent;

  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        {/* ... resto de meta tags ... */}
      </Helmet>

      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          {pages.map(({ component: Component, metadata, path }) => (
            <Route
              key={path}
              path={path}
              element={
                <motion.div
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -32 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full w-full"
                >
                  <div className="relative w-full h-full">
                    {canAccessPage(metadata) ? (
                      // PASAMOS sidebarWidth AL COMPONENTE DE LA PÁGINA
                      <Component onLogout={onLogout} appState={appState} sidebarWidth={sidebarWidth} />
                    ) : (
                      <DefaultPage onLogout={onLogout} appState={appState} sidebarWidth={sidebarWidth} />
                    )}
                  </div>
                </motion.div>
              }
            />
          ))}
          <Route
            path="*"
            element={
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -32 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-full w-full"
              >
                <DefaultPage onLogout={onLogout} appState={appState} sidebarWidth={sidebarWidth} />
              </motion.div>
            }
          />
        </Routes>
      </AnimatePresence>
    </>
  );
};

export default App;