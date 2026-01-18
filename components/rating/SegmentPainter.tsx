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
  onLongPress?: (coordinate: Coordinate) => void;
  enabled: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

// Touch threshold in pixels - how close the finger needs to be to a route segment
// Increased to make it easier to paint routes, especially with sparse GPS points
const TOUCH_THRESHOLD = 80;

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
  onLongPress,
  enabled,
  style,
  children,
}: SegmentPainterProps) {
  const [isPainting, setIsPainting] = useState(false);
  const startIndexRef = useRef<number | null>(null);
  const currentIndexRef = useRef<number | null>(null);

  // Store a fresh copy of screen points for use in gesture handlers
  const screenPointsRef = useRef(routeScreenPoints);
  screenPointsRef.current = routeScreenPoints;

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
      const minIndex = Math.min(startIndexRef.current, currentIndexRef.current);
      const maxIndex = Math.max(startIndexRef.current, currentIndexRef.current);

      // Ensure we paint at least a small segment even for single taps
      const segment: RouteSegment = {
        startIndex: minIndex,
        endIndex: Math.max(minIndex, maxIndex),
        feeling: selectedFeeling,
      };

      onSegmentPainted(segment);
    }

    startIndexRef.current = null;
    currentIndexRef.current = null;
    setIsPainting(false);
    onPaintingStateChange?.(false);
  }, [selectedFeeling, onSegmentPainted, onPaintingStateChange]);

  // JS thread handlers for gesture events - use ref for fresh screen points
  const handleGestureStart = useCallback(
    (x: number, y: number) => {
      const index = findNearestSegmentIndex({ x, y }, screenPointsRef.current);
      if (index !== null) {
        handlePaintStart(index);
      }
    },
    [handlePaintStart]
  );

  const handleGestureUpdate = useCallback(
    (x: number, y: number) => {
      // Always find and update nearest index, even if beyond threshold
      // This prevents gaps when finger moves slightly off route during painting
      let index = findNearestSegmentIndex({ x, y }, screenPointsRef.current);

      // If no index within threshold, find the absolute nearest point (ignoring threshold)
      if (index === null && screenPointsRef.current.length > 0) {
        let minDist = Infinity;
        for (let i = 0; i < screenPointsRef.current.length - 1; i++) {
          const distance = pointToLineDistance(
            { x, y },
            screenPointsRef.current[i],
            screenPointsRef.current[i + 1]
          );
          if (distance < minDist) {
            minDist = distance;
            index = i;
          }
        }
      }

      if (index !== null) {
        handlePaintUpdate(index);
      }
    },
    [handlePaintUpdate]
  );

  // Handle long press - find nearest coordinate and trigger callback
  const handleLongPressEvent = useCallback(
    (x: number, y: number) => {
      if (!onLongPress || screenPointsRef.current.length === 0) return;

      // Find nearest point on route
      let minDist = Infinity;
      let nearestIdx = 0;

      for (let i = 0; i < screenPointsRef.current.length; i++) {
        const pt = screenPointsRef.current[i];
        const dist = Math.sqrt(Math.pow(pt.x - x, 2) + Math.pow(pt.y - y, 2));
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }

      // Only trigger if within threshold
      if (minDist < TOUCH_THRESHOLD && route[nearestIdx]) {
        onLongPress(route[nearestIdx]);
      }
    },
    [onLongPress, route]
  );

  // Pan gesture for painting - only active when feeling is selected
  // minDistance set higher than long press maxDistance to allow long press to complete
  const panGesture = Gesture.Pan()
    .enabled(enabled && selectedFeeling !== null)
    .minDistance(30)
    .onBegin((event) => {
      'worklet';
      paintIndicatorX.value = event.x;
      paintIndicatorY.value = event.y;
    })
    .onStart((event) => {
      'worklet';
      paintIndicatorOpacity.value = withTiming(1, { duration: 100 });
      runOnJS(handleGestureStart)(event.x, event.y);
    })
    .onUpdate((event) => {
      'worklet';
      paintIndicatorX.value = event.x;
      paintIndicatorY.value = event.y;
      runOnJS(handleGestureUpdate)(event.x, event.y);
    })
    .onEnd(() => {
      'worklet';
      paintIndicatorOpacity.value = withTiming(0, { duration: 200 });
      runOnJS(handlePaintEnd)();
    });

  // Long press gesture - active anytime (both when painting and not painting)
  // maxDistance (25) is less than pan minDistance (30) so long press wins if user holds still
  const longPressGesture = Gesture.LongPress()
    .enabled(enabled && !!onLongPress)
    .minDuration(500)
    .maxDistance(25)
    .onStart((event) => {
      'worklet';
      runOnJS(handleLongPressEvent)(event.x, event.y);
    });

  // Create native gesture to allow map interactions when gestures are disabled
  const nativeGesture = Gesture.Native();

  // Combine gestures intelligently:
  // - When painting: race between pan and long press (user can paint or report issue)
  // - When long press enabled: race between long press and native (first to activate wins)
  // - Otherwise: just use native
  const composedGesture = selectedFeeling !== null
    ? (enabled && !!onLongPress)
      ? Gesture.Race(longPressGesture, panGesture)
      : panGesture
    : (enabled && !!onLongPress)
      ? Gesture.Race(longPressGesture, nativeGesture)
      : nativeGesture;

  // Animated style for paint indicator
  const paintIndicatorStyle = useAnimatedStyle(() => ({
    opacity: paintIndicatorOpacity.value,
    transform: [
      { translateX: paintIndicatorX.value - 20 },
      { translateY: paintIndicatorY.value - 20 },
    ],
  }));

  // Always wrap in GestureDetector so long press works
  // Individual gestures control their own enabled state
  return (
    <GestureDetector gesture={composedGesture}>
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
