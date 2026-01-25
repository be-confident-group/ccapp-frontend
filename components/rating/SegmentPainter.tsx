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

// Touch thresholds in pixels - how close the finger needs to be to a route segment
// START_TOUCH_THRESHOLD is more forgiving for initial touch to reduce "missed" starts
// TOUCH_THRESHOLD is used during painting and for long press detection
const TOUCH_THRESHOLD = 80;
const START_TOUCH_THRESHOLD = 120;

// Path interpolation settings for smooth painting
const INTERPOLATION_STEP = 20; // pixels between interpolated samples
const MAX_INTERPOLATION_STEPS = 10; // cap to maintain performance

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
 * Find the nearest segment index to a screen point within a given threshold
 * @param threshold - maximum distance in pixels (defaults to TOUCH_THRESHOLD)
 */
function findNearestSegmentIndex(
  screenPoint: { x: number; y: number },
  routeScreenPoints: { x: number; y: number }[],
  threshold: number = TOUCH_THRESHOLD
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

    if (distance < minDistance && distance < threshold) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  return nearestIndex;
}

/**
 * Find the absolute nearest segment index (ignoring threshold)
 * Used as fallback when finger moves off route during painting
 */
function findAbsoluteNearestSegmentIndex(
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

    if (distance < minDistance) {
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

  // Track previous finger position for path interpolation
  const prevPositionRef = useRef<{ x: number; y: number } | null>(null);

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

  // Reset gesture state for fresh start
  const resetGestureState = useCallback(() => {
    prevPositionRef.current = null;
  }, []);

  // JS thread handlers for gesture events - use ref for fresh screen points
  const handleGestureStart = useCallback(
    (x: number, y: number) => {
      // Use larger threshold for start to make it easier to begin painting
      const index = findNearestSegmentIndex({ x, y }, screenPointsRef.current, START_TOUCH_THRESHOLD);
      if (index !== null) {
        handlePaintStart(index);
        prevPositionRef.current = { x, y };
      }
    },
    [handlePaintStart]
  );

  const handleGestureUpdate = useCallback(
    (x: number, y: number) => {
      const prev = prevPositionRef.current;
      const screenPoints = screenPointsRef.current;

      if (screenPoints.length < 2) return;

      // Track min/max indices found during this update (for path interpolation)
      let minFoundIndex = currentIndexRef.current ?? Infinity;
      let maxFoundIndex = currentIndexRef.current ?? -Infinity;

      // If we have a previous position, interpolate along the path to catch all segments
      if (prev) {
        const dx = x - prev.x;
        const dy = y - prev.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only interpolate if finger moved significantly
        if (distance > INTERPOLATION_STEP) {
          const steps = Math.min(MAX_INTERPOLATION_STEPS, Math.ceil(distance / INTERPOLATION_STEP));

          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const interpX = prev.x + dx * t;
            const interpY = prev.y + dy * t;

            // Try with threshold first, then fallback to absolute nearest
            let index = findNearestSegmentIndex({ x: interpX, y: interpY }, screenPoints);
            if (index === null) {
              index = findAbsoluteNearestSegmentIndex({ x: interpX, y: interpY }, screenPoints);
            }

            if (index !== null) {
              minFoundIndex = Math.min(minFoundIndex, index);
              maxFoundIndex = Math.max(maxFoundIndex, index);
            }
          }
        }
      }

      // Also check current position
      let currentIndex = findNearestSegmentIndex({ x, y }, screenPoints);
      if (currentIndex === null) {
        currentIndex = findAbsoluteNearestSegmentIndex({ x, y }, screenPoints);
      }

      if (currentIndex !== null) {
        minFoundIndex = Math.min(minFoundIndex, currentIndex);
        maxFoundIndex = Math.max(maxFoundIndex, currentIndex);
      }

      // Update current index to the furthest point in the direction of travel
      // This ensures we capture the full range when painting ends
      if (maxFoundIndex >= 0 && maxFoundIndex !== Infinity) {
        handlePaintUpdate(maxFoundIndex);

        // Also extend start index backward if we found segments before it
        if (startIndexRef.current !== null && minFoundIndex < startIndexRef.current && minFoundIndex !== Infinity) {
          startIndexRef.current = minFoundIndex;
        }
      }

      // Update previous position for next interpolation
      prevPositionRef.current = { x, y };
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

  // Handle gesture cancellation (cleanup without saving)
  const handleGestureCancel = useCallback(() => {
    startIndexRef.current = null;
    currentIndexRef.current = null;
    prevPositionRef.current = null;
    setIsPainting(false);
    onPaintingStateChange?.(false);
  }, [onPaintingStateChange]);

  // Pan gesture for painting - only active when feeling is selected
  // minDistance reduced from 30 to 20 for more responsive start
  // Long press maxDistance (25) > pan minDistance (20), but Race gesture handles conflicts
  const panGesture = Gesture.Pan()
    .enabled(enabled && selectedFeeling !== null)
    .minDistance(20)
    .onBegin((event) => {
      'worklet';
      // Reset state for fresh gesture
      runOnJS(resetGestureState)();
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
    })
    .onFinalize(() => {
      'worklet';
      // Ensure cleanup even on gesture cancellation
      paintIndicatorOpacity.value = withTiming(0, { duration: 100 });
      runOnJS(handleGestureCancel)();
    });

  // Long press gesture - active anytime (both when painting and not painting)
  // Long press requires staying within 25px for 500ms; pan requires moving 20px
  const longPressGesture = Gesture.LongPress()
    .enabled(enabled && !!onLongPress)
    .minDuration(500)
    .maxDistance(25)
    .onStart((event) => {
      'worklet';
      runOnJS(handleLongPressEvent)(event.x, event.y);
    });

  // Create native gesture to allow map interactions when not painting
  const nativeGesture = Gesture.Native();

  // Combine gestures intelligently:
  // - When painting (feeling selected): race between pan and long press
  //   (map interactions disabled, so gesture handler controls everything)
  // - When not painting (no feeling): use native gesture pass-through
  //   (Mapbox's native onLongPress handles long press, gesture handler stays out of the way)
  const composedGesture = selectedFeeling !== null
    ? (enabled && !!onLongPress)
      ? Gesture.Race(longPressGesture, panGesture)
      : panGesture
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
