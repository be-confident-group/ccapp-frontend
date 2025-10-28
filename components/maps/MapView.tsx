/**
 * MapView wrapper component for Mapbox GL
 */

import { getMapStyle, MapStyles } from '@/config/mapbox';
import { useTheme } from '@/contexts/ThemeContext';
import type { Region } from '@/types';
import { Camera, RasterDemSource, MapView as RNMapboxMapView, Terrain } from '@rnmapbox/maps';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { CustomUserLocation } from './CustomUserLocation';

export type MapLayer = 'light' | 'dark' | 'outdoors' | 'satellite' | 'streets';

export interface MapViewRef {
  centerOnUserLocation: () => void;
  toggle3D: () => void;
  is3DEnabled: boolean;
  resetNorth: () => void;
}

interface MapViewProps {
  children?: React.ReactNode;
  region?: Region;
  onRegionChange?: (region: Region) => void;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
  selectedLayer?: MapLayer;
  style?: any;
  onHeadingChange?: (heading: number) => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(({
  children,
  region,
  onRegionChange,
  showUserLocation = true,
  followUserLocation = false,
  selectedLayer,
  style,
  onHeadingChange,
}, ref) => {
  const { isDark } = useTheme();
  const mapRef = useRef<RNMapboxMapView>(null);
  const cameraRef = useRef<Camera>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Get map style based on user selection or theme
  const getStyleURL = () => {
    if (selectedLayer) {
      const styleMap: Record<MapLayer, string> = {
        light: MapStyles.LIGHT,
        dark: MapStyles.DARK,
        streets: MapStyles.STREETS,
        outdoors: MapStyles.OUTDOORS,
        satellite: MapStyles.SATELLITE_STREETS,
      };
      return styleMap[selectedLayer];
    }
    return getMapStyle(isDark);
  };

  const mapStyleURL = getStyleURL();

  // Reset map loaded state when style changes
  useEffect(() => {
    setIsMapLoaded(false);
  }, [mapStyleURL]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    centerOnUserLocation: () => {
      if (userLocation && cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: userLocation,
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    },
    toggle3D: () => {
      // No-op for now
    },
    is3DEnabled: false,
    resetNorth: () => {
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          heading: 0,
          animationDuration: 500,
        });
      }
    },
  }));

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
      compassEnabled={true}
      compassPosition={{ bottom: 140, right: 16 }}
      compassFadeWhenNorth={true}
      scaleBarEnabled={true}
      scaleBarPosition={{ bottom: 110, left: 8 }}
      logoEnabled={true}
      logoPosition={{ bottom: 140, left: 8 }}
      attributionEnabled={false}
      onCameraChanged={(state) => {
        if (onHeadingChange && state.properties.heading !== undefined) {
          onHeadingChange(state.properties.heading);
        }
      }}
      onDidFinishLoadingMap={() => {
        setIsMapLoaded(true);
      }}
      onMapLoadingError={() => {
        console.warn('[MapView] Failed to load map');
      }}
    >
      <Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: defaultCenter,
          zoomLevel: defaultZoom,
        }}
      />

      {/* Enable terrain for outdoors style */}
      {selectedLayer === 'outdoors' && (
        <>
          <RasterDemSource
            id="mapbox-dem"
            url="mapbox://mapbox.mapbox-terrain-dem-v1"
            tileSize={514}
            maxZoomLevel={14}
          />
          <Terrain sourceID="mapbox-dem" style={{ exaggeration: 1.5 }} />
        </>
      )}

      {showUserLocation && isMapLoaded && (
        <CustomUserLocation
          onLocationUpdate={(coords) => {
            setUserLocation(coords);
          }}
        />
      )}

      {isMapLoaded && children}
    </RNMapboxMapView>
  );
});

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
