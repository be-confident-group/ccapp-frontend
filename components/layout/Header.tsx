import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { ChevronLeftIcon } from 'react-native-heroicons/solid';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { GlassButton } from '@/components/ui/GlassButton';

const BUTTON_SIZE = 40;
const BACKDROP_FADE_DISTANCE = 24;

export type HeaderVariant = 'standard' | 'minimal';

interface HeaderProps {
  title?: string;
  variant?: HeaderVariant;
  showBack?: boolean;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  style?: ViewStyle;
  /** Scroll offset of the content under the header; fades in a blur backdrop + hairline. */
  scrollY?: SharedValue<number>;
}

export default function Header({
  title,
  variant = 'standard',
  showBack = false,
  onBackPress,
  rightElement,
  leftElement,
  style,
  scrollY,
}: HeaderProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation('common');

  // Opacity is animated on a plain wrapper around BlurView, never on a GlassSurface.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: scrollY
      ? interpolate(scrollY.value, [0, BACKDROP_FADE_DISTANCE], [0, 1], Extrapolation.CLAMP)
      : 0,
  }));

  const backdrop = scrollY ? (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backdropStyle]}>
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFallback, opacity: 0.85 }]}
      />
      <View style={[styles.hairline, { backgroundColor: colors.glassBorder }]} />
    </Animated.View>
  ) : null;

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const backButtonEl = (
    <GlassButton onPress={handleBackPress} accessibilityLabel={t('buttons.back')} size={BUTTON_SIZE}>
      <ChevronLeftIcon size={22} color={colors.glassInactive} />
    </GlassButton>
  );

  if (variant === 'minimal') {
    return (
      <View style={[styles.minimalContainer, style]}>
        {backdrop}
        {showBack && backButtonEl}
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {backdrop}
      <View style={styles.leftSection}>
        {showBack ? (
          backButtonEl
        ) : leftElement ? (
          leftElement
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.centerSection}>
        {title && (
          <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
        )}
      </View>

      <View style={styles.rightSection}>
        {rightElement || <View style={styles.placeholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: BUTTON_SIZE,
  },
  rightElement: {
    marginLeft: 'auto',
  },
});
