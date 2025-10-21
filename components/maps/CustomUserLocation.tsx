/**
 * Custom user location component using Expo Location
 * This avoids issues with the native Mapbox UserLocation module
 */

import { CircleLayer, ShapeSource } from '@rnmapbox/maps';
import * as ExpoLocation from 'expo-location';
import React, { useEffect, useState } from 'react';

interface CustomUserLocationProps {
  onLocationUpdate?: (coords: [number, number]) => void;
}

export function CustomUserLocation({ onLocationUpdate }: CustomUserLocationProps) {
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number>(0);

  useEffect(() => {
    let subscription: ExpoLocation.LocationSubscription | null = null;

    const startTracking = async () => {
      try {
        // Check permission
        const { status } = await ExpoLocation.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[CustomUserLocation] Location permission not granted');
          return;
        }

        // Get initial location
        const initialLocation = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.High,
        });
        
        const coords: [number, number] = [
          initialLocation.coords.longitude,
          initialLocation.coords.latitude,
        ];
        setLocation(coords);
        if (onLocationUpdate) {
          onLocationUpdate(coords);
        }

        // Watch location updates
        subscription = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 10,
          },
          (newLocation) => {
            const newCoords: [number, number] = [
              newLocation.coords.longitude,
              newLocation.coords.latitude,
            ];
            setLocation(newCoords);
            if (newLocation.coords.heading !== null) {
              setHeading(newLocation.coords.heading);
            }
            if (onLocationUpdate) {
              onLocationUpdate(newCoords);
            }
          }
        );
      } catch (error) {
        console.error('[CustomUserLocation] Error tracking location:', error);
      }
    };

    startTracking();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [onLocationUpdate]);

  if (!location) {
    return null;
  }

  // Create GeoJSON for user location
  const userLocationGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: location,
        },
      },
    ],
  };

  return (
    <ShapeSource id="user-location-source" shape={userLocationGeoJSON}>
      {/* Outer pulse circle */}
      <CircleLayer
        id="user-location-pulse"
        style={{
          circleRadius: 20,
          circleColor: '#3b82f6',
          circleOpacity: 0.2,
          circlePitchAlignment: 'map',
        }}
      />
      {/* Accuracy circle */}
      <CircleLayer
        id="user-location-accuracy"
        style={{
          circleRadius: 15,
          circleColor: '#3b82f6',
          circleOpacity: 0.15,
          circlePitchAlignment: 'map',
        }}
      />
      {/* Center dot */}
      <CircleLayer
        id="user-location-dot"
        style={{
          circleRadius: 8,
          circleColor: '#3b82f6',
          circleStrokeWidth: 3,
          circleStrokeColor: '#ffffff',
          circlePitchAlignment: 'map',
        }}
      />
    </ShapeSource>
  );
}

