import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedLanguage } from '@/lib/i18n/types';

const LANGUAGE_STORAGE_KEY = '@beactive_language';

/**
 * Custom hook for managing language selection and switching
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    i18n.language as SupportedLanguage
  );
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    // Update state when language changes
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng as SupportedLanguage);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  /**
   * Change the app language
   */
  const changeLanguage = useCallback(
    async (language: SupportedLanguage) => {
      try {
        setIsChanging(true);
        await i18n.changeLanguage(language);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        setCurrentLanguage(language);
      } catch (error) {
        console.error('Error changing language:', error);
      } finally {
        setIsChanging(false);
      }
    },
    [i18n]
  );

  /**
   * Get the current language
   */
  const getLanguage = useCallback(() => {
    return i18n.language as SupportedLanguage;
  }, [i18n]);

  return {
    currentLanguage,
    changeLanguage,
    getLanguage,
    isChanging,
  };
}
