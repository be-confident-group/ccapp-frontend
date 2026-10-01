import React, { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

const PRESS_SPRING = { damping: 15, stiffness: 400 };

interface GlassButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  /** Diameter of the circular button. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Circular floating glass button with spring press feedback and a haptic tap on touch-down. */
export function GlassButton({ onPress, accessibilityLabel, children, size = 44, style }: GlassButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.shadow,
        { width: size, height: size, borderRadius: size / 2, shadowColor: colors.shadow },
        animatedStyle,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.88, PRESS_SPRING);
          if (process.env.EXPO_OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        style={styles.content}
      >
        <GlassSurface borderRadius={size / 2} interactive />
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
