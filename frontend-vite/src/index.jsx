import React from 'react';
import './index.css';
import ReactDOM from 'react-dom/client';
import i18n from './i18n';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import Main from './main.jsx';
import '@fontsource/cinzel';
import '@fontsource/inter';
import { HelmetProvider } from 'react-helmet-async';
import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAGW_XFLGw7PcUAtFi2h9IcW8A7629uKyU",
  authDomain: "vanellix-adcf0.firebaseapp.com",
  projectId: "vanellix-adcf0",
  storageBucket: "vanellix-adcf0.firebasestorage.app",
  messagingSenderId: "958239060308",
  appId: "1:958239060308:web:3e1a64d997554b32f8d8c1"
};

const app = initializeApp(firebaseConfig);
let messaging = null;

function renderApp() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <HelmetProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <MainWithThemeAndLocale />
          </ThemeProvider>
        </I18nextProvider>
      </HelmetProvider>
    </React.StrictMode>
  );
}

isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
  renderApp();
});

function normalizeLocale(locale) {
  if (!locale) return 'es';
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('en')) return 'en';
  if (locale.startsWith('it')) return 'it';
  if (locale.startsWith('pt')) return 'pt';

  return 'es'; // fallback
}

function MainWithThemeAndLocale() {
  const { theme } = useTheme();
  const language = normalizeLocale(localStorage.getItem('i18nextLng') || 'es');
  i18n.changeLanguage(language);
  return <Main locale={language} theme={theme} firebase={{ app, messaging: messaging || null }} />;
}

// Removed the duplicate render call