/**
 * Maps Screen - Main map view with route visualization
 */

import { LocationPermissionPrompt } from '@/components/maps/LocationPermissionPrompt';
import { MapBottomSheet } from '@/components/maps/MapBottomSheet';
import { MapContainer } from '@/components/maps/MapContainer';
import { MapControls } from '@/components/maps/MapControls';
import { MapLayer } from '@/components/maps/MapLayerSelector';
import { MapView } from '@/components/maps/MapView';
import { ReportIssueModal } from '@/components/maps/ReportIssueModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/lib/hooks/useLocation';
import { useMapMode } from '@/lib/hooks/useMapMode';
import { useMapLayer } from '@/lib/hooks/useMapLayer';
import { mockUserLocation } from '@/lib/utils/mockMapData';
import { LineLayer, ShapeSource } from '@rnmapbox/maps';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TripManager } from '@/lib/services/TripManager';
import { parseRouteData } from '@/lib/utils/geoCalculations';
import { getTripTypeColor } from '@/types/trip';
import type { Trip as DBTrip } from '@/lib/database/db';
import { useTrips } from '@/lib/hooks/useTrips';
import type { ApiTrip } from '@/lib/api/trips';
import { useFocusEffect } from 'expo-router';
import type { MapViewMode } from '@/types/mapMode';

// Transform backend ApiTrip to local Trip format
function transformApiTripToLocal(apiTrip: ApiTrip): DBTrip {
  return {
    id: apiTrip.client_id,
    user_id: apiTrip.user.toString(),
    type: apiTrip.type,
    status: apiTrip.status,
    is_manual: apiTrip.is_manual ? 1 : 0,
    start_time: new Date(apiTrip.start_timestamp).getTime(),
    end_time: new Date(apiTrip.end_timestamp).getTime(),
    distance: apiTrip.distance * 1000, // Convert km to meters
    duration: apiTrip.duration,
    avg_speed: apiTrip.average_speed,
    max_speed: 0,
    elevation_gain: apiTrip.elevation_gain || 0,
    calories: 0,
    co2_saved: apiTrip.co2_saved,
    notes: apiTrip.notes || null,
    route_data: apiTrip.route ? JSON.stringify(apiTrip.route) : null,
    created_at: new Date(apiTrip.created_at).getTime(),
    updated_at: new Date(apiTrip.updated_at).getTime(),
    synced: 1,
  };
}

