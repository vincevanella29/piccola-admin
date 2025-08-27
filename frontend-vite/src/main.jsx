import React, { useState, useEffect, useCallback, useContext } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import privyConfig from './privy.config.js';
import { createConfig, http } from 'wagmi';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, RouterProvider, useNavigate, useLocation } from 'react-router-dom';
import ContentWrapper from './components/ContentWrapper.jsx';
import { AppCacheProvider } from './context/AppCacheContext';
import useWallet from './hooks/useWallet.jsx';
import useAppData from './hooks/useAppData.jsx';
import { useTheme, ThemeProvider } from './context/ThemeContext.jsx';
import { ethers } from 'ethers';
import App from './App.jsx';
import { useGlobalStatusMessage, GlobalStatusMessageProvider } from './components/common/globalStatusMessageContext.jsx';
import getWagmiConfig from './wagmiConfig.js';
import useNotifications from './hooks/useNotifications.jsx';
import { Helmet } from 'react-helmet-async';
import useConversionTracker from './hooks/useConversionTracker.jsx'; // Importamos el nuevo hook
import useTelegramLinkAuth from './hooks/useTelegramLinkAuth.jsx';

// Configuración global 
const rpcUrl = window.env?.VITE_RPC_URL || import.meta.env.VITE_RPC_URL;
const blockExplorer = window.env?.VITE_BLOCK_EXPLORER || import.meta.env.VITE_BLOCK_EXPLORER;
// Note: privyAppId is now resolved inside Main() so window.env is guaranteed to be loaded.
const appMode = window.env?.VITE_MODE || import.meta.env.MODE;
const chainId = Number(window.env?.VITE_CHAIN_ID || import.meta.env.VITE_CHAIN_ID);
const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
const googleMapsApiKey = window.env?.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const vapidKey = window.env?.VITE_VAPID_KEY || import.meta.env.VITE_VAPID_KEY;
const companyId = window.env?.VITE_COMPANY_ID || import.meta.env.VITE_COMPANY_ID;

// Address de WMATIC (o WETH en mainnet)
const WMATIC_ADDRESS = "0x4bcd5FB3F9b6F73084C9B7A19Acbf0C1D2631fF8";
const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000001010";

// Configura QueryClient
const queryClient = new QueryClient();

// Chile time state hook (para pasar a appState)
import { createContext } from 'react';
export const ChileTimeContext = createContext({ chileTime: new Date(), firebase: null });

