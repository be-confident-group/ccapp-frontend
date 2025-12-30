/**
 * RatingMap Component
 *
 * Displays a map with a route that can be painted with feelings.
 * Shows multi-colored segments based on user ratings.
 */

import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  useCallback,
} from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Mapbox, {
  MapView as RNMapView,
  Camera,
  ShapeSource,
  LineLayer,
  CircleLayer,
} from '@rnmapbox/maps';
import { useTheme } from '@/contexts/ThemeContext';
import type { Coordinate } from '@/types/location';
import type { RouteSegment, FeelingType } from '@/types/rating';
import { getFeelingColor, UNPAINTED_COLOR } from '@/types/rating';

/**
 * Validate a coordinate has valid numeric values
 */
function isValidCoordinate(coord: Coordinate): boolean {
  return (
    coord &&
    typeof coord.longitude === 'number' &&
    typeof coord.latitude === 'number' &&
    !isNaN(coord.longitude) &&
    !isNaN(coord.latitude) &&
    isFinite(coord.longitude) &&
    isFinite(coord.latitude)
  );
}

/**
 * Filter route to only include valid coordinates
 */
function filterValidCoordinates(route: Coordinate[]): Coordinate[] {
  return route.filter(isValidCoordinate);
}

export interface RatingMapRef {
  getRouteScreenPoints: () => Promise<{ x: number; y: number }[]>;
  fitToRoute: () => void;
}

interface RatingMapProps {
  route: Coordinate[];
  segments: RouteSegment[];
  previewSegment?: RouteSegment | null;
  style?: ViewStyle;
  onMapReady?: () => void;
}

/**
 * Build GeoJSON features for each painted and unpainted segment
 */
