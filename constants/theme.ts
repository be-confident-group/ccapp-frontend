/**
 * Cycle Confident Theme System
 * Primary: Red (#ED2536), Accent: Gold (#F4C542), Secondary: Dark Blue (#232244)
 */

import { Platform } from 'react-native';

// Cycle Confident brand colors
const primaryRed = '#ED2536';
const accentGold = '#F4C542';
const secondaryBlue = '#232244';
const successGreen = '#4CAF50';
const warningOrange = '#FF9800';
const errorRed = '#F44336';
const infoBlue = '#2196F3';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  // Brand colors
  primary: string;
  accent: string;
  secondary: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Base colors
  text: string;
  textSecondary: string;
  textMuted: string;
  background: string;
  backgroundSecondary: string;

  // UI elements
  card: string;
  border: string;
  divider: string;
  shadow: string;

  // Interactive elements
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;

  // Input fields
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;

  // Overlays
  overlay: string;
  backdrop: string;
}

export const Colors: Record<ColorScheme, ThemeColors> = {
  light: {
    // Brand colors
    primary: primaryRed,
    accent: accentGold,
    secondary: secondaryBlue,

    // Status colors
    success: successGreen,
    warning: warningOrange,
    error: errorRed,
    info: infoBlue,

    // Base colors
    text: '#11181C',
    textSecondary: '#687076',
    textMuted: '#9BA1A6',
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',

    // UI elements
    card: '#FFFFFF',
    border: '#E0E0E0',
    divider: '#EEEEEE',
    shadow: '#000000',

    // Interactive elements
    tint: primaryRed,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryRed,

    // Input fields
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
    inputPlaceholder: '#9BA1A6',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.5)',
    backdrop: 'rgba(0, 0, 0, 0.3)',
  },
  dark: {
    // Brand colors
    primary: primaryRed,
    accent: accentGold,
    secondary: secondaryBlue,

    // Status colors
    success: successGreen,
    warning: warningOrange,
    error: errorRed,
    info: infoBlue,

    // Base colors
    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    textMuted: '#687076',
    background: '#0A0A0A',
    backgroundSecondary: '#151718',

    // UI elements
    card: '#1F1F1F',
    border: '#333333',
    divider: '#2A2A2A',
    shadow: '#000000',

    // Interactive elements
    tint: primaryRed,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: accentGold,

    // Input fields
    inputBackground: '#1F1F1F',
    inputBorder: '#333333',
    inputPlaceholder: '#687076',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.7)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
