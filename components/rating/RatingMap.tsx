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
import { MapStyles } from '@/config/mapbox';
import { useMapLayer } from '@/lib/hooks/useMapLayer';
import type { Coordinate } from '@/types/location';
import type { RouteSegment, FeelingType } from '@/types/rating';
import { getFeelingColor, UNPAINTED_COLOR } from '@/types/rating';

/**
 * Validate a coordinate has valid numeric values
 * Handles both {latitude, longitude} and {lat, lng} formats
 */
function isValidCoordinate(coord: any): boolean {
  // Support both formats: {latitude, longitude} and {lat, lng}
  const lat = coord.latitude ?? coord.lat;
  const lng = coord.longitude ?? coord.lng;

  return (
    coord &&
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng)
  );
}

/**
 * Filter route to only include valid coordinates and normalize to standard format
 */
function filterValidCoordinates(route: any[]): Coordinate[] {
  return route
    .filter(isValidCoordinate)
    .map((coord) => ({
      latitude: coord.latitude ?? coord.lat,
      longitude: coord.longitude ?? coord.lng,
    }));
}

export interface RatingMapRef {
  getRouteScreenPoints: () => Promise<{ x: number; y: number }[]>;
  fitToRoute: () => void;
}

interface RatingMapProps {
  route: Coordinate[];
  segments: RouteSegment[];
  previewSegment?: RouteSegment | null;
  pendingReportLocation?: Coordinate | null; // Temporary marker for report confirmation
  style?: ViewStyle;
  onMapReady?: () => void;
  onCameraIdle?: () => void; // Fires when camera stops moving (for screen point sync)
  disableInteraction?: boolean; // Disable map scrolling when painting
  onLongPress?: (coordinate: Coordinate) => void; // Native long press on map
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

    // Add unpainted section before this segment (only if there's actually a gap)
    if (currentIndex + 1 < startIdx) {
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
      // If this segment is adjacent to the previous one (no gap), start from the previous
      // end point to create an overlap and ensure smooth visual connection
      const actualStartIdx = (currentIndex === startIdx - 1) ? currentIndex : startIdx;

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
            .slice(actualStartIdx, endIdx + 1)
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
  ({ route: rawRoute, segments, previewSegment, pendingReportLocation, style, onMapReady, onCameraIdle, disableInteraction = false, onLongPress }, ref) => {
    const { colors, isDark } = useTheme();
    const { selectedLayer } = useMapLayer(isDark);
    const mapRef = useRef<RNMapView>(null);
    const cameraRef = useRef<Camera>(null);
    const cameraIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        // Ensure map is ready and ref is valid
        if (!mapRef.current || !isMapReady) {
          return [];
        }

        try {
          const points: { x: number; y: number }[] = [];
          for (const coord of route) {
            const point = await mapRef.current.getPointInView([
              coord.longitude,
              coord.latitude,
            ]);
            if (point) {
              points.push({ x: point[0], y: point[1] });
            }
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

    // Fit to route on initial mount only
    const hasFitRef = useRef(false);
    useEffect(() => {
      if (isMapReady && bounds && cameraRef.current && !hasFitRef.current) {
        setTimeout(() => {
          cameraRef.current?.fitBounds(bounds[0], bounds[1], [80, 80, 80, 80], 500);
          hasFitRef.current = true;
        }, 100);
      }
    }, [isMapReady, bounds]);

    const handleMapLoaded = useCallback(() => {
      setIsMapReady(true);
      onMapReady?.();
    }, [onMapReady]);

    // Handle native long press on map - find nearest point on route
    const handleMapLongPress = useCallback((feature: GeoJSON.Feature) => {
      if (!onLongPress || route.length === 0) return;

      // Extract coordinates from the feature
      const geometry = feature.geometry as GeoJSON.Point;
      if (!geometry || geometry.type !== 'Point') return;

      const [lng, lat] = geometry.coordinates;

      // Find nearest point on route
      let minDist = Infinity;
      let nearestIdx = 0;

      for (let i = 0; i < route.length; i++) {
        const coord = route[i];
        // Simple euclidean distance (good enough for nearby points)
        const dist = Math.sqrt(
          Math.pow(coord.longitude - lng, 2) + Math.pow(coord.latitude - lat, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }

      // Use nearest route point for the report
      onLongPress(route[nearestIdx]);
    }, [onLongPress, route]);

    // Handle camera changes - debounce to detect when camera settles
    // Only trigger after map is ready to avoid premature calls
    const handleCameraChanged = useCallback(() => {
      if (!isMapReady) return;

      if (cameraIdleTimeoutRef.current) {
        clearTimeout(cameraIdleTimeoutRef.current);
      }
      cameraIdleTimeoutRef.current = setTimeout(() => {
        onCameraIdle?.();
      }, 300);
    }, [onCameraIdle, isMapReady]);

    // Convert selected layer to Mapbox style URL
    const getStyleURL = (layer: typeof selectedLayer): string => {
      switch (layer) {
        case 'light':
          return MapStyles.LIGHT;
        case 'dark':
          return MapStyles.DARK;
        case 'streets':
          return MapStyles.STREETS;
        case 'outdoors':
          return MapStyles.OUTDOORS;
        case 'satellite':
          return MapStyles.SATELLITE;
        default:
          return isDark ? MapStyles.DARK : MapStyles.LIGHT;
      }
    };

    const mapStyle = getStyleURL(selectedLayer);

    return (
      <View style={[styles.container, style]}>
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={mapStyle}
          onDidFinishLoadingMap={handleMapLoaded}
          onCameraChanged={handleCameraChanged}
          onLongPress={handleMapLongPress}
          scrollEnabled={!disableInteraction}
          zoomEnabled={!disableInteraction}
          rotateEnabled={!disableInteraction}
          pitchEnabled={false}
          compassEnabled={false}
          logoEnabled={false}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: initialCenter,
              zoomLevel: 14,
            }}
          />

          {/* Route segments with different colors */}
          {segmentFeatures.features.length > 0 && (
            <ShapeSource id="routeSegments" shape={segmentFeatures}>
              <LineLayer
                id="routeSegmentsLine"
                style={{
                  lineColor: ['get', 'color'],
                  lineWidth: 8,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.9,
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

          {/* Pending report location marker */}
          {pendingReportLocation && (
            <ShapeSource
              id="pendingReportMarker"
              shape={{
                type: 'Feature',
                properties: { type: 'pending-report' },
                geometry: {
                  type: 'Point',
                  coordinates: [pendingReportLocation.longitude, pendingReportLocation.latitude],
                },
              }}
            >
              <CircleLayer
                id="pendingReportCircle"
                style={{
                  circleRadius: 14,
                  circleColor: '#FF6B6B',
                  circleStrokeColor: '#FFFFFF',
                  circleStrokeWidth: 3,
                  circleOpacity: 0.9,
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
