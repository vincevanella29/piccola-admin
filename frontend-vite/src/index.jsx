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
import { getMessaging, isSupported, onMessage } from 'firebase/messaging';

let app = null;
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

// Inicialización dinámica (Mongo-driven)
fetch('/api/notifications/public-config')
  .then(res => res.json())
  .then(async (data) => {
    if (data && data.firebaseConfig) {
      console.log('[Firebase Diagnostics] Inicializando con config de MongoDB:', data.firebaseConfig.projectId);
      try {
        app = initializeApp(data.firebaseConfig);
        console.log('[Firebase Diagnostics] app inicializada:', app.name);
        
        console.log('[Firebase Diagnostics] Verificando soporte (isSupported)...');
        const supported = await isSupported();
        console.log('[Firebase Diagnostics] isSupported result:', supported);
        
        if (supported) {
          console.log('[Firebase Diagnostics] getMessaging() llamado');
          messaging = getMessaging(app);
          console.log('[Firebase Diagnostics] messaging object:', !!messaging);
          
          // Manejador para cuando la App está abierta (Foreground)
          console.log('[Firebase Diagnostics] Registrando onMessage listener');
          onMessage(messaging, (payload) => {
          console.log('[Firebase] Mensaje recibido en Foreground:', payload);
          if (Notification.permission === 'granted') {
            const notificationTitle = payload.notification?.title || 'Notificación';
            const notificationOptions = {
              body: payload.notification?.body || '',
              icon: payload.notification?.image || '/logo-piccola-negro.png',
              data: payload.data
            };
            const notif = new Notification(notificationTitle, notificationOptions);
            
            // Tracking de Apertura desde Foreground
            notif.onclick = (event) => {
              event.preventDefault();
              notif.close();
              const campaignId = payload.data?.campaign_id;
              if (campaignId) {
                fetch('/api/notifications/track-click', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ campaign_id: campaignId })
                }).catch(err => console.error("[Foreground] Error tracking:", err));
              }
              window.focus();
            };
          }
        });
        } else {
          console.warn('[Firebase Diagnostics] Web Push NO es soportado en este navegador');
        }
      } catch (initErr) {
        console.error('[Firebase Diagnostics] Excepción en inicialización:', initErr);
      }
    } else {
      console.warn('[Firebase Diagnostics] No hay config en MongoDB. Las notificaciones Push no funcionarán hasta configurarlo.');
    }
    renderApp();
  })
  .catch(err => {
    console.error('[Firebase Diagnostics] Error fatal cargando config pública:', err);
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