/**
 * SegmentPainter Component
 *
 * A gesture overlay for painting route segments with feelings.
 * Captures pan gestures and maps screen coordinates to route segments.
 */

import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { Coordinate } from '@/types/location';
import type { FeelingType, RouteSegment } from '@/types/rating';

interface SegmentPainterProps {
  route: Coordinate[];
  routeScreenPoints: { x: number; y: number }[];
  selectedFeeling: FeelingType | null;
  onSegmentPainted: (segment: RouteSegment) => void;
  onPaintingStateChange?: (isPainting: boolean) => void;
  enabled: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

// Touch threshold in pixels - how close the finger needs to be to a route segment
const TOUCH_THRESHOLD = 50;

/**
 * Calculate perpendicular distance from point to line segment
 */
function pointToLineDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  // Parameter of closest point on line segment
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  // Clamp to segment
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest segment index to a screen point
 */
function findNearestSegmentIndex(
  screenPoint: { x: number; y: number },
  routeScreenPoints: { x: number; y: number }[]
): number | null {
  if (routeScreenPoints.length < 2) return null;

  let minDistance = Infinity;
  let nearestIndex: number | null = null;

  for (let i = 0; i < routeScreenPoints.length - 1; i++) {
    const distance = pointToLineDistance(
      screenPoint,
      routeScreenPoints[i],
      routeScreenPoints[i + 1]
    );

    if (distance < minDistance && distance < TOUCH_THRESHOLD) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

export default function SegmentPainter({
  route,
  routeScreenPoints,
  selectedFeeling,
  onSegmentPainted,
  onPaintingStateChange,
  enabled,
  style,
  children,
}: SegmentPainterProps) {
  const [isPainting, setIsPainting] = useState(false);
  const startIndexRef = useRef<number | null>(null);
  const currentIndexRef = useRef<number | null>(null);

  // Visual feedback for painting
  const paintIndicatorOpacity = useSharedValue(0);
  const paintIndicatorX = useSharedValue(0);
  const paintIndicatorY = useSharedValue(0);

  const handlePaintStart = useCallback(
    (index: number) => {
      startIndexRef.current = index;
      currentIndexRef.current = index;
      setIsPainting(true);
      onPaintingStateChange?.(true);
    },
    [onPaintingStateChange]
  );

  const handlePaintUpdate = useCallback((index: number) => {
    currentIndexRef.current = index;
  }, []);

  const handlePaintEnd = useCallback(() => {
    if (
      startIndexRef.current !== null &&
      currentIndexRef.current !== null &&
      selectedFeeling
    ) {
      const segment: RouteSegment = {
        startIndex: Math.min(startIndexRef.current, currentIndexRef.current),
        endIndex: Math.max(startIndexRef.current, currentIndexRef.current),
        feeling: selectedFeeling,
      };
      onSegmentPainted(segment);
    }

    startIndexRef.current = null;
    currentIndexRef.current = null;
    setIsPainting(false);
    onPaintingStateChange?.(false);
  }, [selectedFeeling, onSegmentPainted, onPaintingStateChange]);

  // Pan gesture for painting
  const panGesture = Gesture.Pan()
    .enabled(enabled && selectedFeeling !== null)
    .onStart((event) => {
      if (!selectedFeeling) return;

      const index = findNearestSegmentIndex(
        { x: event.x, y: event.y },
        routeScreenPoints
      );

      if (index !== null) {
        runOnJS(handlePaintStart)(index);
        paintIndicatorOpacity.value = withTiming(1, { duration: 100 });
        paintIndicatorX.value = event.x;
        paintIndicatorY.value = event.y;
      }
    })
    .onUpdate((event) => {
      if (startIndexRef.current === null) return;

      const index = findNearestSegmentIndex(
        { x: event.x, y: event.y },
        routeScreenPoints
      );

      if (index !== null) {
        runOnJS(handlePaintUpdate)(index);
      }

      paintIndicatorX.value = event.x;
      paintIndicatorY.value = event.y;
    })
    .onEnd(() => {
      runOnJS(handlePaintEnd)();
      paintIndicatorOpacity.value = withTiming(0, { duration: 200 });
    })
    .onFinalize(() => {
      runOnJS(handlePaintEnd)();
      paintIndicatorOpacity.value = withTiming(0, { duration: 200 });
    });

  // Animated style for paint indicator
  const paintIndicatorStyle = useAnimatedStyle(() => ({
    opacity: paintIndicatorOpacity.value,
    transform: [
      { translateX: paintIndicatorX.value - 20 },
      { translateY: paintIndicatorY.value - 20 },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.container, style]}>
        {children}

        {/* Paint indicator - shows finger position while painting */}
        {selectedFeeling && (
          <Animated.View
            style={[
              styles.paintIndicator,
              paintIndicatorStyle,
              {
                backgroundColor:
                  selectedFeeling === 'stressed'
                    ? '#F44336'
                    : selectedFeeling === 'uncomfortable'
                    ? '#FF9800'
                    : selectedFeeling === 'comfortable'
                    ? '#8BC34A'
                    : '#4CAF50',
              },
            ]}
            pointerEvents="none"
          />
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paintIndicator: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.6,
    pointerEvents: 'none',
  },
});