function buildSegmentFeatures(
  route: Coordinate[],
  segments: RouteSegment[],
  previewSegment?: RouteSegment | null
): GeoJSON.FeatureCollection {
  if (route.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: GeoJSON.Feature[] = [];

  // Combine segments with preview
  const allSegments = previewSegment
    ? [...segments, previewSegment]
    : segments;

  // Sort segments by start index
  const sortedSegments = [...allSegments].sort(
    (a, b) => a.startIndex - b.startIndex
  );

  let currentIndex = 0;

  for (const segment of sortedSegments) {
    const startIdx = Math.max(0, Math.min(segment.startIndex, route.length - 1));
    const endIdx = Math.max(0, Math.min(segment.endIndex, route.length - 1));

    // Add unpainted section before this segment
    if (currentIndex < startIdx) {
      features.push({
        type: 'Feature',
        properties: { color: UNPAINTED_COLOR, type: 'unpainted' },
        geometry: {
          type: 'LineString',
          coordinates: route
            .slice(currentIndex, startIdx + 1)
            .map((c) => [c.longitude, c.latitude]),
        },
      });
    }

    // Add painted segment
    if (startIdx <= endIdx) {
      features.push({
        type: 'Feature',
        properties: {
          color: getFeelingColor(segment.feeling),
          type: 'painted',
          feeling: segment.feeling,
        },
        geometry: {
          type: 'LineString',
          coordinates: route
            .slice(startIdx, endIdx + 1)
            .map((c) => [c.longitude, c.latitude]),
        },
      });
    }

    currentIndex = endIdx;
  }

  // Add remaining unpainted section
  if (currentIndex < route.length - 1) {
    features.push({
      type: 'Feature',
      properties: { color: UNPAINTED_COLOR, type: 'unpainted' },
      geometry: {
        type: 'LineString',
        coordinates: route
          .slice(currentIndex)
          .map((c) => [c.longitude, c.latitude]),
      },
    });
  }

  // If no segments, show entire route as unpainted
  if (sortedSegments.length === 0) {
    features.push({
      type: 'Feature',
      properties: { color: UNPAINTED_COLOR, type: 'unpainted' },
      geometry: {
        type: 'LineString',
        coordinates: route.map((c) => [c.longitude, c.latitude]),
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Build markers for start and end points
 */
function buildMarkers(route: Coordinate[]): GeoJSON.FeatureCollection {
  if (route.length < 1) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: GeoJSON.Feature[] = [];

  // Start marker
  features.push({
    type: 'Feature',
    properties: { type: 'start' },
    geometry: {
      type: 'Point',
      coordinates: [route[0].longitude, route[0].latitude],
    },
  });

  // End marker
  if (route.length > 1) {
    const lastPoint = route[route.length - 1];
    features.push({
      type: 'Feature',
      properties: { type: 'end' },
      geometry: {
        type: 'Point',
        coordinates: [lastPoint.longitude, lastPoint.latitude],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Calculate bounds for the route
 */
function calculateBounds(
  route: Coordinate[]
): [[number, number], [number, number]] | null {
  if (route.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const coord of route) {
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

const RatingMap = forwardRef<RatingMapRef, RatingMapProps>(
  ({ route: rawRoute, segments, previewSegment, style, onMapReady }, ref) => {
    const { colors, isDark } = useTheme();
    const mapRef = useRef<RNMapView>(null);
    const cameraRef = useRef<Camera>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    // Filter out invalid coordinates to prevent Mapbox errors
    const route = filterValidCoordinates(rawRoute);

    // Build GeoJSON data
    const segmentFeatures = buildSegmentFeatures(route, segments, previewSegment);
    const markerFeatures = buildMarkers(route);

    // Calculate initial camera position
    const bounds = calculateBounds(route);
    const defaultCenter: [number, number] = [-0.1276, 51.5074]; // Default to London
    const initialCenter: [number, number] =
      route.length > 0
        ? [route[0].longitude, route[0].latitude]
        : defaultCenter;

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getRouteScreenPoints: async () => {
        if (!mapRef.current) return [];

        try {
          const points: { x: number; y: number }[] = [];
          for (const coord of route) {
            const point = await mapRef.current.getPointInView([
              coord.longitude,
              coord.latitude,
            ]);
            points.push({ x: point[0], y: point[1] });
          }
          return points;
        } catch (error) {
          console.error('[RatingMap] Error getting screen points:', error);
          return [];
        }
      },
      fitToRoute: () => {
        if (bounds && cameraRef.current) {
          cameraRef.current.fitBounds(bounds[0], bounds[1], [80, 80, 80, 80], 500);
        }
      },
    }));

    // Fit to route on mount
    useEffect(() => {
      if (isMapReady && bounds && cameraRef.current) {
        setTimeout(() => {
          cameraRef.current?.fitBounds(bounds[0], bounds[1], [80, 80, 80, 80], 500);
        }, 100);
      }
    }, [isMapReady, bounds]);

    const handleMapLoaded = useCallback(() => {
      setIsMapReady(true);
      onMapReady?.();
    }, [onMapReady]);

    const mapStyle = isDark
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/outdoors-v12';

    return (
      <View style={[styles.container, style]}>
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={mapStyle}
          onDidFinishLoadingMap={handleMapLoaded}
          scrollEnabled={true}
          zoomEnabled={true}
          rotateEnabled={true}
          pitchEnabled={false}
        >
          <Camera
            ref={cameraRef}
            zoomLevel={14}
            centerCoordinate={initialCenter}
            animationDuration={0}
          />

          {/* Route segments with different colors */}
          {segmentFeatures.features.length > 0 && (
            <ShapeSource id="routeSegments" shape={segmentFeatures}>
              <LineLayer
                id="routeSegmentsLine"
                style={{
                  lineColor: ['get', 'color'],
                  lineWidth: 6,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </ShapeSource>
          )}

          {/* Start/End markers */}
          {markerFeatures.features.length > 0 && (
            <ShapeSource id="markers" shape={markerFeatures}>
              <CircleLayer
                id="markersCircle"
                style={{
                  circleRadius: 10,
                  circleColor: [
                    'match',
                    ['get', 'type'],
                    'start',
                    '#4CAF50',
                    'end',
                    '#F44336',
                    '#000000',
                  ],
                  circleStrokeColor: '#FFFFFF',
                  circleStrokeWidth: 3,
                }}
              />
            </ShapeSource>
          )}
        </Mapbox.MapView>
      </View>
    );
  }
);

RatingMap.displayName = 'RatingMap';

export default RatingMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
  },
  map: {
    flex: 1,
  },
});
