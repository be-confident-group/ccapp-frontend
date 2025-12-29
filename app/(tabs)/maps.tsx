/**
 * Maps Screen - Main map view with route visualization
 */

import { LocationPermissionPrompt } from '@/components/maps/LocationPermissionPrompt';
import { MapBottomSheet } from '@/components/maps/MapBottomSheet';
import { MapContainer } from '@/components/maps/MapContainer';
import { MapControls } from '@/components/maps/MapControls';
import { MapLayer } from '@/components/maps/MapLayerSelector';
import { MapView } from '@/components/maps/MapView';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/lib/hooks/useLocation';
import { useMapMode } from '@/lib/hooks/useMapMode';
import { mockUserLocation } from '@/lib/utils/mockMapData';
import { LineLayer, ShapeSource } from '@rnmapbox/maps';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TripManager } from '@/lib/services/TripManager';
import { parseRouteData } from '@/lib/utils/geoCalculations';
import { getTripTypeColor } from '@/types/trip';
import type { Trip as DBTrip } from '@/lib/database/db';

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

  // Layer selector state - default to theme-appropriate style
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>(isDark ? 'dark' : 'light');
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [recentTrips, setRecentTrips] = useState<DBTrip[]>([]);
  const mapViewRef = useRef<any>(null);

  // Track if user has manually changed the layer
  const hasUserChangedLayer = useRef(false);

  // Load recent trips for map display
  useEffect(() => {
    loadRecentTrips();
  }, []);

  const loadRecentTrips = async () => {
    try {
      const trips = await TripManager.getRecentTrips(10);
      setRecentTrips(trips);
    } catch (error) {
      console.error('[MapsScreen] Error loading recent trips:', error);
    }
  };

  // Auto-update layer based on theme, but only if user hasn't manually changed it
  useEffect(() => {
    if (!hasUserChangedLayer.current) {
      setSelectedLayer(isDark ? 'dark' : 'light');
    }
  }, [isDark]);

  // Handle layer change from user interaction
  const handleLayerChange = (layer: MapLayer) => {
    hasUserChangedLayer.current = true;
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
          onViewModeChange={setViewMode}
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
