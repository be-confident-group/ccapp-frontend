import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useTheme } from '@/contexts/ThemeContext';

// Evaluated once: the platform capability can't change while the app runs.
const LIQUID_GLASS = isLiquidGlassAvailable();

interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  /** Corner radius of the surface; glass needs it on the native view itself. */
  borderRadius: number;
  /** Let the glass react to touches (iOS 26+ only). */
  interactive?: boolean;
}

/**
 * Background layer for floating glass UI. Renders Apple's Liquid Glass on
 * iOS 26+, a system chrome blur on older iOS, and a translucent themed fill on
 * Android/web. Place it absolutely behind content (it fills its parent).
 *
 * Note: never animate `opacity` to 0 on this view or its parents — GlassView
 * stops rendering the effect. Animate transforms/size instead.
 */
export function GlassSurface({ style, borderRadius, interactive = false }: GlassSurfaceProps) {
  const { colors, isDark } = useTheme();

  if (LIQUID_GLASS) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        isInteractive={interactive}
        style={[StyleSheet.absoluteFill, { borderRadius }, style]}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        pointerEvents="none"
        intensity={100}
        tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        style={[
          StyleSheet.absoluteFill,
          styles.clip,
          { borderRadius, borderColor: colors.glassBorder },
          style,
        ]}
      />
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.clip,
        { borderRadius, backgroundColor: colors.glassFallback, borderColor: colors.glassBorder },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
