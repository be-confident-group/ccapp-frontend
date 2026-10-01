import React, { ReactNode, useEffect, useRef } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

const HIGHLIGHT_SPRING = { damping: 16, stiffness: 200, mass: 0.9 };
const PADDING = 4;
const GAP = 4;
const DEFAULT_SEGMENT_SIZE = 36;

export interface GlassSegment<K extends string> {
  key: K;
  accessibilityLabel: string;
  /** Segment content; `active` lets it switch to a contrasting colour. */
  render: (active: boolean) => ReactNode;
}

interface GlassSegmentedControlProps<K extends string> {
  segments: GlassSegment<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Fill colour of the sliding highlight behind the active segment. */
  activeColor: string;
  orientation?: 'horizontal' | 'vertical';
  /**
   * Fixed segment width. When omitted (horizontal only) each segment is sized
   * by its content (or shares the width equally with `stretch`) and the
   * highlight springs to the measured frame of the active one.
   */
  segmentWidth?: number;
  segmentHeight?: number;
  /** Measured mode only: fill the parent's width, splitting it equally. */
  stretch?: boolean;
}

interface Frame {
  x: number;
  width: number;
}

/**
 * Glass capsule of segments with a highlight that springs (and, with fixed
 * segments, stretches a little in flight) to the active one.
 */
export function GlassSegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  activeColor,
  orientation = 'horizontal',
  segmentWidth,
  segmentHeight = DEFAULT_SEGMENT_SIZE,
  stretch = false,
}: GlassSegmentedControlProps<K>) {
  const { colors } = useTheme();
  const isHorizontal = orientation === 'horizontal';
  const measured = isHorizontal && segmentWidth == null;
  const fixedWidth = segmentWidth ?? DEFAULT_SEGMENT_SIZE;
  const activeIndex = Math.max(0, segments.findIndex((s) => s.key === value));
  const step = (isHorizontal ? fixedWidth : segmentHeight) + GAP;
  const radius = Math.min(measured ? segmentHeight : fixedWidth, segmentHeight) / 2 + PADDING;

  // Fixed mode: fractional index of the active segment.
  const position = useSharedValue(activeIndex);
  // Measured mode: frame of the highlight.
  const highlightX = useSharedValue(0);
  const highlightWidth = useSharedValue(0);
  const frames = useRef<Frame[]>([]);
  const placed = useRef(false);

  const moveHighlight = (animate: boolean) => {
    const frame = frames.current[activeIndex];
    if (!frame) return;
    if (animate && placed.current) {
      highlightX.value = withSpring(frame.x, HIGHLIGHT_SPRING);
      highlightWidth.value = withSpring(frame.width, HIGHLIGHT_SPRING);
    } else {
      highlightX.value = frame.x;
      highlightWidth.value = frame.width;
      placed.current = true;
    }
  };

  useEffect(() => {
    if (measured) {
      moveHighlight(true);
    } else {
      position.value = withSpring(activeIndex, HIGHLIGHT_SPRING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, measured]);

  const handleSegmentLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    const previous = frames.current[index];
    frames.current[index] = { x, width };
    if (index === activeIndex && (!previous || previous.x !== x || previous.width !== width)) {
      moveHighlight(true);
    }
  };

  const fixedHighlightStyle = useAnimatedStyle(() => {
    const offset = position.value * step;
    // 0 when resting, 0.5 halfway between segments.
    const stretchFactor = 1 + Math.abs(position.value - Math.round(position.value)) * 0.3;
    return {
      transform: isHorizontal
        ? [{ translateX: offset }, { scaleX: stretchFactor }]
        : [{ translateY: offset }, { scaleY: stretchFactor }],
    };
  });

  const measuredHighlightStyle = useAnimatedStyle(() => ({
    width: highlightWidth.value,
    transform: [{ translateX: highlightX.value }],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          flexDirection: isHorizontal ? 'row' : 'column',
          borderRadius: radius,
          shadowColor: colors.shadow,
        },
        measured && stretch && styles.stretch,
      ]}
    >
      <GlassSurface borderRadius={radius} interactive />
      {measured ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            { left: 0, height: segmentHeight, backgroundColor: activeColor },
            measuredHighlightStyle,
          ]}
        />
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            { width: fixedWidth, height: segmentHeight, backgroundColor: activeColor },
            fixedHighlightStyle,
          ]}
        />
      )}
      {segments.map((segment, index) => {
        const active = segment.key === value;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={segment.accessibilityLabel}
            onLayout={measured ? handleSegmentLayout(index) : undefined}
            onPressIn={() => {
              if (!active && process.env.EXPO_OS !== 'web') {
                Haptics.selectionAsync();
              }
            }}
            onPress={() => {
              if (!active) onChange(segment.key);
            }}
            style={[
              styles.segment,
              measured
                ? [{ height: segmentHeight, paddingHorizontal: stretch ? 6 : 14 }, stretch && styles.segmentFlex]
                : { width: fixedWidth, height: segmentHeight },
            ]}
          >
            {segment.render(active)}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: PADDING,
    gap: GAP,
    alignSelf: 'flex-start',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  highlight: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    borderRadius: BorderRadius.full,
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentFlex: {
    flex: 1,
  },
});