// Simple Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    const t = typeof this.props.t === 'function' ? this.props.t : (k) => {
      if (k === 'error.error_boundary') return 'Error';
      if (k === 'error.message') return 'Ha ocurrido un error inesperado.';
      return k;
    };
    if (this.state.hasError) {
      return (
        <div className="p-4 text-dark-error dark:text-light-error bg-red-500/50">
          <h2>{t('error.error_boundary')}</h2>
          <p>{this.state.error?.message || t('error.error_boundary')}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainContent = () => {
  const { chileTime: chileTimeFromContext, firebase } = useContext(ChileTimeContext); // Obtener chileTime y firebase del contexto
  const globalStatus = useGlobalStatusMessage();
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageLoadingError, setPageLoadingError] = useState('');  
  
  const {
    account,
    profile,
    setProfile,
    connectWallet,
    disconnectWallet,
    isConnecting,
    roleLevel,
    error: walletError,
    isAuthenticated,
    isPrivyWalletActive,
    signMessage,
    accessToken,
    user,
    isWalletDataReady,
    signTxData,
    sendTx,
    sendTransaction,
    privyWallet,
    ensureCorrectNetwork,
    getSigner
  } = useWallet({ provider, chainId, rpcUrl, blockExplorer, setError: globalStatus.setError, setSuccess: globalStatus.setSuccess, setPageLoading, firebase, vapidKey });

  // NUEVO: Declarar useAppData para obtener colors y userLevel
  // Declarar useAppData para obtener colors y userLevel
  const { colors, userLevel, isLoading: appDataLoading, error: appDataError } = useAppData({
    account,
    changeLanguage: (lang) => i18n.changeLanguage(lang),
    provider
  });

  // Usamos el hook de Conversion Tracker
  const {
    dripEnabled,
    setDripEnabled,
    trackDripEvent,
    trackViewItem,
    trackClaimPromotion,
    trackBurnTokens,
    updateDripSegmentation,
    addDripTag,
    removeDripTag,
    trackStake,
    trackUnstake,
    trackClaimStake,
  } = useConversionTracker({
    profile,
    accessToken,
    account,
    isAuthenticated,
    provider,
    companyId
  });

  useEffect(() => {
    const handleLangChange = (lng) => setLanguage(lng);
    const handleInitialized = () => setLanguage(i18n.language);
    const handleLoaded = () => setLanguage(i18n.language);

    i18n.on('languageChanged', handleLangChange);
    i18n.on('initialized', handleInitialized);
    i18n.on('loaded', handleLoaded);

    return () => {
      i18n.off('languageChanged', handleLangChange);
      i18n.off('initialized', handleInitialized);
      i18n.off('loaded', handleLoaded);
    };
  }, [i18n]);

  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();


  // Chile time (America/Santiago)
  const [chileTime, setChileTime] = useState(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })));
  useEffect(() => {
    const interval = setInterval(() => {
      setChileTime(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })));
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const changeLanguage = useCallback((lang) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  }, [i18n]);

  const appState = {
    chileTime,
    colors, // NUEVO
    userLevel, // NUEVO
    isLoading: appDataLoading, // NUEVO
    error: appDataError, // NUEVO
    account,
    profile,
    setProfile,
    setSuccess: globalStatus.setSuccess,
    setError: globalStatus.setError,
    token: accessToken,
    roleLevel,
    isPrivyWalletActive,
    signMessage,
    user,
    sendTransaction,
    connectWallet,
    disconnectWallet,
    isConnecting,
    isWalletDataReady,
    changeLanguage,
    accessToken,
    theme,
    setTheme,
    signTxData,
    sendTx,
    provider,
    chainId,
    rpcUrl,
    blockExplorer,    
    privyWallet,
    ensureCorrectNetwork,
    getSigner,
    t,
    language,
    pageLoading,
    setPageLoading,
    pageLoadingError,
    setPageLoadingError,
    companyId,
    appMode,
    googleMapsApiKey,
    NATIVE_TOKEN_ADDRESS,
    WMATIC_ADDRESS,
    firebase,
    vapidKey,
    useNotifications: useNotifications({ accessToken, account, setError: globalStatus.setError, setSuccess: globalStatus.setSuccess, appState: { firebase } }),
    // Agregamos las funciones de tracking al appState
    dripEnabled,
    trackClaimPromotion,
    trackBurnTokens,
    updateDripSegmentation,
    addDripTag,
    removeDripTag,
    setDripEnabled,
    trackDripEvent,
    trackViewItem,
    trackStake,
    trackUnstake,
    trackClaimStake,
  };



  // Telegram link auth: procesa tg_id/state desde URL cuando la wallet está lista
  const telegramAuthStatus = useTelegramLinkAuth({
    isWalletDataReady,
    account,
    accessToken,
    roleLevel,
    setSuccess: globalStatus.setSuccess,
    setError: globalStatus.setError,
  });

  const handleLogout = async () => {
    await disconnectWallet();
    navigate('/', { replace: true });
  };

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (window.gtag) {
      window.gtag('config', 'G-4XEV11DD1K', { page_path: location.pathname });
    }
  }, [location.pathname]);

  return (
    <ThemeProvider colors={colors} userLevel={userLevel}>
      <ErrorBoundary t={t}>
        <div className="min-h-screen flex flex-col bg-dark-bg dark:bg-dark-dark">
          <Helmet>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-4XEV11DD1K"></script>
            <script>{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-4XEV11DD1K');
            `}</script>
          </Helmet>
          {pageLoadingError && (
            <div className="p-4 text-dark-error dark:text-light-error bg-red-dark/50">
              {pageLoadingError}
            </div>
          )}

          <ContentWrapper
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            isAuthenticated={isAuthenticated}
            account={account}
            connectWallet={connectWallet}
            disconnectWallet={disconnectWallet}
            isConnecting={isConnecting}
            appState={appState}
            language={language}
            t={t}
            onLogout={handleLogout}
            MainComponent={App}
            routes={[
              { path: '/*', element: <App appState={appState} onLogout={handleLogout} /> }
            ]}
          />
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

// Define router with v7 future flags
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <GlobalStatusMessageProvider>
        <MainContent />
      </GlobalStatusMessageProvider>
    ),
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

const Main = ({ locale, theme, firebase }) => {
  console.log(locale);
  const privyAppId = (window.env?.VITE_PRIVY_APP_ID || import.meta.env.VITE_PRIVY_APP_ID);
  if (!privyAppId || typeof privyAppId !== 'string' || privyAppId.trim() === '') {
    console.error('[Privy] Missing or invalid VITE_PRIVY_APP_ID', { privyAppId, env: window.env });
  }
  const privyConfigWithTheme = {
    ...privyConfig(chainId, rpcUrl, privyAppId),
    appearance: { ...privyConfig.appearance, theme },
    i18n: {
      locale: 'es', // Usa el idioma dinámico de la app
    },
  };
  console.log(privyConfigWithTheme);

  if (!privyAppId) {
    return (
      <div className="p-4 text-dark-error dark:text-light-error bg-red-dark/50">
        Configuration error: missing Privy App ID.
      </div>
    );
  }

  return (
    <PrivyProvider appId={privyConfigWithTheme.appId} config={privyConfigWithTheme}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={getWagmiConfig(chainId, rpcUrl, blockExplorer)}>
          <AppCacheProvider>
            <ChileTimeContext.Provider value={{ chileTime: new Date(), firebase }}>
              <RouterProvider router={router} />
            </ChileTimeContext.Provider>
          </AppCacheProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
};

export default Main;