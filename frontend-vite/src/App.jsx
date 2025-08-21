import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { pagesMetadata, pageModules, getDynamicMetadata } from './pages/pagesConfig.js';

const App = ({ onLogout, appState }) => {
  const { t } = useTranslation();
  const { roleLevel, setPageLoading } = appState;
  const location = useLocation();

  // Encontrar la página principal
  const mainPageMetadata = pagesMetadata.find((page) => page.isMainPage === true);
  const mainPageModulePath = mainPageMetadata
    ? Object.keys(pageModules).find((fileName) => {
        const module = pageModules[fileName];
        return module.pageMetadata && module.pageMetadata.path === mainPageMetadata.path;
      })
    : null;
  const MainPageComponent = mainPageModulePath ? pageModules[mainPageModulePath].default : null;

  // Función para verificar si el usuario puede acceder a una página
  const canAccessPage = (metadata) => {
    if (metadata.minRoleLevel === -1) return true;
    if (roleLevel === -1) return false;
    const meetsMinLevel = roleLevel >= metadata.minRoleLevel;
    const meetsMaxLevel = metadata.maxRoleLevel === undefined || roleLevel <= metadata.maxRoleLevel;
    return meetsMinLevel && meetsMaxLevel;
  };

  // Mapear los metadatos a componentes
  const pages = pagesMetadata.map((metadata) => {
    const modulePath = Object.keys(pageModules).find((fileName) => {
      const module = pageModules[fileName];
      return module.pageMetadata && module.pageMetadata.path === metadata.path;
    });

    if (!modulePath) return null;

    const Component = pageModules[modulePath].default;

    return {
      component: Component,
      metadata,
      path: metadata.path,
    };
  }).filter((page) => page !== null);

  // Generar metadatos dinámicos
  const metadata = getDynamicMetadata(location.pathname, appState, t);

  // Componente por defecto si no se encuentra la página
  const FallbackComponent = () => (
    <div className="text-dark-error dark:text-light-error p-4">
      {t('app.no_main_page')}
    </div>
  );
  const DefaultPage = MainPageComponent || FallbackComponent;

  return (
    <>
      <Helmet>
        {/* Core SEO Meta Tags */}
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="keywords" content={metadata.keywords} />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="La Piccola Italia Team" />
        <link rel="canonical" href={metadata.canonical} />

        {/* Open Graph */}
        <meta property="og:title" content={metadata.og_title} />
        <meta property="og:description" content={metadata.og_description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={metadata.canonical} />
        <meta property="og:image" content="/favicon-piccola.png" />
        <meta property="og:site_name" content="La Piccola Italia" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metadata.twitter_title} />
        <meta name="twitter:description" content={metadata.twitter_description} />
        <meta name="twitter:image" content="/favicon-piccola.png" />
        <meta name="twitter:site" content="@LaPiccolaItalia" />

        {/* Schema.org JSON-LD para página */}
        <script type="application/ld+json">{JSON.stringify(metadata.schema)}</script>

        {/* Schema.org JSON-LD para productos (si aplica) */}
        {metadata.productSchemas?.map((schema, index) => (
          <script key={index} type="application/ld+json">
            {JSON.stringify(schema)}
          </script>
        ))}
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
                      <Component onLogout={onLogout} appState={appState} />
                    ) : (
                      <DefaultPage onLogout={onLogout} appState={appState} />
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
                <DefaultPage onLogout={onLogout} appState={appState} />
              </motion.div>
            }
          />
        </Routes>
      </AnimatePresence>
    </>
  );
};

export default App;