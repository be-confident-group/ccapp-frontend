/**
 * Cycle Confident color theme
 * Primary: Red (#ED2536), Accent: Gold (#F4C542), Secondary: Dark Blue (#232244)
 */

import { Platform } from 'react-native';

// Cycle Confident brand colors
const primaryRed = '#ED2536';
const accentGold = '#F4C542';
const secondaryBlue = '#232244';
const successGreen = '#4CAF50';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: primaryRed,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryRed,
    primary: primaryRed,
    accent: accentGold,
    secondary: secondaryBlue,
    success: successGreen,
    card: '#f5f5f5',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: primaryRed,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: accentGold,
    primary: primaryRed,
    accent: accentGold,
    secondary: secondaryBlue,
    success: successGreen,
    card: '#1f1f1f',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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
