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
import { mockCommunityTrips, mockPersonalTrips, mockUserLocation } from '@/lib/utils/mockMapData';
import type { Trip } from '@/types';
import { LineLayer, ShapeSource } from '@rnmapbox/maps';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  const [selectedLayer, setSelectedLayer] = useState<MapLayer>('streets');
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const mapViewRef = React.useRef<any>(null);

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

  // Determine which trips to show based on mode
  const getTripsToDisplay = () => {
    if (viewMode === 'heatmap') {
      return heatmapMode === 'personal' ? mockPersonalTrips : mockCommunityTrips;
    }
    // For feedback mode, we'll show routes but add markers in Phase 5
    return heatmapMode === 'personal' ? mockPersonalTrips : mockCommunityTrips;
  };

  const tripsToDisplay = getTripsToDisplay();

  const handleBottomSheetOption = (option: string) => {
    console.log('[MapsScreen] Bottom sheet option pressed:', option);
    // Handle different options (routes, elevation, surface, difficulty)
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
          {/* Render trip routes based on selected mode */}
          {tripsToDisplay.map((trip) => (
            <TripRoute key={trip.id} trip={trip} colors={colors} />
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
          onLayerChange={setSelectedLayer}
          onFindLocation={handleFindLocation}
          on3DToggle={() => {}}
          is3DEnabled={false}
        />

        {/* Bottom sheet for additional options */}
        <MapBottomSheet
          onOptionPress={handleBottomSheetOption}
          onExpandChange={setIsBottomSheetExpanded}
        />
      </MapContainer>
    </GestureHandlerRootView>
  );
}

/**
 * Component to render a single trip route on the map
 */
function TripRoute({ trip, colors }: { trip: Trip; colors: any }) {
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
          coordinates: trip.route.map((coord) => [coord.longitude, coord.latitude]),
        },
      },
    ],
  };

  // Color based on trip type
  const lineColor = trip.type === 'cycle' ? colors.primary : colors.accent;

  return (
    <ShapeSource id={`route-${trip.id}`} shape={routeGeoJSON}>
      <LineLayer
        id={`route-line-${trip.id}`}
        style={{
          lineColor,
          lineWidth: 3,
          lineOpacity: 0.7,
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
