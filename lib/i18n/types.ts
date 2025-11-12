// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
  // Add more languages as needed
  // fr: 'Français',
  // de: 'Deutsch',
  // pt: 'Português',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Language option for picker
export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  // Add more languages as needed
];

// Translation namespaces
export type TranslationNamespace =
  | 'common'
  | 'auth'
  | 'home'
  | 'profile'
  | 'maps'
  | 'groups'
  | 'feedback'
  | 'validation'
  | 'alerts';