export default function MapsScreen() {
  const { colors, isDark } = useTheme();
  const { permissionStatus, requestPermission, isLoading } = useLocation();
  const {
    viewMode,
    heatmapMode,
    feedbackMode,
    setViewMode,
    setHeatmapMode,
    setFeedbackMode,
  } = useMapMode();

  // Use persistent map layer hook
  const { selectedLayer, setSelectedLayer } = useMapLayer(isDark);

  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportCoordinates, setReportCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapViewRef = useRef<any>(null);

  // Fetch trips from backend (including active trips that weren't properly stopped)
  const { data: backendTrips, refetch } = useTrips();

  // Refetch trips when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Transform and get recent trips (last 10)
  const recentTrips = useMemo(() => {
    if (!backendTrips) return [];

    return backendTrips
      .filter((trip) => trip.route && trip.route.length > 0) // Only trips with routes
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(transformApiTripToLocal);
  }, [backendTrips]);

  // Handle layer change from user interaction
  const handleLayerChange = (layer: MapLayer) => {
    setSelectedLayer(layer);
  };

  // Show permission prompt if not granted
  if (permissionStatus !== 'granted') {
    return (
      <MapContainer>
        <MapView
          region={{
            latitude: mockUserLocation.latitude,
            longitude: mockUserLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showUserLocation={false}
        />
        <LocationPermissionPrompt
          onRequestPermission={requestPermission}
          isLoading={isLoading}
        />
      </MapContainer>
    );
  }

  const handleTripPress = async (tripId: string) => {
    console.log('[MapsScreen] Trip pressed:', tripId);
    setSelectedTripId(tripId);

    // Find the trip and center the map on it
    const trip = recentTrips.find(t => t.id === tripId);
    if (trip && trip.route_data && mapViewRef.current) {
      try {
        const route = parseRouteData(trip.route_data);
        if (route.length > 0) {
          // Calculate bounds for the route
          const lats = route.map(c => c.latitude);
          const lngs = route.map(c => c.longitude);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          // Use fitBounds for smoother animation
          // Format: [longitude, latitude]
          const ne: [number, number] = [maxLng, maxLat];
          const sw: [number, number] = [minLng, minLat];

          // Use generous padding to show more context around the trip
          mapViewRef.current.fitBounds({ ne, sw }, 80, 800);
        }
      } catch (error) {
        console.error('[MapsScreen] Error parsing route data:', error);
      }
    }
  };

  const handleFindLocation = () => {
    if (mapViewRef.current) {
      mapViewRef.current.centerOnUserLocation();
    }
  };

  const handleMapLongPress = useCallback((event: any) => {
    const { geometry } = event;
    if (geometry && geometry.coordinates) {
      const [longitude, latitude] = geometry.coordinates;
      setReportCoordinates({ latitude, longitude });
      setIsReportModalVisible(true);
    }
  }, []);

  const handleViewModeChange = useCallback((mode: MapViewMode) => {
    if (mode === 'heatmap') {
      Alert.alert(
        'Coming Soon',
        'Heatmap feature will be available soon!',
        [{ text: 'OK', style: 'default' }]
      );
    } else {
      setViewMode(mode);
    }
  }, [setViewMode]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <MapContainer>
        <MapView
          ref={mapViewRef}
          region={{
            latitude: mockUserLocation.latitude,
            longitude: mockUserLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showUserLocation
          followUserLocation={false}
          selectedLayer={selectedLayer}
          onLongPress={handleMapLongPress}
        >
          {/* Render recent trips from database */}
          {recentTrips.map((trip) => (
            <DBTripRoute key={trip.id} trip={trip} colors={colors} isSelected={selectedTripId === trip.id} />
          ))}
        </MapView>

        {/* Map controls overlay */}
        <MapControls
          viewMode={viewMode}
          heatmapMode={heatmapMode}
          feedbackMode={feedbackMode}
          selectedLayer={selectedLayer}
          onViewModeChange={handleViewModeChange}
          onHeatmapModeChange={setHeatmapMode}
          onFeedbackModeChange={setFeedbackMode}
          onLayerChange={handleLayerChange}
          onFindLocation={handleFindLocation}
          on3DToggle={() => {}}
          is3DEnabled={false}
        />

        {/* Bottom sheet for additional options */}
        <MapBottomSheet
          onTripPress={handleTripPress}
          onExpandChange={setIsBottomSheetExpanded}
          selectedTripId={selectedTripId}
          trips={recentTrips}
        />

        {/* Report Issue Modal */}
        <ReportIssueModal
          visible={isReportModalVisible}
          coordinates={reportCoordinates}
          onClose={() => setIsReportModalVisible(false)}
        />
      </MapContainer>
    </GestureHandlerRootView>
  );
}

/**
 * Component to render a database trip route on the map
 */
function DBTripRoute({ trip, colors, isSelected }: { trip: DBTrip; colors: any; isSelected: boolean }) {
  // Parse route data
  let coordinates: Array<[number, number]> = [];

  try {
    if (trip.route_data) {
      const route = parseRouteData(trip.route_data);
      coordinates = route.map((coord) => [coord.longitude, coord.latitude]);
    }
  } catch (error) {
    console.error('[DBTripRoute] Error parsing route data:', error);
    return null;
  }

  if (coordinates.length < 2) {
    return null;
  }

  // Convert route to GeoJSON LineString
  const routeGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          tripType: trip.type,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates,
        },
      },
    ],
  };

  // Color based on trip type
  const lineColor = getTripTypeColor(trip.type);

  return (
    <ShapeSource id={`db-route-${trip.id}`} shape={routeGeoJSON}>
      <LineLayer
        id={`db-route-line-${trip.id}`}
        style={{
          lineColor,
          lineWidth: isSelected ? 6 : 4,
          lineOpacity: isSelected ? 1 : 0.6,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </ShapeSource>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
