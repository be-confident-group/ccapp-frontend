/**
 * Location permissions hook
 */

import { useState, useEffect } from 'react';
import * as ExpoLocation from 'expo-location';
import type { Location, LocationPermissionStatus } from '@/types';

interface UseLocationReturn {
  location: Location | null;
  permissionStatus: LocationPermissionStatus;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<Location | null>;
}

/**
 * Hook for managing location permissions and getting current location
 */
export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<Location | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('undetermined');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check initial permission status
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  /**
   * Check current permission status
   */
  const checkPermissionStatus = async () => {
    try {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      setPermissionStatus(mapPermissionStatus(status));
    } catch (err) {
      console.error('[useLocation] Error checking permission:', err);
      setError('Failed to check location permission');
    }
  };

  /**
   * Request location permission
   */
  const requestPermission = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      const mappedStatus = mapPermissionStatus(status);
      setPermissionStatus(mappedStatus);

      if (status === ExpoLocation.PermissionStatus.GRANTED) {
        // Get location immediately after permission granted
        await getCurrentLocation();
        return true;
      }

      return false;
    } catch (err) {
      console.error('[useLocation] Error requesting permission:', err);
      setError('Failed to request location permission');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get current location
   */
  const getCurrentLocation = async (): Promise<Location | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check permission first
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== ExpoLocation.PermissionStatus.GRANTED) {
        setError('Location permission not granted');
        return null;
      }

      const expoLocation = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });

      const loc: Location = {
        latitude: expoLocation.coords.latitude,
        longitude: expoLocation.coords.longitude,
        altitude: expoLocation.coords.altitude,
        accuracy: expoLocation.coords.accuracy,
        altitudeAccuracy: expoLocation.coords.altitudeAccuracy,
        heading: expoLocation.coords.heading,
        speed: expoLocation.coords.speed,
        timestamp: expoLocation.timestamp,
      };

      setLocation(loc);
      return loc;
    } catch (err) {
      console.error('[useLocation] Error getting location:', err);
      setError('Failed to get current location');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    location,
    permissionStatus,
    isLoading,
    error,
    requestPermission,
    getCurrentLocation,
  };
}

/**
 * Map Expo permission status to our type
 */
function mapPermissionStatus(
  status: ExpoLocation.PermissionStatus
): LocationPermissionStatus {
  switch (status) {
    case ExpoLocation.PermissionStatus.GRANTED:
      return 'granted';
    case ExpoLocation.PermissionStatus.DENIED:
      return 'denied';
    case ExpoLocation.PermissionStatus.UNDETERMINED:
      return 'undetermined';
    default:
      return 'undetermined';
  }
}
