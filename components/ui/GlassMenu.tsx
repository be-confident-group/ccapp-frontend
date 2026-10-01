import React, { ReactNode, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckIcon } from 'react-native-heroicons/mini';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

/** On-screen frame of the control the menu grows out of (from `measureInWindow`). */
export interface GlassMenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GlassMenuOption<K extends string> {
  key: K;
  label: string;
  icon?: ReactNode;
}

interface GlassMenuProps<K extends string> {
  anchor: GlassMenuAnchor | null;
  options: GlassMenuOption<K>[];
  selected: K;
  /** Called after the close animation with the chosen option. */
  onSelect: (key: K) => void;
  /** Called after the close animation when dismissed. */
  onClose: () => void;
}

const OPEN_SPRING = { damping: 18, stiffness: 260, mass: 0.7 };
const CLOSE_DURATION = 150;
const WIDTH = 220;
const ROW_HEIGHT = 46;
const PADDING = 6;
const GAP = 6;
const EDGE = 16;
const RADIUS = 20;

/**
 * iOS-style pull-down menu: a glass card that grows out of the right edge of
 * `anchor` (below it, or above when there's no room) with a check on the
 * selected option. Tapping outside dismisses it.
 */
export function GlassMenu<K extends string>({ anchor, options, selected, onSelect, onClose }: GlassMenuProps<K>) {
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const progress = useSharedValue(0);
  const isClosing = useRef(false);

  useEffect(() => {
    if (anchor) {
      isClosing.current = false;
      progress.value = 0;
      progress.value = withSpring(1, OPEN_SPRING);
    }
  }, [anchor, progress]);

  const menuHeight = options.length * ROW_HEIGHT + PADDING * 2;
  const below = anchor ? anchor.y + anchor.height + GAP + menuHeight < screenHeight - 120 : true;

  const close = (then: () => void) => {
    if (isClosing.current) return;
    isClosing.current = true;
    progress.value = withTiming(0, { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) });
    setTimeout(then, CLOSE_DURATION);
  };

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.2, 1]) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));

  if (!anchor) return null;

  const right = Math.max(EDGE, screenWidth - (anchor.x + anchor.width) + EDGE);
  const position = below
    ? { top: anchor.y + anchor.height - GAP }
    : { top: anchor.y - menuHeight + GAP };

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close(onClose)}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => close(onClose)} />
      <Animated.View
        style={[
          styles.menu,
          position,
          { right, shadowColor: colors.shadow, transformOrigin: below ? 'right top' : 'right bottom' },
          menuStyle,
        ]}
      >
        <GlassSurface borderRadius={RADIUS} />
        <Animated.View style={contentStyle}>
          {options.map((option) => {
            const isSelected = option.key === selected;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
                onPressIn={() => {
                  if (process.env.EXPO_OS !== 'web') Haptics.selectionAsync();
                }}
                onPress={() => close(() => (isSelected ? onClose() : onSelect(option.key)))}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.glassHighlight }]}
              >
                <View style={styles.check}>{isSelected && <CheckIcon size={18} color={colors.glassTint} />}</View>
                <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                  {option.label}
                </Text>
                {option.icon}
              </Pressable>
            );
          })}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: WIDTH,
    padding: PADDING,
    borderRadius: RADIUS,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 8,
  },
  check: {
    width: 18,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
});
