import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importar dinámicamente todos los archivos JSON de las carpetas de idiomas
const esFiles = import.meta.glob('./locales/es/**/*.json', { eager: true });
const enFiles = import.meta.glob('./locales/en/**/*.json', { eager: true });
const itFiles = import.meta.glob('./locales/it/**/*.json', { eager: true });
const ptFiles = import.meta.glob('./locales/pt/**/*.json', { eager: true });

// Función para combinar archivos JSON en un solo objeto de traducción
const combineTranslations = (files) => {
  const translations = {};
  Object.entries(files).forEach(([path, module]) => {
    // Extraer el nombre del archivo y la estructura de carpetas
    const pathParts = path.replace('./locales/', '').split('/').slice(1); // Eliminar './locales/<lang>/'
    const fileName = pathParts.pop().replace('.json', ''); // Nombre del archivo sin '.json'
    const namespace = pathParts.length > 0 ? pathParts.join('.') + '.' + fileName : fileName; // Ej: 'subfolder.more' o 'admin'
    
    // Combinar las traducciones en el objeto
    translations[namespace] = module.default || module;
  });
  return translations;
};

// Crear recursos para i18next
const resources = {
  es: { translation: combineTranslations(esFiles) },
  en: { translation: combineTranslations(enFiles) },
  it: { translation: combineTranslations(itFiles) },
  pt: { translation: combineTranslations(ptFiles) }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React ya escapa valores
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      checkForLocalStorage: () => {
        try {
          return typeof window !== 'undefined' && window.localStorage !== null;
        } catch (e) {
          console.warn('i18n.js - localStorage not available:', e);
          return false;
        }
      }
    },
    debug: process.env.NODE_ENV === 'development'
  });

i18n.on('languageChanged', (lng) => {
  console.log('i18n.js - Language changed to:', lng);
});

i18n.on('loaded', (loaded) => {
  console.log('i18n.js - Resources loaded:', loaded);
});

i18n.on('failedLoading', (lng, ns, msg) => {
  console.error('i18n.js - Failed loading:', lng, ns, msg);
});

export default i18n;