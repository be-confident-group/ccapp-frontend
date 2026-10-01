import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

const PRESS_SPRING = { damping: 15, stiffness: 400 };
const HEIGHT = 44;
const BUTTON_WIDTH = 44;

export interface GlassAction {
  key: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  accessibilityLabel: string;
  onPress: () => void;
}

/** One glass capsule holding several icon buttons, each with spring press feedback. */
export function GlassActionGroup({ actions }: { actions: GlassAction[] }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.capsule, { shadowColor: colors.shadow }]}>
      <GlassSurface borderRadius={HEIGHT / 2} />
      {actions.map((action) => (
        <ActionButton key={action.key} action={action} color={colors.glassInactive} />
      ))}
    </View>
  );
}

function ActionButton({ action, color }: { action: GlassAction; color: string }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const Icon = action.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      onPress={action.onPress}
      onPressIn={() => {
        scale.value = withSpring(0.82, PRESS_SPRING);
        if (process.env.EXPO_OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      style={styles.button}
    >
      <Animated.View style={style}>
        <Icon size={24} color={color} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  button: {
    width: BUTTON_WIDTH,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
