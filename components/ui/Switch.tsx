import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Switch as NativeSwitch, SwitchProps } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Springs } from '@/constants/motion';
import { useTheme } from '@/contexts/ThemeContext';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const BORDER = 2;
const THUMB = 24;
// The thumb is smaller when off and grows a little while pressed.
const THUMB_OFF_SCALE = 16 / THUMB;
const THUMB_PRESSED_SCALE = 28 / THUMB;
const THUMB_TRAVEL = TRACK_WIDTH - BORDER * 2 - THUMB - 4;

/**
 * Drop-in replacement for React Native's Switch: the native control on iOS,
 * a Material 3 switch on Android (React Native ships the older Material one).
 */
export function Switch(props: SwitchProps) {
  return Platform.OS === 'android' ? <MaterialSwitch {...props} /> : <NativeSwitch {...props} />;
}

function MaterialSwitch({ value = false, onValueChange, disabled = false, trackColor, ...rest }: SwitchProps) {
  const { colors } = useTheme();
  const on = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, Springs.spatial);
  }, [value, on]);

  const onColor = typeof trackColor?.true === 'string' ? trackColor.true : colors.primary;
  const offColor = colors.glassFallback;
  const outline = colors.textMuted;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [offColor, onColor]),
    borderColor: interpolateColor(on.value, [0, 1], [outline, onColor]),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [outline, '#FFFFFF']),
    transform: [
      { translateX: interpolate(on.value, [0, 1], [0, THUMB_TRAVEL]) },
      {
        scale:
          interpolate(on.value, [0, 1], [THUMB_OFF_SCALE, 1]) +
          pressed.value * (THUMB_PRESSED_SCALE - 1),
      },
    ],
  }));

  return (
    <Pressable
      {...rest}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange?.(!value)}
      onPressIn={() => {
        pressed.value = withSpring(1, Springs.press);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, Springs.press);
      }}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: BORDER,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  disabled: {
    opacity: 0.38,
  },
});
