import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation resources
import en from '@/locales/en';
import es from '@/locales/es';

const LANGUAGE_STORAGE_KEY = '@beactive_language';

// Language detection plugin for AsyncStorage
const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lang: string) => void) => {
    try {
      // First, try to get saved language preference
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }

      // If no saved preference, use device language
      const deviceLocale = Localization.getLocales()[0];
      const deviceLanguage = deviceLocale?.languageCode || 'en';

      callback(deviceLanguage);
    } catch (error) {
      console.error('Error detecting language:', error);
      callback('en'); // Fallback to English
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (error) {
      console.error('Error caching language:', error);
    }
  },
};

// Initialize i18next
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en,
      es,
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'home', 'profile', 'maps', 'groups', 'feedback', 'validation', 'alerts'],

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false, // Important for React Native
    },

    debug: __DEV__, // Enable debug logs in development
  });

export default i18n;
