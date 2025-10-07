/**
 * Hook for getting themed colors
 * Uses the new ThemeContext system
 */

import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors
) {
  const { colorScheme, colors } = useTheme();
  const colorFromProps = props[colorScheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[colorName];
  }
}
