/**
 * MapView wrapper component for Mapbox GL
 */

import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import Mapbox, { Camera, MapView as RNMapboxMapView, UserLocation } from '@rnmapbox/maps';
import { useTheme } from '@/contexts/ThemeContext';
import { getMapStyle } from '@/config/mapbox';
import type { Region } from '@/types';

interface MapViewProps {
  children?: React.ReactNode;
  region?: Region;
  onRegionChange?: (region: Region) => void;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
  style?: any;
}

export function MapView({
  children,
  region,
  onRegionChange,
  showUserLocation = true,
  followUserLocation = false,
  style,
}: MapViewProps) {
  const { isDark } = useTheme();
  const mapRef = useRef<RNMapboxMapView>(null);
  const cameraRef = useRef<Camera>(null);

  // Get theme-aware map style
  const mapStyleURL = getMapStyle(isDark);

  // Default center (London) if no region provided
  const defaultCenter = region
    ? [region.longitude, region.latitude]
    : [-0.1278, 51.5074]; // London

  const defaultZoom = region ? calculateZoomLevel(region) : 12;

  return (
    <RNMapboxMapView
      ref={mapRef}
      style={[styles.map, style]}
      styleURL={mapStyleURL}
      compassEnabled
      compassViewPosition={3} // Top right
      scaleBarEnabled={false}
      logoEnabled={false}
      attributionEnabled
      attributionPosition={{ bottom: 8, right: 8 }}
    >
      <Camera
        ref={cameraRef}
        centerCoordinate={defaultCenter}
        zoomLevel={defaultZoom}
        animationMode="flyTo"
        animationDuration={1000}
        followUserLocation={followUserLocation}
      />

      {showUserLocation && (
        <UserLocation
          visible={true}
          showsUserHeadingIndicator
          minDisplacement={10}
        />
      )}

      {children}
    </RNMapboxMapView>
  );
}

/**
 * Calculate zoom level from region delta
 */
function calculateZoomLevel(region: Region): number {
  // Rough approximation: smaller delta = higher zoom
  const maxDelta = Math.max(region.latitudeDelta, region.longitudeDelta);
  if (maxDelta > 10) return 6;
  if (maxDelta > 5) return 8;
  if (maxDelta > 2) return 10;
  if (maxDelta > 1) return 11;
  if (maxDelta > 0.5) return 12;
  if (maxDelta > 0.1) return 13;
  if (maxDelta > 0.05) return 14;
  return 15;
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
