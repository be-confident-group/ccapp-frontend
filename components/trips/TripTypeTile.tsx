import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';

const PRESS_SPRING = { damping: 15, stiffness: 400 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TripTypeTileProps {
  label: string;
  /** Accent colour of this trip type. */
  color: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

/** Equal-width vertical tile (icon above label) used to pick a trip type. */
export function TripTypeTile({ label, color, selected, onPress, icon: Icon }: TripTypeTileProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.94, PRESS_SPRING);
        if (process.env.EXPO_OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={[
        styles.tile,
        {
          backgroundColor: selected ? color + '26' : colors.background,
          borderColor: selected ? color : colors.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        },
        animatedStyle,
      ]}
    >
      <Icon size={22} color={selected ? color : colors.textSecondary} />
      <ThemedText
        numberOfLines={1}
        style={[styles.label, { color: selected ? color : colors.textSecondary }]}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
