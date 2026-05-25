import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import mr from './locales/mr/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      mr: { translation: mr }
    },
    fallbackLng: 'mr', // Default to Marathi
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false
    }
  });

// Set document lang class
const handleLangChange = (lng) => {
  document.documentElement.className = `lang-${lng}`;
  document.documentElement.lang = lng;
};

i18n.on('languageChanged', handleLangChange);
handleLangChange(i18n.language || 'mr');

export default i18n;
