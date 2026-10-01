import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ColorScheme, ThemeColors } from '@/constants/theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colorScheme: ColorScheme;
  colors: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@radzi_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Apply the override natively too. On iOS 27+ the StatusBar style API is a no-op and
  // the status bar follows the window's interface style, so without this a manual
  // Light/Dark choice that differs from the system would leave unreadable status bar text.
  // `null` restores following the system setting.
  useEffect(() => {
    if (!isReady) return;
    Appearance.setColorScheme(themeMode === 'system' ? null : themeMode);
  }, [themeMode, isReady]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    } finally {
      setIsReady(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const currentScheme = themeMode === 'system' ? systemColorScheme : themeMode;
    const newMode = currentScheme === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  // Determine actual color scheme
  const colorScheme: ColorScheme =
    themeMode === 'system'
      ? (systemColorScheme ?? 'light')
      : themeMode;

  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  // Don't render until theme is loaded
  if (!isReady) {
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        colors,
        themeMode,
        setThemeMode,
        toggleTheme,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
