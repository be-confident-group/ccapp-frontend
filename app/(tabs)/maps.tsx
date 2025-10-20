/**
 * Maps Screen - Main map view with route visualization
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { ShapeSource, LineLayer } from '@rnmapbox/maps';
import { MapContainer } from '@/components/maps/MapContainer';
import { MapView } from '@/components/maps/MapView';
import { LocationPermissionPrompt } from '@/components/maps/LocationPermissionPrompt';
import { useLocation } from '@/lib/hooks/useLocation';
import { mockPersonalTrips, mockUserLocation } from '@/lib/utils/mockMapData';
import { useTheme } from '@/contexts/ThemeContext';
import type { Trip } from '@/types';

export default function MapsScreen() {
  const { colors } = useTheme();
  const { permissionStatus, requestPermission, isLoading } = useLocation();

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

  return (
    <MapContainer>
      <MapView
        region={{
          latitude: mockUserLocation.latitude,
          longitude: mockUserLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showUserLocation
        followUserLocation={false}
      >
        {/* Render all trip routes */}
        {mockPersonalTrips.map((trip) => (
          <TripRoute key={trip.id} trip={trip} colors={colors} />
        ))}
      </MapView>
    </MapContainer>
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
