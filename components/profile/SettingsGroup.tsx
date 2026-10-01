import React, { ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface SettingsGroupProps {
  /** Small uppercase header above the card. */
  title?: string;
  children: ReactNode;
  /** Position in the screen, used to stagger the entrance. */
  index?: number;
}

/**
 * iOS inset-grouped section: uppercase caption plus a rounded card.
 * Entrance is translate + a partial fade (never to 0, since rows may host glass controls).
 */
export function SettingsGroup({ title, children, index = 0 }: SettingsGroupProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(index * 70, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.6,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  return (
    <Animated.View style={[styles.section, animatedStyle]}>
      {title ? (
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.card }]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
});
